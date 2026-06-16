# Comment Doc Lens 语言服务质量路线设计

## 背景

当前 Comment Doc Lens 已完成多语言 adapter/registry 架构，并支持 Go、TypeScript、JavaScript、TSX、JSX、Python、Java、Rust、PHP、C#、Ruby、Kotlin、Swift、C 和 C++。其中 Go、TypeScript-family、Python、Java、Rust 和 PHP 为 `stable`，C#、Ruby、Kotlin、Swift、C/C++ 为 `experimental`，暂无 `hover-only` 语言。

对照 VS Code 官方语言扩展和 VS Code Language Features API 后，可以看到官方扩展通常覆盖完整 IDE 能力：IntelliSense、hover、definition、references、diagnostics、CodeLens、Code Actions、refactoring、testing、debugging、project/environment management 等。Comment Doc Lens 不应复制这些能力，而应继续保持清晰定位：复用语言服务，把“符号文档和定义注释”更轻量地展示在引用位置。

下一阶段优化应围绕三个优先级推进：

1. A：语言服务健康检查与用户提示。
2. B：文档质量与噪音过滤。
3. C：继续扩展语言支持。

本设计文档用于 Codex 目标模式执行：明确需要修改的内容、验证方式和最终实现目标。

> 2026-06-17 状态更新：优先级 A 已完成；优先级 B 已完成 formatter 质量规则、adapter-level 文档质量阈值、timeout/cache 保护和 source fallback 证据，document symbols / references 辅助过滤仍作为后续可选增强；优先级 C 已完成 PHP、Ruby、Kotlin、Swift、C/C++ 的接入和 fallback 第一轮验证。

## 官方能力对标结论

| 对标来源 | 官方能力重点 | 对 Comment Doc Lens 的启发 |
| --- | --- | --- |
| VS Code Programmatic Language Features API | hover、definition、references、document symbols、CodeLens、Code Actions、diagnostics 等语言能力均可通过 API/LSP 暴露 | 继续复用官方语言服务，但补齐健康检查、符号质量和 references/document symbols 辅助过滤 |
| Python + Pylance | Pylance 提供 docstrings、signature help、parameter suggestions、completion、auto-import、diagnostics、semantic highlighting，并提供多种性能模式 | 对 Python 需要检测 Pylance/语言服务是否可用，并提供“为什么没有 hint”的可解释反馈 |
| Go 扩展 | 依赖 `go`、`gopls` 和工具链；提供 IntelliSense、代码导航、诊断、测试和调试 | Go adapter 应把 gopls/definition/hover 可用性作为健康状态暴露 |
| Java 扩展 | 提供 code navigation、workspace symbols、peek/go to definition、call/type hierarchy、semantic highlighting、code actions | Java adapter 可借助 document symbols 和 definition 结果减少误判 |
| C# Dev Kit | 提供 solution explorer、test explorer、Roslyn 语义、导航、refactoring、semantic awareness | C# 不应长期停留在仅 metadata 的 hover-only，应先增加语言服务健康提示，再评估 XML doc fallback |
| C/C++ 扩展 | 提供 IntelliSense、debugging、code browsing，但强依赖编译器、debugger、include path 和项目配置 | C/C++ 接入前必须有清晰依赖诊断，不能只盲目注册 language id |

## 目标

- 增加语言服务健康检查和用户可见状态，让用户知道当前语言为何显示或不显示文档提示。
- 提升文档 hint 的质量，减少签名噪音、声明噪音、重复噪音和低价值符号。
- 基于健康检查和质量控制继续扩展语言，而不是盲目添加 language id。
- 保持产品边界：display-only inlay hints，不做运行时值推断，不替代官方语言扩展的导航、重构、测试或调试能力。
- 所有新增能力必须具备自动化验证；若依赖真实 VS Code/Electron integration，应提供可替代的 command-level 测试或清楚记录环境限制。

## 非目标

- 不实现完整语言服务器。
- 不复制官方扩展的 IntelliSense、diagnostics、refactoring、testing、debugging 或项目系统。
- 不把 hint 变成跳转入口或可点击动作，除非后续单独设计并明确改变 display-only 产品边界。
- 不在没有健康检查和验证策略的情况下继续注册大量新语言。
- 不要求用户安装所有官方语言扩展；缺失依赖时应解释和安静降级。

## 优先级 A：语言服务健康检查与用户提示

### 需要修改的内容

1. 新增语言服务健康模型。
   - 新增 `LanguageHealthStatus` 类型，至少包含：
     - `languageId`
     - `adapterDisplayName`
     - `supportLevel`
     - `state`: `ready`、`degraded`、`missingDependency`、`unknown`
     - `reason`
     - `recommendedExtensions`
     - `checkedCapabilities`: hover、definition、sourceFallback
   - 在 `LanguageAdapter` 中增加健康元数据：
     - 推荐扩展 id，例如 Python: `ms-python.python`、Pylance: `ms-python.vscode-pylance`、Go: `golang.Go`。
     - 需要检测的 VS Code capabilities，例如 hover/definition 是否返回有效结果。

