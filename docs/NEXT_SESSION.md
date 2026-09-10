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
