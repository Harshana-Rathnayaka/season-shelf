# Using Season Shelf

See [Getting started](GETTING_STARTED.md) for setup and your first download.

## Your data stays on your computer

- Telegram sessions and remembered sign-in details are encrypted using operating-system storage. Passwords and verification codes are not saved.
- After logout, a remembered-account suggestion can fill all three connection fields. Use **Forget suggestions** to remove it.
- Development and installed apps have separate profiles. Installed updates preserve their profile.
- **Clear app data** removes queue/history, saved-file records, the selected series, series watches and lifetime totals. Media and partial files stay on disk; account, preferences and onboarding completion remain.
- **Reset lifetime totals** clears only activity counters. It does not change queue progress or history.
- Deleting media is a separate, confirmed action in **Saved files**. After clearing history, manage previously downloaded files in File Explorer or Finder.

Closing the window pauses downloads, including when **Keep in system tray** is selected. File verification and transfer operations finish safely. Resume from the tray or Downloads.

## File handling

Files are staged locally, checked, and published without replacing a different existing file. Interrupted work returns paused after a restart.

Filename normalization uses completed, app-managed files from the same season and destination. It preserves extensions and recognised tags such as `WEB-DL`. Tied styles remain unchanged. Failed or paused season entries delay normalization; filename collisions retain the original and offer a retry in File details. Unverified files keep original names in an `Unverified` folder.

## Updates, when releases begin

Release publishing is disabled until the maintainer enables `RELEASES_ENABLED` and configures signing. The updater targets this repository's GitHub Releases. Installed builds check at startup and daily, download available updates, then offer **Restart now** or **Not now**. Deferred updates install on the next launch after release and download verification; that check requires connectivity. Active work must finish before installation.

Development mode does not install updates. Packaging is intentionally separate from everyday development. See [release and signing instructions](RELEASES.md).

