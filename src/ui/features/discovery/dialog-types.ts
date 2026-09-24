export interface Channel { id: string; title: string }
export interface DiscoverySource extends Channel { linked?: boolean }
export interface DiscoveryMessage { text: string; links: Array<{ id: string; label: string; kind: string; automatic?: boolean }> }
export type DiscoveryDialog =
  | { kind: "channels"; channels: Channel[]; demo: boolean; filter: "suggested" | "all"; keywords: string[]; selectedMediaChannel?: string }
  | { kind: "discovery-search"; source?: DiscoverySource | null }
  | { kind: "discovery-wait"; reading: boolean; heading?: string }
  | { kind: "discovery-groups"; groups: Channel[] }
  | { kind: "discovery-channel"; channel: Channel }
  | { kind: "discovery-results"; notice?: string; messages: DiscoveryMessage[] }
  | { kind: "discovery-error"; error: string }
  | { kind: "subscriptions"; choices: Array<{ id: string; label: string }> };
