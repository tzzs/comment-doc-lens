# Comment Doc Lens

Comment Doc Lens displays definition comments and symbol documentation inline at reference sites as VS Code inlay hints.

The first version targets Go, TypeScript, JavaScript, TSX, and JSX by reusing the language services already available in VS Code. Python support is experimental and should use the Python extension with Pylance for best hover and definition results. Go projects should install the official Go extension with gopls enabled for best results.

## What it shows

Comment Doc Lens shows symbol documentation comments, not runtime values. It scans visible identifiers, asks the active VS Code language service for hover and definition information, then renders the first useful documentation line as an inlay hint.

The default TypeScript and JavaScript path is verified for constants, variables, enum members, functions, class methods, object methods, TSX references, and JSDoc. Go support depends on the official Go extension and gopls. Python support can read function and class docstrings when definitions are available.

See [the language support matrix](docs/language-support.md) for support levels, recommended language-service dependencies, fallback strategies, and planned language expansion.

Hints are rendered at the end of the source line so they do not split expressions in the middle of a statement. The text prefix defaults to `// ` and can be customized with `commentDocLens.hintPrefix`.
By default, the first useful documentation line is truncated to 120 characters. You can tune this with `commentDocLens.maxHintLength`.

## Noise and performance controls

The extension filters declaration names, JSX tag names, and intermediate property-chain segments by default. It also deduplicates repeated line summaries, limits concurrent documentation lookups, times out slow lookups, and bounds resolver cache growth.

Relevant settings:

- `commentDocLens.maxHintsPerRequest`
- `commentDocLens.maxHintLength`
- `commentDocLens.minIdentifierLength`
- `commentDocLens.preferPropertyTail`
- `commentDocLens.dedupeLineHints`
- `commentDocLens.resolveTimeoutMs`
- `commentDocLens.maxCacheEntries`
- `commentDocLens.hintPrefix`

## Known limits

Comment Doc Lens only runs for `file` documents in the configured first-version languages. Coverage and wording depend on each language service's hover and definition providers. When hover has no usable documentation, the extension also tries to read leading source comments near the definition, which improves Go behavior when gopls returns signature-only hover content. Timeout handling prevents stale hints from being displayed, but VS Code command calls that are already in flight cannot be forcibly cancelled by this extension.
