> Historical record through 12 September 2026. May describe superseded behaviour. See [current documentation](../README.md).

# Test Season Shelf on your Windows PC

## Put the files in your chosen folder

Extract the ZIP into:

`C:\Users\DELL\Desktop\Hash\Projects`

The ZIP already includes the `season-shelf` folder. The final project path should be:

`C:\Users\DELL\Desktop\Hash\Projects\season-shelf`

Check that `package.json`, `Setup.cmd` and `Start.cmd` are directly inside that folder. Do not run from inside the ZIP.

## Explore the UI without installing anything

Double-click **Preview.cmd**, or open **docs\preview.html** directly in your browser. This preview uses illustrative sample data. It supports quality switches, season selection, searching, theme changes and a sample queue. It cannot sign in or download files.

## Install and run the actual desktop application

1. Install Node.js 24 LTS if needed.
2. Double-click **Setup.cmd**. It installs the locked dependencies and runs the offline tests. Internet is needed for the first installation.
3. Double-click **Start.cmd**. Future launches only need this step.

Alternatively, in PowerShell:

```powershell
Set-Location 'C:\Users\DELL\Desktop\Hash\Projects\season-shelf'
npm ci
npm test
npm start
```

## First functional test

1. Connect your account from inside the desktop app using your own API details. Keep credentials and login codes out of chat and Git.
2. Set separate Archive and Watch folders in Settings. For the first test, use empty folders so results are easy to inspect.
3. Choose an accessible series channel and scan it. Check one episode's filename, season, resolution and codec against Telegram before queueing it.
4. Download one file. Confirm the final path and that it plays in your usual player.
5. Download a second file, pause it partway through, wait for it to stop, then resume. Compare the final size and playback.
6. Restart the app with a partial job, reconnect and resume it. Completed bytes should be retained except for an incomplete 512 KiB tail.
7. Only after those pass, test a small batch and compare its speed against Telegram Desktop. Run the two clients separately, using uncached files and the same connection.

Archive means 720p HEVC stored in season folders. Watch means 1080p saved to the separate viewing folder. Deleting a viewing copy requires an explicit action; it never automatically deletes a video after opening it.

The app is a first source build. Actual Windows/Telegram behaviour and throughput were not verified in the remote build environment. Review `README.md` and `docs\VALIDATION.md` for limitations and `docs\DEVELOPMENT_PLAN.md` for the remaining work.
