# Documentation Provenance + Adaptive Summary 改造

> 当前状态：**已完成（2026-08-18）**。来源：Issue #44（Go declaration 同一行 trailing comment 被误当 documentation）+ 固定长度截断对长注释的无效截断。
>
> 说明：Issue #44 的 trailing-comment provenance 修复已先合入 main（见 [trailing comment provenance 方案](2026-08-18-trailing-comment-provenance.md)）。本文记录本 PR 在其之上叠加的架构层：**documentation 数据模型升级 + 自适应摘要（presentation 策略）**。

## 架构调整

### Documentation Resolution 与 Presentation 分离

- `DocumentationResolver` 只负责找到正确的 documentation 并**保留完整 fullText + 来源 + range**，不再截断。
- `ResolvedDocumentation` 升级为 `{ fullText, source: 'hover' | 'source-comment' | 'fallback', location?, range? }`，移除 `summary`。
- `DocumentationResolverOptions` 移除 `maxHintLength`（presentation 不再属于 resolver）。
- 新增 `src/hintSummary.ts`：`HintDisplayPolicy { maxCharacters, maxLines }` 与 `summarizeDocumentation(fullText, policy)`。
- `hintBuilder` 在展示层用 `summarizeDocumentation` 生成 label；tooltip 仍使用完整 `fullText`。
- `vscode/hover.ts` 升级为返回 `{ lines, range }`，保留 `vscode.Hover.range` 元数据。
- 解析器保持 main 已合入的本地声明/外部 symbol 双路径：本地声明 source-comment 优先 + trailing-comment 校验；外部 symbol 保持语言服务 hover 优先。

### 摘要策略（`summarizeDocumentation`）

1. 取文档第一段（空白行/heading/list/tag/code fence 为段落边界）。
2. 若不超过 `maxCharacters` 且不超过 `maxLines` 行，原样使用。
3. 否则按句子边界截断（支持中英文句号与省略号），追加 `…`。
4. 仍过长则按安全空白边界做字符级截断并追加 `…`。
5. 不在 Markdown 链接/反引号中间截断。

## 配置

- `commentDocLens.maxHintLength`（默认 120）继续作为摘要最大字符数，兼容保留。
- 新增 `commentDocLens.maxHintLines`（默认 2）限制摘要考虑的行数。
- README / README_CN / package.nls.json / package.nls.zh-cn.json / projectMetadata 测试同步。

## 测试

- 新增 `test/hintSummary.test.ts`：摘要策略（首段、句子边界、字符级、省略号、Markdown 安全）。
- `test/documentationResolver.test.ts`：数据模型升级（source/range）与完整文档不截断。
- Go 10 场景回归（leading/trailing 行/块注释、const group 继承、member trailing、同名声明最近匹配、external symbol）随 main 的 provenance 测试与本文档合并保留。

## 验收

- `npm test`：194/194 pass。
- `npm run harness:check`：passed。
- `npm run package -- --out /tmp/comment-doc-lens-verify.vsix`：DONE。
- vscode seam 仍仅 4 个文件 import `vscode`。