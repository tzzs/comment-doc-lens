# Comment Doc Lens Maintenance Metrics

Comment Doc Lens should move on a predictable product-quality cadence instead of accumulating unrelated features.

## Cadence

- monthly quality release: bug fixes, diagnostics improvements, language quality evidence, README/GIF refreshes, and support-matrix updates.
- quarterly language upgrade: promote one language level or add one carefully scoped language adapter with fixture, tests, documentation, and release notes.
- weekly triage: review new issues, ratings, Marketplace/Open VSX stats, and diagnostics reports attached by users.

## Growth Metrics

Track these after each release:

- Marketplace Acquisition Trend.
- Marketplace Total Acquisition.
- Marketplace Ratings & Reviews.
- Open VSX downloads.
- GitHub stars, forks, issues, and support requests.
- Legacy package downloads versus current `comment-doc-lens` downloads.

## Quality Metrics

Track these before and after language work:

- Number of fixtures per support level.
- Number of source fallback tests per language.
- Number of noise-filter tests per language.
- Count of issues that include `Copy Diagnostics for Issue`.
- Count of issues resolved by `Diagnose Workspace`.
- Timeout and degraded language-service reports from the Output Channel.

## Promotion Rules

A language can move to `stable` only when it has:

- representative fixture files;
- adapter tests for declaration filtering;
- source fallback or documented reason why source fallback is not needed;
- README and `docs/language-support.md` updates;
- release notes that describe dependencies and limits.

Languages with source fallback but limited real language-service integration evidence should remain `experimental`.

## Review Loop

At the end of each month:

- compare installs/downloads against the previous release;
- scan review text for confusion around privacy, generation, or missing hints;
- pick the next quality target from diagnostics data rather than adding unrelated UI;
- confirm README, README_CN, sample gallery, and language matrix still describe the current behavior.
