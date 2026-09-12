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

## Latest handoff - discovery buttons and compact workspace

Implemented: re-fetch accepted bot replies by message ID to retrieve inline keyboards; preserve callback data and original message context; validate buttons before pressing; handle callback URLs and edited keyboards. Unsupported buttons remain visible. A sole eligible result continues through Start, channel join and scan; multiple results require selection. Navigation/subscription controls are excluded from automatic selection. Bare MCF bot links now continue to plain /start.

Downloads and Saved files use matching 96px base summary tiles (scaled with text size) and compact rows retaining episode details. Account click opens an anchored popup with logout; Settings copy and account separator corrected. Windows uses a theme-matched 32px draggable title bar with native window buttons; restart Electron to load it.

Validation: 73 tests and syntax checks pass. Preview rebuilt. No live Telegram messages/joins or personal-file deletions performed. Native/pixel-level appearance remains unverified. Test a real MCF search next; callbacks that send a separate new message rather than return a URL or edit their source message are not collected yet. Subscription gates, attachment-contained links, forums and alternate file bots remain future work. Earlier callback limitations below are superseded for supported URL/edited-keyboard callbacks.

# Season Shelf ? current handoff

## Current implementation

- Latest correction: search belongs in the shared MovieClubFamily group, not the private bot. See BOT_DISCOVERY_RESEARCH.md for the cited feasibility assessment and limits.
- All five pages now use the shared bounded workspace: stationary topbar/heading/controls and a scrollable content pane. Same-page redraws preserve content position.
- Accent bug fixed: choosing a colour turns off Automatic and previews immediately; Apply saves it. Text colour, weight and size use the same preview flow. Removed developer-oriented concurrency and command-line copy.

- Current staged plan: DEVELOPMENT_PLAN.md; targeted code review: ARCHITECTURE_REVIEW.md.
- Appearance settings: 90?120% text, Regular/Medium/Semibold, custom accent/text or theme defaults, reset. Values validated in main; reusable core/UI appearance modules added.
- Telegram display name and @username appear in sidebar and Settings after connection; phone and account ID are not sent to the renderer. Profile is memory-only, optional if getMe fails.
- Queue jobs, current batch and usage now save atomically in one SQLite transaction.

- Segoe UI system typography, compact Archive/Watch and channel-derived quality buttons, visible source filenames, restored illustrated hero/catchphrase.
- Library now keeps the header and controls stationary in a bounded viewport; only the episode list scrolls. Consolidated conflicting CSS overrides, reduced header/toolbar spacing, retained illustrated hero, horizontal season navigation and filename tooltips. The filename is one ellipsized line; redundant metadata is hidden in library rows. Short windows use a smaller hero. Native visual acceptance is pending.
- Suggested channels with configurable keywords in Settings, Save/Restore defaults and an empty-list option. Explicit media titles remain visible; All channels bypasses filters. Newly approved standalone words are signals, gold, profit, market, exchange. Other proposals in CHANNEL_FILTER_REVIEW.md remain unapproved.
- Current-batch byte progress retains completed files from the ongoing batch. Example: 5 GB completed + 5 GB pending = 5 / 10 GB. Additional enqueues while work is pending join that batch. A new enqueue after completion starts a fresh batch. Cancel/remove/delete/missing entries are excluded; paused/failed/waiting jobs remain included. Current batch identity persists so clearing a queue cannot fall back to old lifetime history. Saved files has a separate saved-size total.
- Settings lifetime counters: payload bytes received by the download engine, verified bytes published, completed file count, measurement start timestamp. Counters persist independently of queue removal/deletion. These measure from this update, not reconstructed old network traffic; payload excludes protocol overhead and discarded prefetch, publication is logical verified output rather than every physical disk copy. Counters checkpoint with queue saves, so an abrupt crash may omit activity since the last checkpoint.
- Automatic noninteractive restoration of the encrypted saved Telegram session on startup. Cached UI loads immediately; a status event updates the connection. Expired/revoked sessions need explicit sign-in; errors do not open surprise prompts. Unfinished downloads remain paused until the user resumes.
- Individual removal and Pause/Resume/Cancel all. Removal retains partials, re-enqueue starts a new job. Completed files in BOTH Archive and Watch can be moved to the Recycle Bin after a native confirmation and content-hash check. No permanent-delete action. File details shows actual saved basename, original filename and path; Show in folder uses the native file manager.
- New and unfinished queued jobs use Season NN / original Telegram filename, never synthesized show/episode filenames. Original valid spelling/spacing/case is preserved. Windows-incompatible names are sanitized.
- Separator normalization now runs AFTER every non-cancelled/non-deleted queued job for the same destination/channel/mode/season is complete. It votes using original names of completed version-2 app-managed jobs; dot, underscore and dash styles supported. Ties preserve originals. Extensions, decimal numbers and recognized compound tags such as WEB-DL and HEVC-PSA are protected. It does not establish whether a whole broadcast season exists in the channel. Earlier completed files remain untouched (user explicitly chose display-only handling of legacy files).
- Naming uses exclusive hard links or exclusive verified copies, a persisted journal, source hash checks, no-overwrite collision handling and restart recovery. Naming errors appear in Downloads; originals survive collisions. A later successful season run, restart, or the explicit Retry season naming action in File details retries eligible naming. An interrupted exFAT naming copy with a mismatching target is retained for manual review, not overwritten automatically.
- Delete all pending snapshots and removes eligible unfinished entries, aborts network work and retains completed/finishing files and all partial bytes. Delete all saved snapshots completed files and confirms before Recycle Bin deletion, preserving changed or currently renamed files and reporting failures.
- Settings: Check storage / Clean up unused partials identifies app-format partials without a job or active worker. Recycles only confirmed orphan IDs, rechecking references before cleanup; tracked paused/cancelled/failed partials are preserved.
- How it works explains queue/review behaviour. Attachments to review remains informational; missing resolution such as WEB.x264 is never assumed to mean 720p.
- Dev.cmd / npm.cmd run dev: UI auto-reload while main-process downloads continue; backend restart deferred until downloads/naming/scanning/authentication are idle. Ctrl+R reload and Ctrl+Shift+I DevTools. See DEVELOPMENT.md. No drag-and-drop designer or state-preserving hot module replacement is claimed.