2. 新增健康检查服务。
   - 新增 `languageHealth.ts`。
   - 使用 `vscode.extensions.getExtension()` 检测推荐扩展是否安装。
   - 使用轻量 command probe 检测当前 document 的 hover/definition 是否有结果。
   - 健康检查必须有缓存和超时，不能每次 inlay hint 请求都重复昂贵检测。

3. 新增用户入口。
   - 新增命令：`commentDocLens.showLanguageStatus`。
   - 命令输出当前活动 editor 的语言支持状态、推荐依赖、最近一次 hover/definition/source fallback 结果。
   - 可选：在状态栏显示简短状态，例如 `Comment Doc Lens: Ready` / `Degraded`，但默认应保持克制，避免噪音。

4. README 和支持矩阵同步。
   - 在 README 中新增 “Language service status” 说明。
   - 在 `docs/language-support.md` 中补充推荐扩展 id 与健康检查状态。

### 验证方式

| 验证项 | 命令/方式 | 通过标准 |
| --- | --- | --- |
| 健康模型单元测试 | `npm test` | ready/degraded/missingDependency/unknown 状态可正确生成 |
| 推荐扩展检测 | mock `vscode.extensions.getExtension` 或抽象接口测试 | 安装/未安装路径均可验证 |
| command probe 超时 | 单元测试 | 慢 hover/definition 不阻塞 hint pipeline |
| 命令注册 | metadata 测试 | `commentDocLens.showLanguageStatus` 出现在 `package.json` contributes.commands |
| 文档 | 文档扫描 | README 和支持矩阵说明推荐依赖和降级行为 |
| 全量验证 | `npm run compile`、`npm test`、`npm run package` | 全部通过 |

## 优先级 B：文档质量与噪音过滤

### 需要修改的内容

1. 引入 symbol-aware 过滤。
   - 在 resolver 或 hint pipeline 中可选调用 `vscode.executeDocumentSymbolProvider`。
   - 根据 symbol kind 区分 function、method、class、enum member、field、property、variable。
   - 允许 adapter 定义优先 symbol kind 和排除 symbol kind。
   - 默认继续使用轻量扫描；document symbols 作为质量增强，不应成为硬依赖。

2. 引入 references 辅助去噪。
   - 对高重复、低价值符号可选调用 `vscode.executeReferenceProvider`。
   - 目标不是显示引用数量，而是用于降低局部变量、临时变量、一次性符号的 hint 价值。
   - 必须受预算限制：只对已经通过 hover/definition 的少量候选做 references probe。

3. 改进 formatter 质量规则。
   - 增强 signature-only 检测，覆盖 Java/C#/Rust/Python 常见签名形态。
   - 增加 `commentDocLens.minimumDocumentationWords` 或 adapter-level 质量阈值。
   - 增加多行文档摘要策略：首句优先、标题优先、去掉 `@param`/`@return` 噪音。

4. adapter 扩展点。
   - 新增 adapter 可选字段：
     - `preferredSymbolKinds`
     - `ignoredSymbolKinds`
     - `qualityRules`
     - `referenceBudget`
   - 保持所有规则默认保守，避免破坏现有 Go/TS/JS 行为。

### 验证方式

| 验证项 | 命令/方式 | 通过标准 |
| --- | --- | --- |
| symbol kind 过滤 | 新增单元测试 | adapter 能按 symbol kind 保留/过滤候选 |
| references 预算 | 新增单元测试 | references probe 不超过配置预算，超时可降级 |
| formatter 质量规则 | `documentationFormatter.test.ts` | 常见签名噪音被过滤，有效 doc comment 保留 |
| 现有行为回归 | `npm test` | Go/TS/JS/TSX/JSX/Python/Java/Rust/C# 现有测试不回退 |
| 性能保护 | timeout/cache 测试 | 新增 probes 不绕过现有超时、缓存和 `maxHintsPerRequest` |

## 优先级 C：继续扩语言

### 当前执行状态

该优先级的第一轮已经完成，并超过了原始目标：

- PHP 已从 `experimental` 升级为 `stable`，覆盖 class/function/method/property/const PHPDoc 与 source fallback。
- Ruby 已具备 YARD/RDoc source fallback，并进入 `experimental`。
- Kotlin 已具备 KDoc source fallback，并进入 `experimental`。
- Swift 已具备 `///` 和 block doc comment fallback，并进入 `experimental`。
- C/C++ 已具备 Doxygen-style source fallback，并进入 `experimental`。

剩余工作不是继续盲目加语言，而是为 experimental 语言补真实语言服务 integration 证据、截图或手工验证记录。

### 需要修改的内容

