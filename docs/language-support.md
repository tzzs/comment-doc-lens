# Comment Doc Lens 语言支持矩阵

本文档记录 Comment Doc Lens 的语言支持等级、依赖、注释策略、fallback 策略和验证状态。后续新增语言必须先进入本矩阵，或与实现同一提交进入本矩阵。

## 支持等级

| 等级 | 含义 | 进入条件 |
| --- | --- | --- |
| `stable` | 默认支持，并在 README 中推荐使用 | 有 fixtures、自动化测试、文档说明，并覆盖常见注释格式 |
| `experimental` | 可用，但存在已知限制 | 基础 hover 或 fallback 行为能覆盖代表性 fixture；真实语言服务 evidence 尚未完全闭环 |
| `planned` | 已列入路线图但尚未实现 | 有预期支持方式和验证目标 |

## 文档来源能力

`supportLevel` 只表示支持成熟度。adapter 还会单独声明文档来源能力，避免把“是否稳定”和“如何取文档”混在一起。

| 能力 | 含义 | 用户感知 |
| --- | --- | --- |
| `language-service` | 只依赖 VS Code 语言服务 hover/definition 输出 | 需要对应语言服务返回有用文档；没有本地源码注释 fallback |
| `language-service-with-source-fallback` | 优先使用 VS Code 语言服务；hover 缺失时可尝试读取定义附近源码注释 | 即使有 fallback，真实项目仍建议安装推荐扩展和工具链 |

## 当前支持

| 语言 | VS Code language id | 等级 | 文档来源能力 | 推荐依赖 | 注释/文档来源 | Fallback 策略 | 验证状态 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Go | `go` | `stable` | `language-service-with-source-fallback` | 官方 Go 扩展和 gopls | hover、definition hover、`//`、`/* */` | 当 hover 只有签名或无可用文档时，读取定义附近源码注释；本地 definition provider 不可用时可扫描 Go 定义 | 单元测试覆盖 Go declaration 过滤、source fallback、timeout；integration fixture 已存在 |
| TypeScript | `typescript` | `stable` | `language-service` | VS Code 内置 TypeScript 服务 | hover、definition hover、JSDoc | 暂无自定义 source fallback | 单元测试和 integration fixture 覆盖常量、变量、enum、函数、class、method、object method |
| JavaScript | `javascript` | `stable` | `language-service` | VS Code 内置 TypeScript/JavaScript 服务 | hover、definition hover、JSDoc | 暂无自定义 source fallback | 单元测试和 integration fixture 覆盖 JSDoc 引用 |
| TSX | `typescriptreact` | `stable` | `language-service` | VS Code 内置 TypeScript 服务 | hover、definition hover、JSDoc | 暂无自定义 source fallback | integration fixture 覆盖 JSX tag 噪音过滤 |
| JSX | `javascriptreact` | `stable` | `language-service` | VS Code 内置 JavaScript 服务 | hover、definition hover、JSDoc | 暂无自定义 source fallback | 与 TypeScript-family adapter 共用过滤规则和单元测试 |
| Python | `python` | `stable` | `language-service-with-source-fallback` | Python 扩展和 Pylance | hover、definition hover、function/class docstring | 读取定义后的 `"""..."""`、`'''...'''` docstring；缺少语言服务时安静降级 | Python adapter 单元测试覆盖 declaration 过滤、本地 definition fallback 和 docstring 读取；fixture 已存在 |
| Java | `java` | `stable` | `language-service-with-source-fallback` | Extension Pack for Java 或等价 language server | hover、definition hover、Javadoc | 读取定义前 `/** ... */` Javadoc | Java adapter 单元测试覆盖 declaration 过滤、本地 definition fallback 和 Javadoc 读取；fixture 已存在 |
| Rust | `rust` | `stable` | `language-service-with-source-fallback` | rust-analyzer | hover、definition hover、`///`、`//!` 文档注释 | 读取定义前连续 `///` 或 `//!` 文档注释 | Rust adapter 单元测试覆盖 declaration 过滤、本地 definition fallback 和 doc comment 读取；fixture 已存在 |
| C# | `csharp` | `experimental` | `language-service-with-source-fallback` | C# Dev Kit 或 OmniSharp | hover、definition hover、XML docs | 读取定义前连续 `///` XML doc comment | C# adapter 单元测试覆盖 XML docs source fallback；真实语言服务 fixture 已建立，capture 状态见 [language-service-evidence.md](language-service-evidence.md) |
| PHP | `php` | `stable` | `language-service-with-source-fallback` | Intelephense | hover、definition hover、PHPDoc | 读取定义前 `/** ... */` PHPDoc | PHP adapter 单元测试覆盖 class、function、method、property、const declaration 过滤、本地 definition fallback 和 PHPDoc 读取；手动 fixture 已存在 |
| Ruby | `ruby` | `experimental` | `language-service-with-source-fallback` | Ruby LSP | hover、definition hover、YARD/RDoc | 读取定义前连续 `#` YARD/RDoc comment | Ruby adapter 单元测试覆盖 YARD/RDoc fallback；真实语言服务 fixture 已建立，capture 状态见 [language-service-evidence.md](language-service-evidence.md) |
| Kotlin | `kotlin` | `experimental` | `language-service-with-source-fallback` | Kotlin | hover、definition hover、KDoc | 读取定义前 `/** ... */` KDoc | Kotlin adapter 单元测试覆盖 KDoc fallback；真实语言服务 fixture 已建立，capture 状态见 [language-service-evidence.md](language-service-evidence.md) |
| Swift | `swift` | `experimental` | `language-service-with-source-fallback` | Swift | hover、definition hover、doc comment | 读取定义前 `///` 或 `/** ... */` doc comment | Swift adapter 单元测试覆盖 doc comment fallback；真实语言服务 fixture 已建立，capture 状态见 [language-service-evidence.md](language-service-evidence.md) |
| C | `c` | `experimental` | `language-service-with-source-fallback` | C/C++ | hover、definition hover、Doxygen | 读取定义前 `///`、`//!` 或 `/** ... */` Doxygen comment | C/C++ adapter 单元测试覆盖 `c`/`cpp` 双 language id、推荐扩展诊断和 Doxygen fallback；真实语言服务 fixture 已建立，capture 状态见 [language-service-evidence.md](language-service-evidence.md) |
| C++ | `cpp` | `experimental` | `language-service-with-source-fallback` | C/C++ | hover、definition hover、Doxygen | 读取定义前 `///`、`//!` 或 `/** ... */` Doxygen comment | 与 C 共用 C/C++ adapter；真实语言服务 fixture 已建立，capture 状态见 [language-service-evidence.md](language-service-evidence.md) |

