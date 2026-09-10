# Architecture review — 11 September 2026

## Assessment

The main/renderer/preload separation is appropriate for a small Electron app.
The issue is concentration of responsibilities, not a missing framework.
`src/core` already separates catalog selection, downloads, file publication,
maintenance and persistence from the UI. Keep this boundary.

Inspected against [Electron's security guidance](https://www.electronjs.org/docs/latest/tutorial/security):
renderer Node integration is off, context isolation and sandboxing are on,
navigation/new windows are denied, permission requests are denied, the preload
allows specific IPC methods, and main validates the sender and main-frame URL.
Telegram text is HTML-escaped. Credentials use OS encryption, with no plaintext
save fallback. This is a targeted source review, not a penetration test or a
dependency vulnerability audit.

## Changes made

- Appearance validation lives in `core/appearance.mjs`; its renderer form and
  application live in `ui/appearance.mjs`. Main validates persisted values.
- `core/discovery.mjs` parses only supported Telegram discovery links. It cannot
  send, join, execute callbacks or open external URLs. Entity resolution still
  must establish that a public peer is a bot/channel before any action.
- Removed contradictory library scrolling/minimum-height overrides. Layout uses
  one bounded list and does not need a ResizeObserver for header offsets.
- Queue jobs, batch ID and counters now checkpoint in one SQLite transaction.
  A rollback test covers serialization failure midway through the checkpoint.

## Next refactors, in order

1. Extract main IPC handlers by feature: account, library, queue, maintenance.
   Keep one sender-validation wrapper and inject services; do not expose raw
   filesystem paths or arbitrary Telegram API calls through the preload.
2. Extract renderer pages and action handlers. Keep transient UI selection apart
   from main-owned persisted state. Update queue rows/progress in place instead
   of reconstructing the whole page twice per queue/usage event; this will also
   preserve keyboard focus. Avoid adding a state library solely for file size.
3. Consolidate shared CSS component rules; the old stylesheet still contains
   historical typography overrides outside the corrected library layout.
4. Evaluate a restricted custom application protocol and production Electron
   fuses before packaging, as recommended in the linked security guide.
5. Profile synchronous SQLite snapshot serialization with large queues before
   moving persistence to a worker. File I/O and hashing already use asynchronous
   operations; adding workers without evidence would add coordination costs.

## Open verification

- No connected browser/native surface available for visual QA at this run.
  Check 1024×720, normal window size and 120% text with extra notices visible.
- Real remembered-session login/profile, Recycle Bin, disk removal/fullness and
  exFAT remain native acceptance work. No personal files touched by these tests.
- User confirmed @MCF_SeriesBot. A separate desktop/discovery.mjs service and
  specific IPC endpoints now implement the first search/start/preview/join flow.
  Entity checks reject groups and other bots; results have opaque IDs held in main.
  Correlation uses the selected private bot and messages newer than the submitted
  query, with a five-second quiet window (30-second overall polling budget).
  Concurrent manual bot conversations and replies after that window may need a
  new search. Callbacks, subscription tasks and live acceptance remain pending.
- Dependency advisory check, packaged build, crash/power-loss simulation and
  broader security audit have not been performed in this pass.

## Shared-group correction

The earlier private-query assumption is superseded. desktop/search-source.mjs
now resolves a shared group, checks its entity type and matches reply identity.
Main-owned source tokens bind explicit UI selection to the subsequent send.
When no linked group exists, eligible joined groups are offered for selection.
Private bot actions remain limited to selected Start results. The researched
workflow and remaining integration limits are in BOT_DISCOVERY_RESEARCH.md.

The common workspace now bounds all pages, preserving scroll on same-page
updates. Colour picking disables Automatic and previews before Apply saves.
