<p align="center"><img src="docs/assets/readme-banner.svg" alt="Season Shelf — Your series, beautifully organised" width="100%"></p>

<p align="center">
  <a href="https://github.com/Harshana-Rathnayaka/season-shelf/actions/workflows/ci.yml"><img src="https://github.com/Harshana-Rathnayaka/season-shelf/actions/workflows/ci.yml/badge.svg" alt="Windows and macOS CI"></a>
  <img src="https://img.shields.io/badge/build_targets-Windows%20%7C%20macOS-357EC7?style=flat-square" alt="Windows and macOS build targets">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-A0E4C6?style=flat-square" alt="MIT License"></a>
</p>

<p align="center"><a href="#get-started"><strong>Get started</strong></a> &nbsp; | &nbsp; <a href="#build-and-release">Build &amp; release</a> &nbsp; | &nbsp; <a href="docs/ROADMAP.md">Roadmap</a> &nbsp; | &nbsp; <a href="CONTRIBUTING.md">Contribute</a></p>

**Download episodes from Telegram and organise them into season folders.** Choose a series, pick your quality and manage your collection from one desktop app.

![Season Shelf series library with illustrative sample data](docs/assets/library-preview.png)

<details>
<summary>Contents</summary>

- [Get started](#get-started)
- [Your files and data](#your-files-and-data)
- [Build and release](#build-and-release)
- [Known limitations](#know-the-limits)
- [Contribute](CONTRIBUTING.md)
- [Built on vibes](#built-on-vibes)
- [License](#license-and-acknowledgements)

</details>

## 📺 Your collection, organised

| Feature | What you can do |
| --- | --- |
| Discover series | Browse joined channels or follow supported bot search results. |
| Choose your files | Filter by quality and codec, or manually select Unverified files. |
| Control downloads | Pause, resume, schedule download hours and limit bandwidth. |
| Keep folders tidy | Save episodes by season and normalise filename separators. |
| Track your collection | Find missing episodes against app-managed history and manage saved files. |
| Follow new episodes | Check hourly while the app runs; notify or queue new uploads. |
| Make it yours | Adjust theme, accent colour, font size and weight. |

Download and Watch folders keep permanent and viewing copies separate. You decide when to delete files.

<a id="get-started"></a>

## 🚀 Get started

**Install the app**

Download a published installer from [GitHub Releases](https://github.com/Harshana-Rathnayaka/season-shelf/releases):

- **Windows:** run the `.exe` installer. Future updates download inside the app.
- **macOS:** open the universal `.dmg` and drag Season Shelf into Applications. Updates are installed manually.

Installers are unsigned, so your operating system may show a security warning. If no release is listed yet, the first build is still on its way.

**Run from source**

Install Node.js 24 or later and Git, then clone the project:

```sh
git clone https://github.com/Harshana-Rathnayaka/season-shelf.git
cd season-shelf
```

**Windows · PowerShell**

```powershell
npm.cmd ci
npm.cmd run dev
```

**macOS · Terminal**

```sh
npm ci
npm run dev
```

1. Follow the welcome guide and connect using your own Telegram API ID, API hash and phone number. Obtain API credentials from [Telegram](https://my.telegram.org).
2. Choose a channel or a supported bot result, then set the show's **Download folder** and optional **Watch folder**.
3. Select a quality and episodes in **Verified**, or manually choose **Unverified** files. Track downloads in **Downloads ? Ongoing** and open completed files in **Downloads ? Finished**.

Missing a channel? Select **All channels** or adjust **Settings > Channel filtering**. No verified results? Check other available qualities and Unverified. Replay onboarding from **Settings > About > Watch guide again**.

Use `npm start` for a normal source launch or `npm run dev` for automatic reload. In VS Code, press **F5** and select **Electron: Development** after installing dependencies. Use `npm.cmd` in PowerShell if its execution policy blocks `npm`. See [Contributing](CONTRIBUTING.md#develop-locally) for debugging. Build local installers using the commands in [Desktop releases](README.md#build-and-release).

Just exploring? Open the [sample preview](docs/preview.html) locally. It uses sample data and never connects to your account.

<a id="your-files-and-data"></a>

## 🔒 Your files and data

Sessions and remembered sign-in details are encrypted using operating-system storage. Passwords and verification codes are not saved. Development and installed apps use separate profiles.

**Clear app data keeps downloaded files and partials on disk.** It clears download/history records, the selected series, watches and lifetime totals; login, preferences and onboarding remain. **Reset lifetime totals** clears only counters. **Remove from history** (or **Clear finished history**) also keeps disk files, but the app forgets those downloads and Select missing may offer them again. To delete media, open **Finished ? File details ? Move file to Recycle Bin** and confirm, or use File Explorer/Finder.

Closing pauses downloads, including when the app stays in the tray. Verification and transfers finish safely; resume from the tray or Downloads. Interrupted jobs return paused after restart.

<details>
<summary>Filename rules, sign-in suggestions and updates</summary>

- Season filenames follow the majority separator style once all queued files for that season complete. Extensions and tags such as WEB-DL stay intact. Ties keep original names; paused/failed files delay naming, and collisions offer a retry. Unverified files keep original names in their own folder.
- Remembered sign-in suggestions can refill connection details after logout. **Forget suggestions** removes them.
- Once releases begin, installed Windows apps check at startup and daily and download updates automatically. **Restart now** installs when work is idle; **Not now** defers installation until the next launch after verification, which requires connectivity. Development mode does not install updates.

</details>

Downloads release their network slot after receiving the file, allowing the next queued file to download while local checking and transferring finish. Disk finishing runs one file at a time. Total active work is capped at twice the simultaneous-download limit to prevent an unbounded staging backlog on slow drives.

**Pause all** retains temporary progress for resuming. **Resume all** resumes paused downloads and retries failed or waiting entries. **Clear queue…** and individual **Remove from queue** permanently delete the removed downloads' temporary data after stopping their writers. Completed files and lifetime usage totals are preserved; files already checking or transferring finish safely. The removal confirmation explains that removed downloads must start from scratch if added again.

## Build and release

Run `npm ci`, then `npm run pack:win` on Windows or `npm run pack:mac` on a Mac. Installers appear in `release/`. Mac builds are universal (Intel and Apple Silicon). These commands do not publish.

Builds are unsigned. Windows may show security warnings; macOS may require approval in Privacy & Security before opening the app.

**Windows updates:** the installed app checks GitHub at startup, daily and from Settings, downloads newer versions, then offers **Restart and install**. The installer opens automatically and upgrades the existing app. No manual GitHub download or uninstall is needed. **Not now** keeps the update for installation on a later launch after verification. Active work blocks installation. Settings, login, history and downloaded media are preserved.

**Windows uninstall (1.0.1 and later):** uninstalling removes the installed app's settings, login, onboarding progress, library, download history, lifetime totals, cache and managed partial downloads. Completed media stays in your download folders. Installing again starts with onboarding and an empty library and queue; existing media is not automatically imported. Installing an update without uninstalling preserves your data. Development profiles are separate and are not removed. The original 1.0.0 uninstaller retains app data; this cleanup takes effect after installing 1.0.1 or later. On macOS, moving the app to the Trash does not remove its separate application data.

**macOS updates:** Settings opens GitHub Releases. Download the new DMG, quit the app and replace Season Shelf in Applications. App data is stored separately and retained. Automatic installation is disabled for unsigned Mac builds.

**Publish:** merge the version change into `master` with passing CI, set repository Actions variable `RELEASES_ENABLED=true`, then push a matching tag such as `v1.0.0`. The workflow builds Windows EXE and Mac DMG/ZIP, uploads to a draft, and publishes only after both platforms succeed and required assets exist. No signing secrets are needed. Keep the generated blockmaps and update metadata with the installers. Never overwrite a published version; increment the package and lockfile version for every release.

For the first release, after merging and pulling master:

```sh
git tag -a v1.0.0 -m "Season Shelf 1.0.0"
git push origin v1.0.0
```

Local installer and real version-to-version update acceptance are separate from automated tests. Use a disposable OS account or VM for fresh-install testing.

## Know the limits

- Bot automation supports specific Telegram flows. Some attachment links, separate callback replies and approval-only subscriptions still need Telegram.
- Missing-episode checks use app-managed history, not arbitrary folders on disk.
- Watches need the app running; downloads cannot continue while the computer sleeps.
- Alternate-bot 1080p retrieval and WhatsApp notifications are not implemented.

See the [roadmap](docs/ROADMAP.md) for next steps and remaining release prerequisites.

## 🤝 Contribute

Start with [CONTRIBUTING.md](CONTRIBUTING.md). The app uses Electron and SQLite, with a renderer migrating to React and TypeScript ([plan](docs/react-migration.md)):

| Location | Responsibility |
| --- | --- |
| `src/core/` | Queue, parsing, persistence and file integrity |
| `src/desktop/` | Electron, Telegram, secure storage and IPC |
| `src/ui/` | Interface and interactions |
| `test/` | Regression tests |

[Code architecture](docs/architecture.md) ? [Contribution and development guide](CONTRIBUTING.md) · [Release setup](README.md#build-and-release)

<a id="built-on-vibes"></a>

## ✨ Built on vibes

Entirely vibe-coded with **Astra in Codex**. Human ideas, AI-written code, and plenty of "why is this doing that?" moments. Proudly built in the open.

## License and acknowledgements

Licensed under the [MIT License](LICENSE). Third-party dependencies retain their own licenses, available in **Settings > About > Third-party licenses**.

Built with Electron, Teleproto, electron-updater and SQLite. Season Shelf is independent and is not affiliated with Telegram.
