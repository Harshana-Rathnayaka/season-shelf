# Branches, PRs and releases

## Repository baseline

The default branch is `master`. PRs #1, #2 and #3 have merged; new independent work starts from updated `master`. CI checks Windows and macOS. Release publishing is explicitly gated. Labels are synchronized from `.github/labels.json` by repository Actions.

## Recommended model: GitHub flow

Use short-lived branches and merge reviewed PRs into `master`. A permanent `develop` branch is unnecessary for the current project size. Keep `master` working; a release is an explicitly tagged, tested snapshot rather than every merge.

| Work | Branch name | Base |
| --- | --- | --- |
| New feature | `feat/123-series-watch` | Updated `master` |
| Bug fix | `fix/124-search-focus` | Updated `master` |
| Refactoring | `refactor/queue-persistence` | Updated `master` |
| Documentation | `docs/contributor-guide` | Updated `master` |
| Dependencies/tooling | `chore/update-electron` | Updated `master` |
| Version preparation | `chore/release-0.2.0` | Updated `master` |
| Work requiring an open PR | Descriptive feature/fix branch | That PR's branch; declare the dependency |

Issue numbers are optional. Avoid personal names, dates and long-lived “working”, “dev” or “latest” branches.

### Dependent PRs

When work depends on an open PR, branch from its head and initially target that branch so reviewers see only the new changes. Merge the parent first, then update the child base to `master`.

A parent merge commit preserves ancestry. A squash merge changes commit IDs, so retargeting alone can show duplicate changes. On an exclusively owned child branch, save the old parent tip, then use `git rebase --onto origin/master <old-parent-tip> <child-branch>` and `git push --force-with-lease`. Coordinate history changes with collaborators. For a shared branch, a fresh branch from `master` with only the child commits cherry-picked avoids rewriting shared history.

## PR and history policy

Prefer **squash and merge** for independent short-lived PRs: one reviewed outcome becomes one useful `master` commit. Use Conventional Commit-style PR titles. The PR keeps discussion and intermediate commits accessible; the mainline stays easy to scan and revert. Avoid merging unrelated fixes, refactors and release work together.

Recommended repository settings (not silently applied): require PRs and the `Windows checks` and `macOS checks` status checks; block force pushes/deletion on `master`; resolve review conversations; allow squash merges. For a solo maintainer, do not require an impossible self-approval. Add one independent approval when another maintainer is available. Configure checks after CI has reported its first run.

Use tags for versions, labels for issue/PR categorization, and milestones for a planned release. None of these replaces a focused PR description.

## Labels

The source of truth is [.github/labels.json](../.github/labels.json). `Sync repository labels` creates/updates these labels without deleting other labels. It runs when the definitions or sync script/workflow change on a pushed branch, and can be manually run after it reaches the default branch. It only needs repository contents read and issues write permissions.

| Category | Labels | Rule |
| --- | --- | --- |
| Change type | `bug`, `enhancement`, `documentation`, `maintenance` | Pick the primary type |
| Area | `area: ui`, `area: downloads`, `area: telegram`, `area: desktop`, `area: release` | Add the affected area(s) |
| Priority | `priority: high` | Use sparingly for high-impact work; ordinary work needs no priority label |
| Dependency | `blocked` | State the dependency in the issue/PR |
| Contributors | `good first issue`, `help wanted` | Add only after scope and acceptance criteria are ready |

Do not create “in review”, “merged” or “done” labels; GitHub already tracks these states.

## CI versus release

| Event | Workflow | Result |
| --- | --- | --- |
| PR or development branch push | `CI` | Install dependencies, syntax checks, tests, label-definition validation; no installer/publishing |
| Label definition change | `Sync repository labels` | Create/update the configured repository labels |
| Stable `vX.Y.Z` tag push | `Desktop release` | Runs only when `RELEASES_ENABLED=true`; validates version and ancestry, tests Windows/macOS, builds signed NSIS and notarized universal macOS assets, and publishes only after both succeed |

The release workflow already performs both artifact construction and publication. **A second build workflow is not required.** `npm run release:win` invokes electron-builder with publishing enabled; it produces the installer, blockmap and update manifest in that same job and uploads them to GitHub Releases.

Originally, any `v*` tag matching package.json could publish immediately. The revised workflow is disabled by default through the `RELEASES_ENABLED` repository variable. It also requires a stable semantic version, a commit reachable from `origin/master`, and code signing. No variable was enabled, tag pushed, artifact built or release published in this task.

### When ready to release

1. Choose the project license, configure signing, test a signed installation/update cycle, and configure required CI checks.
2. Create a release PR with matching package.json/package-lock.json version and reviewed release notes; merge it into `master` after checks pass.
3. A maintainer enables `RELEASES_ENABLED=true`. Protect `v*` tags with a ruleset if desired.
4. Tag the intended merged commit, for example `v0.2.0`, and push that single tag. Never use a broad `git push --tags` as a casual development command.
5. The one release workflow validates, tests, packages and publishes. Check the release contains the EXE, DMG, ZIP, blockmaps, `latest.yml` and `latest-mac.yml`; installed apps use their platform manifest.
6. Never move or reuse a published version tag. Fix a bad release with a new patch version. Beta channels require a separate intentional policy before enabling them; the current workflow accepts stable versions only.

GitHub normally generates source archives for a tag/release; those archives are **not** an Electron installer. Our workflow builds Windows and macOS application assets explicitly.

## Sources

This recommendation follows [GitHub flow](https://docs.github.com/en/get-started/using-github/github-flow), [GitHub's merge-method guidance](https://docs.github.com/en/pull-requests/reference/pull-request-merges), and [workflow event documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows). Repository-specific claims above come from the checked-in workflows and the GitHub repository/PR audit.
