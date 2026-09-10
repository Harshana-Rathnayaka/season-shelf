const { watch } = require("node:fs");
const path = require("node:path");
const { Menu } = require("electron");

exports.enableDevelopment = ({ app, win, queue, isAuthenticating }) => {
  let uiChanged = false, backendChanged = false, debounce;
  const applyChanges = () => {
    if (isAuthenticating()) return;
    if (backendChanged) {
      // Do not interrupt a real download or a naming operation to restart code.
      if (queue.running.size || queue.namingLocks.size) return;
      backendChanged = false;
      app.relaunch();
      app.quit();
    } else if (uiChanged && !win.isDestroyed()) {
      uiChanged = false;
      win.webContents.reloadIgnoringCache();
    }
  };
  const watcher = watch(path.join(__dirname, ".."), { recursive: true }, (_event, name) => {
    if (!name || !/\.(css|html|mjs|cjs)$/.test(name)) return;
    if (name.replaceAll("\\", "/").startsWith("ui/")) uiChanged = true;
    else {
      backendChanged = true;
      console.log("Backend changed. Restarting when downloads and sign-in are idle.");
    }
    clearTimeout(debounce);
    debounce = setTimeout(applyChanges, 350);
  });
  watcher.on("error", error => console.error("Development watcher:", error.message));
  const pending = setInterval(applyChanges, 1000);
  Menu.setApplicationMenu(Menu.buildFromTemplate([{ label: "Development", submenu: [
    { label: "Reload UI", accelerator: "CmdOrCtrl+R", click: () => { uiChanged = true; applyChanges(); } },
    { role: "toggleDevTools" },
    { label: "Restart when idle", click: () => { backendChanged = true; applyChanges(); } },
    { type: "separator" }, { role: "quit" },
  ] }]));
  app.once("before-quit", () => { watcher.close(); clearInterval(pending); clearTimeout(debounce); });
  console.log("Development mode: UI changes reload automatically; backend changes restart when idle. Ctrl+Shift+I opens DevTools.");
};
