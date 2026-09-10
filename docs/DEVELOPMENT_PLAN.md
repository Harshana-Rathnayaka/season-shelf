# Development plan

## Current position

The shared-group correction supersedes the earlier private-query assumption.
Read BOT_DISCOVERY_RESEARCH.md for the cited feasibility assessment and
NEXT_SESSION.md for the full handoff.

1. **Consistent workspace - implemented.** All five pages retain their header
   while content scrolls beneath it. Library controls and illustrated heading
   remain compact. Scroll position survives same-page updates.
2. **Appearance and account - implemented.** Profile name/username, remembered
   encrypted login, size/weight/colour settings. Picking a colour disables
   Automatic and previews immediately; Apply persists changes.
3. **Discovery - corrected first version implemented.** Resolve MovieClubFamily
   or select its actual joined search group, show the posting destination, send
   one query, match the bot's replies to that query, follow the selected link,
   start the private bot, then preview/join/scan the chosen series channel.
   Private message links remain a fallback. No live conversation was tested.
4. **Reliability and review - targeted pass complete.** Atomic SQLite queue
   checkpoints; separate appearance, discovery and search-source modules.
   Larger page/IPC extraction remains in ARCHITECTURE_REVIEW.md.
5. **Next acceptance step.** Check all screens at 1024x720 and normal size,
   including 120% text and custom accent. Run one real search in the group shown
   by the app. Verify its reply and final series channel before a batch.

## Next development after acceptance

- Callback pagination and subscription-task UX; preserve exact callback data.
- Forum topics, late/edited reply updates and attachment-contained links.
- Alternate 1080p bot and bot-delivered file cataloging.
- Per-series destination/quality, optional language/media probing and monitoring.
- Native storage failure testing, packaging and repository backup.

Do not infer full provider compatibility from mock tests. Retain original
filenames, season-only folders, majority separator normalization after queued
season completion, and display-only handling of completed legacy downloads.
