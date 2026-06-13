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

## 第一批扩展语言

| 语言 | VS Code language id | 初始等级 | 推荐依赖 | 注释/文档来源目标 | Fallback 目标 | 验证目标 |
| --- | --- | --- | --- | --- | --- | --- |

## 第二批候选语言

| 语言 | 预期等级 | 初步策略 | 接入前需要确认 |
| --- | --- | --- | --- |
| PHP | `hover-only` 或 `experimental` | 依赖 PHP language server 的 hover/Javadoc-style docblock | 主流 PHP 扩展的 hover 输出质量 |
| Ruby | `hover-only` 或 `experimental` | 依赖 Solargraph 或 Ruby LSP hover | YARD 注释输出是否稳定 |
| Kotlin | `hover-only` 或 `experimental` | 依赖 Kotlin language server hover/KDoc | VS Code Kotlin language server 成熟度 |
| Swift | `hover-only` 或 `experimental` | 依赖 SourceKit-LSP hover/doc comment | macOS/SourceKit-LSP 环境要求 |
| C/C++ | `hover-only` 或 `experimental` | 依赖 C/C++ 扩展 hover/Doxygen-style comments | 多扩展生态下的 provider 差异 |

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
