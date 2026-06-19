# Experimental Language Service Evidence

> Updated: 2026-06-17. This document records reproducible evidence paths for the experimental C#, Ruby, Kotlin, Swift, and C/C++ adapters. Keep the support level conservative until every language has a completed real language-service capture.

## Evidence Policy

Real language-service evidence means all of these are captured from VS Code with the recommended language extension installed:

- a minimal workspace fixture that the language service can index;
- `Comment Doc Lens: Show Language Status` output for a documented symbol reference;
- `Comment Doc Lens: Copy Diagnostics for Issue` output;
- whether hover returned useful documentation;
- whether definition returned the expected declaration;
- whether source fallback was used when hover was missing or signature-only;
- a screenshot or copied Output Channel excerpt showing the hint at the reference site.

Do not mark a language as `stable` from source fallback alone. Source fallback proves Comment Doc Lens can recover docs, but stable promotion also needs real hover/definition evidence from the language service.

## Local Snapshot

This snapshot explains what could and could not be verified in the current local environment.

| Check | Result |
| --- | --- |
| Date | 2026-06-17 |
| VS Code CLI | `code --list-extensions --show-versions` returned installed extensions, but also logged an `EPERM` failure while trying to create VS Code logs under the user Library path in the sandboxed session |
| Installed relevant extensions | `swiftlang.swift-vscode@2.16.6` only |
| Missing relevant extensions | `ms-dotnettools.csdevkit`, `shopify.ruby-lsp`, `fwcd.kotlin`, `ms-vscode.cpptools` |
| `.NET SDK` | Missing: `dotnet` command not found |
| Ruby | `ruby 2.6.10p210`; `ruby-lsp` gem not installed |
| Kotlin / Gradle | Missing: `kotlinc` and `gradle` commands not found |
| Swift | Present: Apple Swift `6.3.2`; `sourcekit-lsp` exists at `/usr/bin/sourcekit-lsp`, but VS Code language-status capture was not run in this turn |
| C/C++ compiler | Present: Apple clang `21.0.0`; C/C++ VS Code extension missing |

Current conclusion: this commit adds reproducible fixtures and evidence capture instructions. It does not claim C#, Ruby, Kotlin, Swift, or C/C++ are fully language-service verified on this machine.

## Fixture Sanity Checks

These checks validate fixture shape where the local toolchain is available. They are not a replacement for VS Code hover/definition evidence.

| Fixture | Command | Result |
| --- | --- | --- |
| Swift source | `swiftc -parse Sources/CommentDocLensSwift/OrderPresenter.swift` from `test-fixtures/language-service/swift` | Passed |
| SwiftPM package | `swift build` from `test-fixtures/language-service/swift` | Blocked in this sandbox by SwiftPM/clang module-cache and `sandbox-exec` permissions; rerun in a normal local shell when capturing SourceKit-LSP evidence |
| C/C++ source | `clang++ -std=c++20 -fsyntax-only order.cpp` from `test-fixtures/language-service/cpp` | Passed |
| C# fixture | `dotnet build` | Not run here because `dotnet` is not installed |
| Ruby fixture | `bundle install` / Ruby LSP launch | Not run here because Ruby LSP is not installed |
| Kotlin fixture | `gradle build` | Not run here because Gradle/Kotlin CLI is not installed |

## Fixture Map

| Language | Fixture root | Recommended extension | Toolchain expectation | Evidence status |
| --- | --- | --- | --- | --- |
| C# | `test-fixtures/language-service/csharp` | `ms-dotnettools.csdevkit` | .NET SDK 8+ | Fixture ready; local language-service capture blocked by missing extension and `dotnet` |
| Ruby | `test-fixtures/language-service/ruby` | `shopify.ruby-lsp` | Ruby with `ruby-lsp` from `Gemfile` | Fixture ready; local language-service capture blocked by missing extension and gem |
| Kotlin | `test-fixtures/language-service/kotlin` | `fwcd.kotlin` | Gradle and JDK 21+ | Fixture ready; local language-service capture blocked by missing extension and Gradle/Kotlin CLI |
| Swift | `test-fixtures/language-service/swift` | `swiftlang.swift-vscode` | SwiftPM and SourceKit-LSP | Fixture ready; local extension and Swift toolchain present; VS Code status/screenshot capture still pending |
| C/C++ | `test-fixtures/language-service/cpp` | `ms-vscode.cpptools` | clang and C/C++ extension indexing | Fixture ready; local language-service capture blocked by missing extension |

