const { watch } = require("node:fs");
const path = require("node:path");
const { Menu } = require("electron");

async function buildRenderer() {
  const { build } = await import("vite");
  await build({ configFile: path.join(__dirname, "../../vite.config.ts") });
}

exports.enableDevelopment = ({ app, win, beforeReload = () => {}, rebuild = buildRenderer }) => {
  let uiChanged = false, backendChanged = false, debounce, restarting = false, building = false;
  const applyChanges = async () => {
    if (restarting || building) return;
    if (backendChanged) {
      // Request normal shutdown now; the shared quit handler stops active work.
      restarting = true;
      backendChanged = false;
      app.relaunch();
      app.quit();
    } else if (uiChanged && !win.isDestroyed()) {
      uiChanged = false;
      building = true;
      try {
        await rebuild();
        if (!win.isDestroyed()) {
          beforeReload();
          win.webContents.reloadIgnoringCache();
        }
      } catch (error) {
        console.error("Renderer build failed:", error.message);
      } finally {
        building = false;
        if (uiChanged || backendChanged) debounce = setTimeout(applyChanges, 350);
      }
    }
  };
  const watcher = watch(path.join(__dirname, ".."), { recursive: true }, (_event, name) => {
    if (!name || !/\.(css|html|mjs|cjs|ts|tsx)$/.test(name)) return;
    if (name.replaceAll("\\", "/").startsWith("ui/")) uiChanged = true;
    else {
      backendChanged = true;
      console.log("Backend changed. Restarting with normal shutdown.");
    }
    clearTimeout(debounce);
    debounce = setTimeout(applyChanges, 350);
  });
  watcher.on("error", error => console.error("Development watcher:", error.message));
  Menu.setApplicationMenu(Menu.buildFromTemplate([{ label: "Development", submenu: [
    { label: "Reload UI", accelerator: "CmdOrCtrl+R", click: () => { uiChanged = true; applyChanges(); } },
    { role: "toggleDevTools" },
    { label: "Restart app", click: () => { backendChanged = true; applyChanges(); } },
    { type: "separator" }, { role: "quit" },
  ] }]));
  app.once("before-quit", () => { watcher.close(); clearTimeout(debounce); });
  console.log("Development mode: UI changes reload automatically; backend changes restart immediately through normal shutdown. Ctrl+Shift+I opens DevTools.");
};
