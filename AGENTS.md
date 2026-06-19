# Agent Map

Comment Doc Lens is a VS Code extension that shows existing documentation at symbol reference sites as inlay hints. Keep the product boundary narrow: read existing docs, do not generate comments, do not rewrite source, and do not upload source code.

## Start Here

- Product overview: [README.md](README.md) and [README_CN.md](README_CN.md).
- Documentation index: [docs/README.md](docs/README.md).
- Language support source of truth: [docs/language-support.md](docs/language-support.md).
- Language status and fallback troubleshooting: [docs/language-support.md](docs/language-support.md#语言状态排查).
- Current optimization status: [docs/2026-06-16-comment-lens-optimization-plan.md](docs/2026-06-16-comment-lens-optimization-plan.md).
- Release checks: [docs/release-quality-checklist.md](docs/release-quality-checklist.md).

## Key Commands

```bash
npm install
npm run compile
npm test
npm run package
npm run harness:check
```

Run `npm run test:integration` only when a GUI-capable VS Code/Electron host is available. If it aborts before any `PASS` or `FAIL` output, treat it as an extension-host environment issue until proven otherwise.

## Commit and PR Title Requirements

- Use Conventional Commits for every local commit and PR title because Release Please parses the final commit subject on `main`.
- Format commit and PR titles as `type(scope): description`; use `type(scope)!: description` for breaking changes and `revert: description` for reverts.
- Allowed types are `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `build`, `ci`, `chore`, and `revert`.
- Keep the type and scope lowercase. Do not prefix PR titles or squash titles with `[codex]`; use labels, branch names, or the PR body for attribution.
- Before merging, manually confirm the PR title and final squash or merge title are still Conventional Commits.

## Boundaries To Preserve

- Package identity is `comment-doc-lens`; command and setting ids use `commentDocLens.*`.
- User-facing product name is `Comment Doc Lens`.
- Default inlay hints are display-first. Tooltip and definition locations stay behind `commentDocLens.enableHintInteractions`.
- Language support levels live in [docs/language-support.md](docs/language-support.md); do not promote a language without fixtures, tests, and docs evidence.
- `missingDependency` with `sourceFallback=true` is expected when a recommended language extension is absent; document the dependency state before changing adapter behavior.
- Publication uses `comment-doc-lens-v*` release tags. Keep `release-please-config.json`, `.github/workflows/publish.yml`, and `package.json` aligned.

## Validation Notes

- Fast regression gate: `npm test`.
- Package proof: `npm run package -- --out /tmp/comment-doc-lens-verify.vsix`.
- Harness drift check: `npm run harness:check`.
- CI mirrors the fast gate on Node.js 20 and 22 and runs CodeQL across the configured matrix.
