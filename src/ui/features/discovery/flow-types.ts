import type { Channel, DiscoverySource, DiscoveryMessage } from "./dialog-types";
import type { LibraryCatalogue } from "../library/types";
export interface JoinedChannel { channel: Channel; channels: Channel[] }
export interface DiscoveryResult {
  joined?: JoinedChannel; source?: DiscoverySource; groups?: Channel[]; channel?: Channel;
  notice?: string; messages?: DiscoveryMessage[];
  query?: string;
  expired?:boolean;
  catalogue?: LibraryCatalogue;
}
export interface DiscoveryRequests {
  "discovery-resume": { id: string };
  "discovery-source": { groupId?: string } | undefined;
  "discovery-search": { query: string; sourceId: string };
  "discovery-open-message": { link: string };
  "discovery-follow": { id: string };
  "complete-subscriptions": { ids: string[] };
  "discovery-join": { id: string };
  "discovery-collect": undefined;
}
export type DiscoveryMethod = Exclude<keyof DiscoveryRequests, "discovery-join">;
export type DiscoveryCall = <K extends keyof DiscoveryRequests>(method: K, payload: DiscoveryRequests[K]) => Promise<K extends "discovery-join" ? JoinedChannel : DiscoveryResult>;
