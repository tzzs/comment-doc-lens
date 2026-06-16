# 第二批语言接入评估

> 2026-06-17 更新：本文档最初用于评估 PHP、Ruby、Kotlin、Swift、C/C++ 的接入策略。当前第一轮接入已经完成：PHP 为 `stable`，Ruby、Kotlin、Swift、C、C++ 为 `experimental`，并且都具备 source fallback。本文档现在记录当前状态、剩余验证门槛和后续执行顺序。

## 结论摘要

| 语言 | 当前等级 | 当前策略 | 下一步 |
| --- | --- | --- | --- |
| PHP | `stable` | PHPDoc source fallback + Intelephense hover 优先 | 补 Intelephense 环境截图或手工验证记录 |
| Ruby | `experimental` | YARD/RDoc source fallback + Ruby LSP/Solargraph hover 优先 | 验证真实语言服务 hover 输出质量 |
| Kotlin | `experimental` | KDoc source fallback + Kotlin language server hover 优先 | 在 Gradle/Maven fixture 中验证 KDoc hover |
| Swift | `experimental` | Swift doc comment fallback + SourceKit-LSP hover 优先 | 在 macOS/SwiftPM 环境记录可复现验证条件 |
| C/C++ | `experimental` | Doxygen-style fallback + C/C++ extension hover 优先 | 在 compile commands/include path 场景验证输出 |

## PHP

当前等级：`stable`

当前已支持：

- class/function 前的 `/** ... */`；
- method/property 前的 PHPDoc；
- `function name(...)`、`class Name`、`enum Name`、`interface Name`、`trait Name`、`const NAME`、typed property 的本地 definition fallback；
- `$variable` 左值过滤；
- README 和 `docs/language-support.md` 中的推荐依赖说明。

后续升级目标：

- 更复杂的 namespace/use 场景；
- inherited PHPDoc 和 magic method 行为；
- integration fixture 在安装 Intelephense 的环境中验证 hover 输出。

## Ruby

当前等级：`experimental`

当前已支持：

- Ruby LSP 作为推荐语言服务；
- definition hover 优先；
- 定义前连续 `#` YARD/RDoc comment source fallback；
- fixture 和 adapter 单元测试覆盖 YARD/RDoc fallback。

后续升级到 `stable` 前需要：

- Ruby LSP 或 Solargraph 环境中的真实 hover 输出记录；
- class、method、constant 的截图或手工验证记录；
- 对 bare type/signature-like hover 噪音的回归样例。

## Kotlin

当前等级：`experimental`

当前已支持：

- Kotlin language server 推荐依赖；
- `/** ... */` KDoc source fallback；
- class、function、property 的 fixture 和 adapter 单元测试。

后续升级到 `stable` 前需要：

- Gradle/Maven fixture 中的真实 hover/definition 输出记录；
- Kotlin language server 未就绪时的 missingDependency/degraded 诊断记录；
- KDoc fallback 与语言服务 hover 互补关系说明。

## Swift

当前等级：`experimental`

当前已支持：

- Swift extension / SourceKit-LSP 推荐依赖；
- `///` 和 `/** ... */` doc comment source fallback；
- type、function、property 的 fixture 和 adapter 单元测试。

后续升级到 `stable` 前需要：

- macOS + Swift toolchain + SwiftPM fixture 的验证记录；
- SourceKit-LSP 未安装、未索引、索引完成三种状态的诊断说明；
- 真实 hover 输出和 fallback 命中的截图或日志。

## C/C++

当前等级：`experimental`

当前已支持：

- C/C++ extension 推荐依赖；
- Doxygen-style `///`、`//!`、`/** ... */` source fallback；
- `c` 与 `cpp` 双 language id；
- function、struct/class、enum 相关 fixture 和 adapter 单元测试。

后续升级到 `stable` 前需要：

- 有 compile commands 或 include path 配置的真实项目验证；
- C 与 C++ 分别保留截图或手工验证记录；
- 说明 C/C++ extension 索引失败时的 degraded 诊断和恢复建议。

## 后续执行顺序

当前不再优先实现新的第二批 adapter。下一步顺序是补证据：

1. PHP：补 Intelephense 真实语言服务验证记录，确认 stable 级别描述可信。
2. C#、Ruby、Kotlin、Swift、C/C++：各补一份真实 hover/definition + source fallback 记录。
3. Sample Gallery：把每个 experimental 语言的代表性示例补成可截图的 fixture。
4. Release Notes：发布时记录哪些语言只有 source fallback 证据，哪些已有真实语言服务证据。
5. 晋级评估：只有真实语言服务证据、fallback 测试、噪音过滤、README 和矩阵都闭环后，才从 `experimental` 升到 `stable`。
