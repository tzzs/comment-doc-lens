# Comment Doc Lens 架构深化优化方案

> 当前状态：**全部 5 个候选已完成并合入 `multi-comment`（2026-08-07）**。来源：2026-08-07 架构审查（基于最近 15 个提交的热点：适配器拆分、宿主适配器提取、候选角色分类统一）。

## 背景

架构审查按 /codebase-design 词汇（module / interface / depth / seam / adapter / leverage / locality）识别出 5 个深化候选，按推荐强度排序：

| # | 候选 | 强度 | 核心摩擦 |
|---|------|------|---------|
| 1 | 合并诊断子系统为一个深模块 | Strong | `DiagnosticsReportInput` 9 字段→模板、6 个 getter/setter 纯样板——interface 宽度≈implementation 宽度 |
| 2 | 把源注释回退折叠进 lookup seam | Strong | `SourceCommentStrategy` 跨层穿越，canRead 判定分裂在 resolver 和 lookup 两处 |
| 3 | 配置只读一次，glob 从注册表派生 | Worth exploring | 同一 vscode 配置三份手写投影；诊断 glob 是 languageRegistry 的第二份事实来源 |
| 4 | 测试真正运行的模块，而不是它的孪生 | Worth exploring | 测试测 go.ts 的导出副本，而 java/php/kotlin 用的 shared.ts 无直接测试 |
| 5 | 给 language-health 缓存加边界 | Speculative | 缓存以 position 为键且无上限，workspace 诊断沉淀 40+ 项，策略无测试 |

不变的约束：vscode seam 保持干净（仅 `src/extension.ts` 与 `src/vscode/` 下文件 import `vscode`）；不改变任何用户可见行为（命令、设置、hint 输出）；全部完成以 `npm test`、`npm run harness:check`、`npm run package` 通过为准。

## 已完成（按实施顺序）

### 候选 2：把源注释回退折叠进 lookup seam（`054534d`）

- `DocumentationLookup.getDefinitionSourceLines?` → 必选 `getDefinitionSourceComments(location, candidate, languageAdapter?)`，不可读或找不到定义时返回 `[]`。
- `VscodeDocumentationLookup` 内部执行 `sourceComment` 的 canRead → findDefinitionLine → collectLeadingComments；canRead 判定只留在 lookup 一处。
- `DocumentationResolver.getSourceDocumentation` 只调该方法，空数组即"无源文档"；删除 `SourceCommentStrategy` import 与 canRead 分支。
- 全部测试 mock 同步；新增"不可读返回空 → resolver 不产出 hint"用例。

### 候选 1：合并诊断子系统为一个深模块（`507653e`）

- `src/diagnostics.ts` 纯函数层 + `src/vscode/diagnostics.ts` 状态类合并为 `DiagnosticsSession`：`record` / `latest(kind, value)` / `getLatest(kind)` / `renderIssueReport`，外加 `recordWorkspaceDiagnosis` 与 `explainHiddenHint` 两个自持 output channel 与事件记录的流程。
- 模板拼装、单元格转义、uri 缩短、事件上限（100）、隐藏提示状态机全部移入 implementation。
- `extension.ts` 7 个命令统一走 session seam，消除手动 appendLine+show 路径。
- `src/diagnostics.ts` 与 `test/diagnostics.test.ts` 删除；诊断测试只经 session seam。

### 候选 4：测试真正运行的模块，而不是它的孪生（`ad5574e`）

- go.ts 的收集器语义并入 `shared.ts` 的 `collectLeadingSlashCommentLines`（复用 `collectLeadingLineCommentLines` / `collectLeadingBlockCommentLines` 组合，已证明等价），go.ts 不再导出副本。
- `sourceCommentExtractor.test.ts` 直接测试全部 shared 收集器；`findGoDefinitionLine` 保留在 go 适配器名下。
- kotlin/swift/cpp 合体冒烟测试拆分，每个适配器独立测试并补 `isDeclarationCandidate` 正负例。

### 候选 3：配置只读一次，glob 从注册表派生（`c075866`）

- 新模块 `src/config.ts`（纯函数 + 注入 `ConfigReader`）：`readCommentDocLensConfig` 一次读取产出完整 `CommentDocLensConfig`（含 maxHintLength / maxCacheEntries）；`toResolverOptions` / `toDiagnosticsSettingsSnapshot` 从同一模型派生。
- `extension.ts` 三处手写投影删除，统一走 `createVscodeConfigReader()`。
- `LanguageAdapter` 新增 `sourceFileExtensions`；`LanguageRegistry.getSourceFileGlobs()` 派生扩展名 glob，`diagnoseWorkspace` 的 findFiles 使用它，硬编码 glob 删除。
- 新增 `test/config.test.ts`（注入 reader 测默认值与合并）。

### 候选 5：给 language-health 缓存加边界（`cada0d0`）

- `LanguageHealthService` 构造器新增 `maxCacheEntries = 1000`（与 resolver 一致），超出淘汰最旧键。
- 注释固定 position 进键决策（hover 真值依赖探测位置）；workspace 诊断路径（≤40 位置/批）共享上限且淘汰只移除最旧项。
- 补缓存策略测试：并发去重、淘汰、clearCache。

## 验收口径（全部通过）

- `npm test`：157/157 pass。
- `npm run harness:check`：passed。
- `npm run package -- --out comment-doc-lens-verify.vsix`：DONE（58 files）。
- vscode seam 仍仅 4 个文件 import `vscode`（`src/extension.ts`、`src/vscode/*`）。
- 用户可见行为不变：命令 id、设置项、hint 输出、语言支持矩阵均无变化。
- 每个候选单独提交，commit message 遵循 Conventional Commits。
