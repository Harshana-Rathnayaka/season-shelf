# Getting started

Season Shelf is currently available for development use. Windows and macOS release packaging is configured, but a production release has not been published.

## Run from source

Install Node.js 24 or later and Git, then clone the repository into any folder you control:

```sh
git clone https://github.com/Harshana-Rathnayaka/season-shelf.git
cd season-shelf
```

On Windows, run in PowerShell:

```powershell
npm.cmd ci
npm.cmd run dev
```

On macOS, run in Terminal:

```sh
npm ci
npm run dev
```

Internet access is needed to install dependencies and use Telegram. Run commands inside the extracted/cloned project folder, where `package.json` lives. No personal directory layout is required.

On Windows, `Setup.cmd` installs dependencies and runs checks, `Dev.cmd` starts development mode, and `Start.cmd` launches normally. On either platform, `npm start` launches normally (use `npm.cmd start` in PowerShell).

## Try the interface without an account

Open [preview.html](preview.html) locally, or run `npm run preview` and visit the address printed in the terminal. Use `npm.cmd` in PowerShell. The preview contains sample data; it cannot sign in or download files.

## Connect and download

1. Follow the welcome guide. Enter your own Telegram API ID, API hash and phone number, then complete Telegram's login prompts. Obtain API credentials through [Telegram's application portal](https://my.telegram.org). Never share passwords, codes or API secrets in issues.
2. Choose an accessible series channel, or use the supported bot discovery flow. If there are several results, select the intended series.
3. Choose the show's **Download folder**. Recognised episodes are organised into season folders. The optional **Watch folder** stores separate viewing copies.
4. Choose a quality and select episodes in **Verified**. Use **Unverified** to manually select files whose metadata could not be recognised reliably.
5. Download one episode first. Review its path in **Saved files** and open it in your preferred player. Use **Downloads** to pause or resume the queue.

Replay the welcome guide from **Settings > About > Watch guide again**. Completion is remembered in development and installed profiles.

## Common questions

- **A channel is missing:** select All channels; see [channel filters](CHANNEL_FILTERS.md).
- **No verified episodes:** try the qualities found in that channel, then inspect Unverified. The app does not invent missing quality or episode metadata.
- **Editing files does not reload the app:** close a normally launched instance before starting development mode. See [development](DEVELOPMENT.md).
- **Downloads stopped after closing:** closing pauses the queue even when keeping the app in the tray. Resume from the tray menu or Downloads.

See the [user guide](USER_GUIDE.md) for data resets, filename rules and update behaviour. Maintainers preparing installers should use [release instructions](RELEASES.md).
