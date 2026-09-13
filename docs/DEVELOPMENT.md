# Develop Season Shelf with live feedback

For cloning, dependencies and Windows/macOS launch commands, start with [Getting started](GETTING_STARTED.md). Use `npm` in macOS Terminal and `npm.cmd` in Windows PowerShell.

Close a normally launched Season Shelf instance once, then double-click **Dev.cmd**, or run:

```powershell
npm.cmd run dev
```

Start.cmd remains the normal launcher. The single-instance lock means a second launch focuses the existing instance rather than changing it into development mode.

- Save a file in `src/ui`: the renderer reloads automatically after a short debounce. The main-process download queue and Telegram connection keep running.
- Save backend/core/preload code: Electron restarts automatically once current download/naming operations, scans and sign-in are idle. Pause downloads if you need that restart sooner. Restarted unfinished jobs remain paused and need resume as usual; the encrypted Telegram session reconnects automatically when valid.
- **Ctrl+R**: reload the UI manually.
- **Ctrl+Shift+I** or **Development → Toggle Developer Tools**: inspect elements, edit CSS live, inspect console errors and debug renderer code. CSS changes in DevTools are temporary unless saved back to the source files.
- **Development → Restart when idle**: request a backend restart.

This is renderer auto-reload, not state-preserving React Fast Refresh. Unsaved selections, search/filter UI state and form input can reset during reload. Reload/restart is deferred during authentication. Do not edit backend files during a real long-running batch unless you intend to restart when it becomes idle.

Electron uses ordinary HTML/CSS for its interface. There is no built-in drag-and-drop form designer like WinForms, but the running app plus Chromium DevTools gives live visual inspection and CSS editing. No new development dependencies or remote debugging port are required.

`Preview.cmd` / `npm.cmd run preview` remains a sample-only browser preview. It cannot log into Telegram or download files. The desktop development mode is the one to use for real application behaviour.

## Routine checks

```sh
npm run check
npm test
node scripts/build-preview.mjs
```

Use `npm.cmd` instead of `npm` in PowerShell. Regenerate the standalone preview when UI source changes; documentation-only changes do not require rebuilding it. Normal CI runs syntax checks and tests on Windows and macOS without packaging installers.

The development watcher has offline tests for UI reload during downloads and delayed backend restart. See [validation status](VALIDATION.md) for native acceptance limits and [contributing](../CONTRIBUTING.md) for PR expectations.
