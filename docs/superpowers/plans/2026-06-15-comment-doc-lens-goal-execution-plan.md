# Comment Lens 0.3.0 后续目标执行计划

> **给 agentic workers：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 按任务执行本计划。所有步骤使用 checkbox（`- [ ]`）语法追踪。

**目标：** 基于已经合入的 0.3.0 多语言架构，继续打磨 Comment Lens 的文档、配置语义、可选交互能力、第二批语言质量和发布验证流程。

**架构：** 当前主分支已经包含 language adapter、语言支持等级、语言健康检查、语言支持矩阵、Python/Java/Rust/PHP experimental 支持，以及 C#/Ruby/Kotlin/Swift/C/C++ hover-only 支持。本计划不重复这些已完成工作，而是在现有 adapter 边界、`LanguageHealthService` 和 README/docs 用户契约之上做收敛。

**技术栈：** VS Code Extension API、TypeScript、Node test runner、`@vscode/test-electron`、VS Code hover/definition providers、VS Code inlay hints。

---

## 当前基线

本地代码已更新到远端最新主干：

`d4d6aef chore(main): release comment-doc-lens 0.3.0 (#11)`

主分支已经具备：

- `src/languages/languageAdapter.ts`
- `src/languages/languageRegistry.ts`
- `src/languageHealth.ts`
- `docs/language-support.md`
- `docs/second-batch-language-evaluation.md`
- `docs/superpowers/plans/2026-06-14-language-service-quality-roadmap-design.md`
- `docs/superpowers/plans/2026-06-14-multilanguage-architecture-design.md`
- Python、Java、Rust、PHP 为 `experimental`
- C#、Ruby、Kotlin、Swift、C、C++ 为 `hover-only`
- 已有 `commentDocLens.languageOverrides`
- 已有 `commentDocLens.maxLineLength`
- 已有 `commentDocLens.minimumDocumentationWords`
- 已有命令 `Comment Lens: Show Language Status`

## Goal 模式契约

**执行目标：** 准备 0.3.0 之后的下一轮改进 PR。

**完成标准：**

- README 不再使用 “first version” 这类过期表述。
- `commentDocLens.languages` 明确说明它过滤的是已注册 adapter language id。
- Inlay hint 的 tooltip 和 definition location 交互能力以显式设置开启，默认保持安静展示。
- PHP experimental adapter 覆盖 `method`、`property`、`const NAME` 等 `docs/second-batch-language-evaluation.md` 中记录的后续目标。
- 语言状态输出对 missing dependency、degraded、unknown 场景更可操作。
- 交付前 `npm test`、`npm run test:integration`、`npm run package` 通过，或明确记录无法运行的环境原因。

**非目标：**

- 不实现自定义 language server。
- 不给 hover-only 语言宣称 source fallback。
- 不在自动化测试中强制安装外部语言扩展。
- 不引入 AI 生成文档能力。

## 文件结构

- 修改：`README.md`
  - 修正过期语言描述，补充产品定位，明确语言支持矩阵入口。
- 修改：`docs/language-support.md`
  - 保持语言矩阵与实现一致，补充 0.3.0 之后的升级说明。
- 修改：`docs/second-batch-language-evaluation.md`
  - 标记 PHP adapter 补强为当前下一步执行目标。
- 修改：`package.json`
  - 澄清 `commentDocLens.languages` 语义，新增可选 hint 交互设置。
- 修改：`src/extension.ts`
  - 读取新设置；开启时把 tooltip/location 写入 inlay hint label part；优化 language status 文案。
- 修改：`src/hintBuilder.ts`
  - 如果配置接口仍作为集中设置形状，补充 hint interaction 字段。
- 修改：`src/languages/languageRegistry.ts`
  - 扩展 PHP adapter 的声明过滤和本地 fallback helper。
- 修改：`test/projectMetadata.test.ts`
  - 锁定 package 配置语义。
- 修改：`test/integration/suite/index.ts`
  - 验证默认 display-only 与 opt-in interactive hints。
- 修改：`test/languageRegistry.test.ts`
  - 验证 PHP adapter 元数据和增强行为。
- 修改：`test/languageHealth.test.ts`
  - 验证更可操作的 status 文案。
