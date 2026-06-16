# Comment Doc Lens 语言支持矩阵

本文档记录 Comment Doc Lens 的语言支持等级、依赖、注释策略、fallback 策略和验证状态。后续新增语言必须先进入本矩阵，或与实现同一提交进入本矩阵。

## 支持等级

| 等级 | 含义 | 进入条件 |
| --- | --- | --- |
| `stable` | 默认支持，并在 README 中推荐使用 | 有 fixtures、自动化测试、文档说明，并覆盖常见注释格式 |
| `experimental` | 可用，但存在已知限制 | 基础 hover 或 fallback 行为能覆盖代表性 fixture |
| `hover-only` | 只依赖 VS Code 语言服务 hover/definition 输出 | 可展示有用文档，但还没有自定义 source fallback |
| `planned` | 已列入路线图但尚未实现 | 有预期支持方式和验证目标 |

## 当前支持

| 语言 | VS Code language id | 等级 | 推荐依赖 | 注释/文档来源 | Fallback 策略 | 验证状态 |
| --- | --- | --- | --- | --- | --- | --- |
| Go | `go` | `stable` | 官方 Go 扩展和 gopls | hover、definition hover、`//`、`/* */` | 当 hover 只有签名或无可用文档时，读取定义附近源码注释；本地 definition provider 不可用时可扫描 Go 定义 | 单元测试覆盖 Go declaration 过滤、source fallback、timeout；integration fixture 已存在 |
| TypeScript | `typescript` | `stable` | VS Code 内置 TypeScript 服务 | hover、definition hover、JSDoc | 暂无自定义 source fallback | 单元测试和 integration fixture 覆盖常量、变量、enum、函数、class、method、object method |
| JavaScript | `javascript` | `stable` | VS Code 内置 TypeScript/JavaScript 服务 | hover、definition hover、JSDoc | 暂无自定义 source fallback | 单元测试和 integration fixture 覆盖 JSDoc 引用 |
| TSX | `typescriptreact` | `stable` | VS Code 内置 TypeScript 服务 | hover、definition hover、JSDoc | 暂无自定义 source fallback | integration fixture 覆盖 JSX tag 噪音过滤 |
| JSX | `javascriptreact` | `stable` | VS Code 内置 JavaScript 服务 | hover、definition hover、JSDoc | 暂无自定义 source fallback | 与 TypeScript-family adapter 共用过滤规则和单元测试 |
| Python | `python` | `experimental` | Python 扩展和 Pylance | hover、definition hover、function/class docstring | 读取定义后的 `"""..."""`、`'''...'''` docstring；缺少语言服务时安静降级 | Python adapter 单元测试覆盖 declaration 过滤、本地 definition fallback 和 docstring 读取；fixture 已存在 |
| Java | `java` | `experimental` | Extension Pack for Java 或等价 language server | hover、definition hover、Javadoc | 读取定义前 `/** ... */` Javadoc | Java adapter 单元测试覆盖 declaration 过滤、本地 definition fallback 和 Javadoc 读取；fixture 已存在 |
| Rust | `rust` | `experimental` | rust-analyzer | hover、definition hover、`///`、`//!` 文档注释 | 读取定义前连续 `///` 或 `//!` 文档注释 | Rust adapter 单元测试覆盖 declaration 过滤、本地 definition fallback 和 doc comment 读取；fixture 已存在 |
| C# | `csharp` | `hover-only` | C# Dev Kit 或 OmniSharp | hover、definition hover、XML docs | 暂不启用 source fallback；依赖语言服务 hover 输出 | C# adapter 单元测试覆盖 hover-only 元数据；fixture 已存在 |
| PHP | `php` | `experimental` | Intelephense | hover、definition hover、PHPDoc | 读取定义前 `/** ... */` PHPDoc | PHP adapter 单元测试覆盖 class、function、method、property、const declaration 过滤、本地 definition fallback 和 PHPDoc 读取；手动 fixture 已存在 |
| Ruby | `ruby` | `hover-only` | Ruby LSP | hover、definition hover、YARD/RDoc | 暂不启用 source fallback；依赖语言服务 hover 输出 | Ruby adapter 单元测试覆盖 hover-only 元数据 |
| Kotlin | `kotlin` | `hover-only` | Kotlin | hover、definition hover、KDoc | 暂不启用 source fallback；依赖 Kotlin language server hover 输出 | Kotlin adapter 单元测试覆盖 hover-only 元数据和推荐扩展诊断 |
| Swift | `swift` | `hover-only` | Swift | hover、definition hover、doc comment | 暂不启用 source fallback；依赖 SourceKit-LSP 和本机 Swift 工具链 | Swift adapter 单元测试覆盖 hover-only 元数据和推荐扩展诊断 |
| C | `c` | `hover-only` | C/C++ | hover、definition hover、Doxygen | 暂不启用 source fallback；依赖 C/C++ 扩展索引配置 | C/C++ adapter 单元测试覆盖 `c`/`cpp` 双 language id 和推荐扩展诊断 |
| C++ | `cpp` | `hover-only` | C/C++ | hover、definition hover、Doxygen | 暂不启用 source fallback；依赖 C/C++ 扩展索引配置 | 与 C 共用 C/C++ adapter |

