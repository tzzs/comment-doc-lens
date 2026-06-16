# Comment Doc Lens 产品与分发优化方案

> 当前状态：2026-06-17。本文只保留当前事实、已完成内容和未完成内容；后续优先看“未完成”和“下一步建议”。

## 当前定位

Comment Doc Lens 的定位是：

**在代码引用处显示已有文档，不生成、不改写、不离开当前文件。**

英文主张：

**Read existing docs where symbols are used.**

它不和官方语言插件竞争 IntelliSense、definition、debug、test 或 lint，而是复用 VS Code 与已安装语言服务的 hover/definition 数据，在代码阅读层提供持续可见的文档上下文。

## 当前事实

- 包名：`comment-doc-lens`。
- 展示名：`Comment Doc Lens`。
- 版本：`0.4.2`。
- 命令命名空间：`commentDocLens.*`。
- 发布链：Marketplace、Open VSX、GitHub release、release-please。
- 核心边界：本地运行、不上传源码、不调用 LLM、不生成注释、不改写源文件。
- `stable` 语言：Go、TypeScript、JavaScript、TSX、JSX、Python、Java、Rust、PHP。
- `experimental` 语言：C#、Ruby、Kotlin、Swift、C、C++。
- 当前主要用户命令：
  - `Comment Doc Lens: Toggle`
  - `Comment Doc Lens: Refresh`
  - `Comment Doc Lens: Show Language Status`
  - `Comment Doc Lens: Diagnose Workspace`
  - `Comment Doc Lens: Copy Diagnostics for Issue`
  - `Comment Doc Lens: Explain Hidden Hint`
  - `Comment Doc Lens: Open Sample Gallery`

## 已完成

### 品牌与入口

- `package.json`、README、README_CN、发布 workflow、release-please 配置、命令标题和配置项描述已统一到 `Comment Doc Lens` / `comment-doc-lens` / `commentDocLens.*`。
- README/README_CN 已强调“读取已有文档”的产品边界，并说明本地、非生成式、不改写源码。
- `package.nls.json` 与 `package.nls.zh-cn.json` 已覆盖命令标题和配置项描述，中文 VS Code 环境下可展示本地化文案。

### P2：官方级体验细节

- `provideInlayHints` 返回轻量 summary；tooltip、definition location、full docs 通过 `resolveInlayHint` 惰性解析。
- 新增 `Comment Doc Lens` Output Channel，记录 refresh、language status、workspace diagnosis、hidden hint explanation 和 lazy resolution 等诊断事件。
- 新增 `Comment Doc Lens: Diagnose Workspace`，扫描代表性 workspace 文件并汇总语言服务状态。
- 新增 `Comment Doc Lens: Copy Diagnostics for Issue`，复制可粘贴到 issue 的 Markdown 诊断报告。
- 新增 `Comment Doc Lens: Explain Hidden Hint`，解释全局禁用、语言未启用、语言覆盖禁用、行过长、无候选符号和无可用文档等常见原因。

### P3：语言质量第一轮

- Python、Java、Rust、PHP 已进入 `stable`，具备 adapter tests、fixture、source fallback 或明确 fallback 策略。
- PHP 已覆盖 class、function、method、property、const 的 PHPDoc 与本地 definition fallback。
- C# 已具备 XML docs source fallback。
- Ruby 已具备 YARD/RDoc source fallback。
- Kotlin 已具备 KDoc source fallback。
- Swift 已具备 `///` 与 block doc comment fallback。
- C/C++ 已具备 Doxygen-style fallback，并在支持矩阵中保留 compile commands/include path 相关限制。

### P4：增长功能与样例资产

- 新增 `docs/sample-gallery.md`，覆盖 Go、TypeScript、Python、Java、Rust、PHP 与第二批语言说明。
- 新增 `docs/articles/inline-docs-without-generating-comments.md`，说明它是 reading tool，不是文档生成器、不调用 LLM、不上传源码。
- README 和 README_CN 已链接 sample gallery、技术文章、维护指标和发布质量清单。

