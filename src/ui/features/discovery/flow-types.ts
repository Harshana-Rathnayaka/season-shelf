import type { Channel, DiscoverySource, DiscoveryMessage } from "./dialog-types";
export interface JoinedChannel { channel: Channel; channels: Channel[] }
export interface DiscoveryResult {
  joined?: JoinedChannel; source?: DiscoverySource; groups?: Channel[]; channel?: Channel;
  notice?: string; messages?: DiscoveryMessage[];
}
export interface DiscoveryRequests {
  "discovery-source": { groupId?: string } | undefined;
  "discovery-search": { query: string; sourceId: string };
  "discovery-open-message": { link: string };
  "discovery-follow": { id: string };
  "complete-subscriptions": { ids: string[] };
  "discovery-join": { id: string };
}
export type DiscoveryMethod = Exclude<keyof DiscoveryRequests, "discovery-join">;
export type DiscoveryCall = <K extends keyof DiscoveryRequests>(method: K, payload: DiscoveryRequests[K]) => Promise<K extends "discovery-join" ? JoinedChannel : DiscoveryResult>;
