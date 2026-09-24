import { array, boolean, ignored, nullable, number, object, oneOf, optional, text, type Decoded, type Schema } from "../shared/lib/schema";
import { friendlyError } from "../shared/lib/format";
import type { DownloadRequests, DownloadResponses } from "../features/downloads/types";
import type { Settings } from "../features/settings/types";
import type { DestinationMode, QualitySelection } from "../features/library/types";

const maybeText = optional(text), maybeNumber = optional(number), maybeBoolean = optional(boolean);
const channel = object({ id: text, title: text });
const peer = object({ id: text, type: maybeText });
const item = object({ id: maybeText, filename: text, size: number, title: maybeText,
  season: optional(nullable(number)), episode: optional(nullable(number)), episodeEnd: optional(nullable(number)),
  resolution: optional(nullable(number)), codec: optional(nullable(text)), reason: optional(nullable(text)),
  bitDepth: optional(nullable(number)), unverified: maybeBoolean, alternatives: maybeNumber, peer: optional(peer) });
const catalogue = object({ channel, items: array({ parse(value: unknown) {
  const parsed = item.parse(value);
  return { ...parsed, id: text.parse(parsed.id) };
} }), truncated: maybeBoolean, scanned: maybeNumber });
const job = object({ id: text, series: text, mode: oneOf("archive", "watch"),
  status: oneOf("queued", "downloading", "retrying", "checking", "transferring", "paused", "failed", "waiting", "cancelled", "removing", "complete", "deleted", "missing", "preview"),
  item, received: maybeNumber, speed: maybeNumber, createdAt: maybeText, completedAt: maybeText,
  batchId: maybeText, finalPath: maybeText, error: maybeText, namingError: maybeText });
const jobs = array(job);
const folder = optional(nullable(object({ path: text })));
const settings = object({ theme: optional(oneOf("dark", "light", "system")), concurrency: maybeNumber,
  closeToTray: maybeBoolean, sidebarCollapsed: maybeBoolean, archiveRoot: folder, watchRoot: folder,
  appearance: optional(object({ size: maybeNumber, weight: maybeNumber, accent: maybeText, text: maybeText })),
  transfer: optional(object({ speedKiB: maybeNumber, scheduled: maybeBoolean, start: maybeText, end: maybeText })),
  hiddenKeywords: optional(array(text)) });
const usage = object({ payloadBytes: maybeNumber, publishedBytes: maybeNumber, completedFiles: maybeNumber, since: maybeText, currentBatchId: maybeText });
const updates = object({ state: optional(oneOf("manual", "idle", "development", "checking", "current", "unpublished", "available", "downloading", "ready", "error")),
  version: maybeText, percent: maybeNumber, lastCheckedAt: optional(nullable(text)), deferred: maybeBoolean });
const profile = optional(nullable(object({ name: maybeText, username: maybeText })));
const connection = object({ connected: boolean, profile, restoringSession: maybeBoolean, connectionError: optional(nullable(text)) });
const bootstrap = object({ settings: optional(settings), channels: optional(array(channel)), catalogue: optional(nullable(catalogue)), jobs: optional(jobs), usage: optional(usage),
  connected: maybeBoolean, profile, currentBatchId: maybeText, restoringSession: maybeBoolean, connectionError: optional(nullable(text)),
  hasCredentials: maybeBoolean, firstRun: maybeBoolean, customTitleBar: maybeBoolean, appName: maybeText, version: maybeText, environment: maybeText });
const discovery = object({ source: optional(object({ id: text, title: text, linked: maybeBoolean })), groups: optional(array(channel)), channel: optional(channel), notice: maybeText,
  messages: optional(array(object({ text, links: array(object({ id: text, label: text, kind: text, automatic: maybeBoolean })) }))) });
const joined = object({ channel, channels: array(channel) });
const watch = object({ channel, mode: oneOf("archive", "watch"), automatic: maybeBoolean, error: maybeText });
const watches = array(watch);
const choices = array(object({ id: text, label: text }));
const staging = object({ count: number, bytes: number });
const login = object({ apiId: { parse(value: unknown) { return typeof value === "number" ? number.parse(value) : text.parse(value); } }, apiHash: text, phone: text });
const suggestions = array(object({ id: text, apiId: loginId(), phone: text }));
function loginId(): Schema<string | number> { return { parse: value => typeof value === "number" ? number.parse(value) : text.parse(value) }; }