- 新建或修改：`test files/order.php`
  - 增加 PHP 手动样例覆盖。

---

## 任务 1：对齐 0.3.0 后的用户文档和配置语义

**文件：**

- 修改：`README.md`
- 修改：`docs/language-support.md`
- 修改：`docs/second-batch-language-evaluation.md`
- 修改：`package.json`
- 修改：`test/projectMetadata.test.ts`

- [ ] **步骤 1：为 package 配置语义添加失败测试**

在 `test/projectMetadata.test.ts` 中加入：

```ts
test('language configuration describes registered adapter semantics', () => {
  const packageJson = readPackageJson();
  const setting = packageJson.contributes.configuration.properties[
    'commentDocLens.languages'
  ] as {
    description: string;
  };

  assert.match(setting.description, /registered adapter language identifiers/i);
  assert.match(setting.description, /filters/i);
});
```

- [ ] **步骤 2：运行聚焦测试，确认先失败**

运行：

```bash
npm test -- test/projectMetadata.test.ts
```

预期：失败。当前描述仍是 `Language identifiers where Comment Lens runs.`

- [ ] **步骤 3：更新 `package.json` 配置描述**

把 `commentDocLens.languages.description` 改为：

```json
"Registered adapter language identifiers where Comment Lens runs. This setting filters supported adapter languages; unknown language identifiers are ignored."
```

- [ ] **步骤 4：修正 README 中过期的语言支持说明**

在 `README.md` 中，把当前类似 “The first version targets...” 的段落替换为：

```md
Comment Lens supports a stable core for Go, TypeScript, JavaScript, TSX, and JSX. Python, Java, Rust, and PHP are experimental adapter-backed languages with source-comment fallback where available. C#, Ruby, Kotlin, Swift, and C/C++ are hover-only languages that depend on their language service's hover and definition quality.

Install the recommended language extensions for non-built-in languages. Go works best with the official Go extension and `gopls`; Python works best with Python plus Pylance; Rust works best with rust-analyzer.
```

- [ ] **步骤 5：增加产品定位说明**

在 `README.md` 的 `## What it shows` 前加入：

```md
## What it is not

Comment Lens does not generate comments, rewrite source files, highlight TODO tags, or index comment anchors. It keeps source unchanged and projects existing symbol documentation from definitions to references.
```

- [ ] **步骤 6：更新第二批语言评估文档**

在 `docs/second-batch-language-evaluation.md` 的 `## 后续执行顺序` 下补充：

```md
当前下一步执行目标是 PHP adapter 补强：method、property 和 `const NAME` fallback。Ruby、Kotlin、Swift、C/C++ 继续保持 hover-only，直到真实语言服务输出质量完成验证。
```

- [ ] **步骤 7：运行单元测试**

运行：

```bash
npm test
```

预期：全部通过。

- [ ] **步骤 8：提交**

```bash
git add README.md docs/language-support.md docs/second-batch-language-evaluation.md package.json test/projectMetadata.test.ts
git commit -m "docs(language): align post-0.3.0 support contract"
```

---

## 任务 2：增加可选的 Inlay Hint 交互能力

**文件：**

- 修改：`package.json`
- 修改：`src/extension.ts`
- 修改：`src/hintBuilder.ts`
- 修改：`test/projectMetadata.test.ts`
- 修改：`test/integration/suite/index.ts`

- [ ] **步骤 1：添加失败的配置元数据测试**

在 `test/projectMetadata.test.ts` 的配置 key 列表中加入：

```ts
'commentDocLens.enableHintInteractions'
```

新增测试：

```ts
test('hint interactions are opt-in', () => {
  const packageJson = readPackageJson();
  const setting = packageJson.contributes.configuration.properties[
    'commentDocLens.enableHintInteractions'
  ] as {
    type: string;
    default: boolean;
    description: string;
  };

  assert.equal(setting.type, 'boolean');
  assert.equal(setting.default, false);
  assert.match(setting.description, /tooltip/i);
  assert.match(setting.description, /definition/i);
});
```

- [ ] **步骤 2：运行聚焦测试，确认先失败**

运行：

```bash
npm test -- test/projectMetadata.test.ts
```

