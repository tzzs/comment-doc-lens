# Agent Map

Comment Doc Lens is a VS Code extension that shows existing documentation at symbol reference sites as inlay hints. Keep the product boundary narrow: read existing docs, do not generate comments, do not rewrite source, and do not upload source code.

## Start Here

- Product overview: [README.md](README.md) and [README_CN.md](README_CN.md).
- Documentation index: [docs/README.md](docs/README.md).
- Language support source of truth: [docs/language-support.md](docs/language-support.md).
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

## Boundaries To Preserve

- Package identity is `comment-doc-lens`; command and setting ids use `commentDocLens.*`.
- User-facing product name is `Comment Doc Lens`.
- Default inlay hints are display-first. Tooltip and definition locations stay behind `commentDocLens.enableHintInteractions`.
- Language support levels live in [docs/language-support.md](docs/language-support.md); do not promote a language without fixtures, tests, and docs evidence.
- Publication uses `comment-doc-lens-v*` release tags. Keep `release-please-config.json`, `.github/workflows/publish.yml`, and `package.json` aligned.

## Validation Notes

- Fast regression gate: `npm test`.
- Package proof: `npm run package -- --out /tmp/comment-doc-lens-verify.vsix`.
- Harness drift check: `npm run harness:check`.
- CI mirrors the fast gate on Node.js 20 and 22 and runs CodeQL across the configured matrix.
