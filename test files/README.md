# Comment Lens Manual Test Files

Open these files in VS Code after installing the packaged extension to manually verify supported symbol documentation display.

- `go.go` requires the official Go extension with gopls enabled.
- `javascript.js` uses JSDoc comments.
- `typescript.ts` covers constants, variables, enum members, functions, class methods, and object methods.

Hints should appear at the end of each source line. To verify custom prefixes, set `commentDocLens.hintPrefix` in VS Code settings and run `Comment Lens: Refresh`.

Use the `*-i18n` files to compare English, Chinese, and bilingual documentation summaries. The default summary length is 120 characters and can be changed with `commentDocLens.maxHintLength`.
