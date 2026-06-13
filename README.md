# Comment Doc Lens

Comment Doc Lens displays definition comments and symbol documentation inline at reference sites as VS Code inlay hints.

The first version targets Go, TypeScript, JavaScript, TSX, and JSX by reusing the language services already available in VS Code. Python, Java, and Rust support are experimental, while C# starts as hover-only support. These languages should use their recommended language extensions for best hover and definition results. Go projects should install the official Go extension with gopls enabled for best results.

## What it shows

Comment Doc Lens shows symbol documentation comments, not runtime values. It scans visible identifiers, asks the active VS Code language service for hover and definition information, then renders the first useful documentation line as an inlay hint.

The default TypeScript and JavaScript path is verified for constants, variables, enum members, functions, class methods, object methods, TSX references, and JSDoc. Go support depends on the official Go extension and gopls. Python support can read function and class docstrings when definitions are available. Java support can read Javadoc-style block comments. Rust support can read `///` and `//!` doc comments. C# currently relies on language-service hover output.

See [the language support matrix](docs/language-support.md) for support levels, recommended language-service dependencies, fallback strategies, and planned language expansion.

Hints are rendered at the end of the source line so they do not split expressions in the middle of a statement. The text prefix defaults to `// ` and can be customized with `commentDocLens.hintPrefix`.
By default, the first useful documentation line is truncated to 120 characters. You can tune this with `commentDocLens.maxHintLength`.

## Language service status

Run `Comment Doc Lens: Show Language Status` from the command palette to inspect the active file's language-service readiness. The status check verifies recommended extensions, hover output, definition output, and whether the adapter has source-comment fallback support.

The check is cached per language, file, and cursor position, and the cache is cleared when you refresh, toggle, or change Comment Doc Lens settings. A `missingDependency` status means at least one recommended extension is not installed. A `degraded` status means the language service is present but hover or definition output is not currently useful enough for inline documentation.

## Noise and performance controls

The extension filters declaration names, JSX tag names, and intermediate property-chain segments by default. It also deduplicates repeated line summaries, limits concurrent documentation lookups, times out slow lookups, and bounds resolver cache growth.

Relevant settings:

- `commentDocLens.maxHintsPerRequest`
- `commentDocLens.maxLineLength`
- `commentDocLens.maxHintLength`
- `commentDocLens.languageOverrides`
- `commentDocLens.minIdentifierLength`
- `commentDocLens.preferPropertyTail`
- `commentDocLens.dedupeLineHints`
- `commentDocLens.resolveTimeoutMs`
- `commentDocLens.maxCacheEntries`
- `commentDocLens.hintPrefix`

## Known limits

Comment Doc Lens only runs for `file` documents in the configured first-version languages. Coverage and wording depend on each language service's hover and definition providers. When hover has no usable documentation, the extension also tries to read leading source comments near the definition, which improves Go behavior when gopls returns signature-only hover content. Timeout handling prevents stale hints from being displayed, but VS Code command calls that are already in flight cannot be forcibly cancelled by this extension.
