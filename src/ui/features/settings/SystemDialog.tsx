import type { DialogActionHandler } from "../../shared/ui/dialog-actions";
import { DialogButton } from "../../shared/ui/DialogButton";

export type SystemDialogView =
  | { kind: "guide" }
  | { kind: "update"; version: string; error?: string }
  | { kind: "licenses"; entries: Array<{ name: string; license: string; text: string }> };

export function SystemDialog({ view, onAction }: { view: SystemDialogView; onAction: DialogActionHandler }) {
  if (view.kind === "licenses") return <><h2>Third-party licenses</h2><div className="license-list">{view.entries.map(entry => <details key={entry.name}><summary>{entry.name} · {entry.license}</summary><pre>{entry.text}</pre></details>)}</div></>;
  if (view.kind === "update") return <><h2>Your update is ready</h2><p>Version {view.version} has downloaded. Restart now, or install on your next launch after verification.</p><p id="update-error" role="alert">{view.error}</p><div className="dialog-actions"><DialogButton label="Not now" action="update-later" onAction={onAction} /><DialogButton label="Restart now" className="button primary" action="update-install" onAction={onAction} /></div></>;
  return <><h2>Welcome to Season Shelf</h2><p>Your series, organised on your computer.</p><ol className="onboarding-steps"><li><strong>Connect Telegram</strong><p>Use your own API credentials and sign in securely.</p></li><li><strong>Choose a series and folder</strong><p>Select a channel and the show folder. We create season folders inside it.</p></li><li><strong>Choose files and download</strong><p>Verified defaults to 720p HEVC. Unverified files are yours to select manually. Track progress in Downloads.</p></li></ol><p>You can revisit these instructions in How it works.</p><DialogButton label="Get started" className="button primary" action="finish-onboarding" onAction={onAction} /></>;
}