### P5：维护机制与指标

- 新增 `docs/maintenance-metrics.md`，定义 monthly quality release、quarterly language upgrade、weekly triage、增长指标和语言晋级规则。
- 新增 `docs/release-quality-checklist.md`，覆盖 `npm test`、`npm run package`、integration 可用性、README/docs/package.nls 检查、Marketplace/Open VSX 发布验证和 post-release watch。

### 仓库交接与索引

- 新增 `AGENTS.md`，记录 agent 接手项目时的工作流、验证命令和当前 source of truth。
- 新增 `docs/README.md`，作为 docs 入口索引，区分当前文档、历史设计和状态记录。
- 新增 `npm run harness:check`，校验关键交接文档与 npm scripts 是否存在。

## 未完成

### 公开入口与转化

- 发布前重新核对 Marketplace、Open VSX、GitHub release、release tag、README 链接和仓库 URL 是否都指向同一个 `comment-doc-lens` 入口。
- 补 GitHub topics，覆盖 `vscode-extension`、`documentation`、`inlay-hints`、`doc-comments`、`docstring`、`code-reading` 等检索词。
- 补 issue templates：bug report、missing hint diagnostics、language support request。
- 补一张真实 Before/After 截图或 10 秒以内 GIF，并同步 README、Marketplace、Open VSX 和 release notes。

### 语言质量证据

- 为 C#、Ruby、Kotlin、Swift、C/C++ 补真实语言服务 integration 证据、截图或手工验证记录。
- 为 Python、Java、Rust、PHP 各补一张代表性截图或手工验证记录，支撑 `stable` 语言对外展示。
- 发布后根据第一批诊断报告，调整 Output Channel 事件字段，让用户更容易解释 missing hints。

### 发布后指标闭环

- 发布后记录 Marketplace installs/downloads、Open VSX downloads、GitHub issues、ratings/reviews 和 diagnostics report 使用率。
- 按 `docs/maintenance-metrics.md` 维护 monthly quality release 记录。
- 按季度选择一个语言升级目标，升级前必须同步支持矩阵、fixture、测试和验证证据。

### 后续可选技术增强

- 评估 document symbols / references 是否能进一步降低误匹配；只有在现有 adapter/filter 不足时再引入。
- 评估是否需要更细的 per-language timeout/cache 指标，帮助定位大型 workspace 的 hint 延迟。
- 评估是否需要把 workspace diagnosis 输出拆成更适合 GitHub issue 的最小复现模板。

## 下一步建议

### 近期 1 周

1. 完成公开入口一致性核对。
2. 补 GitHub topics 和 issue templates。
3. 补真实 Before/After 截图或短 GIF。
4. 用 `Comment Doc Lens: Copy Diagnostics for Issue` 输出样例完善 issue 模板。

### 接下来 2-4 周

1. 补 C#、Ruby、Kotlin、Swift、C/C++ 的真实语言服务 evidence。
2. 补 Python、Java、Rust、PHP 的代表性截图或手工验证记录。
3. 根据真实 issue 调整 diagnostics 字段和 hidden hint explanation。

### 1-2 个月

1. 按月记录质量版本、下载、安装、issue 和评分变化。
2. 从 diagnostics 数据中选择一个语言质量升级目标。
3. 决定是否进入 document symbols / references 辅助过滤阶段。

## 验收口径

- 对外信息统一为 `Comment Doc Lens`、`comment-doc-lens` 和 `Read existing docs where symbols are used`。
- 用户可以复制诊断报告解释“为什么没有显示 hint”。
- Python、Java、Rust、PHP 的 `stable` 状态有测试、fixture、矩阵和演示证据支撑。
- C#、Ruby、Kotlin、Swift、C/C++ 的 `experimental` 状态有 fallback 测试、矩阵和限制说明支撑。
- README、README_CN、语言矩阵、sample gallery、维护指标、发布清单与实际功能一致。
- 后续每个语言升级都按矩阵、fixture、测试、截图或手工记录、发布记录闭环。
