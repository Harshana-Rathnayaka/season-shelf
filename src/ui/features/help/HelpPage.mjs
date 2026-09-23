import { icon } from "../../shared/ui/icons.mjs";
export function helpPage() {
  const steps = [
    ['search', 'Find your series', 'Connect Telegram, then choose a joined channel or follow a supported bot result.', 'Missing a channel? Switch to All channels.'],
    ['film', 'Choose your episodes', 'Pick a quality and codec. Select a whole season or just the episodes you want.', 'Unverified lets you choose files with uncertain metadata.'],
    ['download', 'Start your collection', 'Choose your Download or Watch folder, then download. Open completed files from Finished downloads.', 'Pause and resume from Downloads whenever you need.'],
  ];
  const questions = [
    ['What do Ongoing, Finished and Remove from history mean?', 'Ongoing shows downloads that are active, queued, paused or need attention. Finished shows completed files, newest first. Remove from history and Clear finished history keep your files on disk, but the app forgets those episodes and Select missing may offer them again. To delete a disk file, open File details and choose Move file to Recycle Bin, then confirm.'],
    ['Why does a file say Checking or Transferring?', 'The Telegram download is finished. Checking calculates a checksum; Transferring saves the file in your chosen folder and verifies the copy. New downloads can start during these stages. Disk work runs one file at a time; downloads wait if the finishing backlog reaches its limit.'],
    ['How are my files organised?', 'Recognised episodes go into season folders. After all queued files for a season finish, filenames follow the majority separator style: dots, spaces, underscores or dashes. Extensions and tags such as WEB-DL stay intact. Ties keep the original style; paused or failed jobs delay naming. Unverified files keep original names in an Unverified folder. Filename collisions offer a retry in File details.'],
    ['What do Verified and Unverified mean?', 'Verified means the episode and quality metadata were recognised; it does not guarantee language, subtitles or content. Archive defaults to 720p HEVC and Watch prefers 1080p. Choose from formats actually found in the channel; Auto codec prefers HEVC. Check source filenames and play a sample for audio and subtitles.'],
    ['How does bot discovery work?', 'Use Change series to find the supported MovieClubFamily search group. Search for a title or paste a private message link. A single series result continues automatically; choose when several appear. The app follows supported bot buttons, sends Start and joins the series channel. Subscription help lets you select required channels and retry. Unsupported buttons and approval-only invites may still need Telegram.'],
    ['What if I pause, clear the queue or close the app?', 'Pause retains progress for resuming. Remove from queue and Clear queue delete temporary data; adding those downloads again starts from scratch. Completed files and lifetime usage totals are kept. Closing pauses downloads even when the app stays in the tray; file verification and transfers finish safely. After a restart, resume paused jobs. Your saved Telegram session reconnects when valid; sign in again if it expires. Reconnect missing drives at their original location. Downloads need the computer awake.'],
    ['Can I clear history without deleting videos?', 'Yes. Clear app data in Settings removes history and the selected series while keeping downloaded media and partial files. Delete media separately from Finished downloads with confirmation. Delete all pending only removes unfinished queue entries. Settings can clean up unused partial files. Different existing media files are never overwritten; staging and the destination both need free space.'],
    ['Can I follow new episodes automatically?', 'Watch series checks new posts hourly while the app runs. Choose notifications or automatic queuing with your selected quality and folder. Select missing compares the channel against app-managed saved files in the current mode. Set download hours, bandwidth and simultaneous downloads in Settings. Requests already in flight can finish after scheduled hours end.'],
  ];
  return `<section class="simple-heading">
    <div class="eyebrow">HOW IT WORKS</div>
    <h1>From channel to collection.</h1>
    <p>Your next season, a few simple steps away.</p>
    </section>
  <section class="help-guide workspace-scroll" tabindex="0" role="region" aria-label="How it works">
    <div class="help-hero">
      <div class="help-hero-copy">
    <span class="help-kicker">${icon('shelf')} A HOME FOR EVERY EPISODE</span>
    <h2>Less sorting.<br>More watching.</h2>
    <p>Find a series, choose your files and let Season Shelf organise the download.</p>
    <div class="help-actions">
    <button class="button primary" data-action="nav" data-page="library">Open series library ${icon('arrow')}</button>
    <button class="button secondary" data-action="show-guide">Replay welcome guide</button>
    </div>
    </div>
      <div class="help-illustration" role="img" aria-label="Example: downloaded episodes organised in a Season 01 folder">
    <div class="help-folder-label">${icon('folder')} Your collection <span>EXAMPLE</span>
    </div>
    <div class="help-folder-body">
    <div class="help-season">${icon('folder')} Season 01</div>
    <div class="help-file">${icon('film')}<span>Episode 01<small>Saved to your folder</small>
    </span>
    <span class="help-file-check">${icon('check')}</span>
    </div>
    <div class="help-file">${icon('film')}<span>Episode 02<small>Ready to watch</small>
    </span>
    <span class="help-file-check">${icon('check')}</span>
    </div>
    </div>
    <span class="help-folder-note">${icon('shield')} Your files. Your folders.</span>
    </div>
    </div>
    <div class="help-section-heading">
    <div>
    <span class="help-kicker">THE BASICS</span>
    <h2>How to use Season Shelf</h2>
    </div>
    <span class="help-section-note">Three steps to get started</span>
    </div>
    <ol class="help-steps">${steps.map(([glyph,title,description,tip],index)=>`<li class="help-step">
    <div class="help-step-top">
    <span class="help-step-icon">${icon(glyph)}</span>
    <span class="help-step-number">0${index+1}</span>
    </div>
    <h3>${title}</h3>
    <p>${description}</p>
    <div class="help-step-tip">${icon('info')}<span>${tip}</span>
    </div>
    </li>`).join('')}</ol>
    <div class="help-folder-choices">
    <div>${icon('drive')}<span>
    <strong>Download folder</strong>
    <small>Keep your collection, organised by season.</small>
    </span>
    </div>
    <div>${icon('play')}<span>
    <strong>Watch folder</strong>
    <small>Keep viewing copies in a separate location.</small>
    </span>
    </div>
    </div>
    <div class="help-section-heading">
    <div>
    <span class="help-kicker">GOOD TO KNOW</span>
    <h2>A little more detail, when you need it.</h2>
    </div>
    </div>
    <div class="help-faq">${questions.map(([title,answer])=>`<details>
    <summary>
    <span>${title}</span>${icon('plus')}</summary>
    <p>${answer}</p>
    </details>`).join('')}</div>
    <div class="help-bottom-note">${icon('refresh')}<p>Windows downloads updates automatically. Restart to install. On macOS, download the latest DMG from GitHub and replace the app in Applications.</p>
    <button class="text-button" data-action="nav" data-page="settings">Open settings ${icon('arrow')}</button>
    </div>
  </section>`;
}

