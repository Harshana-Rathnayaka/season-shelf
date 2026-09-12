## 12 September: settings, reset controls, sign-in and filename follow-up

Completed in source (development only; DO NOT rebuild/publish installers until requested):
- Settings now has Appearance, Downloads and storage, Channel filtering, Data and activity, About groups with shared spacing and dividers. Download folder / Watch folder labels. Removed duplicate account/settings links.
- Clear app data is metadata-only: clears queue/history, catalogue/channels, watches and lifetime counters. Retains media, partials, encrypted login, preferences and guide completion. Separate lifetime reset leaves jobs/batch progress alone. Both require themed confirmation. Active operations block full reset.
- All delete/reset confirmations now use trusted main-process requests and opaque reply IDs, themed in the renderer. Closing or Escape cancels; no native Windows message boxes for these actions. Deletion still checks integrity before Recycle Bin operations.
- Sign-in details remembered after successful interactive login, encrypted separately from sessions; a saved-account suggestion fills API ID/hash/phone. Password/code/session never enter suggestions. Forget suggestions removes the separate memory; logout removes the session.
- Guide runs in development and installed profiles and persists completion. Replay in Settings/About.
- Closing pauses pending/active downloads even with tray enabled. Checks/transfers finish safely. The tray setting chooses hide vs quit.
- Updates download automatically; ready prompt offers Now/Not now and a desktop notification. Deferred version is stored and installed on the next startup after the existing updater validates the release/download. Connectivity is required for that check; development does not install updates. No real release/update installation has been exercised.
- Fixed missing/deleted navigation count; badge also refreshes while Library is open. Empty batch progress track hidden (it was a progress bar, not a scrollbar).
- Filename voting now includes spaces and handles spaced dashes correctly. Existing original-name jobs normalize on disk after all queued season jobs complete, preserving byte integrity and extensions/protected tags. Ties still keep originals. Old legacy generated-path records remain display-only per the earlier explicit request. Paused/failed season work delays naming; collisions expose a retry.
- README rewritten with an actual sample-data Electron preview, feature overview, development commands and data/reset/update semantics. Core third-party licenses bundled for About; no project license chosen or signing credentials configured.

Verification: All 102 tests and syntax checks passed after the final changes. Isolated Electron screenshots rendered successfully outside the sandbox with a separate test profile. Reviewed library, unverified list, Settings sections, guide, sign-in/password and themed deletion. First sandbox attempt could not render; the outside-sandbox attempt worked. No real account/media touched by visual checks. Artifacts are under artifacts/visual (ignored); README image is docs/assets/library-preview.png.

Remaining release work: choose project license and signing provider, test a real signed installer/update cycle, publish a version only when requested. Future bot/1080p/WhatsApp work remains as previously documented. Do not treat old installer build notes below as current binaries.

## 12 September: installation and library UX follow-up

- Verified/Unverified are mutually exclusive library views; unverified files retain manual selection and original names. Removed the redundant review dialog. Bulk selection follows the displayed view.
- Watch form and About/update controls have consistent gaps. Settings groups downloads, Telegram, storage/activity, then About. Missing GitHub releases produce a neutral status, not a provider error.
- Packaged builds use %APPDATA%/Season Shelf/installed, created before Electron's instance lock. Development retains its existing profile. No old credentials/history/files are copied or deleted. This intentionally resets the previously shared test-install profile once; subsequent installed launches/updates preserve the new profile. Reinstalling over this installed profile also preserves it (uninstaller still retains app data).
- Packaged first run shows a quick guide; Get started persists completion. How it works remains available. Future feature-specific tours are not implemented.
- Saved files contains only complete entries. Deletion clears deleted/missing entries; a missing file becomes missing history without ENOENT. Changed files are still protected by hash checks. Lifetime counters are retained.
- Validation: All 93 tests passed together after the final changes. UI checks are DOM-based, not native/pixel verification. Rebuilt sample preview and Windows installer; all 35 packaged source/assets match the workspace and installer SHA-512 matches latest.yml. Installer remains unsigned. No release pushed/published.

## Latest implementation - automation and delivery

