# Season Shelf

A local desktop companion for episodic Telegram downloads. Built with **Electron + JavaScript**, a **Node.js download engine**, **Teleproto**, and a local **SQLite** database.

**Status: working development build; user reports Telegram works.** 46 offline tests pass. The latest UI/queue changes need live and visual acceptance. See [current changes and tomorrow's backlog](docs/NEXT_SESSION.md). No Telegram credentials or media are included.

## Try the interface first

Open **docs/preview.html** in your browser. No installation or account is required. Explore dark/light mode, seasons, episode selection, quality presets and the sample queue. This is a sample-only preview: it cannot download, sign in or access your files.

## Run the desktop app on Windows

For your requested folder, use `C:\Users\DELL\Desktop\Hash\Projects\season-shelf`. See **docs/WINDOWS_QUICK_START.md**. The ZIP includes the `season-shelf` folder. **Setup.cmd** installs and tests dependencies; **Start.cmd** launches the app; **Preview.cmd** opens the sample interface without installation.

1. Install **Node.js 24 LTS** from https://nodejs.org/ if it is not installed.
2. Extract this project to a normal folder, for example `C:\Projects\season-shelf`. Do not run it from inside the ZIP.
3. Open Terminal in that folder and run:

   ```powershell
   npm ci
   npm test
   npm start
   ```

4. Click **Connect Telegram**. Get your own API ID and API hash at https://my.telegram.org/apps. Enter them **in the desktop app**, along with your phone number. Enter any login code or two-step verification password in the app when asked. Do not send these values in chat or commit them to Git.
5. In **Settings**, choose an Archive folder on your HDD and a separate Watch folder on your PC.
6. Open/join your series channel in Telegram normally. In Season Shelf, select **Change series**, refresh the channel list, select the channel, and wait for its metadata scan.
7. Choose **Build your archive** (720p HEVC) or **Just here to watch** (1080p), select episodes or seasons, and click **Download selected**.

Your Telegram Desktop app does not need to remain open. Season Shelf must remain running, and the PC needs power and an internet connection. It prevents idle system sleep during active work, but cannot continue during shutdown or a forced sleep.

If Electron's runtime download was interrupted during installation, rerun `npm ci`. Downloads and user state live outside the source folder.

## Current behaviour

- Archive defaults to 720p HEVC/x265; Watch defaults to 1080p and prefers HEVC. Resolution and codec selectors override these defaults; the smallest matching candidate is chosen per episode.
- Choose the show folder itself. New jobs create only Season NN subfolders and preserve source filenames, normalizing dots/underscores/dashes only after all queued files in the season finish. Existing queued jobs retain their saved paths.
- The library has compact channel-derived quality buttons, scrollable seasons, normal page scrolling with sticky essential controls, whole-row selection and a collapsible sidebar. Suggested channels filters likely finance/crypto names; All channels restores them.
- Saved files show a compact actual filename with full details and Show in folder. Existing files are not renamed.
- Downloads shows downloaded/total/remaining size, individual removal, and Pause all / Resume all / Cancel all. Removed entries leave partial files on disk; re-enqueue starts fresh. The How it works page explains these controls.
- Season and episode numbers come from attachment filenames/captions. Conflicting, unknown, and multi-episode labels appear in a review list and are excluded.
- “Seasons found” and “matching episodes” describe channel results, not externally verified series completeness. Scan limit: 10,000 messages; a warning appears at the limit. Channel picker: up to 300 recent groups/channels.
- Downloads use 512 KiB ranges, four bounded parallel ranges per file, and 1–4 configurable active files (default 2). At most about 2 MiB of range data per file is buffered by the adapter, plus protocol overhead.
- A SQLite queue preserves jobs. Restart leaves unfinished jobs paused. The saved encrypted session reconnects automatically; resume paused jobs when ready. An expired or revoked session requires explicit sign-in. Resuming truncates only an incomplete 512 KiB tail, then continues from the stored file length.
- Downloads stage under Electron's user-data directory (usually `%APPDATA%\season-shelf\staging` when running from source). Both modes stage locally, so leave sufficient PC space. Completed files are copied to the selected mode's destination and SHA-256 checked before the staging file is deleted.
- Destination folders get a small `.season-shelf-root.json` marker to recognise them. Do not remove it while jobs refer to the folder. Drive disappearance produces a waiting status; reconnect it with the same drive letter and resume. Automatic drive-letter remapping is a later enhancement.
- Different existing destination files are never overwritten. A matching verified destination is accepted after an interrupted transfer.
- Cancel preserves partial downloads for possible resume; automatic partial-file cleanup is not implemented. Completed Archive and Watch files can be moved to the Recycle Bin after confirmation using their queue action.
- A transfer already checking/publishing is allowed to finish; pause/cancel applies to queued/network downloads. Closing the app preserves staged files for recovery.
- SHA-256 here verifies copies and local identity. It is not proof of source authenticity or visual quality. There is no video transcoding, metadata probing, player integration beyond opening the default player, or automatic watched detection.
- No servers, cloud database, AI API, telemetry, embedded remote content or video conversion. Telegram account and network limitations apply.

## Important development limitations

- **Telegram login and actual downloads have not been tested with a live account in this environment.** Additional account challenges such as CAPTCHA may require using the official client; this build does not automate challenges.
- **Speed parity with Telegram Desktop is not established.** Use the benchmark worksheet in the development plan before relying on a large batch. The iterator requests regular Telegram file delivery; if a source requires an unsupported CDN redirect, the job fails clearly and retains its partial file. TDLib is the planned alternative if performance or transport coverage requires it.
- The Windows executable, OS encryption, HDD unplug behaviour and player/Recycle Bin actions need a Windows acceptance test. The source is provided; no prebuilt executable is claimed.
- The interface has dark/light/system themes and responsive rules, but visual review remains pending because the build environment blocked local browser preview.
- Telegram bot search/navigation is a later stage. Version 0.1 starts at the series channel you can already access.
- On filesystems without hard links (e.g. exFAT), exclusive-copy publishing is used. A crash during that final fallback copy may leave an incomplete destination; the staged original is retained, and the next attempt refuses to overwrite a mismatching destination. Remove only the incomplete destination after checking it, then resume.
- Audio/subtitle language and preferred release-group filters are not implemented yet. Check filename details or sample an episode when those matter.

## Development

```powershell
npm test                 # Offline parser, adapter, queue and file-safety tests
npm run check            # JavaScript syntax checks
npm run preview          # Local sample UI at the printed /ui/index.html URL
node scripts/build-preview.mjs  # Rebuild the standalone HTML preview
npm run pack:win         # On Windows: build a portable executable locally
```

See **docs/DEVELOPMENT_PLAN.md** for stages, acceptance gates and the speed benchmark worksheet. **docs/VALIDATION.md** records what was checked. Native packaging downloads build dependencies once; no hosted service is required to run the app.

## GitHub

The connected GitHub account was available, but its connector did not expose repository creation. No remote repo has been created. Create an empty **private** repository named `season-shelf` and run these commands from this extracted folder:

```powershell
git init -b main
git add .
git commit -m "Build initial Season Shelf desktop app"
git remote add origin https://github.com/Harshana-Rathnayaka/season-shelf.git
git push -u origin main
```

If the folder is already a Git checkout, skip `git init` and the initial commit if present. `.gitignore` excludes dependencies, builds, databases and credential files. All actual account state is stored separately in Electron's user-data directory.

## Dependency note

The original plan named GramJS. During installation, npm marked `telegram@2.26.22` archived and directed developers to Teleproto. This build pins **teleproto 1.229.0**, uses its current two-argument `iterDownload` API, and tests that adapter contract with mocked file ranges. See https://docs.teleproto.dev/migrating-from-gramjs and https://core.telegram.org/api/obtaining_api_id.

## Live development

Run **Dev.cmd** or `npm.cmd run dev` for UI auto-reload, deferred backend restart and Chromium DevTools. Close the normally launched instance first. See [development workflow](docs/DEVELOPMENT.md). Settings now includes editable channel keywords and lifetime activity; Downloads tracks the current batch separately.

Bulk actions are now available: Delete all pending removes unfinished queue entries without deleting saved media or partial bytes; Delete all saved files moves completed media to the Recycle Bin after confirmation. Settings can identify and recycle orphaned partials while retaining resumable jobs.
