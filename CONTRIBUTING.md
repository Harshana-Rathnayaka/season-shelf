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

## Develop locally

Install dependencies with `npm ci`, then use `npm run dev`. In VS Code, open Run and Debug, choose **Electron: Development**, and press **F5** (or **Ctrl+F5** to run without debugging). The launch configuration supports main-process breakpoints; inspect the renderer with Development > Toggle Developer Tools. Run Task also offers dependency installation, source checks and tests.

Use `npm` on macOS and `npm.cmd` in Windows PowerShell if needed. Close an existing instance of the same profile before debugging; the single-instance lock otherwise focuses it. Do not set ELECTRON_RUN_AS_NODE when launching Electron (the VS Code configurations clear it).

After a short save debounce, UI edits reload the renderer and backend edits request an immediate restart through normal shutdown. There is no wait for downloads or authentication to become idle. Pending sign-in/discovery prompts are cancelled on UI reload. This is reload, not state-preserving hot module replacement: unsaved UI state may reset and unfinished jobs return paused. An automatic backend relaunch may end the debug session; press F5 again to debug it after closing that instance. Use the Development menu for manual reload or Restart app.

| Command / VS Code configuration | Profile and purpose |
| --- | --- |
| `npm run dev` / Electron: Development | Existing development data; automatic reload and DevTools |
| `npm start` | Same development profile without automatic reload |

Use development for coding and normal packaged builds for installer testing. Development and installed builds keep separate application data. Test fresh installs in a VM or separate OS account; updates preserve the installed profile. All builds use the real Telegram service and the download folders you select.

See [release setup](README.md#build-and-release) for local packaging and publishing. This project uses Electron's npm/VS Code workflow and electron-builder; a bundler is not required for its plain HTML/CSS/JavaScript renderer. See [Electron's setup and debugging guide](https://www.electronjs.org/docs/latest/tutorial/tutorial-first-app).

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

Prefer squash merging independent short-lived PRs with a descriptive final title. Delete merged branches. For dependent PRs, merge the parent first, then retarget the child to master. A parent merge commit preserves ancestry; a squash merge changes commit IDs and can show duplicate changes. On an exclusively owned child branch, save the old parent tip and use `git rebase --onto origin/master <old-parent-tip> <child-branch>` followed by `git push --force-with-lease`. Coordinate with collaborators; a fresh branch with only child commits cherry-picked avoids rewriting a shared branch.

## Labels and repository settings

Label definitions live in [.github/labels.json](.github/labels.json); the sync workflow creates/updates them. Pick one change type (bug, enhancement, documentation or maintenance) and relevant area labels. Use priority: high sparingly, blocked with an explanation, and contributor labels only for scoped work. GitHub already tracks draft/review/merged status.

Recommended master protections: require PRs, passing Windows checks and macOS checks, and resolved conversations; block force pushes and branch deletion. For a solo maintainer, avoid requiring self-approval. Add independent review when another maintainer is available.

## Releases

Contributors should not create release tags as part of normal feature work. Version bumps and release notes belong in a maintainer-reviewed release PR. Only tag a tested commit already merged into `master`, after publishing has been enabled. See [release instructions](README.md#build-and-release).
