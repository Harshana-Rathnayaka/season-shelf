import test from 'node:test';
import assert from 'node:assert/strict';
import {missingEpisodes,unverifiedItems} from '../src/core/collection.mjs';
import {relativeDestination,parseEpisode} from '../src/core/catalog.mjs';

test('missing episodes respect channel, mode, combined coverage and deleted files',()=>{
  const items=[1,2,3].map(episode=>({season:1,episode}));
  const job={status:'complete',mode:'archive',item:{peer:{id:'10'},season:1,episode:1,episodeEnd:2}};
  assert.deepEqual(missingEpisodes(items,[job],'10','archive'),[items[2]]);
  assert.equal(missingEpisodes(items,[job],'11','archive').length,3);
  assert.equal(missingEpisodes(items,[job],'10','watch').length,3);
  assert.equal(missingEpisodes(items,[{...job,status:'missing'}],'10','archive').length,3);
});
test('unverified video stays separate without inventing resolution or episode metadata',()=>{
  const item=parseEpisode({filename:'Unknown.video.mkv',id:'1',size:123});
  const [unverified]=unverifiedItems([item]);
  assert.equal(unverified.resolution,null);assert.ok(unverified.reason);
  assert.deepEqual(relativeDestination('Show',unverified),['Unverified','Unknown.video.mkv']);
  assert.throws(()=>relativeDestination('Show',item));
});
