# Inline Docs Without Generating Comments

Comment Doc Lens is a reading tool, not a documentation generator.

It shows existing documentation where symbols are used. It does not generate comments, does not rewrite files, does not call an LLM, and does not upload source code.

## Why This Is Different

Official language extensions are excellent at hover, completion, definition, diagnostics, debugging, and test integration. They usually keep documentation behind an interaction: hover a symbol, open completion, or jump to definition.

Comment Doc Lens sits one layer above that. It asks VS Code and installed language extensions for existing hover/definition documentation, then projects a short summary into the line where the symbol is referenced.

## What It Reuses

- Doc comments and JSDoc from TypeScript and JavaScript.
- Go comments from `gopls` and local source fallback.
- Python docstrings.
- Java Javadoc.
- Rust doc comments.
- PHPDoc.
- XML docs, YARD/RDoc, KDoc, Swift doc comments, and Doxygen-style comments where source fallback is available.

## What It Avoids

- No generated comments.
- No TODO/comment highlighting scope creep.
- No source-file rewrites.
- No LLM calls.
- No remote indexing.

The product promise is intentionally narrow: **Read existing docs where symbols are used.**
