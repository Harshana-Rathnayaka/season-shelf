# Desktop releases

The updater is configured for public GitHub Releases at https://github.com/Harshana-Rathnayaka/season-shelf.

## Build locally

Run `npm.cmd ci`, then `npm.cmd run pack:win`. The result is `release/Season-Shelf-Setup-<version>-x64.exe`, its `.blockmap` and `latest.yml`. The app uses an NSIS installer and preserves application data when uninstalling. Users do not need Node or development scripts.

If packaging in a restricted environment, set `ELECTRON_BUILDER_CACHE` to a writable cache directory. A cached local Electron distribution can be used with `npm.cmd run pack:win -- --config.electronDist=node_modules/electron/dist`.

## Publish a new version

1. Finish the changes and increment the version in package.json and package-lock.json, for example with `npm.cmd version patch --no-git-tag-version`.
2. Commit the release version and changes. Merge the intended release into `master` first, after CI passes.
3. Configure Windows signing and macOS signing/notarization (below), then deliberately set `RELEASES_ENABLED=true` when ready. Until then the tag workflow skips release jobs.
4. Push a matching stable or UAT version tag on a commit already merged into `master`. The workflow validates ancestry/version, tests Windows and macOS, and uploads signed builds to a draft. Only after both jobs succeed and the expected assets exist does it publish the release. Failures leave the draft unpublished; already published versions cannot be overwritten.
5. Confirm the release contains the Windows `.exe`, its `.blockmap` and `latest.yml`, plus the macOS universal `.dmg`, `.zip`, generated blockmaps and `latest-mac.yml`. Preserve these files from the same release. Do not embed a GitHub access token in the desktop app.

Alternatively, a maintainer can run `npm.cmd run release:win` in an environment with an appropriately scoped `GH_TOKEN`. Do not put that token in a source file, client setting or committed environment file.

## Client behavior

Installed builds check shortly after startup and daily. Available updates download automatically. A ready update offers Restart now or Not now; deferred updates install on the next launch after verification. Development builds do not download updates. Installation is blocked during active transfers, naming, scanning, authentication, discovery or a watcher check.

Signing is not configured. Before broad public distribution, configure a publisher-controlled Windows signing identity and follow electron-builder's signing setup. Never describe an unsigned installer as signed merely because the build log includes a signing step. HTTPS release hosting and update checksums are present but are not a substitute for publisher identity.

Publishing and a real installed-version upgrade have not been performed. The first public release is the remaining external step that makes update delivery available to users.

### Profile separation
Installed builds store their encrypted session, SQLite history and staging under `%APPDATA%/Season Shelf/installed`. Development keeps its original Electron profile. Never copy a developer profile into a release. Updates keep the installed profile and onboarding completion flag. Existing files on disk are not moved by this change.

## Signing before a public release

An unsigned executable has no trusted publisher signature. Authenticode signing identifies the publisher and lets Windows detect changes to the signed file. A signature is separate from the project's source-code license.

Before publishing:

1. Obtain a suitable code-signing certificate or an eligible cloud signing service; complete the provider's identity verification.
2. Configure the Windows signing method supported by our pinned electron-builder 26 toolchain. For example, Azure Trusted Signing uses `win.azureSignOptions`; certificate/hardware-backed signing depends on the provider.
3. Keep signing credentials in protected CI secrets or the provider's key service, never in the repository.
4. Build a signed release, verify its Authenticode signature and test installation/update behaviour before publishing.

