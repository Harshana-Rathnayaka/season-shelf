import type { DiscoveryCall, DiscoveryMethod, DiscoveryRequests, DiscoveryResult } from "./flow-types";
export async function advanceDiscovery(method: DiscoveryMethod, payload: DiscoveryRequests[DiscoveryMethod], {call, cancelled, onStage}: {call: DiscoveryCall; cancelled: () => boolean; onStage: (stage: string) => void}): Promise<DiscoveryResult | null> {
  const automatic = ["discovery-search","discovery-follow","complete-subscriptions"].includes(method);
  for (let step=0; step<8; step++) {
    if (cancelled()) return null;
    onStage(method);
    const result = await call(method,payload);
    if (cancelled()) return null;
    if (!automatic || result.source || result.groups) return result;
    if (result.channel) {
      onStage("discovery-join");
      const joined = await call("discovery-join",{id:result.channel.id});
      return cancelled() ? null : {joined};
    }
    const links = (result.messages || []).flatMap(message=>message.links).filter(link=>link.automatic === true);
    if (links.length !== 1) return result;
    method = "discovery-follow";
    payload = {id:links[0].id};
  }
  throw new Error("This result has too many redirects. Open it in Telegram to continue.");
}
