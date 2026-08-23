# Comment Doc Lens 全项目 Review 与竞品对比优化计划

> 当前状态：**第一至第三批代码修复已完成（2026-08-23 更新）**；第四批增长项中 D3 已落地 `browser` 入口与 `extensionKind`（真实 vscode.dev 环境验证待做），D1/D2/D4 与 C4 仍待实施。来源：2026-08-07 全项目 review（代码库深度审查 agent 通读全部 26 个 src 文件、19 个测试文件、配置与 release 配置；另含 VS Code Marketplace / IDE 生态竞品调研）。
>
> 2026-08-23 进度补充：
> - C2 快捷键已贡献（`Ctrl+Alt+D` / `Cmd+Alt+D` 切换，`editorTextFocus`）。
> - C3+A5 已合并实施：`diagnoseWorkspace` 使用 `withProgress` 通知进度并支持取消。
> - C1 已补完：分组 hint 携带全部候选，`resolveInlayHint` 可重建组合 tooltip 并挂第一个可用 definition location。
> - 新增跨文件缓存失效：编辑定义所在文件会即时失效引用其文档的缓存并去抖刷新可见 hint。
> - B1 已修复：lines 数组统一为相对 `range.startLine` 索引，消除双模隐式契约。
> - B4/B5 已修复：共享 `withTimeout`（`src/async.ts`）与 `nextNonWhitespaceCharacter`；`explainHiddenHint` 候选计数复用 adapter 过滤管线。
> - definition provider 异常不再静默，与 hover 路径一致记录 warn。
> - `resolveInlayHint` 已复用 `mapWithConcurrency`（并发 4），分组 hint 的多候选惰性解析不再按候选数串行叠加超时。
>
> 已知限制（2026-08-23 记录）：
> - 纯 hover 路径的缓存条目（无 definition location，如 `documentationResolver.ts` 中外部符号无定义时的返回）不含定义文件 uri，编辑定义文件不会使其失效；这些条目仍由引用处版本键管理，可用 `Refresh` 手动清理。
> - Web 支持仅满足加载条件（`browser` 入口 + `extensionKind`）；inlay hints selector 目前只注册 `file` scheme，`vscode-vfs` 等 web 场景未验证，README 措辞已保持待验证口径。

## 背景

本次 review 分两条线：

1. **设计/实现审查**：通读全部源码与测试，按性能、健壮性、架构契约、测试覆盖、可维护性五个维度找优化机会。
2. **竞品功能对比**：调研 VS Code 市场与 JetBrains/rust-analyzer 生态中在"引用处显示文档注释"相关的能力，确认功能缺口。

### 竞品市场结论

Comment Doc Lens 在 VS Code 市场"引用处显示文档注释为 inlay hints"这一细分领域是唯一直接竞品。周边相关能力分布：

