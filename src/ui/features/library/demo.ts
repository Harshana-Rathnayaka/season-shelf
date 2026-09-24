import type { LibraryItem } from "./types";
import { parseEpisode } from "../../../core/catalog.mjs";
export function demoCatalogue() {
  const items: LibraryItem[] = [];
  const peer = { id: "sample", type: "channel", accessHash: "0" };
  for (let season = 1; season <= 4; season++)
    for (let episode = 1; episode <= 8; episode++) {
      for (const [resolution, codec, multiplier] of [
        [720, "x265", 1],
        [720, "x264", 1.7],
        [1080, "x265", 2.8],
      ] as const) {
        const filename = `12.Monkeys.S0${season}E${String(episode).padStart(2, "0")}.Episode.${episode}.${resolution}p.WEBRip.${codec}.mkv`;
        items.push(
          parseEpisode({
            id: `${season}-${episode}-${resolution}-${codec}`,
            peer,
            filename,
            size: Math.round(
              (173 + ((episode * 13 + season * 7) % 63)) *
                multiplier *
                1024 ** 2,
            ),
          }),
        );
      }
    }
  return {
    channel: { id: "sample", title: "12 Monkeys", peer },
    items,
    scanned: 128,
    scannedAt: new Date().toISOString(),
    demo: true,
  };
}
