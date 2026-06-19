# Comment Doc Lens Manual Test Files

Open these files in VS Code after installing the packaged extension to manually verify supported symbol documentation display.

- `go.go` requires the official Go extension with gopls enabled.
- `OrderPresenter.cs` covers C# XML documentation fallback at method call references.
- `OrderPresenter.java` covers Java Javadoc fallback at static field and method call references.
- `javascript.js` uses JSDoc comments.
- `order.rs` covers Rust `///` source fallback at function, enum, enum variant, and unit-like struct references.
- `typescript.ts` covers constants, variables, enum members, functions, class methods, and object methods.

Hints should appear at the end of each source line. To verify custom prefixes, set `commentDocLens.hintPrefix` in VS Code settings and run `Comment Doc Lens: Refresh`.

For Java and C# fallback smoke checks, place the cursor or visible range on the call-site methods (`displayLabel` / `DisplayLabel`) rather than the declaration lines. `Show Language Status` may report `missingDependency` with `sourceFallback=true` when the Java or C# extension is not installed; that is expected for a fallback-only check. Install the recommended extension and runtime when validating full language-service readiness.

Use the `*-i18n` files to compare English, Chinese, and bilingual documentation summaries. The default summary length is 120 characters and can be changed with `commentDocLens.maxHintLength`.