## 语言服务健康检查

命令面板中的 `Comment Doc Lens: Show Language Status` 会对当前文件和光标位置执行轻量检查，并返回 `ready`、`degraded`、`missingDependency` 或 `unknown`。检查内容包括推荐扩展是否安装、hover provider 是否返回可用文档、definition provider 是否返回位置，以及 adapter 是否具备 source fallback。

| 语言 | 推荐扩展 ID | 健康检查能力 | 期望状态 |
| --- | --- | --- | --- |
| Go | `golang.Go` | extension、hover、definition、source fallback | gopls 正常时为 `ready`；hover 缺失但 fallback 可用时为 `degraded` |
| TypeScript / JavaScript / TSX / JSX | VS Code 内置 | hover、definition | 内置服务可返回 hover/definition 时为 `ready` |
| Python | `ms-python.python`, `ms-python.vscode-pylance` | extension、hover、definition、source fallback | Python/Pylance 安装且当前位置有文档时为 `ready` |
| Java | `vscjava.vscode-java-pack` | extension、hover、definition、source fallback | Java language server 就绪且 Javadoc 可解析时为 `ready` |
| Rust | `rust-lang.rust-analyzer` | extension、hover、definition、source fallback | rust-analyzer 就绪且 doc comment 可解析时为 `ready` |
| C# | `ms-dotnettools.csdevkit` | extension、hover、definition | C# Dev Kit 返回 XML docs hover 时为 `ready`；无 source fallback 时 definition 缺失会降级 |
| PHP | `bmewburn.vscode-intelephense-client` | extension、hover、definition、source fallback | Intelephense 就绪且 PHPDoc 可解析时为 `ready` |
| Ruby | `shopify.ruby-lsp` | extension、hover、definition | Ruby LSP 返回 YARD/RDoc hover 时为 `ready`；无 source fallback 时 definition 缺失会降级 |
| Kotlin | `fwcd.kotlin` | extension、hover、definition | Kotlin language server 返回 KDoc hover 时为 `ready`；缺少扩展时为 `missingDependency` |
| Swift | `swiftlang.swift-vscode` | extension、hover、definition | Swift 扩展和 SourceKit-LSP 可用时为 `ready`；缺少本机工具链时通常为 `degraded` |
| C/C++ | `ms-vscode.cpptools` | extension、hover、definition | C/C++ 扩展索引到当前文件时为 `ready`；include path 或 compile commands 缺失时通常为 `degraded` |

## 文档质量与噪音过滤

Comment Doc Lens 现在在 formatter、resolver 和 hint builder 三层执行文档质量控制：

- formatter 会跳过 signature-only code block，并可按最小词数过滤低价值摘要；
- resolver 会合并全局 `commentDocLens.minimumDocumentationWords` 与 adapter 的 `documentationQuality.minimumWords`，采用更严格的值；
- hint builder 会在最终展示前再次过滤 resolver 返回的短摘要，避免自定义 resolver 或 hover-only 语言绕过质量预算；
- C#、Ruby、Kotlin、Swift 和 C/C++ adapter 默认使用 `minimumWords: 2`，用于减少 bare type name、signature-like hover 等低信号提示。

新增语言时，如果 hover 输出常出现类型名、签名或单词摘要，应在 adapter 上声明 `documentationQuality.minimumWords`，并用单元测试覆盖该语言的噪音样例。

## 第一批扩展语言

| 语言 | VS Code language id | 初始等级 | 推荐依赖 | 注释/文档来源目标 | Fallback 目标 | 验证目标 |
| --- | --- | --- | --- | --- | --- | --- |

## 第二批候选语言

| 语言 | 预期等级 | 初步策略 | 接入前需要确认 |
| --- | --- | --- | --- |
| Kotlin | `experimental` | 在 hover-only 稳定后补 KDoc source fallback | VS Code Kotlin language server 在 Gradle/Maven 项目内的输出质量 |
| Swift | `experimental` | 在 hover-only 稳定后评估 doc comment source fallback | macOS/SourceKit-LSP 和 SwiftPM 项目环境要求 |
| C/C++ | `experimental` | 在 hover-only 稳定后单独设计 Doxygen fallback | compile commands、include path 和多扩展 provider 差异 |

详细评估见 [第二批语言接入评估](second-batch-language-evaluation.md)。

## 验证规则

新增或升级语言时必须满足：

- adapter 中声明 `languageIds`、`displayName`、`supportLevel` 和必要 fallback 能力；
- package activation/configuration 包含对应 language id；
- 至少一个 fixture 覆盖该语言的代表性文档注释；
- 单元测试覆盖 adapter 过滤、source fallback 或 hover-only 降级行为；
- 如可行，integration fixture 覆盖 VS Code 实际 inlay hint 输出；
- README 或本矩阵说明依赖、限制和验证状态；
- `npm test` 必须通过；
- 发布前运行 `npm run compile`、`npm test`、`npm run package`，并尽量运行 `npm run test:integration`。
