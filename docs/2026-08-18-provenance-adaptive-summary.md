# Documentation Provenance + Adaptive Summary 改造

> 当前状态：**已完成（2026-08-18）**。来源：Issue #44（Go declaration 同一行 trailing comment 被误当 documentation）+ 固定长度截断对长注释的无效截断。

## 目标

1. 修复 Issue #44：Go 中 declaration 同一行的 trailing comment 永不被当作 documentation。
2. 引入真正基于策略的摘要（first paragraph → 句子边界 → 字符级），替代简单的 `substring(0, N)` 截断。
3. 不改变用户可见命令/设置命名；`maxHintLength` 保持兼容，新增 `maxHintLines`。

## 架构调整

### Documentation Resolution 与 Presentation 分离

- `DocumentationResolver` 只负责找到正确的 documentation 并**保留完整 fullText + 来源 + range**，不再截断。
- 新增 `ResolvedDocumentation`：`{ fullText, source: 'hover' | 'source-comment' | 'fallback', location?, range? }`，移除 `summary`。
- `DocumentationResolverOptions` 移除 `maxHintLength`（presentation 不再属于 resolver）。
- 新增 `src/hintSummary.ts`：`HintDisplayPolicy { maxCharacters, maxLines }` 与 `summarizeDocumentation(fullText, policy)`。
- `hintBuilder` 在展示层用 `summarizeDocumentation` 生成 label；tooltip 仍使用完整 `fullText`。
- `vscode/hover.ts` 升级为返回 `{ lines, range }`，保留 `vscode.Hover.range` 元数据。

### 摘要策略（`summarizeDocumentation`）

1. 取文档第一段（空白行/heading/list/tag/code fence 为段落边界）。
2. 若不超过 `maxCharacters` 且不超过 `maxLines` 行，原样使用。
3. 否则按句子边界截断（支持中英文句号与省略号），追加 `…`。
4. 仍过长则按安全空白边界做字符级截断并追加 `…`。
5. 不在 Markdown 链接/反引号中间截断。

### Go Trailing Comment Provenance

- `SourceCommentStrategy` 新增 `findTrailingComment(document, line)` 语义：**leading comment 才是 documentation；trailing comment（声明同行、代码之后）永不是 documentation**。
- `shared.findTrailingCommentStart` 做词法扫描（跳过字符串字面量）识别 `//` 与 `/*`。
- 解析器守卫：本地声明无 leading source comment 且定义行存在 trailing comment 时，拒绝使用 hover documentation（不再盲目信任 gopls 把 trailing comment 拼进 hover 的签名行）。
- 外部 symbol / 无 source fallback 的语言保持原有 hover 行为（场景 10）。
- `findGoDefinitionLine` 改为"最近匹配"语义，避免同名字声明串线（场景 9）；`collectCommentsAtAnchor` 支持 `includeAnchor`，让 gopls 锚点直接落在 const/var/type 组成员时仍能继承 block-level comment（场景 7/8）。
- `candidateScanner` 未改动。

## 配置

- `commentDocLens.maxHintLength`（默认 120）继续作为摘要最大字符数，兼容保留。
- 新增 `commentDocLens.maxHintLines`（默认 2）限制摘要考虑的行数。
- README / README_CN / package.nls.json / package.nls.zh-cn.json / projectMetadata 测试同步。

## 测试（10 个 Go 场景回归）

1. leading line comment → 展示；2. trailing line comment → 不展示；3. leading + trailing → 只展示 leading；4. leading block → 展示；5. trailing block → 不展示；6. leading block + trailing → 只展示 leading；7. const group block-level 继承；8. const group member trailing 不泄漏；9. 同名 declaration 解析到最近声明；10. external symbol 仍用语言服务 documentation。

## 验收

- `npm test`：187/187 pass。
- `npm run harness:check`：passed。
- `npm run package -- --out /tmp/comment-doc-lens-verify.vsix`：DONE（58 files）。
- vscode seam 仍仅 4 个文件 import `vscode`。