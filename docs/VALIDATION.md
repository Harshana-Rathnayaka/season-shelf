# Validation status

Baseline after PR #3 (13 September 2026):

| Area | Evidence | Limit |
| --- | --- | --- |
| Automated tests | 104 tests pass in GitHub Windows and macOS CI | Includes mocks and DOM tests; does not prove live provider behaviour |
| Source checks | JavaScript syntax checks pass | Not a native installation test |
| Packaging configuration | Installed electron-builder schema and workflow YAML validated | No signed macOS installer built during the release-workflow change |
| Layout | Isolated Electron rendering checked six library/tab combinations, focus and transfer controls; earlier settings/login/guide checks are recorded | Sample data and a separate test profile; not macOS visual acceptance |
| Releases | Coordinated Windows/macOS draft-then-publish workflow configured | Publishing gate remains disabled; signing credentials and signed upgrade acceptance pending |

## Before release

- Exercise real Telegram search, result selection, subscription retry, join and scan.
- Download and play a file; pause/resume another; restart with a partial job and verify recovery.
- Check season naming, combined episodes, Unverified selection and saved-file deletion/missing-file recovery.
- Verify narrow layouts, enlarged text, custom themes, keyboard focus and dialogs on both platforms.
- Validate signed install and update on Windows and macOS, including a deferred update and preserved data.

See [development](DEVELOPMENT.md) for routine commands. Add new evidence with its environment and limitations rather than claiming all checks are equivalent. Keep this summary current; earlier evidence remains in Git history.
