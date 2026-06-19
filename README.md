<p align="center">
  <img src="assets/icon.png" alt="Comment Doc Lens icon" width="96" height="96">
</p>

<h1 align="center">Comment Doc Lens</h1>

<p align="center">
  Show definition comments and symbol documentation inline at reference sites as VS Code inlay hints.
</p>

<p align="center">
  <a href="README_CN.md">简体中文</a> | English
</p>

<p align="center">
  <img src="assets/social-preview.png" alt="Comment Doc Lens preview showing inline symbol documentation in VS Code">
</p>

## Demo

| Before | After |
| --- | --- |
| <img src="assets/demo-before.png" alt="VS Code editor before enabling Comment Doc Lens"> | <img src="assets/demo-after.png" alt="VS Code editor after enabling Comment Doc Lens inline documentation hints"> |

## Why

Comment Doc Lens keeps useful documentation close to the code you are reading. When a referenced symbol has a doc comment, JSDoc, docstring, Javadoc, PHPDoc, or language-service hover documentation, the extension renders the first useful summary at the end of the reference line.

It is designed for reading and navigation, not for changing your source. Comment Doc Lens does not generate comments, rewrite files, highlight TODO tags, or index comment anchors.

## What It Shows

Comment Doc Lens scans visible identifiers, asks the active VS Code language service for hover and definition information, then renders concise documentation as an inlay hint.

It is useful for:

- Reading code that uses documented functions, constants, variables, methods, enum members, and object properties.
- Surfacing documentation from definitions without jumping away from the current file.
- Keeping inline hints short, display-only, and easy to ignore when you do not need them.
- Checking whether the current language service can provide useful documentation.

Hints are rendered at the end of the source line so they do not split expressions in the middle of a statement. The default prefix is `// ` and the default summary limit is `120` characters.

## Language Support

| Level | Languages | Notes |
| --- | --- | --- |
| Stable | Go, TypeScript, JavaScript, TSX, JSX, Python, Java, Rust, PHP | Covered by adapter tests, representative fixtures, and source-comment fallback where available. |
| Experimental | C#, Ruby, Kotlin, Swift, C, C++ | Uses language-service hover first and local source-comment fallback for common XML docs, YARD/RDoc, KDoc, Swift doc comments, and Doxygen comments. |
| Hover-only | None currently | New languages start here only when Comment Doc Lens depends entirely on installed language-service hover/definition output. |

Install the recommended language extensions for non-built-in languages. Go works best with the official Go extension and `gopls`; Python works best with Python plus Pylance; Rust works best with rust-analyzer.

See the [language support matrix](docs/language-support.md) for support levels, recommended dependencies, fallback strategies, and validation status.

## Commands

| Command | Purpose |
| --- | --- |
| `Comment Doc Lens: Toggle` | Enable or disable inline documentation hints. |
| `Comment Doc Lens: Refresh` | Clear cached lookup results and refresh hints. |
| `Comment Doc Lens: Show Language Status` | Inspect whether the current file's language service is ready, degraded, missing dependencies, or unknown. |
| `Comment Doc Lens: Diagnose Workspace` | Scan representative workspace files and write a language-service health report. |
| `Comment Doc Lens: Copy Diagnostics for Issue` | Copy recent diagnostic events as Markdown for a GitHub issue. |
| `Comment Doc Lens: Explain Hidden Hint` | Explain why the current line does not show an inline documentation hint. |
| `Comment Doc Lens: Open Sample Gallery` | Open representative inline documentation examples. |

## Language Service Status

Run `Comment Doc Lens: Show Language Status` from the command palette to inspect the active file. The status check verifies recommended extensions, hover output, definition output, and whether the adapter has source-comment fallback support.

- `ready`: the language service can provide useful documentation.
- `missingDependency`: a recommended extension is not installed or enabled.
- `degraded`: the language service is present, but hover or definition output is not currently useful enough.
- `unknown`: Comment Doc Lens cannot determine the current language-service state.

For `missingDependency`, install or enable the listed recommended extension. For `degraded`, put the cursor on a documented symbol and ensure the project has finished indexing.

`sourceFallback=true` means the adapter can try to recover nearby source comments when hover output is missing. It does not replace the recommended language extension: a status such as `missingDependency` with `sourceFallback=true` is expected when Java, C#, or another external language service is not installed. For real projects, install the listed extension and toolchain; for manual same-file fixtures, make sure you are on a call-site line, refresh Comment Doc Lens, and use the latest installed VSIX.

## Settings

| Setting | Purpose |
| --- | --- |
| `commentDocLens.enabled` | Enable Comment Doc Lens. |
| `commentDocLens.languages` | Registered adapter languages where Comment Doc Lens runs. |
| `commentDocLens.languageOverrides` | Enable or disable Comment Doc Lens per language. |
| `commentDocLens.maxHintsPerRequest` | Limit hints produced for one inlay-hint request. |
| `commentDocLens.maxLineLength` | Skip long generated or minified lines. |
| `commentDocLens.maxHintLength` | Limit the visible summary length. |
| `commentDocLens.minimumDocumentationWords` | Suppress very short low-signal summaries. |
| `commentDocLens.minIdentifierLength` | Ignore very short identifiers unless documentation has a definition location. |
| `commentDocLens.preferPropertyTail` | Prefer the final identifier in property chains such as `foo.bar.baz`. |
| `commentDocLens.dedupeLineHints` | Deduplicate repeated summaries on the same line. |
| `commentDocLens.resolveTimeoutMs` | Bound each documentation lookup. |
| `commentDocLens.maxCacheEntries` | Bound resolver cache growth. |
| `commentDocLens.hintPrefix` | Customize the displayed prefix before summaries. |
| `commentDocLens.enableHintInteractions` | Opt into inlay-hint tooltips and definition locations. |

## Known Limits

Comment Doc Lens only runs for `file` documents in registered adapter languages enabled by configuration. Coverage and wording depend on each language service's hover and definition providers.

When hover has no usable documentation, adapters with source fallback can read leading source comments near the definition. Timeout handling prevents stale hints from being displayed, but VS Code command calls already in flight cannot be forcibly cancelled by the extension.

## Development

```bash
npm install
npm run compile
npm test
```

Before publishing, run:

```bash
npm run compile
npm test
npm run package
```

Run `npm run test:integration` when the local VS Code/Electron host is available.

## Links

- [Language support matrix](docs/language-support.md)
- [Sample gallery](docs/sample-gallery.md)
- [Inline docs without generating comments](docs/articles/inline-docs-without-generating-comments.md)
- [Maintenance metrics](docs/maintenance-metrics.md)
- [Release quality checklist](docs/release-quality-checklist.md)
- [Changelog](CHANGELOG.md)
- [MIT License](LICENSE)