See [electron-builder v26 Windows signing documentation](https://www.electron.build/v26/docs/features/code-signing/code-signing-win/).

### Deferred updates

The pinned electron-updater 6.x implementation rechecks releases on startup and verifies the cached download before a deferred install. It does not use the newer 7.x `autoInstallEvent` API. This currently needs network access on the next launch. Development builds do not check/install real updates.

See [contribution and PR policy](../CONTRIBUTING.md). Normal CI never packages an installer. No extra artifact-building workflow is needed: the release job already does that before publishing.

## macOS release setup

The macOS runner builds one universal application for Intel and Apple Silicon. It produces `Season-Shelf-<version>-mac-universal.dmg` for installation and the corresponding ZIP for automatic updates. A universal build avoids separate architecture jobs overwriting `latest-mac.yml`.

Configure these repository Actions secrets before enabling releases:

| Secret | Purpose |
| --- | --- |
| CSC_LINK / CSC_KEY_PASSWORD | Existing Windows certificate and password |
| MAC_CSC_LINK | Base64-encoded Developer ID Application certificate (.p12), including its private key |
| MAC_CSC_KEY_PASSWORD | Password for that exported certificate |
| APPLE_ID | Apple Developer account email |
| APPLE_APP_SPECIFIC_PASSWORD | App-specific password for notarization |
| APPLE_TEAM_ID | Apple Developer team ID |

The workflow requires credentials, enables hardened runtime and JIT entitlements, forces signing, notarizes through electron-builder, and verifies the stapled ticket. Keep credentials and certificates in Actions secrets.

On a Mac, `npm run pack:mac` builds without publishing; `npm run release:mac` publishes with configured credentials. Prefer the tag workflow for public releases because it coordinates both platforms. For deliberate unsigned local packaging only, use `npm run pack:mac -- --config.mac.identity=null --config.mac.notarize=false --config.mac.hardenedRuntime=false`. This cannot validate the signed update path.

Install by opening the DMG and dragging Season Shelf to Applications. Installed macOS data lives under `~/Library/Application Support/Season Shelf/installed`; updates preserve it. DMG and ZIP are both required for macOS automatic updates. The artifact names include the platform to avoid Windows collisions.

Complete native signed install/update acceptance on a Mac before the first public release.

References: [electron-builder v26 macOS configuration](https://www.electron.build/v26/docs/mac/), [publishing](https://www.electron.build/v26/docs/publish/) and [notarization integration](https://github.com/electron/notarize).

## UAT and production flavours

Production keeps the existing app ID and installed profile. UAT builds use **Season Shelf UAT**, app ID `local.seasonshelf.desktop.uat` and the `uat` update channel. Production accepts only stable versions; UAT accepts only `X.Y.Z-uat.N` versions. Channel selection disables downgrades, and runtime checks reject cross-environment updates even if a provider returns an unexpected release.

| Build | Windows | macOS |
| --- | --- | --- |
| Production | `npm run pack:win` | `npm run pack:mac` |
| UAT | `npm run pack:uat:win` | `npm run pack:uat:mac` |

Production output is in `release/`; UAT output is in `release/uat/`. A local UAT build from a stable package version gets a `-uat.0` suffix. For a published UAT version, update package.json and package-lock.json explicitly, for example `npm version 0.2.0-uat.1 --no-git-tag-version`, and merge the version commit before pushing `v0.2.0-uat.1`. Stable releases use matching `v0.2.0` tags. Do not publish local -uat.0 builds repeatedly under one version.

The gated tag workflow chooses the correct build configuration. UAT publishes a GitHub prerelease, never marks it latest, and includes `uat.yml` and `uat-mac.yml`. Production publishes the stable release with `latest.yml` and `latest-mac.yml`. Both require signing, notarization and complete Windows/macOS assets. Keep the publishing gate disabled until signed install/update acceptance succeeds.

Installed profiles live under the OS application-data directory: `Season Shelf/installed` for production and `Season Shelf UAT/installed` for UAT. Source UAT uses `Season Shelf UAT/development`; source production previews use `Season Shelf/production-preview`. Existing source-development storage stays in place. No sessions or history are copied between them.

See [electron-builder update channels](https://www.electron.build/v26/docs/tutorials/release-using-channels/). Environment names are project configuration, not a special Electron flavour API.
