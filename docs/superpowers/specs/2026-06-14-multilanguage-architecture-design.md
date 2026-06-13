# Comment Doc Lens 多语言架构设计

## 背景

Comment Doc Lens 当前通过 VS Code inlay hints 在引用位置展示定义注释和符号文档。当前版本已经支持 Go、TypeScript、JavaScript、TSX 和 JSX，主要流程如下：

- 扫描可见范围内的标识符；
- 通过 VS Code hover 和 definition provider 解析文档；
- 当 Go 的语言服务 hover 只返回签名或不可用文档时，回退读取源码注释；
- 将第一条可用文档摘要格式化为行尾 inlay hint。

这个结构已经能支撑第一版能力，但语言差异开始渗透到核心路径里。Go 有自定义 fallback，TSX/JSX 需要特殊噪音过滤，未来语言还会有不同的注释格式、声明过滤规则、超时预期和文档质量差异。

下一阶段应优先建立稳定的语言架构，再扩展更多语言。语言广覆盖和用户体验优化仍然纳入计划，但必须建立在 adapter 模型之上，避免继续在核心 pipeline 中增加一次性条件判断。

## 目标

- 引入 language adapter 和 language registry 架构，隔离所有语言特定行为。
- 将现有 Go 和 TypeScript-family 行为迁移到 adapter 中，同时保持用户可见行为不变。
- 建立语言支持矩阵，记录支持等级、依赖、注释风格、fallback 策略和验证状态。
- 分批增加新语言，第一批优先 Python、Java、Rust 和 C#。
- 保持产品边界：只展示文档注释和符号文档的 display-only inlay hints，不展示运行时值。
- 为每个阶段定义清晰验证出口，方便后续让 Codex 按目标执行优化。

## 非目标

- 不在一个阶段内承诺所有语言都达到 stable。
- 不给 inlay hints 增加跳转、hover action 或 command link。
- 不推断运行时值，不执行项目代码。
- 不继续在核心 pipeline 文件中堆叠语言特例。
- 不要求用户安装所有语言扩展；语言服务不可用时应安静降级。

## 架构方案

扩展应拆成三层。

| 层级 | 职责 | 示例模块 |
| --- | --- | --- |
| Core Pipeline | 扫描可见文本、调度文档解析、执行预算限制、格式化和去重 hints | `hintBuilder`、`documentationResolver`、`documentationFormatter` |
| Language Registry | 将 VS Code `languageId` 映射到 language adapter，并暴露已启用语言 | `languageRegistry` |
| Language Adapters | 定义语言特定的注释格式、声明过滤、噪音过滤、fallback 查找和超时行为 | `languages/go`、`languages/typescriptFamily`、`languages/python` |

adapter 边界应保证新增或调整一种语言时，不需要修改核心 hint pipeline。

### Adapter 契约

具体 TypeScript 命名可以在实现阶段微调，但契约需要覆盖以下能力：

```ts
interface LanguageAdapter {
  languageIds: readonly string[];
  displayName: string;
  supportLevel: 'stable' | 'experimental' | 'hover-only';

  isDeclarationCandidate?(candidate: SymbolCandidate, line: string): boolean;
  isNoisyCandidate?(candidate: SymbolCandidate, line: string): boolean;

  sourceComment?: {
    canRead(location: LocationLike): boolean;
    findDefinitionLine?(
      document: SourceDocument,
      candidate: SymbolCandidate,
      location: LocationLike
    ): number | undefined;
    collectLeadingComments(document: SourceDocument, definitionLine: number): string[];
  };

  resolveTimeoutMs?: number;
}
```

adapter 只描述语言行为，不接管完整 pipeline。核心层仍然负责 cancellation、cache 限制、hint 位置、文档格式化和 display-only inlay hint 构造。

### Registry 行为

registry 需要：

- 暴露完整的支持语言 id 列表，用于 activation 和 provider registration；
- 根据 `languageId` 解析唯一 adapter；
- 兼容现有 `commentDocLens.languages` 配置；
- 让文档和测试可以读取支持等级与依赖元数据。

初始 registry 应包含：

- Go adapter：`go`；
- TypeScript-family adapter：`typescript`、`javascript`、`typescriptreact`、`javascriptreact`。

## 数据流