Implemented in this working tree:
- Subscription help lists reply channel links for explicit selection, joins selected required channels/groups, then retries the original bot Start/callback. Approval-gated invites and unsupported bot actions still require follow-up.
- Unverified video files can be selected in a separate section of the same Library and saved under Unverified with their original names. They are not labelled as verified quality or included in automatic missing-episode coverage.
- Select missing checks app-managed completed files for the current channel/mode, accounts for combined episodes and marks absent recorded paths missing. It does not scan arbitrary externally downloaded collections.
- Watch series supports hourly notifications or opt-in automatic queuing with saved channel/quality/mode/folder. It runs only while the app is open. Watches detect new video posts, not edits to old messages or broadcast schedules. A large backlog stops cursor advancement and asks for rescan.
- Shared Telegram speed limit and local-time download window; overnight windows supported. Existing in-flight data and final publication can finish outside the window. No OS wake task.
- Resumable rolling ranges now use Teleproto's pooled media scheduler through range-source.mjs. This is a pinned internal 1.229.0 bridge because public downloadFile has no resume offset; fallback iterDownload remains. Eight bounded 512 KiB slots on the pooled path. No live throughput multiplier is claimed.
- Close-to-tray, native completion notifications, NSIS installer, GitHub release metadata and optional automatic update downloads. Installation is explicit and blocked while active work runs. Target repository: Harshana-Rathnayaka/season-shelf. No release has been pushed or published. Authenticode inspection reports NotSigned; publisher signing is not configured.

Validation: 88 tests passed, syntax checks pass, sample preview rebuilt. Local NSIS packaging succeeded; the final build is refreshed after source changes. Real account workflows, native visual behavior and installed-to-installed updating are not claimed verified.

Read TRANSFER_AND_DELIVERY_RESEARCH.md for sourced speed/WhatsApp findings and RELEASES.md for delivery. CallMeBot advertises free personal WhatsApp notification but its registration is currently full; WhatsApp sending was researched, not implemented. Meta's official outbound messaging cannot be promised universally free.

Still outstanding: publish the first public release, configure publisher signing for broad distribution, alternate 1080p bot, attachment-contained discovery links, separate callback messages, broader subscription providers, arbitrary folder collection indexing and language/subtitle probing.

## Toolbar, combined episodes and discovery recovery - 11 September 2026

Queue bulk actions now share one compact wrapping toolbar; separate info controls removed. Supplemental action tooltips and existing deletion confirmations retain the explanations. Saved files uses the same button sizing. UX reference: https://www.nngroup.com/articles/tooltip-guidelines/

Consecutive two-episode files (S04E01E02 or S04E01-02) are accepted only with valid quality/codec/size; larger, reversed or conflicting ranges remain excluded. Combined files display their range, preserve original names and are selected once without overlapping singles. Re-scan existing channels to refresh previously rejected records.

Discovery errors now replace the waiting overlay with visible error/recovery controls. Successful joins switch to Library, close the dialog and clear the old series while scanning. Invite imports without a chat entity recheck the exact invite to retrieve scan identity. Live Telegram error cause from the screenshot is unconfirmed; no account operation was performed during development.

77 tests pass, including missing-entity join recovery, dialog closure/new series rendering, visible failures and combined episodes. Syntax checks pass; sample preview rebuilt. Native visual acceptance and a real provider retry remain pending.

## Inline button schema fix and compact action help - 11 September 2026

Root cause confirmed in installed Teleproto README: layer 229 uses KeyboardInlineButton.type with InlineButtonTypeUrl/Callback; previous fixtures only exercised legacy button shapes. Parser now supports both schemas. Regression uses real installed Api constructors and exercises sole-result Start/join plus callback execution. Multiple-result selection remains covered. Live provider acceptance is still pending.

Queue and saved-file action explanations are now compact info disclosures, available on hover, keyboard focus and click, preserving confirmation messages. Full suite: 74 tests pass; syntax checks pass; preview rebuilt.

## Discovery buttons and workspace follow-up - 11 September 2026

All 73 tests pass; JavaScript syntax checks pass. Added coverage for inline keyboards missing from thread reads, callback context and stale-button rejection, automatic sole-result continuation, multiple-result selection, cancellation/loop bounds, and the anchored account menu. Fixed a document-level keyboard event error found by the menu test. Standalone preview rebuilt.

No live provider interaction or native visual validation was performed. Windows title bar requires Electron restart. Callback replies delivered as separate new messages remain unsupported.

## Shared-group search, common scrolling and accent fix - 11 September 2026

All 67 tests passed. Coverage now requires group preview before posting, linked-group resolution, explicit joined-group fallback, exact bot/reply correlation, single-use source tokens, plain /start vs parameterized Start, live colour preview without manually disabling Automatic, and scroll-position retention on all pages.

No browser/native surface available: pixel-level layout remains unverified. No live Telegram messages, joins, or personal-file operations were performed. The corrected provider flow needs one account-level acceptance run; mocks do not prove MCF response compatibility.

## Private message links ? 11 September 2026

All 27 relevant discovery/UI tests passed (62 tests now in the full suite). New coverage includes the supplied URL format, ID validation, access-hash lookup via dialogs, exact message reads, preserved start payload, missing messages, and bare bot preview without sending. No private Telegram content was read live.

## Discovery follow-up ? 11 September 2026