export const responses = {
  bootstrap, settings, channels: array(channel), scan: catalogue, connect: connection,
  "choose-folder": settings, "find-missing": jobs, enqueue: array(text),
  "queue-control": jobs, "retry-naming": jobs, "remove-history": jobs, "delete-job": jobs,
  "open-job": ignored, "reveal-job": ignored,
  "delete-all-queue": object({ jobs, removed: number }), "staging-info": staging,
  "cleanup-staging": object({ deleted: number, failures: array(object({ error: text })) }),
  "login-suggestions": suggestions, "login-suggestion": login, "forget-login-suggestions": ignored,
  "licenses": array(object({ name: text, license: text, text })),
  "clear-app-data": object({ cleared: boolean, jobs: optional(jobs), channels: optional(array(channel)), catalogue: optional(nullable(catalogue)), usage: optional(usage), currentBatchId: maybeText }),
  "reset-activity": usage, "update-later": updates, "update-status": updates, "update-check": updates, "update-download": updates, "update-install": updates,
  "watch-list": watches, "watch-set": watches, "subscription-choices": choices,
  "discovery-source": discovery, "discovery-search": discovery, "discovery-open-message": discovery, "discovery-follow": discovery, "complete-subscriptions": discovery, "discovery-join": joined,
  "discovery-cancel": ignored, "window-theme": ignored, "confirmation-reply": ignored,
  "auth-reply": ignored, "finish-onboarding": ignored, disconnect: ignored,
};
export interface Requests extends DownloadRequests {
  bootstrap: undefined; settings: Partial<Settings>; channels: undefined; scan: { id: string };
  connect: { apiId?: string; apiHash?: string; phone?: string }; "choose-folder": { mode: DestinationMode };
  "find-missing": { mode: DestinationMode }; enqueue: { ids: string[]; unverifiedIds: string[]; mode: DestinationMode; quality: QualitySelection };
  "login-suggestions": undefined; "login-suggestion": { id: string }; "forget-login-suggestions": undefined;
  licenses: undefined; "clear-app-data": undefined; "reset-activity": undefined;
  "update-later": undefined; "update-status": undefined; "update-check": undefined; "update-download": undefined; "update-install": undefined;
  "watch-list": undefined; "watch-set": { mode: DestinationMode; quality: QualitySelection; automatic: boolean | null };
  "subscription-choices": undefined; "discovery-source": { groupId?: string } | undefined;
  "discovery-search": { query: string; sourceId: string }; "discovery-open-message": { link: string };
  "discovery-follow": { id: string }; "complete-subscriptions": { ids: string[] }; "discovery-join": { id: string };
  "discovery-cancel": undefined; "window-theme": { color: string; symbolColor: string };
  "confirmation-reply": { id: string; response: number }; "auth-reply": { id: string; value?: string; cancel?: boolean };
  "finish-onboarding": undefined; disconnect: undefined;
}
export type Responses = { [K in keyof typeof responses]: Decoded<(typeof responses)[K]> };
export type Method = keyof Requests;
type NoPayload = { [K in Method]: undefined extends Requests[K] ? K : never }[Method];
export interface Call {
  <K extends Method>(method: K, payload: Requests[K]): Promise<Responses[K]>;
  <K extends NoPayload>(method: K): Promise<Responses[K]>;
}
// Compile-time check: the common download contract must match the boundary decoders.
const downloadContract: { [K in keyof DownloadResponses]: Schema<DownloadResponses[K]> } = responses;
void downloadContract;

export const events = {
  queue: jobs, usage, updates, connection,
  "scan-progress": object({ scanned: number, found: number }),
  "new-episodes": object({ count: number, title: text, automatic: boolean }),
  "auth-error": text, "auth-prompt": object({ id: text, label: text, kind: text }),
  confirmation: object({ id: text, title: text, message: text, detail: text, buttons: array(text) }),
};
export type DesktopEvent = { [K in keyof typeof events]: { type: K; data: Decoded<(typeof events)[K]> } }[keyof typeof events];
interface Preload { call(method: string, payload?: unknown): Promise<unknown>; on(callback: (event: unknown) => void): () => void }
declare global { interface Window { shelf?: Preload } }

export const call: Call = async <K extends Method>(method: K, payload?: Requests[K]): Promise<Responses[K]> => {
  if (!window.shelf) throw new Error("Open the desktop app to use your Telegram account");
  const result = await window.shelf.call(method, payload);
  if (!result || typeof result !== "object" || !("ok" in result)) throw new Error("Invalid desktop response");
  if (result.ok !== true) throw new Error(friendlyError("error" in result ? String(result.error) : "Desktop request failed"));
  const data = "data" in result ? result.data : undefined;
  // The indexed decoder is paired with this method by the exhaustive map above.
  return responses[method].parse(data) as Responses[typeof method];
};
export function subscribe(onEvent: (event: DesktopEvent) => void, onError: (error: Error) => void) {
  return window.shelf?.on(value => {
    try {
      if (!value || typeof value !== "object" || !("type" in value) || !("data" in value) || typeof value.type !== "string") throw new Error("Invalid desktop event");
      if (!Object.hasOwn(events, value.type)) return;
      const type = value.type as keyof typeof events;
      const data = events[type].parse(value.data);
      onEvent({ type, data } as DesktopEvent);
    } catch (error) { onError(error instanceof Error ? error : new Error(String(error))); }
  });
}
