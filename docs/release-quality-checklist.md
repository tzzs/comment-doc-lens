# Comment Doc Lens Release Quality Checklist

Use this checklist before every release PR and again after Marketplace/Open VSX publication.

## Pre-Release

- [ ] Run `npm test`.
- [ ] Run `npm run package`.
- [ ] Run `npm run test:integration` when a VS Code/Electron host is available.
- [ ] Confirm README and README_CN match the current command set and language levels.
- [ ] Confirm `docs/language-support.md` matches adapter support levels.
- [ ] Confirm `docs/sample-gallery.md` covers the promoted languages.
- [ ] Confirm `package.nls.json` and `package.nls.zh-cn.json` include new commands/settings.
- [ ] Confirm `package.json` keywords and categories still match the positioning.
- [ ] Confirm privacy wording still says local-only, no upload, no LLM, no generated comments.

## Publication Verification

- [ ] Confirm the GitHub release workflow completed.
- [ ] Confirm the VS Code Marketplace version is visible.
- [ ] Record Marketplace Acquisition Trend.
- [ ] Record Marketplace Total Acquisition.
- [ ] Record Marketplace Ratings & Reviews.
- [ ] Confirm the Open VSX API returns the new version.
- [ ] Record Open VSX downloads.
- [ ] Check whether legacy marketplace entries point users to `comment-doc-lens`.

## Post-Release Watch

- [ ] Watch issues for missing hints in newly promoted languages.
- [ ] Ask users to attach `Copy Diagnostics for Issue` output when language-service state is unclear.
- [ ] Check Output Channel reports for timeouts, missing dependencies, and degraded language-service states.
- [ ] If registry UI looks stale, verify API responses before diagnosing a failed publish.