运行时路径应尽量保持当前行为：

1. VS Code 根据已注册语言 id 和命令激活扩展。
2. inlay hint provider 收到 document 和 range。
3. provider 通过 language registry 获取当前 document 对应 adapter。
4. candidate scanner 扫描可见标识符。
5. core pipeline 应用通用过滤规则，并叠加 adapter 的声明过滤和噪音过滤。
6. resolver 优先尝试 reference hover 文档。
7. 当需要 definition，或 adapter 认为 source fallback 可以改善低质量 hover 文本时，resolver 查询 definition location。
8. resolver 尝试 definition hover 文档。
9. 如果 adapter 启用了 source fallback，resolver 在定义附近读取源码注释。
10. formatter 提取第一条有用文档摘要，并按设置截断。
11. hint builder 去重行内摘要、应用预算限制、将 hint 放在行尾，并返回 display-only inlay hints。

## 现有语言迁移

### Go

将 Go 特定行为迁出核心文件：

- Go 标识符的本地 definition fallback；
- Go 声明上下文过滤；
- 更长的 Go resolve timeout；
- 从 `//` 和 `/* */` 注释读取 Go source comment fallback。

验证必须证明现有 Go 行为不回退。

### TypeScript Family

将 TypeScript、JavaScript、TSX 和 JSX 行为迁入共享 adapter：

- `class`、`const`、`enum`、`function`、`interface`、`let`、`type`、`var` 的声明名过滤；
- property chain 尾部优先；
- JSX tag name 过滤；
- JSX attribute name 过滤。

验证必须证明 TS、JS、TSX 和 JSX fixture 仍然能生成有用 hint，并且不会出现 tag 或 attribute 噪音。

## 语言扩展策略

语言支持分为三个等级。

| 等级 | 含义 | 进入条件 |
| --- | --- | --- |
| `stable` | 默认支持，并在文档中推荐使用 | 有 fixtures、测试、文档，并覆盖常见注释格式 |
| `experimental` | 可用，但文档需要标明已知限制 | 基础 hover 或 fallback 行为能覆盖代表性 fixture |
| `hover-only` | 仅依赖语言服务 hover 或 definition 输出 | 可以提供有用展示，但暂时没有自定义 source fallback |

第一批扩展语言：

| 语言 | 初始等级 | 原因 | 验证重点 |
| --- | --- | --- | --- |
| Python | `experimental`，之后升级到 `stable` | 用户量高，docstring 约定清晰 | 函数/class docstring、变量引用、安静降级 |
| Java | `experimental` | Javadoc 常见，语言服务成熟 | class、method、field Javadoc |
| Rust | `experimental` | `///` 文档注释常见且结构化 | function、struct、enum variant 文档 |
| C# | `hover-only`，之后升级到 `experimental` | XML docs 常见，但 VS Code 行为强依赖扩展 | `/// <summary>` hover 质量和 fallback 可行性 |

第二批扩展语言：

- PHP；
- Ruby；
- Kotlin；
- Swift；
- C/C++。

每种语言必须在实现前或实现同时进入支持矩阵。

## 用户体验计划

用户体验优化应在 adapter 迁移之后推进，而不是先于架构调整。

计划中的 UX 优化：

- 保持 `commentDocLens.languages` 向后兼容；
- registry 建立后再增加 per-language 配置；
- 文档中说明每种语言的依赖和支持等级；
- 通过 adapter-specific 规则减少噪音 hint；
- 保持 display-only hint 行为；
- 保持 `commentDocLens.toggle` 和 `commentDocLens.refresh` 行为稳定；
- 在支持等级建立后，优化设置项描述。

## 错误处理和降级

| 风险 | 必须行为 |
| --- | --- |
| 未安装对应语言服务 | 安静返回空 hints，并在文档中说明依赖 |
| hover 文本只有签名 | formatter 和 adapter 规则应尽量避免展示 signature-only 噪音 |
| definition provider 很慢 | 核心层执行超时限制，并允许 adapter 覆盖语言级 timeout |
| source fallback 不可靠 | 仅对有明确规则和测试的 adapter 启用 fallback |
| 大文件产生过多候选 | 遵守 `maxHintsPerRequest`、扫描预算、并发限制、cancellation 和 cache 上限 |
| 配置禁用某语言 | provider 对该语言返回空 hints |

