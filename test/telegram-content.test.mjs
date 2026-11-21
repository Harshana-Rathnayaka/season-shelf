import test from 'node:test';
import assert from 'node:assert/strict';
import {Api} from 'teleproto';
import {BinaryReader} from 'teleproto/extensions/BinaryReader.js';
import {telegramContent} from '../src/core/telegram-content.mjs';
import {discoveryLinks} from '../src/core/discovery.mjs';
import {Discovery} from '../src/desktop/discovery.mjs';

const peer=new Api.InputPeerChannel({channelId:123456789n,accessHash:55n});
const richText=text=>new Api.TextPlain({text});
function richMenu(buttons,body='Choose a series') {
  const message=new Api.Message({id:12345,peerId:new Api.PeerChannel({channelId:123456789n}),
    fromId:new Api.PeerUser({userId:123n}),replyTo:new Api.MessageReplyHeader({replyToMsgId:12340}),
    date:1730000000,message:'',richMessage:new Api.RichMessage({blocks:[
      new Api.PageBlockParagraph({text:richText(body)}),
      ...buttons.map(([label,type])=>new Api.PageBlockButtonRow({buttons:[new Api.PageButton({text:richText(label),type})]})),
    ]})});
  // Exercise the same decoded constructors as a Telegram response, rather than
  // only objects constructed in tests with legacy message/replyMarkup fields.
  return new BinaryReader(message.getBytes()).tgReadObject();
}
const callback=data=>new Api.InlineButtonTypeCallback({data:Buffer.from(data)});

test('wire-decoded rich bot menus retain Sinhala text, original button order and opaque callback bytes',()=>{
  const body='\u0d94\u0db6\u0da7 \u0d95\u0db1 \u0d91\u0d9a \u0dad\u0ddd\u0dbb\u0db1\u0dca\u0db1';
  const message=richMenu([['The Flash (2023)',callback('movie')],['The Flash (2014)',callback('series')]],body);
  assert.equal(message.message,'');assert.equal(message.replyMarkup,null);
  const parsed=telegramContent(message);assert.equal(parsed.text,body);
  assert.equal(message.richMessage.blocks.length,3,'Description rendering must not remove the original action rows');
  const links=discoveryLinks(message);
  assert.deepEqual(links.map(link=>link.label),['The Flash (2023)','The Flash (2014)']);
  assert.deepEqual(links[1].target.data,[...Buffer.from('series')]);
});

test('reading the reported private link displays a rich menu and follows an edited rich season menu',async()=>{
  let message=richMenu([['The Flash (2014)',callback('series')]]),actions=0;
  const client={getInputEntity:async()=>peer,getMessages:async(_peer,options)=>{
    assert.deepEqual(options.ids,[12345]);return [message];
  },invoke:async request=>{
    assert.equal(request.className,'messages.GetBotCallbackAnswer');assert.equal(request.data.toString(),'series');actions++;
    message=richMenu([['Season 1',callback('s1')],['Season 2',callback('s2')]],'Choose a season');return {};
  }};
  const discovery=new Discovery({requireClient:()=>client});
  const result=await discovery.openMessageLink('https://t.me/c/123456789/12345');
  assert.equal(actions,0);assert.equal(result.messages[0].links[0].label,'The Flash (2014)');
  assert.equal(result.messages[0].links[0].automatic,false);
  const seasons=await discovery.follow(result.messages[0].links[0].id);
  assert.equal(actions,1);assert.equal(seasons.messages[0].text,'Choose a season');
  assert.deepEqual(seasons.messages[0].links.map(link=>link.label),['Season 1','Season 2']);
});

test('rich callback changes invalidate the previously displayed button before any action is sent',async()=>{
  let message=richMenu([['The Flash (2014)',callback('original')]]);
  const discovery=new Discovery({requireClient:()=>({getInputEntity:async()=>peer,getMessages:async()=>[message],
    invoke:async()=>assert.fail('Changed callback must not be submitted')})});
  const result=await discovery.openMessageLink('https://t.me/c/123456789/12345');
  message=richMenu([['The Flash (2014)',callback('replacement')]]);
  await assert.rejects(discovery.follow(result.messages[0].links[0].id),/button changed/);
});

test('rich inline links and quality buttons use the same destination checks as legacy keyboards',()=>{
  const message=richMenu([['1080p - Episodes 23',new Api.InlineButtonTypeUrl({url:'https://t.me/MCFHelper02Bot?start=opaque'})]]);
  message.richMessage.blocks.unshift(new Api.PageBlockParagraph({text:new Api.TextUrl({text:richText('Read this result'),url:'https://t.me/c/123456789/12345',webpageId:0n})}));
  const links=discoveryLinks(message);
  assert.equal(links[0].target.username,'MCFHelper02Bot');assert.equal(links[0].automatic,false);
  assert.ok(links.some(link=>link.target.kind==='private-message'));
  const password=richMenu([['Protected',new Api.InlineButtonTypeCallback({data:Buffer.from('secret'),requiresPassword:true})]]);
  assert.equal(discoveryLinks(password)[0].target.kind,'unsupported');
});

test('blank or unsupported linked records fail visibly rather than rendering an empty results dialog',async()=>{
  const discovery=new Discovery({requireClient:()=>({getInputEntity:async()=>peer,getMessages:async()=>[new Api.Message({id:12345,message:''})]})});
  await assert.rejects(discovery.openMessageLink('https://t.me/c/123456789/12345'),/without readable text/);
});

test('oversized or recursive rich content is bounded and leaves legacy text available',()=>{
  let text=richText('Too deep');for(let i=0;i<100;i++)text=new Api.TextBold({text});
  const message={message:'Legacy fallback',richMessage:new Api.RichMessage({blocks:[new Api.PageBlockParagraph({text})]})};
  assert.equal(telegramContent(message).text,'Legacy fallback');
  assert.deepEqual(discoveryLinks(message),[]);
});

test('group reply collection recognises a rich-only menu from the verified bot',async()=>{
  const message=richMenu([['The Flash (2014)',callback('series')]]);let now=0;
  const client={getMessages:async()=>[message]};
  const discovery=new Discovery({requireClient:()=>client},{now:()=>now,wait:async ms=>{now+=ms;}});
  const result=await discovery.responses(client,peer,12340,new AbortController().signal,{botIds:['123']});
  assert.match(result.messages[0].text,/Choose a series/);
  assert.equal(result.messages[0].links[0].label,'The Flash (2014)');
  assert.equal(result.messages[0].links[0].automatic,false);
});
