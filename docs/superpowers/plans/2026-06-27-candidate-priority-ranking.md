# 候选优先级排序实施计划

> **给 agentic workers：** 必须使用子技能：按任务逐步实施时，使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`。步骤使用复选框（`- [ ]`）语法，方便跟踪执行状态。

**目标：** 为 Comment Doc Lens 增加一个保守的候选相关性排序层，让一行里存在多个有效符号时，插件优先展示最有阅读价值的行内文档。

**架构：** 保留当前的扫描、过滤、解析流水线，然后新增一个由 `hintBuilder` 调用的小型 `candidatePriority` 模块。`DocumentationResolver` 仍然只负责判断是否存在可展示文档；新层只在全局预算裁剪前给候选排序，并在解析完成后裁剪过于拥挤的同行提示。

**技术栈：** TypeScript、VS Code extension APIs、Node test runner、现有 `test/*.test.ts` 单元测试。

---

## 当前设计与新版设计对比

当前行为：

- `src/candidateScanner.ts` 从上到下、从左到右扫描可见文本。
- `src/hintBuilder.ts` 过滤声明和噪音候选，应用 `preferPropertyTail`，对完全相同位置的候选去重，按 `maxHintsPerRequest` 裁剪，解析文档，过滤过短或低词数摘要，对同一行重复摘要去重，然后返回行尾 hint。
- `src/documentationResolver.ts` 决定文档来源顺序：引用点 hover、定义处 hover，然后在 adapter 支持 fallback 时读取源码注释。
- 目前没有显式的方法、enum、属性优先级。过滤之后，扫描顺序是主要排序信号。

新版行为：

- 保留所有现有安全过滤和文档来源顺序。
- 基于局部语法上下文给候选增加相关性分数。
- 在 `maxHintsPerRequest` 裁剪前按相关性排序，让全局预算紧张时优先保留更有价值的符号。
- 新增配置化的同一行展示预算 `commentDocLens.maxHintsPerLine`，让拥挤行保留最高价值 hint，同时普通的双符号场景仍然可以同时展示。
- 分数相同时回退到原扫描顺序，保持行为可预测。

## 文件与职责

- 新建 `src/candidatePriority.ts`：纯评分、稳定排序、按行选择 hint 的辅助函数。
- 新建 `test/candidatePriority.test.ts`：集中覆盖评分和稳定排序。
- 修改 `src/hintBuilder.ts`：在全局预算裁剪前调用优先级辅助函数，并在同行去重后应用同行预算。
- 修改 `src/extension.ts`：读取 `commentDocLens.maxHintsPerLine`，并把它暴露到运行时配置和 diagnostics snapshot。
- 修改 `package.json`：新增配置项。
- 修改 `package.nls.json` 和 `package.nls.zh-cn.json`：新增本地化配置说明。
- 修改 `README.md` 和 `README_CN.md`：记录新版行为和配置项。
- 修改 `test/hintBuilder.test.ts`：覆盖预算压力、拥挤行裁剪、方法加 enum 同时保留、同分回退。
- 修改 `test/projectMetadata.test.ts`：把新配置纳入 metadata 检查。

## 评分模型

使用紧凑、透明的分数。具体数字只需要保证相对顺序稳定：

```ts
export const CANDIDATE_PRIORITY = {
  callTarget: 80,
  enumOrConstantMember: 75,
  propertyTail: 60,
  typeReference: 40,
  neutralReference: 20,
  receiverOrNamespace: 0
} as const;
```

上下文规则：

- `callTarget`：下一个非空白字符是 `(`，且该候选没有被声明过滤规则过滤。
- `enumOrConstantMember`：候选是 `.`, `?.` 或 `::` 之后的成员尾部，并且单词是 PascalCase、ALL_CAPS，或以大写字母开头。
- `propertyTail`：候选是 `.`, `?.` 或 `::` 之后的成员尾部，但不像 enum 或常量。
- `typeReference`：候选出现在 `:`, `as`, `new`, `extends`, `implements` 或 `instanceof` 上下文之后。
- `receiverOrNamespace`：候选后面紧跟 `.`, `?.` 或 `::`；这类候选大多已经被 `preferPropertyTail` 过滤，评分器仍将其作为低价值上下文处理。
- `neutralReference`：普通引用的默认分数。

## 任务 1：增加候选优先级单元测试

**文件：**

- 新建：`test/candidatePriority.test.ts`
- 任务 2 新建：`src/candidatePriority.ts`

- [ ] **步骤 1：编写失败测试文件**

创建 `test/candidatePriority.test.ts`，内容如下：

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import type { SymbolCandidate } from '../src/candidateScanner';
import {
  getCandidatePriorityScore,
  prioritizeCandidates,
  selectHintsForLineBudget,
  type PrioritizedHint
} from '../src/candidatePriority';

function candidate(word: string, lineText: string, occurrence: 'first' | 'last' = 'first'): SymbolCandidate {
  const startCharacter = occurrence === 'first'
    ? lineText.indexOf(word)
    : lineText.lastIndexOf(word);
  return {
    word,
    line: 0,
    startCharacter,
    endCharacter: startCharacter + word.length
  };
}

test('scores call targets and enum-like member tails above neutral references', () => {
  const line = 'const label = presenter.format(OrderStatus.Paid, fallback);';

  const formatScore = getCandidatePriorityScore(candidate('format', line), line);
  const paidScore = getCandidatePriorityScore(candidate('Paid', line), line);
  const fallbackScore = getCandidatePriorityScore(candidate('fallback', line), line);

  assert.equal(formatScore > fallbackScore, true);
  assert.equal(paidScore > fallbackScore, true);
});

test('keeps stable scan order when candidate scores tie', () => {
  const line = 'const label = alpha + beta;';
  const alpha = candidate('alpha', line);
  const beta = candidate('beta', line);

  const prioritized = prioritizeCandidates([alpha, beta], [line]);

  assert.deepEqual(prioritized.map((item) => item.word), ['alpha', 'beta']);
});

test('prioritizes member tail over receiver or namespace context', () => {
  const line = 'const label = OrderStatus.Paid;';
  const orderStatus = candidate('OrderStatus', line);
  const paid = candidate('Paid', line);

  const prioritized = prioritizeCandidates([orderStatus, paid], [line]);

  assert.deepEqual(prioritized.map((item) => item.word), ['Paid', 'OrderStatus']);
});

test('selects highest priority hints per line while leaving other lines intact', () => {
  const line = 'const label = presenter.format(OrderStatus.Paid, customer.displayName);';
  const hints: PrioritizedHint[] = [
    { line: 0, character: line.length, label: '// doc for displayName', tooltip: 'doc for displayName', candidate: candidate('displayName', line) },
    { line: 0, character: line.length, label: '// doc for format', tooltip: 'doc for format', candidate: candidate('format', line) },
    { line: 0, character: line.length, label: '// doc for Paid', tooltip: 'doc for Paid', candidate: candidate('Paid', line) },
    { line: 1, character: 12, label: '// doc for another line', tooltip: 'doc for another line', candidate: { word: 'other', line: 1, startCharacter: 0, endCharacter: 5 } }
  ];

  const selected = selectHintsForLineBudget(hints, [line, 'other();'], 2);

  assert.deepEqual(selected.map((hint) => hint.label), [
    '// doc for format',
    '// doc for Paid',
    '// doc for another line'
  ]);
});
```

- [ ] **步骤 2：运行聚焦测试，确认它失败**

运行：

```bash
npm test -- --test-name-pattern="candidate priority"
```

预期：失败，因为 `../src/candidatePriority` 尚不存在。

## 任务 2：实现候选优先级辅助模块

**文件：**

- 新建：`src/candidatePriority.ts`
- 测试：`test/candidatePriority.test.ts`

- [ ] **步骤 1：增加辅助模块**

创建 `src/candidatePriority.ts`：

```ts
import type { SymbolCandidate } from './candidateScanner';
import type { CommentHint } from './hintBuilder';

export interface PrioritizedHint extends CommentHint {
  candidate: SymbolCandidate;
}

export const CANDIDATE_PRIORITY = {
  callTarget: 80,
  enumOrConstantMember: 75,
  propertyTail: 60,
  typeReference: 40,
  neutralReference: 20,
  receiverOrNamespace: 0
} as const;

export function prioritizeCandidates(
  candidates: readonly SymbolCandidate[],
  lines: readonly string[]
): SymbolCandidate[] {
  return candidates
    .map((candidate, index) => ({
      candidate,
      index,
      score: getCandidatePriorityScore(candidate, lines[candidate.line] ?? '')
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((item) => item.candidate);
}

export function selectHintsForLineBudget(
  hints: readonly PrioritizedHint[],
  lines: readonly string[],
  maxHintsPerLine?: number
): PrioritizedHint[] {
  if (!maxHintsPerLine || maxHintsPerLine < 1) {
    return [...hints];
  }

  const byLine = new Map<number, Array<{ hint: PrioritizedHint; index: number; score: number }>>();
  hints.forEach((hint, index) => {
    const lineHints = byLine.get(hint.line) ?? [];
    lineHints.push({
      hint,
      index,
      score: getCandidatePriorityScore(hint.candidate, lines[hint.line] ?? '')
    });
    byLine.set(hint.line, lineHints);
  });

  const selected = new Set<number>();
  for (const lineHints of byLine.values()) {
    if (lineHints.length <= maxHintsPerLine) {
      lineHints.forEach((item) => selected.add(item.index));
      continue;
    }

    lineHints
      .slice()
      .sort((left, right) => right.score - left.score || left.index - right.index)
      .slice(0, maxHintsPerLine)
      .forEach((item) => selected.add(item.index));
  }

  return hints
    .map((hint, index) => ({ hint, index }))
    .filter((item) => selected.has(item.index))
    .sort((left, right) => {
      const leftScore = getCandidatePriorityScore(left.hint.candidate, lines[left.hint.line] ?? '');
      const rightScore = getCandidatePriorityScore(right.hint.candidate, lines[right.hint.line] ?? '');
      if (left.hint.line !== right.hint.line) {
        return left.hint.line - right.hint.line;
      }
      return rightScore - leftScore || left.index - right.index;
    })
    .map((item) => item.hint);
}

export function getCandidatePriorityScore(candidate: SymbolCandidate, line: string): number {
  if (isReceiverOrNamespace(candidate, line)) {
    return CANDIDATE_PRIORITY.receiverOrNamespace;
  }

  if (isCallTarget(candidate, line)) {
    return CANDIDATE_PRIORITY.callTarget;
  }

  if (isMemberTail(candidate, line)) {
    return looksEnumOrConstantLike(candidate.word)
      ? CANDIDATE_PRIORITY.enumOrConstantMember
      : CANDIDATE_PRIORITY.propertyTail;
  }

  if (isTypeReference(candidate, line)) {
    return CANDIDATE_PRIORITY.typeReference;
  }

  return CANDIDATE_PRIORITY.neutralReference;
}

function isCallTarget(candidate: SymbolCandidate, line: string): boolean {
  return nextNonWhitespace(line, candidate.endCharacter) === '(';
}

function isMemberTail(candidate: SymbolCandidate, line: string): boolean {
  const before = line.slice(0, candidate.startCharacter).trimEnd();
  return before.endsWith('.') || before.endsWith('?.') || before.endsWith('::');
}

function isReceiverOrNamespace(candidate: SymbolCandidate, line: string): boolean {
  const after = line.slice(candidate.endCharacter).trimStart();
  return after.startsWith('.') || after.startsWith('?.') || after.startsWith('::');
}

function isTypeReference(candidate: SymbolCandidate, line: string): boolean {
  const before = line.slice(0, candidate.startCharacter).trimEnd();
  return /(?::|(?:\bas|\bnew|\bextends|\bimplements|\binstanceof))\s*$/.test(before);
}

function looksEnumOrConstantLike(word: string): boolean {
  return /^[A-Z][A-Za-z0-9_]*$/.test(word) || /^[A-Z0-9_]+$/.test(word);
}

function nextNonWhitespace(line: string, startCharacter: number): string | undefined {
  for (let character = startCharacter; character < line.length; character++) {
    if (!/\s/.test(line[character])) {
      return line[character];
    }
  }

  return undefined;
}
```

- [ ] **步骤 2：运行聚焦测试**

运行：

```bash
npm test -- --test-name-pattern="candidate priority"
```

预期：新增候选优先级测试通过。

- [ ] **步骤 3：提交**

```bash
git add src/candidatePriority.ts test/candidatePriority.test.ts
git commit -m "feat(hints): add candidate priority scoring"
```

## 任务 3：把优先级接入 hint builder

**文件：**

- 修改：`src/hintBuilder.ts`
- 测试：`test/hintBuilder.test.ts`

- [ ] **步骤 1：编写失败的 hint builder 测试**

把这些测试追加到 `test/hintBuilder.test.ts`：

```ts
test('prioritizes method and enum candidates before applying max hint budget', async () => {
  const resolvedWords: string[] = [];
  const resolver: CommentHintResolver = {
    resolve: async (candidate) => {
      resolvedWords.push(candidate.word);
      return {
        summary: `doc for ${candidate.word}`,
        fullText: `doc for ${candidate.word}`,
        location: { uri: 'file:///order.ts', line: 1, character: 1 }
      };
    }
  };

  const hints = await buildCommentHints({
    lines: ['const label = localReference + presenter.format(OrderStatus.Paid);'],
    range: { startLine: 0, endLineInclusive: 0 },
    languageId: 'typescript',
    documentUri: 'file:///order.ts',
    documentVersion: 1,
    config: {
      enabled: true,
      languages: ['typescript'],
      maxHintsPerRequest: 2,
      minIdentifierLength: 2,
      preferPropertyTail: true,
      dedupeLineHints: true,
      resolveTimeoutMs: 750
    },
    resolver
  });

  assert.deepEqual(resolvedWords, ['format', 'Paid']);
  assert.deepEqual(hints.map((hint) => hint.label), ['// doc for format', '// doc for Paid']);
});

test('limits crowded same-line hints without hiding method plus enum pairs', async () => {
  const resolver: CommentHintResolver = {
    resolve: async (candidate) => ({
      summary: `doc for ${candidate.word}`,
      fullText: `doc for ${candidate.word}`,
      location: { uri: 'file:///order.ts', line: 1, character: 1 }
    })
  };

  const hints = await buildCommentHints({
    lines: ['const label = presenter.format(OrderStatus.Paid, customer.displayName);'],
    range: { startLine: 0, endLineInclusive: 0 },
    languageId: 'typescript',
    documentUri: 'file:///order.ts',
    documentVersion: 1,
    config: {
      enabled: true,
      languages: ['typescript'],
      maxHintsPerRequest: 20,
      maxHintsPerLine: 2,
      minIdentifierLength: 2,
      preferPropertyTail: true,
      dedupeLineHints: true,
      resolveTimeoutMs: 750
    },
    resolver
  });

  assert.deepEqual(hints.map((hint) => hint.label), ['// doc for format', '// doc for Paid']);
});
```

- [ ] **步骤 2：运行聚焦测试，确认它们失败**

运行：

```bash
npm test -- --test-name-pattern="prioritizes method|limits crowded"
```

预期：失败，因为 `hintBuilder` 仍然按扫描顺序裁剪候选，并且还没有 `maxHintsPerLine` 配置字段。

- [ ] **步骤 3：更新 `CommentDocLensConfig` 和候选流**

在 `src/hintBuilder.ts` 中导入辅助函数：

```ts
import {
  prioritizeCandidates,
  selectHintsForLineBudget,
  type PrioritizedHint
} from './candidatePriority';
```

增加配置字段：

```ts
  maxHintsPerLine?: number;
```

用优先级感知的候选选择替换当前候选选择：

```ts
  const filteredCandidates = dedupeCandidates(
    candidates.filter((candidate) => shouldResolveCandidate(candidate, input, languageAdapter))
  );
  const candidatesToResolve = prioritizeCandidates(filteredCandidates, input.lines)
    .slice(0, input.config.maxHintsPerRequest);
```

修改本地 hints 数组类型：

```ts
  const hints: PrioritizedHint[] = [];
```

创建 hint 时，内部始终保留 candidate 数据：

```ts
    const hint: PrioritizedHint = {
      line: candidate.line,
      character: getLineEndCharacter(input.lines, candidate.line),
      label: `${input.config.hintPrefix ?? '// '}${documentation.summary}`,
      tooltip: documentation.fullText,
      candidate
    };
```

在 `for` 循环之后，选择最终同行预算，并在调用方没有要求候选数据时移除 candidate：

```ts
  const selectedHints = selectHintsForLineBudget(hints, input.lines, input.config.maxHintsPerLine);
  return selectedHints.map((hint) => {
    if (input.includeCandidateData) {
      return hint;
    }

    const { candidate: _candidate, ...publicHint } = hint;
    return publicHint;
  });
```

移除 `buildCommentHints` 末尾现有的 `return hints;`。

- [ ] **步骤 4：运行聚焦测试**

运行：

```bash
npm test -- --test-name-pattern="prioritizes method|limits crowded|prefers the tail|dedupes repeated"
```

预期：通过。

- [ ] **步骤 5：提交**

```bash
git add src/hintBuilder.ts test/hintBuilder.test.ts
git commit -m "feat(hints): prioritize crowded line candidates"
```

## 任务 4：增加运行时配置

**文件：**

- 修改：`package.json`
- 修改：`package.nls.json`
- 修改：`package.nls.zh-cn.json`
- 修改：`src/extension.ts`
- 修改：`test/projectMetadata.test.ts`

- [ ] **步骤 1：增加 metadata 测试预期**

在 `test/projectMetadata.test.ts` 中，把 `commentDocLens.maxHintsPerLine` 加到预期配置键列表里，位置靠近 `commentDocLens.maxHintsPerRequest`。

预期相邻列表：

```ts
    'commentDocLens.maxHintsPerRequest',
    'commentDocLens.maxHintsPerLine',
    'commentDocLens.minIdentifierLength',
```

- [ ] **步骤 2：运行 metadata 测试，确认它失败**

运行：

```bash
npm test -- --test-name-pattern="project metadata"
```

预期：失败，因为 `package.json` 中尚未定义该配置。

- [ ] **步骤 3：增加 `commentDocLens.maxHintsPerLine` 配置**

在 `package.json` 中，把该配置加到 `commentDocLens.maxHintsPerRequest` 之后：

```json
        "commentDocLens.maxHintsPerLine": {
          "type": "number",
          "default": 3,
          "minimum": 1,
          "description": "%commentDocLens.configuration.maxHintsPerLine.description%"
        },
```

- [ ] **步骤 4：增加本地化说明**

在 `package.nls.json` 中增加：

```json
  "commentDocLens.configuration.maxHintsPerLine.description": "Maximum inline documentation hints shown on one source line after candidate priority ranking.",
```

在 `package.nls.zh-cn.json` 中增加：

```json
  "commentDocLens.configuration.maxHintsPerLine.description": "候选优先级排序后，同一源码行最多展示的行内文档提示数量。",
```

- [ ] **步骤 5：运行时读取配置**

在 `src/extension.ts` 的 `readCommentDocLensConfig()` 中增加 `maxHintsPerLine`：

```ts
    maxHintsPerLine: config.get<number>('maxHintsPerLine', 3),
```

在 `readDiagnosticsSettingsSnapshot()` 中增加：

```ts
    maxHintsPerLine: commentConfig.maxHintsPerLine,
```

- [ ] **步骤 6：运行 metadata 和编译检查**

运行：

```bash
npm test -- --test-name-pattern="project metadata"
npm run compile
```

预期：测试通过，编译成功。

- [ ] **步骤 7：提交**

```bash
git add package.json package.nls.json package.nls.zh-cn.json src/extension.ts test/projectMetadata.test.ts
git commit -m "feat(config): add per-line hint budget"
```

## 任务 5：记录优先级行为

**文件：**

- 修改：`README.md`
- 修改：`README_CN.md`

- [ ] **步骤 1：更新英文 README 配置表**

在 `README.md` 中，把这一行加到 `commentDocLens.maxHintsPerRequest` 之后：

```md
| `commentDocLens.maxHintsPerLine` | Limit same-line hints after candidate priority ranking. |
```

把这段简短说明加到配置表附近：

```md
When several documented symbols appear on one line, Comment Doc Lens ranks call targets and business-value member references before neutral references. It still shows different summaries together until the same-line limit is reached.
```

- [ ] **步骤 2：更新中文 README 配置表**

在 `README_CN.md` 中，把这一行加到 `commentDocLens.maxHintsPerRequest` 之后：

```md
| `commentDocLens.maxHintsPerLine` | 候选优先级排序后，限制同一行展示的提示数量。 |
```

把这段简短说明加到配置表附近：

```md
当同一行出现多个有文档的符号时，Comment Doc Lens 会优先保留调用目标和业务语义更强的成员引用，再保留普通引用。不同摘要仍可同时展示，直到达到同一行数量上限。
```

- [ ] **步骤 3：运行文档 metadata 检查**

运行：

```bash
npm run harness:check
```

预期：通过。

- [ ] **步骤 4：提交**

```bash
git add README.md README_CN.md
git commit -m "docs(hints): explain candidate priority ranking"
```

## 任务 6：完整验证

**文件：**

- 无额外源文件。

- [ ] **步骤 1：运行快速回归门禁**

运行：

```bash
npm test
```

预期：所有单元测试通过。

- [ ] **步骤 2：编译**

运行：

```bash
npm run compile
```

预期：TypeScript 编译成功。

- [ ] **步骤 3：打包证明**

运行：

```bash
npm run package -- --out /tmp/comment-doc-lens-priority-ranking.vsix
```

预期：VSIX 包生成在 `/tmp/comment-doc-lens-priority-ranking.vsix`。

- [ ] **步骤 4：harness drift 检查**

运行：

```bash
npm run harness:check
```

预期：通过。

- [ ] **步骤 5：如果验证修复产生了变更，则提交最终修复**

如果验证期间需要修复并产生文件变更，提交修复：

```bash
git add src test README.md README_CN.md package.json package.nls.json package.nls.zh-cn.json docs
git commit -m "fix(hints): stabilize candidate priority ranking"
```

如果验证后没有新增文件变更，不要创建空提交。

## 实施注意事项

- 本轮不要修改 `DocumentationResolver`。文档来源顺序保持为引用点 hover、定义处 hover，然后是源码注释 fallback。
- 本轮不要调用 `vscode.executeDocumentSymbolProvider` 或 `vscode.executeReferenceProvider`。旧的质量路线图把它们列为未来增强，但本计划保持排序逻辑同步且轻量。
- 不要因为这个功能提升任何语言支持等级。排序只改进展示选择，不构成语言服务 evidence。
- 保留 `preferPropertyTail` 行为。新的评分器会处理 receiver/namespace 上下文，但现有过滤仍然是防止容器符号噪音的第一道防线。
- 在按行裁剪之前继续做同一行重复摘要去重。重复摘要应先合并，再由优先级层判断某一行是否拥挤。

## 自检

- 需求覆盖：计划已对比当前扫描顺序行为和新的软优先级行为，包含评分、全局预算裁剪前排序、同行裁剪、配置、文档和测试/打包/harness 验证。
- 占位符扫描：没有 `TBD`、`TODO` 或未说明清楚的实施步骤。
- 类型一致性：`maxHintsPerLine`、`PrioritizedHint`、`prioritizeCandidates`、`selectHintsForLineBudget` 和 `getCandidatePriorityScore` 都在后续任务使用前完成定义。