## 语言服务健康检查

命令面板中的 `Comment Doc Lens: Show Language Status` 会对当前文件和光标位置执行轻量检查，并返回 `ready`、`degraded`、`missingDependency` 或 `unknown`。检查内容包括推荐扩展是否安装、hover provider 是否返回可用文档、definition provider 是否返回位置，以及 adapter 是否具备 source fallback。

| 语言 | 推荐扩展 ID | 健康检查能力 | 期望状态 |
| --- | --- | --- | --- |
| Go | `golang.Go` | extension、hover、definition、source fallback | gopls 正常时为 `ready`；hover 缺失但 fallback 可用时为 `degraded` |
| TypeScript / JavaScript / TSX / JSX | VS Code 内置 | hover、definition | 内置服务可返回 hover/definition 时为 `ready` |
| Python | `ms-python.python`, `ms-python.vscode-pylance` | extension、hover、definition、source fallback | Python/Pylance 安装且当前位置有文档时为 `ready` |
| Java | `vscjava.vscode-java-pack` | extension、hover、definition、source fallback | Java language server 就绪且 Javadoc 可解析时为 `ready` |
| Rust | `rust-lang.rust-analyzer` | extension、hover、definition、source fallback | rust-analyzer 就绪且 doc comment 可解析时为 `ready` |
| C# | `ms-dotnettools.csdevkit` | extension、hover、definition、source fallback | C# Dev Kit 返回 XML docs hover 时为 `ready`；hover 缺失但 fallback 可用时为 `degraded` |
| PHP | `bmewburn.vscode-intelephense-client` | extension、hover、definition、source fallback | Intelephense 就绪且 PHPDoc 可解析时为 `ready` |
| Ruby | `shopify.ruby-lsp` | extension、hover、definition、source fallback | Ruby LSP 返回 YARD/RDoc hover 时为 `ready`；hover 缺失但 fallback 可用时为 `degraded` |
| Kotlin | `fwcd.kotlin` | extension、hover、definition、source fallback | Kotlin language server 返回 KDoc hover 时为 `ready`；缺少扩展时为 `missingDependency` |
| Swift | `swiftlang.swift-vscode` | extension、hover、definition、source fallback | Swift 扩展和 SourceKit-LSP 可用时为 `ready`；缺少本机工具链时通常为 `degraded` |
| C/C++ | `ms-vscode.cpptools` | extension、hover、definition、source fallback | C/C++ 扩展索引到当前文件时为 `ready`；include path 或 compile commands 缺失时通常为 `degraded` |

## 语言状态排查

`Show Language Status` 是保守的环境检查。只要推荐扩展缺失，状态会先返回 `missingDependency`，即使 adapter 已经具备 `sourceFallback=true`。这是预期行为：source fallback 只能在可识别的本地定义附近读取注释，完整项目、跨文件跳转和稳定 hover/definition 仍依赖语言服务。

