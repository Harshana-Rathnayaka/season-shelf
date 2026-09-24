import { advanceDiscovery } from "../features/discovery/flow";
import type { DiscoveryRequests, DiscoveryResult, JoinedChannel } from "../features/discovery/flow-types";
import type { DiscoverySource } from "../features/discovery/dialog-types";
import type { Call } from "./ipc";
import type { createDialogs } from "./dialogs";

interface Context { call: Call; dialogs: ReturnType<typeof createDialogs>; onJoined: (joined: JoinedChannel) => Promise<void> }
export function createDiscovery({ call, dialogs, onJoined }: Context) {
  let version = 0, busy = false;
  function showSearch(source: DiscoverySource | null = null) { dialogs.show({ kind: "discovery-search", source }); }
  return {
    showSearch,
    invalidate() { const wasBusy = busy; version++; busy = false; return wasBusy; },
    async run(method: keyof DiscoveryRequests, payload?: DiscoveryRequests[keyof DiscoveryRequests]) {
      const current = ++version;
      busy = true;
      const reading = method === "discovery-source" || method === "discovery-open-message";
      dialogs.show({ kind: "discovery-wait", reading });
      try {
        let result: DiscoveryResult | null;
        if (method === "discovery-join") {
          if (!payload || !("id" in payload)) throw new Error("Choose a series result first.");
          result = { joined: await call(method, { id: payload.id }) };
        } else result = await advanceDiscovery(method, payload, {
          call, cancelled: () => current !== version,
          onStage(stage) {
            if (current !== version) return;
            const heading = stage === "discovery-join" ? "Joining series channel..."
              : stage === "discovery-follow" ? "Opening series result..."
                : reading ? "Checking Telegram..." : "Waiting for bot replies...";
            dialogs.update(view => view.kind === "discovery-wait" ? { ...view, heading } : view);
          },
        });
        if (!result || current !== version) return;
        if (result.joined) return await onJoined(result.joined);
        if (result.groups) return dialogs.show({ kind: "discovery-groups", groups: result.groups });
        if (result.source) return showSearch(result.source);
        if (result.channel) return dialogs.show({ kind: "discovery-channel", channel: result.channel });
        dialogs.show({ kind: "discovery-results", notice: result.notice, messages: result.messages || [] });
      } catch (error) {
        if (current === version) dialogs.show({ kind: "discovery-error", error: error instanceof Error ? error.message : String(error) });
      } finally { if (current === version) busy = false; }
    },
  };
}
