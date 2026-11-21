export interface Channel { id: string; title: string; source?: "bot" }
export interface DiscoverySource extends Channel { linked?: boolean }
export interface DiscoveryMessage { text: string; links: Array<{ id: string; label: string; hint?: string; kind: string; automatic?: boolean }> }
export type DiscoveryDialog =
  | { kind: "channels"; channels: Channel[]; demo: boolean; filter: "suggested" | "all"; keywords: string[]; selectedMediaChannel?: string; query?: string }
  | { kind: "discovery-search"; source?: DiscoverySource | null; query?: string; link?: string; linkOpen?: boolean }
  | { kind: "discovery-wait"; reading: boolean; heading?: string }
  | { kind: "discovery-groups"; groups: Channel[]; query?: string }
  | { kind: "discovery-channel"; channel: Channel }
  | { kind: "discovery-results"; notice?: string; messages: DiscoveryMessage[] }
  | { kind: "discovery-error"; error: string }
  | { kind: "discovery-expired"; notice?: string }
  | { kind: "subscriptions"; choices: Array<{ id: string; label: string }> };
