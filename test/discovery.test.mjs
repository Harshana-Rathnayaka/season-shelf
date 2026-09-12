import test from "node:test";
import assert from "node:assert/strict";
import { parseDiscoveryLink, discoveryLinks } from "../src/core/discovery.mjs";

test("discovery distinguishes bot starts, public peers and invitations", () => {
  assert.deepEqual(parseDiscoveryLink("https://t.me/MCF_SeriesBot?start=series_12"),{kind:"bot-start",username:"MCF_SeriesBot",start:"series_12"});
  assert.deepEqual(parseDiscoveryLink("tg://resolve?domain=MCF_SeriesBot&start=series_12"),{kind:"bot-start",username:"MCF_SeriesBot",start:"series_12"});
  assert.equal(parseDiscoveryLink("https://t.me/MovieClubFamily").kind,"public-peer");
  assert.equal(parseDiscoveryLink("https://t.me/+Abcdef_123").kind,"invite");
  assert.equal(parseDiscoveryLink("tg://join?invite=Abcdef_123").kind,"invite");
});

test("discovery ignores external, ambiguous and unrelated action links", () => {
  for (const link of ["https://t.me.evil/MCF_SeriesBot", "https://t.me@evil.test/MCF_SeriesBot", "file:///tmp/link", "https://t.me/MCF_SeriesBot?startgroup=x", "https://t.me/MCF_SeriesBot?start=a&start=b", "https://t.me/+94712345678", "https://t.me/share?url=x", "https://t.me/series/44", "tg://resolve?domain=MCF_SeriesBot&invite=Abcdef_123"])
    assert.equal(parseDiscoveryLink(link),null,link);
});

test("discovery collects multiple result buttons and caption links without executing callbacks", () => {
  const url="https://t.me/MCF_SeriesBot?start=one";
  const message={message:"Download here",replyMarkup:{rows:[{buttons:[{text:"Series one",url},{className:"KeyboardButtonCallback",text:"Page 2",data:Buffer.from("next")}]}]},entities:[{className:"MessageEntityTextUrl",offset:0,length:8,url},{className:"MessageEntityTextUrl",offset:9,length:4,url:"https://t.me/+Abcdef_123"}]};
  const links=discoveryLinks(message);
  assert.equal(links.length,3);
  assert.equal(links[0].label,"Series one");
  assert.equal(links[1].target.kind,"callback");
  assert.equal(links[1].automatic,false);
  assert.equal(links[2].target.kind,"invite");
});

test("private message links preserve chat identity and message ID without inventing a start parameter", () => {
  const expected={kind:"private-message",channelId:"1301811144",messageId:10288467};
  assert.deepEqual(parseDiscoveryLink("https://t.me/c/1301811144/10288467"),expected);
  assert.deepEqual(parseDiscoveryLink("tg://privatepost?channel=1301811144&post=10288467"),expected);
  for (const link of ["https://t.me/c/1301811144/0","https://t.me/c/1301811144/2147483648","https://t.me/c/1301811144/12?comment=3","https://t.me/c/1301811144/12?start=fake","tg://privatepost?channel=1&post=2&post=3","https://t.me/c/9999999999999999999/12"])
    assert.equal(parseDiscoveryLink(link),null,link);
});