| 状态片段 | 含义 | 用户下一步 |
| --- | --- | --- |
| `missingDependency` + `sourceFallback=true` | 推荐扩展未安装或未启用；Comment Doc Lens 有本地注释 fallback，但健康检查不会把它当成完整语言服务 | 安装提示中的扩展；如果只是验证同文件手工 fixture，确认使用最新 VSIX、打开调用点并运行 `Comment Doc Lens: Refresh` |
| `hover=false, definition=false, sourceFallback=true` | VS Code 当前没有返回 hover/definition；fallback 只能尝试本地扫描支持的定义形态 | 对真实项目安装扩展和工具链，等待索引完成；对 fixture 确认文件包含引用点而不是只有声明 |
| `degraded` + `sourceFallback=true` | 推荐扩展存在，但 hover 或 definition 暂时没有可用输出；fallback 可能仍可展示同文件/本地定义注释 | 把光标放在带文档的引用点，等待索引完成，运行 `Explain Hidden Hint` 或 `Copy Diagnostics for Issue` |
| `ready` | 推荐扩展和语言服务能力可用 | 若仍无提示，检查 `commentDocLens.enabled`、`commentDocLens.languages`、可见范围、最小词数和行长配置 |

Java 和 C# 的常见排查顺序：

1. 确认打开的是调用点，而不是定义行。手工 fixture 中 Java 使用 `displayLabel()` 里的 `ORDER_LABEL` / `formatStatus("paid")`，C# 使用 `DisplayLabel()` 里的 `FormatStatus("paid")`。
2. 确认安装的是当前构建的 VSIX，或 Extension Development Host 已重启。
3. 确认 VS Code language mode 分别是 `java` 和 `csharp`，且 `commentDocLens.languages` 没有排除对应 id。
4. Java 真实项目安装 `vscjava.vscode-java-pack` 和 JDK；C# 真实项目安装 C# Dev Kit 或 OmniSharp，并安装 .NET SDK。
5. 仍无法展示时，运行 `Comment Doc Lens: Show Language Status`、`Comment Doc Lens: Explain Hidden Hint` 和 `Comment Doc Lens: Copy Diagnostics for Issue`，把当前行、状态输出和诊断一起附到 issue。

## 文档质量与噪音过滤

Comment Doc Lens 现在在 formatter、resolver 和 hint builder 三层执行文档质量控制：

- formatter 会跳过 signature-only code block，并可按最小词数过滤低价值摘要；
- resolver 会合并全局 `commentDocLens.minimumDocumentationWords` 与 adapter 的 `documentationQuality.minimumWords`，采用更严格的值；
- hint builder 会在最终展示前再次过滤 resolver 返回的短摘要，避免自定义 resolver 或 language-service-only adapter 绕过质量预算；
- C#、Ruby、Kotlin、Swift 和 C/C++ adapter 默认使用 `minimumWords: 2`，用于减少 bare type name、signature-like hover 等低信号提示；这些语言的文档来源能力是 `language-service-with-source-fallback`，但仍保持 `experimental`，直到真实语言服务 integration 证据补齐。

新增语言时，如果 hover 输出常出现类型名、签名或单词摘要，应在 adapter 上声明 `documentationQuality.minimumWords`，并用单元测试覆盖该语言的噪音样例。

## 真实语言服务证据

C#、Ruby、Kotlin、Swift 和 C/C++ 的真实语言服务验证入口统一在 [Experimental language service evidence](language-service-evidence.md)。该文档记录：

- 最小 workspace fixture 路径；
- 推荐扩展和工具链要求；
- 当前本机可验证条件；
- `Show Language Status` 和 `Copy Diagnostics for Issue` 的 capture 模板；
- hover、definition 和 source fallback 的验证门槛。

当前这些语言不因 source fallback 完成而升级为 `stable`。只有真实语言服务 capture、fallback 测试、噪音过滤、截图或 Output Channel 记录、支持矩阵和 CI 全部闭环后，才进入稳定等级评估。

## 第一批扩展语言

| 语言 | VS Code language id | 初始等级 | 推荐依赖 | 注释/文档来源目标 | Fallback 目标 | 验证目标 |
| --- | --- | --- | --- | --- | --- | --- |

## 第二批候选语言

| 语言 | 预期等级 | 初步策略 | 接入前需要确认 |
| --- | --- | --- | --- |
| Kotlin | `experimental` | 已具备 KDoc source fallback，继续补真实语言服务 evidence | VS Code Kotlin language server 在 Gradle/Maven 项目内的输出质量 |
| Swift | `experimental` | 已具备 doc comment source fallback，继续补真实语言服务 evidence | macOS/SourceKit-LSP 和 SwiftPM 项目环境要求 |
| C/C++ | `experimental` | 已具备 Doxygen source fallback，继续补真实语言服务 evidence | compile commands、include path 和多扩展 provider 差异 |

详细评估见 [第二批语言接入评估](second-batch-language-evaluation.md)。

## 验证规则

新增或升级语言时必须满足：

- adapter 中声明 `languageIds`、`displayName`、`supportLevel`、`documentationSource` 和必要 fallback 能力；
- package activation/configuration 包含对应 language id；
- 至少一个 fixture 覆盖该语言的代表性文档注释；
- 单元测试覆盖 adapter 过滤、source fallback 或 language-service-only 降级行为；
- 如可行，integration fixture 覆盖 VS Code 实际 inlay hint 输出；
- README 或本矩阵说明依赖、限制和验证状态；
- `npm test` 必须通过；
- 发布前运行 `npm run compile`、`npm test`、`npm run package`，并尽量运行 `npm run test:integration`。
