const { contextBridge, ipcRenderer } = require("electron");
const allowed = new Set([
  "bootstrap",
  "connect",
  "auth-reply",
  "channels",
  "discovery-search",
  "discovery-source",
  "discovery-open-message",
  "discovery-follow",
  "discovery-join",
  "discovery-cancel",
  "scan",
  "choose-folder",
  "settings",
  "enqueue",
  "queue-control",
  "open-job",
  "reveal-job",
  "delete-job",
  "delete-all-queue",
  "delete-all-saved",
  "staging-info",
  "cleanup-staging",
  "retry-naming",
  "disconnect",
]);
contextBridge.exposeInMainWorld("shelf", {
  call: (method, payload) => {
    if (!allowed.has(method))
      return Promise.reject(new Error("Unknown action"));
    return ipcRenderer.invoke(`shelf:${method}`, payload);
  },
  on: (callback) => {
    const handler = (_event, event) => callback(event);
    ipcRenderer.on("shelf:event", handler);
    return () => ipcRenderer.removeListener("shelf:event", handler);
  },
});
