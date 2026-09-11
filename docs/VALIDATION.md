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