预期：失败，因为当前还没有 `commentDocLens.enableHintInteractions`。

- [ ] **步骤 3：在 `package.json` 中新增设置**

在 `commentDocLens.hintPrefix` 后加入：

```json
,
"commentDocLens.enableHintInteractions": {
  "type": "boolean",
  "default": false,
  "description": "Enable inlay hint label tooltips and definition locations when documentation lookup provides them."
}
```

- [ ] **步骤 4：扩展配置接口**

在 `src/hintBuilder.ts` 的 `CommentDocLensConfig` 中加入：

```ts
enableHintInteractions?: boolean;
```

- [ ] **步骤 5：在 extension 中读取设置**

在 `src/extension.ts` 的 `readCommentDocLensConfig()` 中加入：

```ts
enableHintInteractions: config.get<boolean>('enableHintInteractions', false)
```

- [ ] **步骤 6：把 tooltip/location 接到 label part 上**

在 `CommentDocLensInlayHintProvider.provideInlayHints` 中，将 label part 构造逻辑改为：

```ts
const labelPart = new vscode.InlayHintLabelPart(hint.label);
if (config.enableHintInteractions) {
  labelPart.tooltip = hint.tooltip;
  if (hint.location) {
    labelPart.location = new vscode.Location(
      vscode.Uri.parse(hint.location.uri),
      new vscode.Position(hint.location.line, hint.location.character)
    );
  }
}
```

保持 `inlayHint.tooltip` 不设置，默认体验仍然是静默展示。

- [ ] **步骤 7：增加 integration 覆盖**

保留现有 display-only 测试，并新增：

```ts
await runTest('inlay hint interactions are opt-in', async () => {
  const config = vscode.workspace.getConfiguration('commentDocLens');
  await config.update('enableHintInteractions', true, vscode.ConfigurationTarget.Global);
  try {
    await vscode.commands.executeCommand('commentDocLens.refresh');
    const hints = await getHintsForFixture('order.ts');
    assert.ok(
      hints.some((hint) => hint.labelTooltipCount > 0 && hint.labelLocationCount > 0),
      `Expected at least one interactive hint: ${JSON.stringify(hints)}`
    );
  } finally {
    await config.update('enableHintInteractions', undefined, vscode.ConfigurationTarget.Global);
    await vscode.commands.executeCommand('commentDocLens.refresh');
  }
});
```

- [ ] **步骤 8：运行单元测试**

```bash
npm test
```

预期：全部通过。

- [ ] **步骤 9：运行 integration 测试**

```bash
npm run test:integration
```

预期：全部通过。

- [ ] **步骤 10：提交**

```bash
git add package.json src/extension.ts src/hintBuilder.ts test/projectMetadata.test.ts test/integration/suite/index.ts
git commit -m "feat(inlay-hints): add opt-in hint interactions"
```

---

## 任务 3：补强 PHP Experimental Fallback

**文件：**

- 修改：`src/languages/languageRegistry.ts`
- 修改：`test/languageRegistry.test.ts`
- 修改：`docs/language-support.md`
- 修改：`docs/second-batch-language-evaluation.md`
- 新建或修改：`test files/order.php`

- [ ] **步骤 1：添加 PHP fallback 测试**

在 `test/languageRegistry.test.ts` 中加入：

```ts
test('php adapter exposes experimental fallback metadata', () => {
  const registry = createLanguageRegistry(defaultLanguageAdapters);
  const adapter = registry.getAdapter('php');

  assert.equal(adapter?.displayName, 'PHP');
  assert.equal(adapter?.supportLevel, 'experimental');
  assert.deepEqual(adapter?.recommendedExtensions, ['bmewburn.vscode-intelephense-client']);
  assert.equal(Boolean(adapter?.sourceComment), true);
});
```

再加入声明过滤测试：

