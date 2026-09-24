export type DialogAction = "close-dialog" | "finish-onboarding" | "update-later" | "update-install"
  | "reconnect" | "use-login" | "forget-logins" | "discover" | "discovery-source"
  | "discovery-group" | "discovery-follow" | "discovery-join" | "choose-series" | "scan-channel"
  | "refresh-channels" | "channel-filter" | "subscription-help" | "confirmation-reply" | "retry-naming" | "reveal-job" | "delete-job";
export interface DialogActionData { id?: string; job?: string; choice?: string; channel?: string; response?: string; filter?: string }
export type DialogActionHandler = (action: DialogAction, data?: DialogActionData) => Promise<void>;
export type DialogSubmission =
  | { form: "connect-form"; values: { apiId: string; apiHash: string; phone: string } }
  | { form: "auth-form"; values: { id: string; value: string } }
  | { form: "watch-form"; values: { watchMode: string } }
  | { form: "subscriptions-form"; values: { ids: string[] } }
  | { form: "discovery-form"; values: { query: string; sourceId: string } }
  | { form: "discovery-link-form"; values: { link: string } };
export interface DialogCallbacks {
  onAction: DialogActionHandler;
  onSubmit: (submission: DialogSubmission) => Promise<void>;
}
