import type { UpdateStatus } from "./types";

export function updateMessage(updates: UpdateStatus = {}): string {
  const messages: Record<NonNullable<UpdateStatus["state"]>, string> = {
    manual: "Download the latest Mac version from GitHub and replace the app in Applications.",
    idle: "Check for a newer version.",
    development: "Update checks are disabled in development mode. Use the installed Windows app to check and install updates.",
    checking: "Checking for updates...", current: "You are up to date.",
    unpublished: "Updates will appear here when the first release is published.",
    available: `Version ${updates.version} is available.`, downloading: `Downloading update: ${updates.percent || 0}%`,
    ready: "Your update is ready to install.", error: "Could not check for updates. Please try again later.",
  };
  return updates.state ? messages[updates.state] || "Check for updates." : "Check for updates.";
}