```ts
test('php adapter filters function, class, const, and property declarations', () => {
  const registry = createLanguageRegistry(defaultLanguageAdapters);
  const adapter = registry.getAdapter('php');
  assert.ok(adapter);

  assert.equal(
    adapter.isDeclarationCandidate?.({ word: 'formatStatus', line: 0, startCharacter: 9, endCharacter: 21 }, 'function formatStatus($status) {', 'php'),
    true
  );
  assert.equal(
    adapter.isDeclarationCandidate?.({ word: 'OrderPresenter', line: 0, startCharacter: 6, endCharacter: 20 }, 'class OrderPresenter {', 'php'),
    true
  );
  assert.equal(
    adapter.isDeclarationCandidate?.({ word: 'PAID_STATUS', line: 0, startCharacter: 6, endCharacter: 17 }, 'const PAID_STATUS = "paid";', 'php'),
    true
  );
  assert.equal(
    adapter.isDeclarationCandidate?.({ word: 'statusLabel', line: 0, startCharacter: 19, endCharacter: 30 }, 'private string $statusLabel;', 'php'),
    true
  );
});
```

- [ ] **步骤 2：运行聚焦测试，确认先失败**

```bash
npm test -- test/languageRegistry.test.ts
```

预期：如果当前 PHP declaration filtering 还没有覆盖 `const` 和 property，则失败。

- [ ] **步骤 3：扩展 PHP declaration 检测**

在 `src/languages/languageRegistry.ts` 中更新 `isPhpDeclarationName`，让它覆盖：

```ts
/\b(?:class|enum|function|interface|trait|const)\s+$/
```

并覆盖 PHP property：

```ts
/\b(?:public|protected|private|readonly|static|\??[A-Za-z_\\][\w\\]*|\w+\[\])\s+\$?$/
```

条件是 candidate 对应被声明的 property 名。

- [ ] **步骤 4：扩展 PHP 本地 definition fallback**

更新 `findPhpDefinitionLine`，增加匹配：

```ts
new RegExp(`^\\s*const\\s+${wordPattern}\\b`)
new RegExp(`^\\s*(?:public|protected|private)?\\s*(?:static\\s+)?(?:readonly\\s+)?[\\\\?\\w\\[\\]]+\\s+\\$?${wordPattern}\\b`)
```

保留现有 class/function/interface/trait/enum 匹配。

- [ ] **步骤 5：添加 PHP 手动样例**

创建或更新 `test files/order.php`：

```php
<?php

/** Paid order status in PHP. */
const PAID_STATUS = 'paid';

class OrderPresenter
{
    /** Label shown for paid orders. */
    private string $statusLabel = 'Paid';

    /** Formats a PHP order status. */
    public function formatStatus(string $status): string
    {
        return $status === PAID_STATUS ? $this->statusLabel : 'Unknown';
    }
}

$presenter = new OrderPresenter();
$label = $presenter->formatStatus(PAID_STATUS);
```

- [ ] **步骤 6：更新文档**

在 `docs/language-support.md` 中，把 PHP 验证状态更新为已覆盖 function/class/method/property/const。

在 `docs/second-batch-language-evaluation.md` 中，把 PHP 的后续升级目标改为：

```md
后续升级目标：

- 更复杂的 namespace/use 场景；
- inherited PHPDoc 和 magic method 行为；
- integration fixture 在安装 Intelephense 的环境中验证 hover 输出。
```

- [ ] **步骤 7：运行测试**

```bash
npm test
```

预期：全部通过。

- [ ] **步骤 8：提交**

```bash
git add src/languages/languageRegistry.ts test/languageRegistry.test.ts docs/language-support.md docs/second-batch-language-evaluation.md "test files/order.php"
git commit -m "feat(language): strengthen php fallback coverage"
```

---

## 任务 4：让语言状态输出更可操作

**文件：**

- 修改：`src/languageHealth.ts`
- 修改：`src/extension.ts`
- 修改：`test/languageHealth.test.ts`
- 修改：`README.md`

- [ ] **步骤 1：添加状态格式化测试**

在 `test/languageHealth.test.ts` 中加入：

```ts
test('formats missing dependency status with install guidance', () => {
  const message = formatLanguageHealthStatus({
    languageId: 'python',
    adapterDisplayName: 'Python',
    supportLevel: 'experimental',
    state: 'missingDependency',
    reason: 'Missing recommended extensions: ms-python.python, ms-python.vscode-pylance.',
    recommendedExtensions: ['ms-python.python', 'ms-python.vscode-pylance'],
    checkedCapabilities: {
      hover: false,
      definition: false,
      sourceFallback: true
    }
  });

  assert.match(message, /missingDependency/);
  assert.match(message, /ms-python.python/);
  assert.match(message, /ms-python.vscode-pylance/);
  assert.match(message, /Install or enable/i);
});
```

