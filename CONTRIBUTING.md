# Contributing to Season Shelf

Thanks for helping make the app easier to use and maintain. The project is in development; a source-code license has not yet been selected. A public repository alone does not grant an open-source license. Please resolve the license choice with the maintainer before planning substantial third-party code contributions.

## Start small

- Check existing issues and PRs. Describe the problem and desired behaviour before large changes.
- `good first issue` means a scoped task with reproduction steps and acceptance criteria. `help wanted` means contributions are actively welcome.
- Do not include Telegram credentials, sessions, private chat content, phone numbers, media files or personal file paths in issues, screenshots or tests.

## Branch and commit

The default branch is currently **master**. New independent work starts from an up-to-date `master`; there is no permanent `develop` branch.

```powershell
git switch master
git pull --ff-only
git switch -c fix/123-search-focus
npm.cmd ci
npm.cmd run dev
```

Use `feat/`, `fix/`, `docs/`, `refactor/` or `chore/` plus a short kebab-case description. An issue number is useful, not mandatory. Keep one coherent outcome per branch/PR. Dependent work may branch from another feature branch, but state that dependency and target that parent branch until its changes land.

Commit titles describe the result: `fix(ui): keep library controls stable for empty channels`. Use `feat`, `fix`, `docs`, `refactor`, `test`, `chore` or `ci`. Avoid generic titles such as “updates” or “final fixes”.

## Make a reviewable change

- Keep parsing/queue/file rules in `src/core`, privileged services in `src/desktop`, and presentation in `src/ui`.
- Extract a module when it owns a distinct responsibility. Avoid speculative frameworks and broad rewrites bundled with a small feature.
- Validate renderer IPC input in the main process. Preserve context isolation, sandboxing and the preload allowlist.
- Never overwrite different media. Preserve staging, byte verification, recovery journals and Recycle Bin safeguards.
- Use synthetic fixtures. Add regression tests for meaningful behaviour; do not add tests that merely repeat the implementation.
- UI changes must cover dark/light appearance, narrow windows, keyboard focus, empty channels, unverified-only channels and long filenames where relevant.

```powershell
npm.cmd run check
npm.cmd test
node scripts/build-preview.mjs
```

Preview output is committed when the UI changes. Installer builds are not part of the ordinary development loop. Explain any live Telegram or platform-specific verification you could not perform.

## Open the PR

Target `master` for independent work. Use the PR template: problem, resulting behaviour, validation and material limitations. Include a screenshot for UI changes. Apply one change-type label and relevant area labels. Keep work-in-progress PRs as drafts; do not use labels to duplicate draft/review status.

Prefer squash merging independent short-lived PRs with a descriptive final title. Delete merged branches. A stack needs special care after a parent is squash-merged; see [the project workflow](docs/PROJECT_WORKFLOW.md) before rebasing or force-pushing.

## Releases

Contributors should not create release tags as part of normal feature work. Version bumps and release notes belong in a maintainer-reviewed release PR. Only tag a tested commit already merged into `master`, after publishing has been enabled and signing configured. See [release instructions](docs/RELEASES.md).