57-test full suite passed, then all 15 UI tests passed after adding the discovery UI test (58 total). Mock service tests cover destination type, edited/multiple replies, unknown senders, start payload, preview without join, explicit join, cancellation and timeouts. No live bot messages or joins.

## 11 September 2026

52 tests pass; syntax checks pass. Added appearance validation/UI reset, safe profile projection, discovery-link parsing and transactional checkpoint rollback coverage. No browser/native surfaces available; visual and live Telegram checks remain pending. Discovery transport is not implemented.

# Current validation ? scrolling, bulk actions and remembered sessions

46 tests pass after final code changes. Syntax checks pass and standalone preview is rebuilt. New coverage: quiet valid/expired session restoration with mocked clients; singular/plural labels; essential-controls structure; bulk removal preserving completed/finishing entries; verified bulk trash preserving changed files; orphan cleanup preserving tracked/active partials; naming retry after collision removal.

Normal page scroll replaces the fixed episode pane. Visual layout is not proven by JSDOM; native auto-reconnect, Recycle Bin actions and sticky layout still need acceptance in the running app. No user media was deleted during development. Tests use disposable fixtures and mocked Recycle Bin operations.

---

# Current validation ? batch progress, naming and live development

39 tests pass after final code changes; JavaScript syntax checks pass; standalone sample preview rebuilt. Added coverage for batch/history separation, cancellation/removal totals, end-of-season naming timing, byte preservation, collisions, naming journal recovery, payload/publication counters, keyword editor, Archive deletion action and development reload/restart deferral.

Native layout, Recycle Bin, Show in folder and Electron relaunch need user acceptance; tests exercise logic with fixtures/mocks and do not claim visual or live Telegram validation. Lifetime activity begins with this update. See NEXT_SESSION.md and DEVELOPMENT.md for current behaviour and limits.

---

# Current validation ? resumed UX work

30 tests pass; JavaScript syntax checks pass; standalone preview rebuilt. New tests cover channel-derived qualities, enqueue consistency, channel filters, row/checkbox selection, retained scroll position, sidebar collapse, keyboard season navigation and saved file details. Visual inspection was unavailable: the connected UI inventory contains no browsers/apps. Show in folder and desktop persistence need native acceptance. Older entries below are historical.

---

# Latest update ? 10 September 2026

22 tests and syntax checks pass. User reports the app works with Telegram. New quality controls, queue removal/bulk actions, totals and naming rules have offline regression coverage. Visual review is pending: no browser was available to the UI tool. See [session handoff](NEXT_SESSION.md).

---

# Validation record — initial build

## Verified offline

The final local suite contains 16 passing tests. DOM interaction tests use JSDOM and do not establish visual layout correctness.

- JavaScript syntax checks.
- Dependency import and current Teleproto adapter range signature.
- Dotted/underscored filenames, HEVC aliases, resolution and episode parsing.
- Archive/watch selection and smallest matching candidate.
- Exclusion of conflicting, multi-episode and unknown metadata.
- Windows-safe naming and destination containment.
- Ordered parallel range output with bounded batches.
- Source attachment identity change detection.
- Byte-exact completed downloads with a deterministic local fixture.
- Mid-download pause/resume.
- Missing destination marker prevents download and produces waiting status.
- Existing destination file is preserved and the staged original remains.
- Restart recovers unfinished jobs as paused.
- Archive and Watch are distinct jobs.
- Truncated source cannot be published.
- Recovery recognises an already verified completed destination.
- Sample UI renders rows, switches archive/watch quality, selects seasons and creates a preview queue.
- Search and theme changes update the DOM.
- Sample sign-in does not request credentials.

## Pending on the user's PC

- Native Windows launch, login code/2FA/email flows and OS session encryption.
- Real channel scan and actual Telegram downloads.
- Speed benchmark versus Telegram Desktop on the same account and connection.
- Windows/exFAT publishing, drive unplug/replug, player launch and Recycle Bin.
- Visual inspection, keyboard ergonomics and narrow-window layout.

The build environment could not launch Electron because native desktop/socket facilities were restricted. The Cloud browser blocked localhost and local-file preview by policy. No rendered screenshot or visual verification is claimed. `docs/preview.html` is a self-contained sample-only interface for manual review.

Final packaging check: NSIS build completed; all 34 packaged source/assets match the workspace and latest.yml SHA-512 matches the installer. Authenticode status is NotSigned. No release was published.

## Library positioning and project workflow
104 tests pass; syntax and workflow YAML checks pass. Actual Electron checks cover mixed, unverified-only and empty catalogues on both tabs. Identical tab/search X positions and aligned centers across all six cases. Reviewed focused search and redesigned transfer controls. No EXE rebuilt.