- [ ] **步骤 2：运行聚焦测试，确认先失败**

```bash
npm test -- test/languageHealth.test.ts
```

预期：失败。当前格式化文案列出了 extensions，但没有明确操作建议。

- [ ] **步骤 3：更新 formatter**

在 `formatLanguageHealthStatus` 中加入 guidance：

```ts
const guidance =
  status.state === 'missingDependency'
    ? `Install or enable: ${recommendedExtensions}.`
    : status.state === 'degraded'
      ? 'Move the cursor onto a documented symbol, refresh language services, or check project indexing.'
      : status.state === 'unknown'
        ? 'Try again after the language service finishes indexing.'
        : 'Ready for inline documentation.';
```

把 `guidance` 追加到返回信息中。

- [ ] **步骤 4：优化命令输出前缀**

在 `src/extension.ts` 中把 language status message 改为：

```ts
await vscode.window.showInformationMessage(`Comment Lens Language Status: ${formatLanguageHealthStatus(status)}`);
```

- [ ] **步骤 5：更新 README**

在 language status 小节补充：

```md
For `missingDependency`, install or enable the listed recommended extension. For `degraded`, put the cursor on a documented symbol and ensure the project has finished indexing.
```

- [ ] **步骤 6：运行测试**

```bash
npm test
```

预期：全部通过。

- [ ] **步骤 7：提交**

```bash
git add src/languageHealth.ts src/extension.ts test/languageHealth.test.ts README.md
git commit -m "feat(status): add actionable language health guidance"
```

---

## 任务 5：最终验证与交付

**文件：**

- 只有在验证发现真实问题时才修改。

- [ ] **步骤 1：运行单元测试**

```bash
npm test
```

预期：全部通过。

- [ ] **步骤 2：运行集成测试**

```bash
npm run test:integration
```

预期：全部通过。如果 VS Code extension host 因本地网络或缓存状态失败，记录精确错误并重试一次，再决定是否改代码。

- [ ] **步骤 3：打包扩展**

```bash
npm run package
```

预期：成功生成 VSIX，且没有 missing-file warning。如果产生 `.vsix` 且不准备提交，确认 repo 是否忽略发布产物后再处理。

- [ ] **步骤 4：检查工作区**

```bash
git status --short --branch
```

预期：只剩计划内的源码、测试、文档变更。

- [ ] **步骤 5：准备 PR 描述**

PR body：

```md
## Summary

- aligns README and configuration copy with the post-0.3.0 adapter architecture
- adds opt-in inlay hint tooltip/location interactions
- strengthens PHP experimental fallback coverage
- improves language status guidance for missing/degraded language services

## Verification

- npm test
- npm run test:integration
- npm run package
```

- [ ] **步骤 6：如有最终清理，单独提交**

只有验证过程中产生额外 cleanup 时执行：

```bash
git add README.md docs package.json src test "test files"
git commit -m "chore(release): prepare post-0.3.0 polish handoff"
```

---

## 自检

**需求覆盖：** 本计划基于已合入的 0.3.0 主干，覆盖文档/配置语义、可选 hint 交互、PHP 后续补强、语言状态提示优化和最终验证。

**占位符扫描：** 没有 `TBD`、`TODO`、`implement later` 之类占位步骤。每个任务都有明确文件、测试命令、预期结果和关键代码片段。

**类型一致性：** `enableHintInteractions` 在 package metadata、配置接口、配置读取和 integration 测试中使用同一个名称。

## 执行交接

计划已保存到：

`docs/superpowers/plans/2026-06-15-comment-doc-lens-goal-execution-plan.md`

两种执行方式：

1. **Subagent-Driven（推荐）**：每个任务派发一个新 subagent，任务之间做 review，迭代更快。
2. **Inline Execution**：在当前会话中使用 `executing-plans` 分批执行，并在关键节点检查。
