# Comment Doc Lens 产品与分发优化方案

> 本方案最初基于 2026-06-16 的产品、竞品、Marketplace/Open VSX 和本地仓库分析整理。
> 2026-06-17 更新：主线已恢复 `comment-doc-lens` / `Comment Doc Lens` 品牌，PR #21 已完成 P2-P5 的实现、验证、冲突解决和 CI 检查。文件名保留 `comment-lens` 历史名称，正文以当前仓库事实为准。

## 核心定位

Comment Doc Lens 的定位保持不变：

**在代码引用处显示已有文档，不生成、不改写、不离开当前文件。**

英文主张：

**Read existing docs where symbols are used.**

它不和官方语言插件竞争 IntelliSense、definition、debug、test 或 lint，而是复用 VS Code 与已安装语言服务的 hover/definition 数据，在代码阅读层提供持续可见的文档上下文。

## 产品边界

Comment Doc Lens 应继续坚持：

- 只展示已有 doc comment、JSDoc、docstring、Javadoc、PHPDoc、Doxygen/YARD/KDoc/XML docs 或语言服务 hover 文档。
- 默认不修改源文件，不生成注释，不调用 LLM，不上传源码。
- 默认保持轻量 display-first；tooltip 和 definition location 只在 `commentDocLens.enableHintInteractions` 打开后惰性解析。
- 以引用处阅读为核心，不转向 TODO 高亮、注释盒子、文档生成器或代码片段管理器。
- 语言质量必须可验证：每次提升 support level 都要有 fixture、单测、integration 可行性说明、截图或手工验证记录，以及语言支持矩阵更新。

## 当前基线

截至 2026-06-17，当前工作树事实如下：

- 包名为 `comment-doc-lens`，展示名为 `Comment Doc Lens`，版本为 `0.4.2`。
- 命令命名空间统一为 `commentDocLens.*`。
- README/README_CN 已说明本地、非生成式、不改写源码的产品边界。
- 语言支持矩阵当前为：
  - `stable`：Go、TypeScript、JavaScript、TSX、JSX、Python、Java、Rust、PHP。
  - `experimental`：C#、Ruby、Kotlin、Swift、C、C++。
  - `hover-only`：暂无。
- 当前命令入口包括：
  - `Comment Doc Lens: Toggle`
  - `Comment Doc Lens: Refresh`
  - `Comment Doc Lens: Show Language Status`
  - `Comment Doc Lens: Diagnose Workspace`
  - `Comment Doc Lens: Copy Diagnostics for Issue`
  - `Comment Doc Lens: Explain Hidden Hint`
  - `Comment Doc Lens: Open Sample Gallery`
- 发布链仍覆盖 Marketplace/Open VSX，但外部商店数据、历史包入口和截图/GIF 需要发布前再次核对。

## P0-P5 状态

| 优先级 | 当前状态 | 已完成 | 仍需跟进 |
| --- | --- | --- | --- |
| P0：校准发布事实与包入口 | 部分完成 | 本地包名、release-please、README、发布 workflow 已回到 `comment-doc-lens` | 发布前重新核对 Marketplace/Open VSX 实际版本、下载、旧入口指向 |
| P1：品牌收口与 Marketplace 转化 | 部分完成 | README/README_CN、social preview、关键词方向、隐私边界已更新到 Comment Doc Lens | 真实 GIF/截图、GitHub topics、issue templates、商店页文案和历史入口 FAQ |
| P2：官方级体验细节 | 完成 | lazy `resolveInlayHint`、Output Channel、workspace diagnosis、copyable diagnostics、hidden hint explanation、`package.nls.zh-cn.json` | 发布后观察诊断报告是否足够解释 missing hints |
| P3：语言质量升级 | 完成第一轮 | Python/Java/Rust/PHP 已升 stable；C#/Ruby/Kotlin/Swift/C/C++ 已具备 source fallback 并升 experimental | 为 experimental 语言补真实语言服务 integration 证据和截图 |
| P4：增长功能与样例资产 | 部分完成 | `Open Sample Gallery`、sample gallery 文档、技术文章已加入包内 docs | 多语言真实截图/GIF、Release/Marketplace/Open VSX 复用素材、旧入口 FAQ |
| P5：维护机制与指标 | 完成基础 | `docs/maintenance-metrics.md` 与 `docs/release-quality-checklist.md` 已建立节奏、指标和发布检查 | 发布后按月记录指标、按季度推进语言升级 |

## P2 已完成项

