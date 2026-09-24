import { useEffect, useRef } from "react";
import { Icon } from "../../shared/ui/Icon";
import { DialogButton } from "../../shared/ui/DialogButton";
import { AsyncForm } from "../../shared/ui/AsyncForm";
import type { DialogCallbacks } from "../../shared/ui/dialog-actions";
import type { AccountDialog as View } from "./dialog-types";

export function AccountDialog({ view, onAction, onSubmit }: DialogCallbacks & { view: View }) {
  const formRef = useRef<HTMLDivElement>(null);
  const saved = view.kind === "connect" ? view.saved : undefined;
  useEffect(() => {
    const form = formRef.current?.querySelector<HTMLFormElement>("#connect-form");
    if (form && saved) for (const key of ["apiId", "apiHash", "phone"] as const) (form.elements.namedItem(key) as HTMLInputElement).value = String(saved[key]);
  }, [saved]);
  if (view.kind === "preview") return <><div className="modal-icon"><Icon name="shield" /></div><h2>This is the interface preview.</h2><p>Telegram sign-in and file access run in the Electron desktop app. Open Season Shelf on your PC to connect your account.</p><DialogButton label="Got it" className="button primary" action="close-dialog" onAction={onAction} /></>;
  if (view.kind === "auth") return <><div className="modal-icon"><Icon name="shield" /></div><h2>{view.label}</h2><p>Enter it here on your computer. It is never saved in your download history.</p>
    <AsyncForm id="auth-form" onSave={form => { const value = (form.elements.namedItem("value") as HTMLInputElement).value; form.reset(); return onSubmit({ form: "auth-form", values: { id: view.id, value } }); }}>
      {pending => <><label>{view.authKind === "password" ? "Two-step verification password" : view.authKind === "code" ? "Verification code" : view.authKind}<input name="value" required autoComplete="off" type={view.authKind === "password" ? "password" : "text"} autoFocus /></label><button className="button primary full" type="submit" disabled={pending}>Continue <Icon name="arrow" /></button></>}
    </AsyncForm></>;
  return <div ref={formRef}><div className="modal-icon"><Icon name="bolt" /></div><div className="eyebrow">YOUR ACCOUNT. YOUR COMPUTER.</div><h2>Connect to Telegram.</h2><p>Use the API ID and hash from my.telegram.org → API development tools. Your session is encrypted locally.</p>
    {view.hasCredentials && <><DialogButton label="Reconnect saved account" className="button primary full" action="reconnect" onAction={onAction} /><p className="form-divider">Or connect with your API details</p></>}
    <div id="login-suggestions" className="login-suggestions">{view.suggestions.map(entry => <DialogButton key={entry.id} label={`Use ${entry.phone} · API ${entry.apiId}`} action="use-login" data={{ id: entry.id }} onAction={onAction} />)}{view.suggestions.length > 0 && <DialogButton label="Forget suggestions" className="text-button" action="forget-logins" onAction={onAction} />}</div>
    <AsyncForm id="connect-form" onSave={form => { const field = (name: string) => (form.elements.namedItem(name) as HTMLInputElement).value; const values = { apiId: field("apiId"), apiHash: field("apiHash"), phone: field("phone") }; form.reset(); return onSubmit({ form: "connect-form", values }); }}>
      {pending => <><label>API ID<input name="apiId" inputMode="numeric" required placeholder="e.g. 12345678" autoComplete="off" /></label><label>API hash<input name="apiHash" type="password" required minLength={32} maxLength={32} autoComplete="off" placeholder="Your 32-character API hash" /></label><label>Phone number<input name="phone" type="tel" required placeholder="+94 …" autoComplete="off" /></label><button className="button primary full" type="submit" disabled={pending}>Connect securely <Icon name="arrow" /></button></>}
    </AsyncForm><small className="modal-note">No bot token, hosting or subscription required.</small>
  </div>;
}
