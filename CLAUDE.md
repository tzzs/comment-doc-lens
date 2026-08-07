# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Comment Doc Lens is a VS Code extension that renders existing symbol documentation (doc comments, JSDoc, docstrings, hover docs) as inlay hints at reference sites. It is strictly read-only: it never generates comments, rewrites source, or uploads code. Read [AGENTS.md](AGENTS.md) first — it covers the agent map, commit/PR conventions, and product boundaries.

## Commands

```bash
npm install
npm run compile      # tsc -p . — compiles BOTH src/ and test/ into out/
npm run watch
npm test             # compile + node --test out/test/*.test.js (fast regression gate)
npm run test:coverage   # adds 80% line/branch/function coverage gates
npm run test:integration # launches real VS Code via @vscode/test-electron; needs a GUI host
npm run harness:check   # verifies docs index alignment (scripts/check-harness-docs.js)
npm run package      # vsce package; proof: npm run package -- --out /tmp/comment-doc-lens-verify.vsix
```

Run a single test file after compiling: `npm run compile && node --test out/test/documentationResolver.test.js`. If `test:integration` aborts before any PASS/FAIL output, treat it as an extension-host environment issue, not a code failure.

## Architecture

### Layering: pure core vs. VS Code seam

Only four files import `vscode`: `src/extension.ts` and the three files under `src/vscode/`. Everything else is pure TypeScript with injected interfaces, which is what makes the fast unit suite possible without an editor host.

- `src/vscode/documentationLookup.ts` — `VscodeDocumentationLookup` implements `DocumentationLookup` from `src/documentationResolver.ts`, wrapping `vscode.executeHoverProvider` / `vscode.executeDefinitionProvider` and reading documents for source-comment fallback. The adapter's `sourceComment` strategy (`canRead` → `findDefinitionLine` → `collectLeadingComments`) executes entirely inside this seam.
- `src/vscode/hover.ts` — thin wrapper translating `vscode.Hover[]` into markdown lines (via `src/hoverContent.ts`).
- `src/vscode/languageHealthProbe.ts` — implements `LanguageHealthProbe` from `src/languageHealth.ts` (extension presence, hover/definition capability checks).
- `src/vscode/diagnostics.ts` — `DiagnosticsSession`, the single deep module backing every diagnostics command: `record` / `latest` / `getLatest` / `renderIssueReport`, plus the `recordWorkspaceDiagnosis` and `explainHiddenHint` flows that own output-channel writes and the issue-copy report rendering.

`src/extension.ts` wires everything: builds the registry, registers the inlay-hint provider (with lazy `resolveInlayHint` behind `commentDocLens.enableHintInteractions`), commands, and config-change refresh. The provider calls `buildCommentHints` and converts results into `vscode.InlayHint` objects.

### The hint pipeline (src/hintBuilder.ts)

1. `candidateScanner.ts` — character scan for identifier candidates per line, skipping strings, comments, and a shared keyword list; skips lines over `maxLineLength`.
2. Filter candidates through the language adapter's `isDeclarationCandidate` / `isNoisyCandidate` predicates, then dedupe.
3. `candidatePriority.ts` — classify each candidate into a role (`callTarget` 80, `enumOrConstantMember` 75, `propertyTail` 60, `typeReference` 40, `neutralReference` 20, `receiverOrNamespace` 0) by line context (next char is `(`, member-tail `.`/`::`, type-annotation position, etc.). Sort by score, cap at `maxHintsPerRequest`, then resolve with concurrency 4 and per-adapter timeouts.
4. `documentationResolver.ts` — per-candidate resolution with a bounded cache keyed by `uri:version:position` and `summary` vs `full` variants. Strategy: hover at the reference → if useless, go to definition → hover at definition → ask the lookup for `getDefinitionSourceComments` (empty means no source documentation). `resolveSummary` skips the definition lookup when reference hover is already useful.
5. `documentationFormatter.ts` — normalize hover markdown into `{ summary, fullText }`: strips code blocks, comment markers, XML doc tags (`<param>` → `@param`), doc-command lines, and hover UI chrome (separators, `Peek Definition`-style links, codicons); groups prose paragraphs; truncates to `maxHintLength`; enforces `minimumDocumentationWords`.
6. Enforce `minIdentifierLength`, word count, per-line budget (`maxHintsPerLine`), dedupe, and group multiple hints on one line as `word: summary | word: summary`.

### Language adapters (src/languages/)

Each language is a plain data object in its own module implementing `LanguageAdapter` (`languageAdapter.ts`): `languageIds`, `displayName`, `supportLevel` (`stable` | `experimental`), `documentationSource` (`language-service` | `language-service-with-source-fallback`), `recommendedExtensions`, and pure-function heuristics — `isDeclarationCandidate` (skip the name on a declaration line), `isNoisyCandidate` (e.g. JSX tag names), `findProbePosition`, and optionally a `sourceComment` strategy (`canRead`, `findDefinitionLine`, `collectLeadingComments`). `shared.ts` holds the common building blocks (comment collectors, C-style signature detection, `findDefinitionLine`, regex escaping). `languageRegistry.ts` assembles `defaultLanguageAdapters` and throws on duplicate language ids. Recent refactors split Kotlin, Swift, and C++ into standalone modules and moved source-anchor logic into adapters — keep per-language heuristic functions in the language module, not in shared code.

Adding a language = adapter module + registry entry + unit tests + [docs/language-support.md](docs/language-support.md) update + real-language evidence fixtures under `test-fixtures/language-service/` for experimental levels. `docs/language-support.md` is the source of truth for support levels; do not promote a language without fixtures, tests, and docs evidence.

### Diagnostics and health

`languageHealth.ts` evaluates `ready` / `degraded` / `missingDependency` / `unknown` per language via the probe; `missingDependency` with `sourceFallback=true` is expected when a recommended extension is absent. `src/vscode/diagnostics.ts` exposes `DiagnosticsSession` — the single seam for events, latest snapshots, issue-copy rendering, workspace diagnosis summaries, and hidden-hint explanations. `src/languages/probe.ts` picks a probe position by scanning for a non-declaration candidate.

## Testing conventions

- Unit tests use `node:test` + `node:assert/strict` in `test/*.test.ts` (compiled by tsc alongside src). Mock the `DocumentationLookup` / resolver interfaces rather than touching the VS Code API.
- `test/integration/` launches a real VS Code instance against the fixture workspace (`test/integration/fixtures/workspace`) with `@vscode/test-electron`; run only on a GUI-capable host.
- `test/projectMetadata.test.ts` and `test/publishWorkflow.test.ts` assert packaged-file inclusion and release-workflow alignment — run `npm run harness:check` and re-package when docs or package metadata change.

## Release and docs conventions

- Release Please parses the final commit subject on `main`: every commit and PR title must be Conventional Commits (`type(scope): description`). See AGENTS.md for the full list and rules.
- Publication uses `comment-doc-lens-v*` tags; keep `release-please-config.json`, `.github/workflows/publish.yml`, and `package.json` aligned.
- [docs/README.md](docs/README.md) is the docs index; `npm run harness:check` verifies it stays aligned. Prefer the 2026-06-16 optimization plan over older superpowers plans for current work status.
- Package identity is `comment-doc-lens`; command and setting ids use `commentDocLens.*`; user-facing product name is `Comment Doc Lens`.
- Default hints are display-first: tooltip and definition location only activate with `commentDocLens.enableHintInteractions`.
