# 行尾注释与 Hover 来源校验（Issue #44）优化方案

> 当前状态：2026-08-18 完成。来源：Issue #44「针对同位置的注释还是会被展示出来」根因分析（hover documentation provenance validation 缺失）。

## 问题

```go
// 测试注释
var a string // 测试注释
```

期望行为：

- 前导 `// 测试注释` 是 `a` 的文档注释，可以展示。
- 行尾 `// 测试注释` 不是文档注释，Comment Doc Lens 不得把它当作 `a` 的 documentation。

## 根因（不是 Go comment parser bug）

1. `candidateScanner` 扫描到 `//` 即停止，不会把行尾注释内容当作代码 candidate——扫描层无问题。
2. Go 的 `collectLeadingSlashCommentLines()` 只从 definition line 上方收集注释，不会主动读取行尾注释——收集器无问题。
3. `VscodeDocumentationLookup` 无条件接受 `vscode.executeHoverProvider` 返回的 documentation。
4. `DocumentationResolver` 把 hover documentation 当作最高优先级，一旦 hover 有内容就不再用 source comment 校验。

因此如果语言服务把声明行行尾注释纳入 hover 文档，插件就会误把它当作声明文档。

## 修复思路

- 不修改 `candidateScanner`。
- 不做 `if (documentation.includes('//'))` 这类简单字符串过滤。
- 把「行尾注释永远不是文档」提升为 `LanguageAdapter` 层能力，而不是 Go 专属 patch。
- 对**当前文件内的声明（local declaration）**：source declaration comment 优先，语言服务 hover 次之；没有前导 source 文档且声明行带行尾注释时，拒绝 hover 文档。
- 对**外部 symbol**：保持语言服务 hover / definition 优先，不受行尾校验影响。

## 实现

- `SourceCommentStrategy` 新增可选能力 `hasTrailingCommentAt?(document, line)`。
- `shared.ts` 新增 `findTrailingCommentStart`（忽略字符串字面量内的 `//` / `/*`）与 `hasTrailingComment`（整行注释不算 trailing）。
- Go adapter 实现 `hasTrailingCommentAt`。
- `DocumentationLookup` 新增可选方法 `hasTrailingCommentAt?`，`VscodeDocumentationLookup` 打开 definition 文档后调用 adapter 能力。
- `DocumentationResolver` 重构为本地声明 / 外部 symbol 两条路径：
  - 本地声明：source comment → hover（校验行尾注释）→ definition hover。
  - 外部 symbol：保持原 hover → definition → source fallback 顺序。
- 带 sourceComment 策略的语言，`resolveSummary` 走完整校验路径，不再无条件信任参考点 hover。

## 验收标准（全部通过）

- `npm test`：172/172 pass（新增 resolver 回归 + 共享收集器 + Go adapter 用例）。
- `npm run harness:check`：passed。
- `npm run package -- --out /tmp/comment-doc-lens-verify.vsix`：通过。
- 回归用例覆盖：
  - 前导 `//` → 展示；
  - 行尾 `//` → 不展示；
  - 前导 `/* */` → 展示；
  - 行尾 `/* */` → 不展示；
  - 前导 + 行尾 → 只展示前导；
  - 外部 symbol 不受行尾校验影响。