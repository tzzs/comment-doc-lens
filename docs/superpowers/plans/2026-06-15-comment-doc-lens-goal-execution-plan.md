# Comment Doc Lens 0.3.0 后续目标执行计划状态

> 原计划创建于 2026-06-15，用于指导 0.3.0 之后的下一轮改进 PR。
> 2026-06-17 更新：计划内工作已经在后续提交和 PR #21 中完成或被新的 P2-P5 优化计划覆盖。本文档现在作为执行状态记录，后续 agent 不应再按旧的未勾选步骤重新执行。

## 当前基线

当前工作树事实：

- 包名：`comment-doc-lens`
- 展示名：`Comment Doc Lens`
- 版本：`0.4.2`
- 命令命名空间：`commentDocLens.*`
- 当前分支：`codex/comment-lens-p2-p5-optimization`
- 当前 PR：`#21`

当前命令入口：

- `commentDocLens.toggle`
- `commentDocLens.refresh`
- `commentDocLens.showLanguageStatus`
- `commentDocLens.diagnoseWorkspace`
- `commentDocLens.copyDiagnosticsForIssue`
- `commentDocLens.explainHiddenHint`
- `commentDocLens.openSampleGallery`

当前语言支持等级：

- `stable`：Go、TypeScript、JavaScript、TSX、JSX、Python、Java、Rust、PHP。
- `experimental`：C#、Ruby、Kotlin、Swift、C、C++。
- `hover-only`：暂无。

## 任务完成状态

| 原任务 | 状态 | 当前结果 | 后续事项 |
| --- | --- | --- | --- |
| 任务 1：对齐 0.3.0 后的用户文档和配置语义 | 完成 | README/README_CN、`commentDocLens.languages` 语义、本地化配置、语言矩阵已对齐当前包名和配置命名 | 发布前再次核对 Marketplace/Open VSX 文案 |
| 任务 2：增加可选的 Inlay Hint 交互能力 | 完成并演进 | `commentDocLens.enableHintInteractions` 仍为 opt-in；tooltip/location/full docs 通过 `resolveInlayHint` 惰性解析 | 继续观察真实用户对交互入口的反馈 |
| 任务 3：补强 PHP Experimental Fallback | 完成并晋级 | PHP 已升为 `stable`，覆盖 class/function/method/property/const PHPDoc 与本地 fallback | 补 Intelephense 真实语言服务截图或手工记录 |
| 任务 4：让语言状态输出更可操作 | 完成 | `LanguageHealthService`、`Comment Doc Lens: Show Language Status`、README 状态说明和降级建议已落地 | 根据 issue diagnostics 调整文案和字段 |
| 任务 5：最终验证与交付 | 完成 | `npm test`、`npm run package`、GitHub CI/CodeQL 已通过；integration host 在受限 GUI 环境下需单独记录 | 在 GUI-capable 环境定期复跑 integration |

## 已被新计划覆盖的部分

以下旧计划片段已经不再作为待办：

- “PHP 下一步只补 method/property/const fallback”：已完成，PHP 当前为 `stable`。
- “Ruby/Kotlin/Swift/C/C++ 保持 hover-only”：已过期，这些语言当前具备 source fallback 并为 `experimental`。
- “只新增 `commentDocLens.showLanguageStatus`”：已扩展为 show status、diagnose workspace、copy diagnostics、explain hidden hint、open sample gallery。
- “交互能力直接在 provide 阶段解析 tooltip/location”：已演进为 `resolveInlayHint` 惰性解析。

## 验证记录

最近一次 PR 冲突解决后的验证结果：

- `git diff --check`：通过。
- `npm test`：88 个单元测试通过。
- `npm run package -- --out /tmp/comment-doc-lens-conflict-resolve.vsix`：成功生成 VSIX。
- GitHub PR #21：`mergeable=MERGEABLE`、`mergeStateStatus=CLEAN`。
- GitHub checks：Node.js 20、Node.js 22、CodeQL matrix 全部 SUCCESS。

## 剩余后续计划

下一轮不要从本文件的旧步骤继续，而应从以下事项中选：

1. 发布前重新核对 Marketplace/Open VSX 当前包入口、版本、下载和历史入口指向。
2. 补真实截图/GIF，并同步 README、Marketplace、Open VSX、GitHub Release。
3. 为 C#、Ruby、Kotlin、Swift、C/C++ 补真实语言服务 integration 证据。
4. 在 GUI-capable 环境复跑 `npm run test:integration`，并把结果记录到 release checklist。
5. 根据用户 issue 中的 diagnostics 输出，继续改进 “why no hint” 文案和 Output Channel 字段。

## 交接说明

本文件是历史执行计划的状态化版本。新的实现计划应优先参考：

- `docs/2026-06-16-comment-lens-optimization-plan.md`
- `docs/language-support.md`
- `docs/maintenance-metrics.md`
- `docs/release-quality-checklist.md`
