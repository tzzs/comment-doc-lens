# Comment Lens

Comment Lens displays definition comments and symbol documentation inline at reference sites as VS Code inlay hints.

Comment Lens supports a stable core for Go, TypeScript, JavaScript, TSX, and JSX. Python, Java, Rust, and PHP are experimental adapter-backed languages with source-comment fallback where available. C#, Ruby, Kotlin, Swift, and C/C++ are hover-only languages that depend on their language service's hover and definition quality.

Install the recommended language extensions for non-built-in languages. Go works best with the official Go extension and `gopls`; Python works best with Python plus Pylance; Rust works best with rust-analyzer.

## What it is not

Comment Lens does not generate comments, rewrite source files, highlight TODO tags, or index comment anchors. It keeps source unchanged and projects existing symbol documentation from definitions to references.

## What it shows

Comment Lens shows symbol documentation comments, not runtime values. It scans visible identifiers, asks the active VS Code language service for hover and definition information, then renders the first useful documentation line as an inlay hint.

The default TypeScript and JavaScript path is verified for constants, variables, enum members, functions, class methods, object methods, TSX references, and JSDoc. Go support depends on the official Go extension and gopls. Python support can read function and class docstrings when definitions are available. Java support can read Javadoc-style block comments. Rust support can read `///` and `//!` doc comments. PHP support can read PHPDoc blocks near definitions. C#, Ruby, Kotlin, Swift, and C/C++ currently rely on language-service hover output.

See [the language support matrix](docs/language-support.md) for support levels, recommended language-service dependencies, fallback strategies, and planned language expansion.

Hints are rendered at the end of the source line so they do not split expressions in the middle of a statement. The text prefix defaults to `// ` and can be customized with `commentDocLens.hintPrefix`.
By default, the first useful documentation line is truncated to 120 characters. You can tune this with `commentDocLens.maxHintLength`.

## Language service status

Run `Comment Lens: Show Language Status` from the command palette to inspect the active file's language-service readiness. The status check verifies recommended extensions, hover output, definition output, and whether the adapter has source-comment fallback support.

The check is cached per language, file, and cursor position, and the cache is cleared when you refresh, toggle, or change Comment Lens settings. A `missingDependency` status means at least one recommended extension is not installed. A `degraded` status means the language service is present but hover or definition output is not currently useful enough for inline documentation.

For `missingDependency`, install or enable the listed recommended extension. For `degraded`, put the cursor on a documented symbol and ensure the project has finished indexing.

## Noise and performance controls

The extension filters declaration names, JSX tag names, and intermediate property-chain segments by default. It also deduplicates repeated line summaries, limits concurrent documentation lookups, times out slow lookups, and bounds resolver cache growth.

Use `commentDocLens.minimumDocumentationWords` to suppress very short hover summaries such as bare type names. The default is `1` to preserve existing behavior, while adapters can opt into stricter rules for languages whose hover output is often signature-like or low signal.

Relevant settings:

- `commentDocLens.maxHintsPerRequest`
- `commentDocLens.maxLineLength`
- `commentDocLens.maxHintLength`
- `commentDocLens.minimumDocumentationWords`
- `commentDocLens.languageOverrides`
- `commentDocLens.minIdentifierLength`
- `commentDocLens.preferPropertyTail`
- `commentDocLens.dedupeLineHints`
- `commentDocLens.resolveTimeoutMs`
- `commentDocLens.maxCacheEntries`
- `commentDocLens.hintPrefix`

## Known limits

Comment Lens only runs for `file` documents in registered adapter languages enabled by configuration. Coverage and wording depend on each language service's hover and definition providers. When hover has no usable documentation, adapters with source fallback can read leading source comments near the definition, which improves languages such as Go when the language service returns signature-only hover content. Timeout handling prevents stale hints from being displayed, but VS Code command calls that are already in flight cannot be forcibly cancelled by this extension.