| 竞品/能力 | 做什么 | 对本项目的启发 |
| --- | --- | --- |
| [Inline JSDoc Hints](https://marketplace.visualstudio.com/items?itemName=Peckage.inline-jsdoc-hints) | 补全列表内显示 JSDoc summary | 补全集成是可选项（见 D4） |
| [rust-analyzer](https://rust-analyzer.github.io/manual.html#inlay-hints) | label part 携带 source location：悬停看 doc、Ctrl+Click 跳定义 | 交互增强范本（见 C1） |
| [WebStorm/IntelliJ](https://www.jetbrains.com/help/webstorm/2025.2/viewing-inline-documentation.html) | Quick Documentation 弹窗 + 参数名/usages hints | 持续内联显示仍是差异化点；用户缺 Vue inlay hints 的诉求佐证 D1 |
| [clangd](https://github.com/clangd/vscode-clangd) | C/C++ inlay hints 渲染 doc comments | 证明 doc-in-hint 交互模式有效 |
| [out-of-code-insights](https://github.com/JacquesGariepy/out-of-code-insights) | inlay hints 可点击展开、CodeLens、树视图 | inlay hint + command 可承载更多交互 |
| [Inlay Hints (DominicVonk)](https://marketplace.visualstudio.com/items?itemName=DominicVonk.inlay-hints) / [vscode-inline-parameters](https://github.com/RobertOstermann/vscode-inline-parameters) | 调用点参数名 hint | 独立赛道，不冲突 |

## 发现总览

### A 批：性能与健壮性（代码修复）

| # | 发现 | 严重度 | 证据 |
| --- | --- | --- | --- |
| A1 | 每个走 source-fallback 的候选都做一次全文档线性扫描，且忽略语言服务已给的 definition location | 高 | `documentationResolver.ts:73-74` → `documentationLookup.ts:79-92`；8 份 `findXxxDefinitionLine`（shared.ts:148-165、go.ts:10-53、python.ts:44-67 等）都从第 0 行扫到文件尾 |
| A2 | hover 错误无 try/catch 会炸掉整批 hint；definition 错误却空 catch 静默 | 中 | `vscode/hover.ts:5-10` vs `vscode/documentationLookup.ts:25-27`、`vscode/languageHealthProbe.ts:23-25` |
| A3 | languageHealth 缓存永久缓存超时/失败结果（`'unknown'`/`'degraded'`），装完扩展后仍显示旧状态 | 中 | `languageHealth.ts:70-92`；清除点仅 3 处（extension.ts:46-47、59-60、175-176） |
| A4 | resolveSummary 成功路径不写 `'full'` 键，`enableHintInteractions` 下 hover 触发完整重跑 | 中 | `documentationResolver.ts:115-118` vs 73-96、159-173 |
| A5 | diagnoseWorkspace 无进度、无 CancellationToken，串行最坏 ~30 秒 | 中 | `extension.ts:334-362`；`languageHealth.ts:100-108` |
| A6 | `isKeyword(word, _languageId)` 忽略语言参数，PHP/Rust 关键字进候选池 | 低 | `candidateScanner.ts:184-186` |

### B 批：架构契约与重复

| # | 发现 | 严重度 | 证据 |
| --- | --- | --- | --- |
| B1 | lines 数组双模索引隐式契约（绝对行号 vs 相对行号），`startLine > 0` 混合情形零测试 | 中 | `extension.ts:314-320`；`candidateScanner.ts:75-87` |
| B2 | hintBuilder 持有模块级默认注册表（第二事实来源） | 低 | `hintBuilder.ts:53` |
| B3 | markdown/文本处理分散 5 处；`shortUri` 与 `isFilePathWithExtension` 复制同一模式 | 低-中 | hoverContent.ts；documentationFormatter.ts:69-240；diagnostics.ts:129、259-269；hintBuilder.ts:101；shared.ts:64-70 |
| B4 | `withTimeout` ×2、`nextNonWhitespace` ×2（同义不同名） | 低 | hintBuilder.ts:305-318 vs languageHealth.ts:191-204；candidatePriority.ts:146 vs shared.ts:236 |
| B5 | explainHiddenHint 候选计数未过 adapter 过滤，声明行/JSX 行文案误导 | 低 | `extension.ts:141-147`；`diagnostics.ts:248-252` |

### C 批：用户可见功能（竞品对标）

| # | 功能 | 来源 | 说明 |
| --- | --- | --- | --- |
| C1 | label part 级 `location` + `command`：hint 变可点击链接（Ctrl+Click 跳定义、悬停看 doc、右键导航菜单） | rust-analyzer 做法；`InlayHintLabelPart.location` API 已确认可用（@types/vscode 1.125，引擎 1.101 满足） | 改动集中 `extension.ts` 的 resolveInlayHint，约 20 行 |
| C2 | 贡献 keybindings（当前零快捷键），如 `Ctrl+Alt+D` 切换 | 市场惯例；VS Code `editor.inlayHints.enabled` 的 `onUnlessPressed` 模式可配合 | 低风险，需考虑与既有键位冲突 |
| C3 | diagnoseWorkspace 加进度与取消（与 A5 合并实施） | — | — |
| C4 | 补全列表集成（completion item 显示 summary） | Inline JSDoc Hints | ⚠️ 超出"引用处"核心定位，列为可选里程碑，复用 `documentationFormatter` 输出 |

### D 批：增长（语言与平台）

| # | 方向 | 依据 | 门槛 |
| --- | --- | --- | --- |
| D1 | 新语言：Vue/Svelte 模板、Dart/Flutter | WebStorm 用户对 Vue inlay hints 的明确诉求；适配器模式直接复用 | 按 `docs/language-support.md` 证据闭环：adapter + registry + tests + matrix + fixtures |
| D2 | kernel-doc 风格标签（`@new` 等）识别 | StackOverflow 真实用户诉求；`documentationFormatter` XML 标签处理可延伸 | 需确认各语言服务 hover 输出中 kernel-doc 的形态 |
| D3 | Web 支持（vscode.dev）：`browser` 入口 + `extensionKind` | 引擎 1.101 足够新，seam 已干净（仅 4 文件 import vscode） | 需验证 executeHoverProvider 在 web 环境可用 |
| D4 | GitHub topics 补齐（`vscode-extension`、`documentation`、`inlay-hints`、`doc-comments`、`docstring`、`code-reading`） | 2026-06-16 优化计划未完成项 | 一次性，发布时同步 |

## 实施计划（按批次）

### 第一批：低成本高收益（约 10 行代码 + 文档）

1. **A2 修复**：`getHoverLines` 加 try/catch 返回 `[]`（与 definition 路径一致），catch 内经 DiagnosticsSession 记 warn。约 5 行。验收：语言服务异常时单候选失败不再炸整批 hint。
2. **A4 修复**：`resolveSummary` 的 fromReference 成功分支同时写 `'summary'` 与 `'full'` 键。约 3 行 + 1 测试。验收：`enableHintInteractions` 下 hover hint 不再触发完整重跑。
3. **A3 修复**：`'unknown'`（超时）结果不写入缓存或加短 TTL；in-flight 去重保留。验收：装完扩展/索引完成后状态立即可靠。
4. **A6 修复**：`isKeyword` 改为接收语言参数并补 PHP（`echo`/`use`/`foreach` 等）与 Rust（`impl`/`trait` 等）关键字。验收：声明行/关键字不再进候选池。
5. **文档过期修正**：`docs/README.md:10` 2026-08-07 计划状态改 "Completed"；`docs/2026-06-16-comment-lens-optimization-plan.md:87` 的 issue templates 标记与仓库实际（4 个模板已存在）同步。验收：`npm run harness:check` 通过。

### 第二批：性能（definition-location 锚点化）

- **A1 修复**：优先用 `location.line` 向上收集注释（collectLeading* 已向上走）；收集为空时仅在 `[location.line-20, location.line]` 窗口内按正则在锚点附近搜索；统一 8 份 `findXxxDefinitionLine` 传参。
- 风险：中。需验证"定义行在 location 之前"的各类 fixture；595 行 adapter 测试兜底。
- 验收：大文件 + 引用 hover 仅返回签名的场景下，hint 延迟显著下降；`npm test` 全绿。

### 第三批：用户可见功能

- **C1 + C2 + C3**：label part 交互增强、keybindings、diagnoseWorkspace 进度/取消（C3 与 A5 合并）。
- 验收：`enableHintInteractions` 下 hint 可点击跳转定义；新增键位在 package.json 声明并被 projectMetadata 测试覆盖。

### 第四批：增长

- **D1 新语言**（建议先 Vue，用户诉求最明确）：adapter + registry 条目 + 单测 + `docs/language-support.md` 更新 + `test-fixtures/language-service/` 证据。
- **D3 Web 支持**：验证 `vscode.executeHoverProvider` 在 web 环境行为后，补 `browser` 入口与 `extensionKind: ["workspace"]`。
- **D2/D4**：kernel-doc 标签延伸与 GitHub topics，随发布节奏推进。
- **C4 补全集成**：需产品决策（超出核心定位），暂缓。

### 明确不做（本期）

- document symbols / references 辅助过滤（2026-06-16 计划已有评估项，等 A1 修复后实际数据再判断）。
- 参数名/类型 inlay hints（clangd、vscode-inline-parameters 已覆盖的独立赛道，与产品定位无关）。

## 验收口径

- 第一批至第三批完成后：`npm test` 全绿、`npm run harness:check` 通过、`npm run package` 通过。
- vscode seam 仍仅 4 个文件 import `vscode`（`src/extension.ts`、`src/vscode/*`）。
- 每个批次单独提交，commit message 遵循 Conventional Commits（release-please 解析 final commit subject）。
- 用户可见行为变化（C 批新增交互、D 批新增语言）需同步 README/README_CN、package.nls.json、`docs/language-support.md` 与 sample gallery。
