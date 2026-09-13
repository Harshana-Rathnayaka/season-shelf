# Desktop releases

## Develop and test locally

Use `npm run dev` (or VS Code F5) for development. Use the normal packaged app to test installation. Source and installed builds keep separate login, history and settings; downloaded folders are whichever paths you choose.

For a clean installation test, use a VM snapshot or a separate OS account. Reinstalling intentionally preserves existing installed data. You do not need another app environment to test an installer.

Install Node.js 24 and run `npm ci` first. In PowerShell, use `npm.cmd` if execution policy blocks `npm`.

| Host computer | Command | Output in `release/` |
| --- | --- | --- |
| Windows | `npm run pack:win` | `Season-Shelf-Setup-1.0.0-x64.exe` |
| Mac | `npm run pack:mac` | `Season-Shelf-1.0.0-mac-universal.dmg` and `.zip` |

These commands never publish. The Mac build needs a Mac and produces one app for Intel and Apple Silicon. Open the DMG and drag the app into Applications. Windows uses an NSIS installer.

Without signing credentials, Windows local packaging is unsigned. For a deliberately unsigned Mac test build, run:

```sh
npm run pack:mac -- --config.mac.identity=null --config.mac.notarize=false --config.mac.hardenedRuntime=false
```

Unsigned packages can trigger OS security warnings and do not validate signed updates. Prefer a signed build for final acceptance.

## Signing

Signing proves the publisher's identity and detects changes to an executable. It is separate from the source-code license. Credentials are not supplied by this repository.

### Windows

Choose a publicly trusted code-signing provider and complete identity verification. Current providers commonly require hardware or cloud protection for private keys; do not assume a newly purchased certificate can be exported into a PFX file.

The current workflow supports a certificate file through `CSC_LINK` and `CSC_KEY_PASSWORD` GitHub Actions secrets. Use this only when your provider supports that method. A hardware token or cloud service requires its provider-specific signing integration. Azure Artifact Signing (formerly Trusted Signing) is another option where eligible; electron-builder 26 uses `win.azureSignOptions` and Azure authentication. Its configuration and the workflow credential check must be adapted before using it. Keep the same publisher identity for future updates. Signing does not guarantee immediate SmartScreen reputation.

References: [electron-builder 26 Windows signing](https://www.electron.build/v26/docs/features/code-signing/code-signing-win/) and [Microsoft signing options](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options).

### macOS

1. Enrol in the Apple Developer Program (normally USD 99/year).
2. Create a **Developer ID Application** certificate, then export it with its private key as a password-protected `.p12` from Keychain Access.
3. Add the following repository Actions secrets:

| Secret | Value |
| --- | --- |
| `MAC_CSC_LINK` | Base64-encoded `.p12` certificate |
| `MAC_CSC_KEY_PASSWORD` | Certificate export password |
| `APPLE_ID` | Apple Developer account email |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password for notarization |
| `APPLE_TEAM_ID` | Developer team ID |

For a local signed Mac build, set `CSC_LINK` and `CSC_KEY_PASSWORD` in your shell instead of the `MAC_` names, plus the three Apple variables. The workflow maps the Mac secrets automatically. Never commit secrets or certificates.

The build signs with hardened runtime, submits the app for Apple's notarization and verifies its signature and stapled ticket in CI.

References: [Apple membership](https://developer.apple.com/support/compare-memberships/) and [Electron notarization](https://github.com/electron/notarize).

## First release: 1.0.0

1. Test local installers on Windows and macOS. Configure and validate signing for both platforms.
2. Merge the intended code and the `1.0.0` package/lockfile version into `master`, with CI passing.
3. Add signing secrets under GitHub **Settings > Secrets and variables > Actions**. Set the repository variable `RELEASES_ENABLED` to `true` only when ready to publish.
4. On the latest local `master`, run:

```sh
git pull --ff-only
git tag -a v1.0.0 -m "Season Shelf 1.0.0"
git push origin v1.0.0
```

The tag workflow checks version and master ancestry, creates an unpublished draft, tests and builds on Windows and macOS, signs the builds, then uploads the assets. It publishes automatically only after both platforms succeed and the required assets are present. A failure leaves the draft unpublished. Do not push the tag until you are ready for public publication.

GitHub Releases hosts the EXE, DMG, ZIP, blockmaps and `latest.yml` / `latest-mac.yml`. The ZIP and update metadata are necessary for the updater: keep them together with the installers. No second build workflow or separate hosting service is needed. Never overwrite a published version.

For later releases, increment the version (for example `npm version patch --no-git-tag-version`), merge, and push the matching tag.

## Testing and receiving updates

A single local installer tests installation, not automatic updates. To test the whole updater before public distribution, use a temporary GitHub repository as a test feed, build two increasing stable versions with the same signing identity and repository override, and publish both there. In a disposable VM/account, install the older version, make the newer version available, and verify download, restart and preserved data. Keep the production repository configuration unchanged. Private feeds require additional authentication; never embed a GitHub token in the app.

Installed apps check after startup and daily and download available stable updates automatically. Users choose **Restart now** or **Not now**. Deferred installation is retried on next launch after verification; the current updater needs network access for that check. Active work blocks installation. Development builds do not install updates.

Production profiles live under the OS application-data directory in `Season Shelf/installed`. Updates retain login, settings, onboarding and history. Files on disk are not moved. No signed release or real installed-version upgrade has been verified yet.
