# Maintainer handoff

Current baseline: PRs #1, #2 and #3 are merged into `master`. Windows/macOS release configuration is present. Use [project workflow](PROJECT_WORKFLOW.md) for new branches and [roadmap](ROADMAP.md) for outstanding work.

## Constraints to preserve

- Develop without repeatedly rebuilding installers. Release publishing remains gated; do not enable it or push version tags as ordinary development work.
- Clear app data removes metadata, not downloaded media or partial files. Media deletion remains a separate confirmed action.
- Keep development and installed profiles separate; installed updates preserve user data.
- Closing pauses downloads even if the app remains in the tray.
- Preserve episode details, stable library controls and compact scrollable lists.
- Normalise filename separators after queued season completion, preserving extensions and protected tags. Unverified files keep their original names; legacy generated-path records remain display-only.
- Do not infer live Telegram compatibility or signed update success from mock/DOM tests.

The latest baseline has 104 passing tests on Windows and macOS CI. Native signed installation/update acceptance remains pending; see [validation](VALIDATION.md).

Keep this handoff current. Git history preserves earlier development records.
