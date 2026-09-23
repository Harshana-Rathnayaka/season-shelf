import { useState } from "react";
import { Icon } from "../../shared/ui/Icon";
import { DialogButton } from "../../shared/ui/DialogButton";
import { AsyncForm } from "../../shared/ui/AsyncForm";
import type { DialogCallbacks } from "../../shared/ui/dialog-actions";
import type { DiscoveryDialog as View } from "./dialog-types";
import { ChannelPicker } from "./ChannelPicker";

export function DiscoveryDialog({ view, onAction, onSubmit }: DialogCallbacks & { view: View }) {
  const [query, setQuery] = useState("");
  switch (view.kind) {
    case "channels": return <ChannelPicker view={view} onAction={onAction} />;
    case "discovery-search": return <><h2>Find your next series.</h2>
      {view.source ? <><p>Your search will be posted in <strong>{view.source.title}</strong>{view.source.linked ? ", the discussion group linked to MovieClubFamily" : ""}. Other members can see it. @MCF_SeriesBot replies in that group.</p>
        <AsyncForm id="discovery-form" onSave={form => { const field = (name: string) => (form.elements.namedItem(name) as HTMLInputElement).value; return onSubmit({ form: "discovery-form", values: { query: field("query"), sourceId: field("sourceId") } }); }}>
          {pending => <><input type="hidden" name="sourceId" value={view.source?.id} /><label>Series name<input name="query" required maxLength={120} placeholder="e.g. Breaking Bad" autoComplete="off" /></label><button className="button primary full" type="submit" disabled={pending}>Post search in this group</button></>}
        </AsyncForm></> : <><p>Search in the MovieClubFamily shared chat, then open the series bot's result.</p><DialogButton label="Find MovieClubFamily search group" className="button primary full" action="discovery-source" onAction={onAction} /></>}
      <details className="message-link-entry"><summary>Already have a Telegram message link?</summary><AsyncForm id="discovery-link-form" onSave={form => onSubmit({ form: "discovery-link-form", values: { link: (form.elements.namedItem("link") as HTMLInputElement).value } })}>
        {pending => <><label>Private message link<input name="link" type="url" required maxLength={2048} placeholder="https://t.me/c/123456/789" /></label><button className="button secondary full" type="submit" disabled={pending}>Read linked message</button></>}
      </AsyncForm><p>Reads the message using your account. Nothing is sent and no channel is joined until you choose an action.</p></details><p>One series result opens automatically, starts the bot and joins its channel. When several results appear, choose one. Files are downloaded only after you select episodes.</p>
    </>;
    case "discovery-wait": return <><h2>{view.heading || (view.reading ? "Checking Telegram..." : "Waiting for the result...")}</h2><p>{view.reading ? "Reading chat information through your account. No message is being sent." : "Collecting replies for up to 30 seconds. Closing this window stops waiting; it does not unsend your message."}</p><DialogButton label="Stop waiting" action="close-dialog" onAction={onAction} /></>;
    case "discovery-groups": return <><h2>Choose the search group.</h2><p>MovieClubFamily is an entry channel. Select the joined group where you normally post series names. No message is sent when choosing.</p>
      <label className="modal-search"><Icon name="search" /><input id="search-group-filter" placeholder="Find a joined group" aria-label="Find a joined group" value={query} onInput={event => { event.stopPropagation(); setQuery(event.currentTarget.value); }} /></label>
      <div className="discovery-results" id="search-group-results">{view.groups.length ? view.groups.filter(group => group.title.toLowerCase().includes(query.toLowerCase().trim())).map(group => <DialogButton key={group.id} label={group.title} glyph="arrow" className="channel-option" action="discovery-group" data={{ choice: group.id }} onAction={onAction} />) : <p>No eligible group found in your recent chats. Use a Telegram result link instead.</p>}</div><DialogButton label="Use a message link instead" className="text-button" action="discover" onAction={onAction} />
    </>;
    case "discovery-channel": return <><h2>{view.channel.title}</h2><p>Join this Telegram channel and scan its episodes? Required subscription channels are not joined automatically.</p><DialogButton label="Join channel and scan" className="button primary" action="discovery-join" data={{ choice: view.channel.id }} onAction={onAction} /></>;
    case "discovery-error": return <><h2>Could not finish opening the series.</h2><p role="alert">{view.error}</p><p>If Telegram already joined the channel, select it from your channels to load its episodes.</p><DialogButton label="Choose series channel" className="button primary" action="choose-series" onAction={onAction} /><DialogButton label="Try search again" action="discover" onAction={onAction} /></>;
    case "discovery-results": return <><h2>Discovery results</h2>{view.notice && <p role="status">{view.notice}</p>}<div className="discovery-results">
      {view.messages.length ? view.messages.map((message, index) => <section className="discovery-message" key={index}><p>{message.text}</p>{message.links.map(link => <button key={link.id} type="button" className="channel-option" data-action="discovery-follow" data-choice={link.id} disabled={link.kind === "unsupported"} onClick={event => { event.stopPropagation(); void onAction("discovery-follow", { choice: link.id }); }}><span>{link.label}<small>{link.kind === "unsupported" ? "Open this button in Telegram" : link.kind === "callback" ? "Open bot result" : link.kind === "bot-start" ? "Start bot with this result" : link.kind === "private-message" ? "Read linked message" : "Preview Telegram destination"}</small></span><Icon name="arrow" /></button>)}</section>) : <p>No reply arrived. Try again later or open the bot in Telegram.</p>}
      </div><p>A single series result continues automatically. Choose a result when there are several. Subscription tasks require your selection.</p><DialogButton label="Bot requires channel subscriptions?" action="subscription-help" onAction={onAction} /><DialogButton label="New search" action="discover" onAction={onAction} />
    </>;
    case "subscriptions": return <><h2>Required channels</h2><p>Select the channels the bot requires. The app will join them and retry the series request.</p>
      <AsyncForm id="subscriptions-form" onSave={form => onSubmit({ form: "subscriptions-form", values: { ids: [...form.querySelectorAll<HTMLInputElement>("input:checked")].map(input => input.value) } })}>
        {pending => <>{view.choices.length ? view.choices.map(choice => <label key={choice.id}><input type="checkbox" name="subscription" value={choice.id} />{choice.label}</label>) : <p>No supported channel links in this reply.</p>}<button className="button primary" type="submit" disabled={pending || !view.choices.length}>Join selected and continue</button></>}
      </AsyncForm>
    </>;
  }
}
