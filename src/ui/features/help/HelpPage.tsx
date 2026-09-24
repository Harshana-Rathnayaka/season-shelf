import { PageHeader } from "../../shared/ui/PageHeader";
import { Icon } from "../../shared/ui/Icon";
import { AsyncActionButton } from "../../shared/ui/AsyncActionButton";
import { steps, questions } from "./content";

export type HelpCommand = { action: "nav"; page: "library" | "settings" } | { action: "show-guide" };

export function HelpPage({ onAction }: { onAction: (command: HelpCommand) => Promise<void> }) {
  return <main><PageHeader title="How it works" description="Connect Telegram, choose a series and manage your downloads." />
    <section className="help-guide workspace-scroll" tabIndex={0} role="region" aria-label="How it works">
      <div className="help-hero"><div className="help-hero-copy"><h2>Get started</h2><p>Find a series, choose your files and let Season Shelf organise the download.</p>
        <div className="help-actions"><AsyncActionButton label="Open series library" glyph="arrow" className="button primary" data-action="nav" data-page="library" onAction={() => onAction({ action: "nav", page: "library" })} /><AsyncActionButton label="Replay welcome guide" data-action="show-guide" onAction={() => onAction({ action: "show-guide" })} /></div>
      </div>
        <div className="help-illustration" role="img" aria-label="Example: downloaded episodes organised in a Season 01 folder">
          <div className="help-folder-label"><Icon name="folder" /> Your collection <span>EXAMPLE</span></div>
          <div className="help-folder-body"><div className="help-season"><Icon name="folder" /> Season 01</div>
            {["01", "02"].map((episode, index) => <div className="help-file" key={episode}><Icon name="film" /><span>Episode {episode}<small>{index ? "Ready to watch" : "Saved to your folder"}</small></span><span className="help-file-check"><Icon name="check" /></span></div>)}
          </div><span className="help-folder-note"><Icon name="shield" /> Your files. Your folders.</span>
        </div>
      </div>
      <div className="help-section-heading"><div><span className="help-kicker">THE BASICS</span><h2>How to use Season Shelf</h2></div><span className="help-section-note">Three steps to get started</span></div>
      <ol className="help-steps">{steps.map(([glyph, title, description, tip], index) => <li className="help-step" key={title}><div className="help-step-top"><span className="help-step-icon"><Icon name={glyph} /></span><span className="help-step-number">0{index + 1}</span></div><h3>{title}</h3><p>{description}</p><div className="help-step-tip"><Icon name="info" /><span>{tip}</span></div></li>)}</ol>
      <div className="help-folder-choices"><div><Icon name="drive" /><span><strong>Download folder</strong><small>Keep your collection, organised by season.</small></span></div><div><Icon name="play" /><span><strong>Watch folder</strong><small>Keep viewing copies in a separate location.</small></span></div></div>
      <div className="help-section-heading"><div><span className="help-kicker">GOOD TO KNOW</span><h2>Common questions</h2></div></div>
      <div className="help-faq">{questions.map(([title, answer]) => <details key={title}><summary><span>{title}</span><Icon name="plus" /></summary><p>{answer}</p></details>)}</div>
      <div className="help-bottom-note"><Icon name="refresh" /><p>Windows downloads updates automatically. Restart to install. On macOS, download the latest DMG from GitHub and replace the app in Applications.</p><AsyncActionButton label="Open settings" glyph="arrow" className="text-button" data-action="nav" data-page="settings" onAction={() => onAction({ action: "nav", page: "settings" })} /></div>
    </section>
  </main>;
}
