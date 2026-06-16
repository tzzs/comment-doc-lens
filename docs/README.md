# Comment Doc Lens Docs

This index is the repository-local map for product decisions, support evidence, release checks, and agent handoff notes.

| Document | Use when | Current status | Verification signal |
| --- | --- | --- | --- |
| [Language support matrix](language-support.md) | Changing adapters, language ids, recommended extensions, support levels, or fallback behavior | Current source of truth | `npm test` plus adapter/registry tests |
| [Optimization plan status](2026-06-16-comment-lens-optimization-plan.md) | Checking P0-P5 scope, completed work, and remaining roadmap | Updated after PR #21 conflict resolution | `npm run harness:check` checks the file is indexed |
| [Second-batch language evaluation](second-batch-language-evaluation.md) | Working on PHP, Ruby, Kotlin, Swift, C, or C++ evidence | Updated for PHP stable and second-batch experimental fallback | `npm test` plus language adapter tests |
| [Sample gallery](sample-gallery.md) | Adding examples, screenshots, or marketplace demo material | Current packaged sample reference | `test/projectMetadata.test.ts` checks package inclusion |
| [Inline docs without generating comments](articles/inline-docs-without-generating-comments.md) | Explaining positioning against generators, AI docs tools, and official language extensions | Current positioning article | `test/projectMetadata.test.ts` checks package inclusion |
| [Maintenance metrics](maintenance-metrics.md) | Planning monthly quality releases or quarterly language upgrades | Current cadence and metrics guide | `test/projectMetadata.test.ts` checks key terms |
| [Release quality checklist](release-quality-checklist.md) | Preparing a release or post-publish verification | Current release checklist | `test/projectMetadata.test.ts` checks key commands |
| [Language service quality roadmap](superpowers/specs/2026-06-14-language-service-quality-roadmap-design.md) | Planning future language quality evidence or optional symbol/reference filtering | Historical roadmap with 2026-06-17 status update | Keep aligned with language matrix |
| [Multilanguage architecture design](superpowers/specs/2026-06-14-multilanguage-architecture-design.md) | Understanding the original adapter/registry design | Historical design reference | Do not treat all phase tables as current TODOs |
| [Post-0.3.0 execution plan status](superpowers/plans/2026-06-15-comment-doc-lens-goal-execution-plan.md) | Auditing what the old execution plan became | Status record, not an active task list | Prefer the optimization plan for next work |

## Agent Workflow

1. Read [AGENTS.md](../AGENTS.md) first.
2. Use this index to find the current source of truth before editing product, release, or language docs.
3. Run `npm run harness:check` after docs or package metadata changes.
4. Run `npm test` for code, metadata, language support, diagnostics, or release workflow changes.
5. Run `npm run package -- --out /tmp/comment-doc-lens-verify.vsix` when packaging behavior or packaged docs/assets change.
