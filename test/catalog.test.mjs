import test from "node:test";
import assert from "node:assert/strict";
import {
  parseEpisode,
  selectEpisodes,
  safeName,
  relativeDestination,
  normalizeSeasonNames,
  availableQualities,
  availableSelection,
  channelCategory,
  cleanKeywords,
} from "../src/core/catalog.mjs";
const episode = (filename, size = 200, caption = "") =>
  parseEpisode({ id: filename, filename, size, caption });
test("parses the screenshot naming style and dotted/underscored HEVC aliases", () => {
  const item = episode(
    "12_Monkeys_S04E01_The_End_720p_10bit_WEBRip_2CH_x265_HEVC_PSA.mkv",
  );
  assert.equal(item.season, 4);
  assert.equal(item.episode, 1);
  assert.equal(item.resolution, 720);
  assert.equal(item.codec, "HEVC");
  assert.equal(item.bitDepth, 10);
  assert.equal(item.reason, null);
  assert.equal(episode("Series.S02E08.720p.H.265.mkv").codec, "HEVC");
});
test("archive selects smallest 720p HEVC, watch prefers 1080p HEVC", () => {
  const items = [
    episode("Show.S01E01.720p.x265.mkv", 300),
    episode("Show.S01E01.720p.HEVC.mkv", 200),
    episode("Show.S01E01.720p.x264.mkv", 100),
    episode("Show.S01E01.1080p.x265.mkv", 800),
    episode("Show.S01E01.1080p.x264.mkv", 500),
  ];
  assert.equal(selectEpisodes(items, "archive")[0].size, 200);
  assert.equal(selectEpisodes(items, "watch")[0].size, 800);
  assert.deepEqual(selectEpisodes([items[2]], "archive"), []);
});
test("conflicting, multi-episode and unknown metadata are excluded", () => {
  for (const item of [
    episode("Show.S01E01.720p.x265.mkv", 200, "Show.S02E01.1080p.x264.mkv"),
    episode("Show.S01E01E02.720p.x265.mkv"),
    episode("Show.S01E01-02.720p.x265.mkv"),
    episode("Show.S01E01.mkv"),
  ]) {
    assert.ok(item.reason);
    assert.equal(selectEpisodes([item]).length, 0);
  }
  assert.equal(episode("Show.txt"), null);
});
test("destination names cannot escape or become Windows reserved names", () => {
  assert.equal(safeName("CON"), "Series CON");
  assert.ok(!/[<>:"/\\|?*]/.test(safeName("../Series:<Name>")));
  const parts = relativeDestination(
    "../../Shows",
    episode("Show.S04E01.720p.x265.mkv"),
  );
  assert.equal(parts[0], "Season 04");
  assert.equal(parts[1], "Show.S04E01.720p.x265.mkv");
  assert.equal(parts.length, 2);
  assert.ok(parts.every((p) => !p.includes("/")));
});

test("season naming follows majority without changing extensions or internal hyphens", () => {
  const items = [
    episode("Show_S01E01_720p_WEB-DL_5.1_x265.mkv"),
    episode("Show_S01E02_720p_WEB-DL_x265.mkv"),
    episode("Show.S01E03.720p.WEB-DL.5.1.x265.MKV"),
    episode("Show.S02E01.720p.x265.mkv"),
  ];
  const result = normalizeSeasonNames(items);
  assert.equal(result[2].destinationFilename, "Show_S01E03_720p_WEB-DL_5.1_x265.MKV");
  assert.equal(result[2].filename, items[2].filename);
  assert.equal(result[3].destinationFilename, items[3].filename);
  const tied = normalizeSeasonNames([items[0], items[2]]);
  assert.equal(tied[0].destinationFilename, items[0].filename);
  assert.equal(tied[1].destinationFilename, items[2].filename);
});
test("quality overrides choose requested resolution and codec", () => {
  const items = [episode("Show.S01E01.720p.x265.mkv"), episode("Show.S01E01.1080p.x264.mkv")];
  assert.equal(selectEpisodes(items, "archive", { resolution:1080, codec:"H.264" })[0].filename, items[1].filename);
  assert.deepEqual(selectEpisodes(items, "archive", { resolution:2160 }), []);
  assert.throws(() => selectEpisodes(items, "archive", { resolution:123 }), /Invalid quality/);
});

test("available qualities exclude unusable files and resolve absent preferences", () => {
  const records = [episode("Show.S01E01.1080p.x264.mkv"), episode("Show.S01E02.1080p.x265.mkv"), episode("Show.S01E03.2160p.x265.mkv", 0), episode("Show.S01E04.480p.mkv")];
  assert.deepEqual(availableQualities(records), [{resolution:1080,codecs:["HEVC","H.264"]}]);
  assert.deepEqual(availableSelection(records,"archive"), {resolution:1080,codec:"HEVC"});
  assert.deepEqual(availableSelection(records,"watch"), {resolution:1080,codec:"any"});
  assert.deepEqual(availableSelection([records[0]],"archive"), {resolution:1080,codec:"H.264"});
  assert.deepEqual(availableQualities([]), []);
});
test("channel filtering prioritises media, hides finance and retains unfamiliar titles", () => {
  for (const title of ["Crypto Signals", "FOREX_VIP", "Bitcoin traders", "Binance updates"]) assert.equal(channelCategory(title),"finance");
  for (const title of ["12 Monkeys", "Breaking Bad", "The Signal", "Stockholm"]) assert.equal(channelCategory(title),"other");
  for (const title of ["TV Series", "Movie Club", "Trading Movies", "Cinema"]) assert.equal(channelCategory(title),"media");
});

test("custom keyword filters accept literal words and disable when empty", () => {
  assert.equal(channelCategory("GOLD signals"),"finance");
  assert.equal(channelCategory("Profit Market Exchange"),"finance");
  assert.equal(channelCategory("GOLD signals",[]),"other");
  assert.deepEqual(cleanKeywords([" GOLD ","gold","My_Custom Phrase"]),["gold","my custom phrase"]);
  assert.equal(channelCategory("My_Custom Phrase VIP",["my custom phrase"]),"finance");
  assert.equal(channelCategory("Goldfinger",["gold"]),"other");
});
test("dash-dominant seasons normalize separators while retaining release tags", () => {
  const items=[episode("Show-S01E01-720p-WEB-DL-x265.mkv"),episode("Show-S01E02-720p-WEB-DL-x265.mkv"),episode("Show.S01E03.720p.WEB-DL.x265.mkv")];
  assert.equal(normalizeSeasonNames(items)[2].destinationFilename,"Show-S01E03-720p-WEB-DL-x265.mkv");
});