- `provideInlayHints` 返回轻量 summary；tooltip/location/full docs 通过 `resolveInlayHint` 惰性解析。
- 新增 `Comment Doc Lens` Output Channel，记录 refresh、language status、workspace diagnosis、hidden hint explanation、lazy resolution 等诊断事件。
- 新增 `Comment Doc Lens: Diagnose Workspace`，扫描代表性 workspace 文件并汇总语言服务状态。
- 新增 `Comment Doc Lens: Copy Diagnostics for Issue`，复制可粘贴到 issue 的 Markdown 诊断报告。
- 新增 `Comment Doc Lens: Explain Hidden Hint`，解释全局禁用、语言未启用、语言覆盖禁用、行过长、无候选符号和无可用文档等常见原因。
- 新增 `package.nls.json` 与 `package.nls.zh-cn.json`，覆盖命令标题和配置项描述。

## P3 已完成项

- Python、Java、Rust、PHP 已进入 `stable`，具备 adapter tests、source fallback 或明确 fallback 策略、fixture 和支持矩阵记录。
- PHP 已覆盖 class/function/method/property/const PHPDoc 与本地 definition fallback。
- C# 已具备 XML docs source fallback。
- Ruby 已具备 YARD/RDoc source fallback。
- Kotlin 已具备 KDoc source fallback。
- Swift 已具备 `///` 和 block doc comment fallback。
- C/C++ 已具备 Doxygen-style fallback，并在矩阵中保留 compile commands/include path 相关限制。

## P4 已完成项

- 新增 `docs/sample-gallery.md`，覆盖 Go、TypeScript、Python、Java、Rust、PHP 与第二批语言说明。
- 新增 `docs/articles/inline-docs-without-generating-comments.md`，明确它是 reading tool，不是文档生成器、不调用 LLM、不上传源码。
- README 和 README_CN 链接 sample gallery、技术文章、维护指标和发布质量清单。

## P5 已完成项

- 新增 `docs/maintenance-metrics.md`，定义 monthly quality release、quarterly language upgrade、weekly triage、增长指标和语言晋级规则。
- 新增 `docs/release-quality-checklist.md`，覆盖 `npm test`、`npm run package`、integration 可用性、README/docs/package.nls 检查、Marketplace/Open VSX 发布验证和 post-release watch。

## 剩余路线

### 近期 1 周

- 发布前重新核对 Marketplace/Open VSX 当前包入口、版本、下载和历史入口状态。
- 补 GitHub topics 与 issue templates：bug report、language support request、missing hint diagnostics。
- 为旧入口关系写短 FAQ：当前主入口、历史包名、是否需要卸载旧包。
- 补至少一张真实 Before/After 截图或短 GIF，并同步 README、Marketplace、Open VSX。

### 接下来 2-4 周

- 为 C#、Ruby、Kotlin、Swift、C/C++ 补真实语言服务 integration 证据。
- 对 Python/Java/Rust/PHP 各补一张代表性截图或手工验证记录。
- 根据第一批 issue 中的诊断报告调整 Output Channel 事件字段。

### 1-2 个月

- 按 `docs/maintenance-metrics.md` 固定月度质量版本记录。
- 从 diagnostics 数据中选择下一个语言晋级或噪音过滤目标。
- 评估是否需要 document symbols / references 作为第二阶段质量增强；只有在现有 adapter/filter 不足时再引入。

## 风险与处理

| 风险 | 影响 | 处理 |
| --- | --- | --- |
| 历史包名和当前包名认知混乱 | 影响搜索、安装和 issue 反馈 | README、release note、商店文案和 FAQ 统一说明当前主入口 |
| 语言服务差异导致 hint 不稳定 | 用户认为扩展坏了 | Output Channel、workspace diagnosis、support matrix 和 issue diagnostics 解释依赖状态 |
| fallback 误读无关注释 | 噪音增加，降低信任 | 每种语言增加 declaration 过滤、注释距离限制、signature-only 过滤和 fixture |
| 惰性解析实现不当导致体验退化 | tooltip/full docs 慢或不一致 | 默认 summary 与 resolve details 分离，增加 timeout/cache 统计和回归测试 |
| 过早宣传 experimental 语言为 stable | 负面评价 | support level 必须由证据驱动，README 和矩阵保持保守 |
| AI 文档生成器认知干扰 | 用户误会会上传源码或生成注释 | README、Marketplace、隐私声明反复强调本地、非生成式、不改写 |

## 当前成功标准

- 对外信息统一为 `Comment Doc Lens` 与 `Read existing docs where symbols are used`。
- 用户可以复制诊断报告解释“为什么没有显示 hint”。
- Python/Java/Rust/PHP 已有 stable 证据链；C#/Ruby/Kotlin/Swift/C/C++ 有 experimental fallback 证据链。
- README、README_CN、语言矩阵、sample gallery、维护指标、发布清单与实际功能一致。
- 后续每个语言升级都能按矩阵、fixture、测试、截图、发布记录闭环。
