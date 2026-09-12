<p align="center"><img src="docs/assets/readme-banner.svg" alt="Season Shelf — Your series, beautifully organised" width="100%"></p>

<p align="center">
  <a href="https://github.com/Harshana-Rathnayaka/season-shelf/actions/workflows/ci.yml"><img src="https://github.com/Harshana-Rathnayaka/season-shelf/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <img src="https://img.shields.io/badge/platform-Windows-357EC7?style=flat-square" alt="Windows">
  <img src="https://img.shields.io/badge/status-in_development-A0E4C6?style=flat-square" alt="In development">
</p>
<p align="center"><a href="#get-started">Get started</a> ? <a href="CONTRIBUTING.md">Contribute</a> ? <a href="docs/PROJECT_WORKFLOW.md">Branches &amp; releases</a> ? <a href="docs/NEXT_SESSION.md">Roadmap</a></p>

> **A calmer way to build your collection.** Choose episodes in Telegram channels. Keep the files in folders you control.


![Season Shelf series library, using illustrative sample data](docs/assets/library-preview.png)

## From channel to collection

Choose a series channel, pick a quality, and select your episodes. Season Shelf handles the queue, checks the downloaded bytes and saves them into season folders.

| Feature | What it does |
| --- | --- |
| Channel discovery | Browse joined channels or follow supported MovieClubFamily bot results and subscription steps. |
| Quality selection | Shows formats found in the channel. Archive defaults to 720p HEVC; Watch prefers 1080p. |
| Verified / Unverified | Keep recognised episode metadata separate from files you choose manually. |
| Resumable downloads | Pause, resume, cancel or remove individual files or the queue. |
| Season filenames | Keep original names; after queued season files finish, match minority separators to the season's majority style. Supports dots, underscores, dashes and spaces. |
| Collection tools | Find missing episodes in app-managed history, review saved files and move selected media to the Recycle Bin. |
| Series watches | Check new uploads hourly while running. Notify or queue automatically when enabled. |
| Transfer controls | Set download hours, a shared speed limit and simultaneous downloads. |
| Personal workspace | Customise theme, colours, font size and weight. Collapse the sidebar and keep controls visible while lists scroll. |

## Get started

**Development builds only for now.** No production release is being published yet.

On Windows, with Node.js 24 or later installed:

```powershell
npm.cmd ci
npm.cmd run dev
```

Development mode reloads UI changes and restarts backend changes when current work is idle. You do not need to rebuild an installer for each edit. `Start.cmd` launches normally; `Dev.cmd` starts development mode.

1. Follow the welcome guide and connect your Telegram account using your own API ID, API hash and phone number.
2. Choose a series channel, or use the supported bot discovery flow.
3. Choose the show's **Download folder**, such as `D:\Shows\12 Monkeys`. Episodes go into `Season 01` inside it. The optional **Watch folder** is separate.
4. Select files and download. Track the current batch in Downloads.

Replay onboarding any time from **Settings → About → Watch guide again**. Its completion is remembered in both development and installed profiles.

Want to explore without connecting Telegram? Open [the sample preview](docs/preview.html) locally. It uses sample data and does not download or access your account.

## Your data stays on your computer

- Telegram sessions and remembered sign-in details are encrypted using operating-system storage. Passwords and verification codes are not saved.
- After logout, a remembered-account suggestion can fill all three connection fields. Use **Forget suggestions** to remove it.
- Development and installed apps have separate profiles. Installed updates preserve their profile.
- **Clear app data** removes queue/history, saved-file records, the selected series, series watches and lifetime totals. Media and partial files stay on disk; account, preferences and onboarding completion remain.
- **Reset lifetime totals** clears only activity counters. It does not change queue progress or history.
- Deleting media is a separate, confirmed action in **Saved files**. After clearing history, manage previously downloaded files in File Explorer.

Closing the window pauses downloads, including when **Keep in system tray** is selected. File verification and transfer operations finish safely. Resume from the tray or Downloads.

## File handling

Files are staged locally, checked, and published without replacing a different existing file. Interrupted work returns paused after a restart.

Filename normalization uses completed, app-managed files from the same season and destination. It preserves extensions and recognised tags such as `WEB-DL`. Tied styles remain unchanged. Failed or paused season entries delay normalization; filename collisions retain the original and offer a retry in File details. Unverified files keep original names in an `Unverified` folder.

## Updates, when releases begin

Release publishing is disabled until the maintainer enables `RELEASES_ENABLED` and configures signing. The updater targets this repository's GitHub Releases. Installed builds check at startup and daily, download available updates, then offer **Restart now** or **Not now**. Deferred updates install on the next launch after release and download verification; that check requires connectivity. Active work must finish before installation.

Development mode does not install updates. Packaging is intentionally separate from everyday development. See [release and signing instructions](docs/RELEASES.md).

## Development checks

```powershell
npm.cmd run check
npm.cmd test
node scripts/build-preview.mjs
```

The tests cover download integrity and recovery, discovery, parsing, naming, settings, update decisions and UI interactions. Isolated Electron screenshots are used for layout checks; they do not validate live Telegram transfers.

| Area | Location |
| --- | --- |
| Queue, parsing, file integrity and persistence | `src/core/` |
| Electron, Telegram, secure storage and IPC | `src/desktop/` |
| Interface, appearance and interaction | `src/ui/` |
| Regression tests | `test/` |
| Development notes and research | `docs/` |

## Current boundaries

Bot discovery is specific to supported Telegram flows. Some attachment links, callbacks that send separate messages, and approval-only subscriptions still need Telegram. Alternate-bot 1080p retrieval and WhatsApp completion messages are not implemented. Missing-episode checks compare app-managed history, not arbitrary files elsewhere on disk. Watches need the app running; downloads cannot continue while the PC sleeps or is shut down.

See [the current handoff](docs/NEXT_SESSION.md) for remaining work and [the architecture review](docs/ARCHITECTURE_REVIEW.md) for design decisions.

## License and acknowledgements

A project license has not been selected yet. Third-party dependencies retain their own licenses, viewable from **Settings → About → Third-party licenses**. Built with Electron, Teleproto, electron-updater and SQLite. Season Shelf is an independent client, not affiliated with Telegram.
