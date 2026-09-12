# Windows releases

The updater is configured for public GitHub Releases at https://github.com/Harshana-Rathnayaka/season-shelf. No release has been published by this development task.

## Build locally

Run `npm.cmd ci`, then `npm.cmd run pack:win`. The result is `release/Season-Shelf-Setup-<version>-x64.exe`, its `.blockmap` and `latest.yml`. The app uses an NSIS installer and preserves application data when uninstalling. Users do not need Node or development scripts.

If packaging in a restricted environment, set `ELECTRON_BUILDER_CACHE` to a writable cache directory. A cached local Electron distribution can be used with `npm.cmd run pack:win -- --config.electronDist=node_modules/electron/dist`.

## Publish a new version

1. Finish the changes and increment the version in package.json and package-lock.json, for example with `npm.cmd version patch --no-git-tag-version`.
2. Commit the release version and changes. Merge the intended release into `master` first, after CI passes.
3. Configure Windows signing and deliberately set the repository variable `RELEASES_ENABLED=true` when ready. Until then the tag workflow skips release jobs.
4. Create and push a matching stable version tag, for example `v0.1.1`, on a commit already merged into `master`. The one release workflow validates ancestry/version, runs checks, builds signed artifacts and uploads them to GitHub Releases. Unsigned release builds fail.
5. Confirm the release is public and contains the `.exe`, `.exe.blockmap` and `latest.yml`. Preserve all three files from the same build. A private repository needs a separate public release repository or a different distribution design; do not embed a GitHub access token in the desktop app.

Alternatively, a maintainer can run `npm.cmd run release:win` in an environment with an appropriately scoped `GH_TOKEN`. Do not put that token in a source file, client setting or committed environment file.

## Client behavior

Installed builds check shortly after startup and daily. Available updates download automatically. A ready update offers Restart now or Not now; deferred updates install on the next launch after verification. Development builds do not download updates. Installation is blocked during active transfers, naming, scanning, authentication, discovery or a watcher check.

Signing is not configured. Before broad public distribution, configure a publisher-controlled Windows signing identity and follow electron-builder's signing setup. Never describe an unsigned installer as signed merely because the build log includes a signing step. HTTPS release hosting and update checksums are present but are not a substitute for publisher identity.

Publishing and a real installed-version upgrade have not been performed. The first public release is the remaining external step that makes update delivery available to users.

### Profile separation (12 September)
Installed builds store their encrypted session, SQLite history and staging under `%APPDATA%/Season Shelf/installed`. Development keeps its original Electron profile. Never copy a developer profile into a release. Updates keep the installed profile and onboarding completion flag. Existing files on disk are not moved by this change.

## Signing before a public release

An unsigned executable has no trusted publisher signature. Authenticode signing identifies the publisher and lets Windows detect changes to the signed file. A signature is separate from the project's source-code license.

Before publishing:

1. Obtain a suitable code-signing certificate or an eligible cloud signing service; complete the provider's identity verification.
2. Configure the Windows signing method supported by our pinned electron-builder 26 toolchain. For example, Azure Trusted Signing uses `win.azureSignOptions`; certificate/hardware-backed signing depends on the provider.
3. Keep signing credentials in protected CI secrets or the provider's key service, never in the repository.
4. Build a signed release, verify its Authenticode signature and test installation/update behaviour before publishing.

See [electron-builder v26 Windows signing documentation](https://www.electron.build/v26/docs/features/code-signing/code-signing-win/). Signing is not configured or purchased in this task, and no release is published.

### Deferred updates

The pinned electron-updater 6.x implementation rechecks releases on startup and verifies the cached download before a deferred install. It does not use the newer 7.x `autoInstallEvent` API. This currently needs network access on the next launch. Development builds do not check/install real updates.

See [the full branch, PR and release policy](PROJECT_WORKFLOW.md). Normal CI never packages an installer. No extra artifact-building workflow is needed: the release job already does that before publishing.
