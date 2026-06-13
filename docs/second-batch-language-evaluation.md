# 第二批语言接入评估

本文档评估 PHP、Ruby、Kotlin、Swift、C/C++ 的接入策略。当前 PHP 已进入 `experimental`，Ruby、Kotlin、Swift、C/C++ 已进入 `hover-only`；本文档保留后续升级到 source fallback 的进入条件和验证门槛。

## 结论摘要

| 语言 | 建议初始等级 | 建议策略 | 接入优先级 |
| --- | --- | --- | --- |
| PHP | `experimental` | 先支持 docblock fallback，再依赖 language server hover 补充 | 高 |
| Ruby | `hover-only` | 先依赖 Ruby LSP 或 Solargraph hover，暂不承诺 YARD fallback | 中 |
| Kotlin | `hover-only` | 先验证 Kotlin language server hover 质量，再评估 KDoc fallback | 中 |
| Swift | `hover-only` | 依赖 SourceKit-LSP hover；fallback 受本机工具链影响，后置 | 中低 |
| C/C++ | `hover-only` | 先依赖 C/C++ 扩展 hover；Doxygen fallback 需要单独设计 | 中低 |

## PHP

当前等级：`experimental`

PHP 的 docblock 形式和 Java/JSDoc 接近，source fallback 的实现风险较低。当前已优先支持：

- class/function 前的 `/** ... */`；
- `function name(...)`、`class Name`、`enum Name`、`interface Name`、`trait Name` 的本地 definition fallback。

后续升级目标：

- method/property 前的 PHPDoc；
- `$variable` 左值过滤；
- `const NAME` 的本地 definition fallback。

验证门槛：

- PHP fixture 覆盖 class、function、method、property docblock；
- adapter 单元测试覆盖 `$` 前缀变量、docblock 读取和 declaration 过滤；
- README 或支持矩阵标注推荐 PHP language server。

## Ruby

当前等级：`hover-only`

Ruby 的注释和 YARD 约定很常见，但不同语言服务对 hover 输出和定义跳转的质量差异较大。建议先以 hover-only 进入矩阵，等确认 Ruby LSP 或 Solargraph 的输出稳定后，再补 YARD fallback。

验证门槛：

- Ruby fixture 覆盖 class、method 和 constant；
- adapter 元数据明确 `hover-only`；
- 文档说明需要 Ruby LSP 或 Solargraph；
- 后续升级到 `experimental` 前，需要 YARD 注释读取测试。

## Kotlin

当前等级：`hover-only`

Kotlin 的 KDoc 结构适合 fallback，但 VS Code Kotlin language server 成熟度和项目配置差异较大。建议先验证 hover 质量，再决定是否读取源码 KDoc。

验证门槛：

- Kotlin fixture 覆盖 class、function、property；
- adapter 元数据明确 `hover-only`；
- 文档说明 language server 限制；
- 升级到 `experimental` 前，需要 `/** ... */` KDoc fallback 测试。

## Swift

当前等级：`hover-only`

Swift 的 SourceKit-LSP 通常依赖本机 Xcode/Swift toolchain。为了避免跨平台不稳定，建议初始阶段只暴露 hover-only 支持，不做 source fallback。

验证门槛：

- Swift fixture 覆盖 type、function、property；
- adapter 元数据明确 `hover-only`；
- 文档说明 SourceKit-LSP 和本机工具链依赖；
- integration 验证如果依赖本机工具链，必须记录环境条件。

## C/C++

当前等级：`hover-only`

C/C++ 的语言服务生态和 Doxygen 注释风格差异较大，definition provider 可能受 compile commands、include path 和扩展选择影响。建议先以 hover-only 进入，等确认主流 C/C++ 扩展输出后，再单独设计 Doxygen fallback。

验证门槛：

- C 和 C++ fixture 分开覆盖 function、struct/class、enum；
- adapter 元数据明确 `hover-only`；
- 文档说明需要 C/C++ 扩展和项目索引配置；
- 升级到 `experimental` 前，需要 Doxygen `///` 和 `/** ... */` fallback 测试。

## 后续执行顺序

1. PHP：补 method/property/const fallback，并增加 integration fixture。
2. Ruby：观察 Ruby LSP/Solargraph 输出，稳定后评估 YARD fallback。
3. Kotlin：基于 Gradle/Maven fixture 评估 KDoc fallback。
4. Swift：依赖本机工具链，适合在有稳定 macOS/SwiftPM 验证环境时推进。
5. C/C++：需要额外处理项目索引差异和 Doxygen 风格差异，建议单独设计后推进。