## Capture Checklist

For each fixture:

1. Open the fixture root as the VS Code workspace.
2. Install the recommended extension from `.vscode/extensions.json`.
3. Install or restore the required toolchain dependencies.
4. Open the main source file and place the cursor on the call-site reference:
   - C#: `FormatStatus(status)` in `OrderPresenter.BuildLabel`
   - Ruby: `render_label("paid")` in `OrderPresenter#label`
   - Kotlin: `formatStatus("paid")` in `OrderPresenter.label`
   - Swift: `formatStatus("paid")` in `OrderPresenter.label`
   - C/C++: `formatStatus("paid")` in `OrderPresenter::label`
5. Run `Comment Doc Lens: Show Language Status`.
6. Run `Comment Doc Lens: Copy Diagnostics for Issue`.
7. Run `Comment Doc Lens: Refresh` and capture the inlay hint.
8. Paste the captured result into the relevant section below.

If `Show Language Status` reports `missingDependency` with `sourceFallback=true`, record it as a missing recommended extension, not as language-service evidence. Install the listed extension and required toolchain, reload VS Code, and rerun the capture before marking the language service path verified.

## C# Evidence

Fixture: `test-fixtures/language-service/csharp`

Expected documentation source:

- Primary: C# Dev Kit or OmniSharp hover/definition for XML docs.
- Fallback: local source fallback reads leading `/// <summary>` XML docs.

Current status: pending real language-service capture.

Required capture fields:

```text
VS Code:
Extension:
Toolchain:
Show Language Status:
Copy Diagnostics for Issue:
Hover returned docs:
Definition returned declaration:
Source fallback used:
Screenshot or Output Channel excerpt:
```

## Ruby Evidence

Fixture: `test-fixtures/language-service/ruby`

Expected documentation source:

- Primary: Ruby LSP hover/definition for YARD/RDoc comments.
- Fallback: local source fallback reads contiguous leading `#` comments.

Current status: pending real language-service capture.

Required capture fields:

```text
VS Code:
Extension:
Toolchain:
Show Language Status:
Copy Diagnostics for Issue:
Hover returned docs:
Definition returned declaration:
Source fallback used:
Screenshot or Output Channel excerpt:
```

## Kotlin Evidence

Fixture: `test-fixtures/language-service/kotlin`

Expected documentation source:

- Primary: Kotlin language server hover/definition for KDoc.
- Fallback: local source fallback reads leading `/** ... */` KDoc.

Current status: pending real language-service capture.

Required capture fields:

```text
VS Code:
Extension:
Toolchain:
Show Language Status:
Copy Diagnostics for Issue:
Hover returned docs:
Definition returned declaration:
Source fallback used:
Screenshot or Output Channel excerpt:
```

## Swift Evidence

Fixture: `test-fixtures/language-service/swift`

Expected documentation source:

- Primary: SourceKit-LSP hover/definition for Swift doc comments.
- Fallback: local source fallback reads leading `///` or `/** ... */` doc comments.

Current status: fixture ready; Swift extension and Swift toolchain are present locally, but VS Code status/screenshot capture is still pending.

Required capture fields:

```text
VS Code:
Extension:
Toolchain:
Show Language Status:
Copy Diagnostics for Issue:
Hover returned docs:
Definition returned declaration:
Source fallback used:
Screenshot or Output Channel excerpt:
```

## C/C++ Evidence

Fixture: `test-fixtures/language-service/cpp`

Expected documentation source:

- Primary: C/C++ extension hover/definition with configured include path and compiler.
- Fallback: local source fallback reads Doxygen-style `///`, `//!`, or `/** ... */` comments.

Current status: pending real language-service capture.

Required capture fields:

```text
VS Code:
Extension:
Toolchain:
Show Language Status:
Copy Diagnostics for Issue:
Hover returned docs:
Definition returned declaration:
Source fallback used:
Screenshot or Output Channel excerpt:
```

## Promotion Gate

An experimental language can be considered for `stable` only after:

- its fixture has a completed real language-service capture in this document;
- `docs/language-support.md` points to that evidence;
- adapter tests cover declaration filtering, source fallback, and noisy declaration-signature symbols;
- a screenshot or Output Channel excerpt proves the hint appears at the call site;
- CI passes after the evidence and docs update.
