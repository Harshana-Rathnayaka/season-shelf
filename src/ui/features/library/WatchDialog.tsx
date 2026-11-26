import { AsyncForm } from "../../shared/ui/AsyncForm";
import type { DialogCallbacks } from "../../shared/ui/dialog-actions";
import { RadioChoices } from '../../shared/ui/RadioChoices';

export interface WatchDialogView { kind: "watch"; mode: "archive" | "watch"; watch?: { automatic?: boolean; error?: string } }
export function WatchDialog({ view, onSubmit }: { view: WatchDialogView; onSubmit: DialogCallbacks["onSubmit"] }) {
  return <><h2>Watch for new episodes</h2><p>Check this channel hourly while the app is open. Uses your current quality and {view.mode} folder. New uploads only; existing files stay under manual control.</p>
    <AsyncForm id="watch-form" onSave={form => onSubmit({ form: "watch-form", values: { watchMode: String(new FormData(form).get('watchMode')) } })}>
      {pending => <><RadioChoices label="When new files appear" name="watchMode" defaultValue={!view.watch ? "off" : view.watch.automatic ? "auto" : "notify"} disabled={pending} options={[{value:'notify',label:'Notify me'},{value:'auto',label:'Queue automatically'},{value:'off',label:'Off'}]} /><button className="button primary" type="submit" disabled={pending}>Save series watch</button></>}
    </AsyncForm>{view.watch?.error && <p role="alert">{view.watch.error}</p>}
  </>;
}
