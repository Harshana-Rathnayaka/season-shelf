# Credential and account-isolation audit

Date: 10 November 2026. Published baseline: v1.2.8, commit 0a2edc4. Fix branch: fix/account-session-isolation.

Release integration: these fixes are included in the v1.2.9 source on fix/mcf-helper-workflow.

## Result

No real Telegram API hash, Telegram session, bot token, GitHub token, AWS access key, private key or credential file was found in the audited reachable Git history or the published Windows application's first-party code. The inspected installer does not contain the developer's account database or session. A fresh installation requires the recipient's own Telegram authentication.

This does not mean all personal information is absent: Git author names/emails are public commit metadata, including one non-noreply email identity. The repository owner and release URLs are also public identifiers. A personal-looking username existed in a UI test; the current fixture now uses a generic example username. These identifiers cannot authenticate a Telegram account. No history rewriting was performed.

## Evidence and scope

- Fetched origin branches and tags before auditing. The reachable local graph contained 83 commits, 1,080 Git objects and 600 blobs across 249 historical paths. A custom value-redacted scan checked all reachable text blobs and sensitive filenames. Its phone matches were sequential-number test fixtures; no credential/database/session filenames were present.
- Downloaded official Gitleaks 8.30.1 and verified its SHA-256 against the release checksums before execution. Its git scan with --log-opts=--all --redact=100 processed 77 commit patches (merge/history counting differs from rev-list), about 5.23 MB, and reported no leaks. Source, test and script directory scans also passed.
- Downloaded the actual public Season-Shelf-Setup-1.2.8-x64.exe (113,131,627 bytes), verified its SHA-512 against latest.yml, and extracted the application archive without executing the installer. The archive had 1,052 entries. No credential/session/database/private-key paths were found. All 47 extracted first-party text files scanned clean with Gitleaks.
- Inspected the existing published builder-debug.yml and latest.yml: their secret scan passed. Builder diagnostics were nevertheless being uploaded by an overly broad extension filter; future uploads now use the explicit release asset plan.
- Inspected the README screenshot: it shows sample series data, no signed-in profile, credentials or verification codes.
- Reviewed Telegram authentication, secure storage, startup restoration, renderer IPC, local profiles, packaging and release upload code. GitHub workflow credentials are secret references supplied at runtime, not hardcoded token values or renderer build inputs.

Local redacted scanner reports, downloaded installers and extracted audit files are under artifacts/security-audit/, which is ignored by Git. No real user credential store was decrypted, and no live account was signed in or revoked during this audit.

## Issues fixed

| Finding | Change |
| --- | --- |
| Explicit login reused a saved session when API IDs matched. API IDs identify applications, not individual users. | Supplying details now always creates an empty Telegram session. Saved sessions are used only for explicit saved-account reconnection or startup restoration. Starting a fresh login removes the previous local saved session. |
| Queues, channel caches and watches were shared when switching Telegram accounts within one local profile. | Workspace metadata is bound to Telegram's verified user ID. Switching snapshots the prior workspace transactionally and restores the destination account's workspace. Inactive partial downloads are protected from orphan cleanup. No downloaded files are deleted. |
| Existing legacy workspace metadata had no account owner. | Only restoration of a previously saved session can adopt it. A fresh sign-in archives unassigned legacy metadata and starts a clean workspace rather than claiming another user's data. |
| Logout disconnected the client without asking Telegram to revoke its authorization; a network failure could prevent local credential clearing. | Logout now clears local credentials first, detaches the client, requests Telegram logout and destroys the in-memory session. Offline logout still succeeds locally and tells the user to revoke the session in Telegram > Devices. Concurrent account operations are blocked. Ordinary application shutdown still preserves the encrypted saved session. |
| Remembered login suggestions did not reject Linux basic_text encryption, and credential reads had a weaker policy than writes. | Shared secure-storage policy rejects unavailable or basic_text storage for both reads and writes. Persisted sessions are restricted to API ID/hash/session fields; passwords and verification codes are excluded. |
| Release upload filtering allowed unrelated diagnostic YAML files. | Only planned installers, update metadata and matching blockmaps are uploaded. Packaging excludes environment files, credentials, database/session files and signing keys; Git ignore rules are expanded. |
| No automated history scan in CI. | Added a pinned, checksum-verified, redacted Gitleaks job with full Git history checkout. |

Account switching waits for scans, watches, downloads, removals and naming operations to stop. Telegram identity is verified before new credentials are saved. Login errors cannot leave an authenticated previous client available. Renderer account changes replace the prior account's queue/library and clear selections and demo snapshots.

## How another user signs in

The app contains no default Telegram API ID, API hash, phone number or developer session. A new operating-system profile has an empty credential store. The user obtains their own API credentials from my.telegram.org and signs in with their own phone, Telegram verification code and two-step password when Telegram requires it. Subsequent launches can restore only that local encrypted session.

API/phone suggestions are encrypted local conveniences; they do not contain a session and cannot bypass Telegram authentication. Signing out retains these suggestions until Forget suggestions is selected. Code/2FA values are not written to storage, and submitted forms are cleared. IPC exposes no method for retrieving the serialized session.

Windows/macOS installed data lives under the current OS user's application-data directory, separate from the development profile. Storage is not copied into the installer. There is no central app account database shared between recipients. Telegram's server is the authentication authority: https://core.telegram.org/api/auth. Logout semantics: https://core.telegram.org/method/auth.logOut.

The public search group/bot names and GitHub release owner remain intentional integration endpoints, not personal login credentials. Other users see their own joined channels and must have whatever memberships/subscriptions the selected source requires.

The application is a desktop client, not an OS-user isolation boundary: people sharing the same logged-in OS account can access that profile's local files and remembered account. It does not add an application PIN or encrypt all library/history metadata. Use separate OS user logins on shared computers. Electron documents Windows DPAPI and the weaker Linux basic_text backend here: https://www.electronjs.org/docs/latest/api/safe-storage. Unsigned macOS updates can also trigger Keychain permission prompts.

## Validation and limits

The full suite passed 189 tests, covering fresh profiles, explicit sign-ins with repeated API IDs, online/offline logout, logout races, per-account queues/watches, partial preservation, legacy-data adoption, transaction failures, renderer workspace replacement and upload filtering. Syntax/TypeScript checks and production build passed. An unpacked Windows packaging check passed and its 1,054 archive entries contained no sensitive credential paths. The final small notification-state change received focused revalidation.

The audited 1.2.8 installer does not include these fixes; they are included in the v1.2.9 source. No release was overwritten. The macOS installer was not unpacked during this audit, and real two-account sign-in/OS-keychain behaviour still requires manual acceptance testing. Secret scanners cannot prove absence of all possible encoded or unrecognized secrets, and this audit does not cover inaccessible/deleted remote objects, unrelated forks, private messages or every historical binary image.