## Verification

67 automated tests passed after the shared-group correction, common scroll layout and accent fix. Syntax checks and rebuilt preview are recorded in VALIDATION.md.

No connected browser/native app surface was available for visual verification. Native Recycle Bin deletion, Show in folder, development relaunch and small-window hero/panel layout need user acceptance. No real user files were deleted or manually moved during development. Standalone sample preview is rebuilt.

## Remaining priorities

1. User visual review at 1024px / 720px and normal sizes: compact illustrated hero, stationary controls and independent episode scroll; also test 120% text, saved rows and appearance editor. Native bulk Recycle Bin actions and remembered-session restoration also need acceptance. Test one real season's end-of-download naming and deletion confirmation before relying on a large batch.
2. Orphaned staging cleanup is implemented. Future: broader disk usage accounting, restoring/re-attaching removed partials and exact wire-traffic measurement.
3. Naming controls: preview final names, per-season style overrides/pinning, and collision previews and guided collision resolution. A Retry season naming action is now available in File details after errors; it waits for queued season completion and retains no-overwrite checks. Media probing/manual metadata corrections for the review list. No legacy-file migration requested.
4. Per-series folders/quality persistence, alternative-release chooser, bit-depth filters. Bitrate requires reliable duration; never infer it from file size alone.
5. English/language/subtitle preferences with Unknown retained, clear distinction between filename hints, embedded tracks and sidecar subtitles. Consider optional local media probing.
6. Channel filtering: review remaining proposed terms in CHANNEL_FILTER_REVIEW.md. Future per-channel Always show override, explain matched keyword, persist successful media classification. Current filtering is title-based, not a content classifier; movie channels may be listed, but standalone movie parsing is not implemented.
7. Shared-group discovery now resolves MovieClubFamily and its Telegram-linked discussion group when present. If the entry channel has no linked group, it offers eligible joined groups from up to 1,000 recent dialogs, with name-based ranking and filtering. The user chooses the actual search group and sees its title plus public visibility before posting. Main holds expiring source tokens; no direct series-name query goes to the private bot. Replies require the configured bot identity AND reply/thread linkage to the sent message. Parameterized Start uses messages.startBot; plain Start sends /start (empty startBot parameters were invalid). URL/private-message results and channel joins remain supported. No live bot/group verification has occurred. Remaining: callback pagination, forum topics, anonymous/unthreaded replies, attachment links, bot-delivered files, incremental updates and user acceptance.
8. Alternate 1080p bot / private-message delivery: obtain second bot's username and interaction examples. Model deep links and resulting media peer/message IDs accurately. Implement after channel discovery.
9. Automatic new-episode monitoring, incremental scans, expanded history/channel coverage, duplicate protection and externally grounded season completeness.
10. HDD drive-letter recovery, disk-full/unplug/exFAT testing, optional destination staging to reduce PC space requirements. Benchmark against Telegram Desktop before transport/concurrency changes; evaluate CDN support/TDLib only if needed.
11. Tray/background behaviour, portable executable build/testing and repository backup. No new executable built. Exact OS network usage, partial cleanup and visual acceptance remain pending.

## User decisions retained

- Show folder is selected directly; create only season subfolders.
- Original filenames matter. Only majority separator normalization is wanted, after queued-season completion; no new show/episode naming template.
- Already completed legacy files: display improvements only, no physical migration.
- Default 720p HEVC; English usual but metadata often absent.
- Channel keyword edits belong in Settings; the five additional standalone words above are approved, other drafted words need review.
- Keep next-session work documented; bot automation follows the core usability/reliability work.

Final packaging check: NSIS build completed; all 34 packaged source/assets match the workspace and latest.yml SHA-512 matches the installer. Authenticode status is NotSigned. No release was published.