1. 补真实语言服务验证。
   - PHP：在安装 Intelephense 的环境中验证 hover 输出和 source fallback 行为。
   - Ruby：在 Ruby LSP 或 Solargraph 环境中验证 YARD/RDoc hover 与 fallback 互补关系。
   - Kotlin：在 Gradle/Maven fixture 中验证 Kotlin language server 的 KDoc hover 输出。
   - Swift：在 macOS/SwiftPM + SourceKit-LSP 环境中记录可重复验证条件。
   - C/C++：在包含 compile commands 或 include path 配置的 fixture 中验证 C/C++ 扩展输出。

2. 补截图或手工验证记录。
   - 每个 experimental 语言至少保留一个可复现 fixture、截图或验证说明。
   - 截图/GIF 应进入 README、sample gallery 或发布记录，而不是只留在 PR 评论中。

3. 再决定晋级。
   - 只有当真实语言服务证据、fallback 测试、噪音过滤和文档都闭环后，才把 experimental 语言提升到 `stable`。

4. 支持矩阵更新。
   - 每种新增语言必须同步更新 `docs/language-support.md`。
   - 如果只进入 planned，不应加入默认 `commentDocLens.languages`。

### 验证方式

| 验证项 | 命令/方式 | 通过标准 |
| --- | --- | --- |
| PHP stable 证据 | 单元测试 + fixture + Intelephense 手工记录 | docblock fallback、definition 查找、declaration filtering 和 hover 互补关系可解释 |
| Ruby experimental 证据 | 单元测试 + fixture + Ruby LSP/Solargraph 手工记录 | YARD/RDoc fallback 可用，语言服务依赖和限制清楚 |
| Kotlin/Swift/C/C++ experimental 证据 | 单元测试 + fixture + 手工记录 | KDoc、Swift doc comments、Doxygen fallback 可用，环境限制清楚 |
| package metadata | metadata 测试 | activationEvents 和默认 languages 与支持等级一致 |
| 支持矩阵 | 文档检查 | 每种语言有等级、依赖、fallback、验证状态 |
| 全量验证 | `npm run compile`、`npm test`、`npm run package` | 全部通过 |

## 建议实施顺序

| 阶段 | 目标 | 原因 | 产物 |
| --- | --- | --- | --- |
| P0 | 健康检查基础 | 已完成 | health model、health service、status command、文档 |
| P1 | 文档质量控制 | 已完成第一轮；symbol/reference 辅助过滤后置 | formatter quality rules、adapter quality rules、timeout/cache 保护 |
| P2 | PHP + Ruby | 已完成并更新等级 | PHP stable、Ruby experimental、fixtures、tests、docs |
| P3 | Kotlin/Swift/C/C++ | 已完成第一轮 experimental fallback | Kotlin/Swift/C/C++ source fallback、依赖诊断、支持矩阵 |
| P4 | 真实语言服务证据 | 当前下一步 | experimental 语言截图、手工验证记录、sample gallery 更新 |

## Codex 目标模式最终目标

```md
基于 Comment Doc Lens 当前多语言 adapter 架构，推进下一阶段“语言服务质量证据”优化。

当前健康检查、copyable diagnostics、formatter 质量规则、PHP stable 支持，以及 Ruby/Kotlin/Swift/C/C++ experimental fallback 已完成。下一步目标不再是继续注册更多 language id，而是补齐真实语言服务 integration 证据、截图或手工验证记录。

优先级 A：为 C#、Ruby、Kotlin、Swift、C/C++ 各补一份真实语言服务验证记录，说明推荐扩展、项目环境、hover/definition 输出质量和 source fallback 兜底行为。

优先级 B：将验证证据同步到 README、sample gallery、language-support matrix 或 release notes。保持 support level 保守，未完成真实语言服务证据前不要把 experimental 语言升到 stable。

优先级 C：根据 diagnostics 数据决定是否引入 document symbols / references 辅助过滤。只有当现有 adapter/filter 无法解释真实噪音问题时再引入，且必须受预算、timeout 和 cache 保护。

最终必须运行并记录：
- npm run compile
- npm test
- npm run package
- npm run test:integration，如 Electron 宿主失败，需要记录精确失败原因

完成后更新 PR，并检查 GitHub CI 是否通过。
```

## 参考资料

- VS Code Programmatic Language Features API: https://code.visualstudio.com/api/language-extensions/programmatic-language-features
- Python extension Marketplace: https://marketplace.visualstudio.com/items?itemName=ms-python.python
- Pylance Marketplace: https://marketplace.visualstudio.com/items?itemName=ms-python.vscode-pylance
- Go extension Marketplace: https://marketplace.visualstudio.com/items?itemName=golang.Go
- Java navigation/editing docs: https://code.visualstudio.com/docs/java/java-editing
- C# Dev Kit Marketplace: https://marketplace.visualstudio.com/items?itemName=ms-dotnettools.csdevkit
- C/C++ Marketplace: https://marketplace.visualstudio.com/items?itemName=ms-vscode.cpptools