## 验证计划

| 阶段 | 验证方式 | 通过标准 |
| --- | --- | --- |
| Adapter 架构 | `npm test` | 迁移后现有单元测试通过 |
| Registry | 新增 registry 单元测试 | 每个 language id 都映射到预期 adapter，禁用语言不会运行 |
| Go 迁移 | Go adapter 单元测试和现有 integration fixture | Go source fallback 仍能提取 `//` 和 block comments |
| TypeScript-family 迁移 | 现有 hint builder 和 integration 测试 | TS/JS/TSX/JSX hints 仍然有用，JSX 噪音仍被过滤 |
| Documentation resolver | resolver 测试 | reference hover、definition hover、source fallback、cache 上限和 max length 仍正常 |
| Python adapter | Python fixture 和测试 | function 与 class docstring 能产生 hints；缺少语言服务时安静降级 |
| Java adapter | Java fixture 和测试 | class、method、field 的 Javadoc 能产生 hints |
| Rust adapter | Rust fixture 和测试 | function、struct、enum variant 的 `///` 注释能产生 hints |
| C# adapter | C# fixture 和测试 | 可用时展示 XML summary hover 输出 |
| 性能 | timeout、cancellation 和 cache 测试 | 慢 provider 不产生 stale hints，cache 上限保持生效 |
| 文档 | README 或 docs 审查 | 支持矩阵、依赖、支持等级和限制完整一致 |
| 发布准备 | `npm run compile`、`npm test`、可选 `npm run test:integration`、`npm run package` | 编译、单元测试和打包通过；integration 问题需要记录精确失败原因 |

## 实施阶段

| 阶段 | 优先级 | 目标 | 产物 | 验收标准 |
| --- | ---: | --- | --- | --- |
| P0.1 | 最高 | 建立 language adapter 和 registry 基础 | adapter types、registry、registry tests | 核心层可以解析 adapter，当前 language ids 已注册 |
| P0.2 | 最高 | 迁移 Go 和 TypeScript-family 行为 | `go` adapter、`typescriptFamily` adapter、迁移后的过滤和 fallback | 现有测试通过，用户行为不回退 |
| P0.3 | 最高 | 建立语言支持矩阵 | README 章节或 `docs/language-support.md` | 矩阵列出等级、依赖、fallback、限制和验证状态 |
| P1.1 | 高 | 增加 Python | Python adapter、fixtures、tests、docs | Python docstring 能产生有用 hints 或安静降级 |
| P1.2 | 高 | 增加 Java、Rust 和 C# | adapters、fixtures、tests、docs | 每种语言都有明确支持等级和基础验证 |
| P2.1 | 中 | 改善 per-language UX | 向后兼容的配置更新 | 用户可以按语言启停行为，不破坏旧设置 |
| P2.2 | 中 | 改善性能和噪音控制 | 更多 timeout、cancellation、cache 和 filter 测试 | 大文件和慢语言服务保持可控 |
| P3 | 中低 | 评估第二批语言 | PHP、Ruby、Kotlin、Swift、C/C++ 评估或 adapters | 每种语言进入 `experimental` 或 `hover-only`，或记录拒绝原因 |

## Codex 执行目标

后续实现时可使用以下目标描述：

```md
将 Comment Doc Lens 升级为可扩展的多语言架构。

第一步，引入 language adapter 和 registry 层。将现有 Go、TypeScript、JavaScript、TSX、JSX 行为迁移到 adapters 中，同时保持所有当前用户可见行为不变。现有测试和 integration 预期不能回退。

第二步，建立语言支持矩阵，记录支持等级、所需 VS Code 语言扩展、支持的注释风格、fallback 策略、已知限制和验证状态。

第三步，在可行范围内按 Python、Java、Rust、C# 的顺序增加语言支持。每种语言必须包含 adapter 元数据、fixtures、测试、文档和明确降级行为。

最后，通过 per-language 设置、更好的噪音过滤、timeout/cancellation 行为、cache 上限和大文件预算改善用户体验与可靠性。

保持产品边界不变：只展示用于总结文档注释或语言服务符号文档的 display-only inlay hints。不要增加跳转 action、hover action 或运行时值推断。
```
