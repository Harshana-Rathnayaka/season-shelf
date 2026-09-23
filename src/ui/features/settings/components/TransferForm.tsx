import { useState } from "react";
import type { TransferPreferences, SaveSettings } from "../types";
import { AsyncForm } from "../../../shared/ui/AsyncForm";

export function TransferForm({ value, onSave }: { value: Partial<TransferPreferences>; onSave: SaveSettings }) {
  const [scheduled, setScheduled] = useState(!!value.scheduled);
  return <AsyncForm id="transfer-form" className="setting-row transfer-settings" onSave={form => {
    const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement;
    return onSave({ transfer: { speedKiB: Number(field("speedKiB").value), scheduled: field("scheduled").checked, start: field("start").value, end: field("end").value } }, "Download preferences saved.");
  }}>{pending => <div>
    <h3>Download hours and bandwidth</h3><p>Set a shared speed limit and an optional daily schedule.</p>
    <div className="transfer-fields">
      <label className="transfer-field">Speed limit<span className="unit-field"><input name="speedKiB" type="number" min="0" max="1048576" defaultValue={value.speedKiB || 0} aria-describedby="speed-help" /><span>KiB/s</span></span><small id="speed-help">0 means unlimited, across all downloads.</small></label>
      <div className="schedule-field"><label className="schedule-toggle"><input name="scheduled" type="checkbox" checked={scheduled} onChange={event => { event.stopPropagation(); setScheduled(event.currentTarget.checked); }} />Use download hours</label>
        <fieldset className="schedule-times" disabled={!scheduled}><legend className="sr-only">Download hours</legend>
          <label>From<input name="start" type="time" defaultValue={value.start || "00:00"} /></label><label>Until<input name="end" type="time" defaultValue={value.end || "00:00"} /></label>
        </fieldset><small>Local time. Matching times allow all day.</small>
      </div>
    </div><div className="transfer-footer"><button className="button secondary" type="submit" disabled={pending}>Save download preferences</button><small>Requests already in progress may finish after the window closes.</small></div>
  </div>}</AsyncForm>;
}
