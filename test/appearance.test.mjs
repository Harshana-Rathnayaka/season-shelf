import test from "node:test";
import assert from "node:assert/strict";
import { cleanAppearance, contrastInk } from "../src/core/appearance.mjs";

test("appearance rejects CSS injection and excessive size, handles null and chooses readable button ink", () => {
  assert.deepEqual(cleanAppearance({size:10000,weight:1,accent:"red;display:none",text:"url(x)"}), {size:100,weight:400,accent:"",text:""});
  assert.deepEqual(cleanAppearance(null), {size:100,weight:400,accent:"",text:""});
  assert.equal(cleanAppearance({accent:"#AABBCC",size:"120"}).accent,"#aabbcc");
  assert.equal(contrastInk("#ffffff"),"#101113");
  assert.equal(contrastInk("#000000"),"#ffffff");
});
