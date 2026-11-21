import { Rich } from 'teleproto';

// Telegram can put the text and action rows in richMessage instead of message
// and replyMarkup. Keep plain text for the renderer and original action bytes.
function richNodes(rich) {
  const nodes=[],seen=new Set(),pending=[[rich,0]];let characters=0;
  while(pending.length) {
    const [value,depth]=pending.pop();
    if(!value || typeof value!=='object' || ArrayBuffer.isView(value) || seen.has(value))continue;
    if(depth>32 || nodes.length>=4096)return [];
    seen.add(value);nodes.push(value);
    for(const [key,child] of Object.entries(value).reverse()) {
      if(['originalArgs','photos','documents','users'].includes(key))continue;
      if(typeof child==='string') {characters+=child.length;if(characters>262144)return [];}
      else if(child && typeof child==='object')pending.push([child,depth+1]);
    }
    if(pending.length>4096)return [];
  }
  return nodes;
}

// Keep buttons out of the description: discovery renders them as controls.
// Preserve constructor prototypes for the SDK's rich-text renderer and leave
// the received message untouched for callback validation.
function withoutButtonRows(value,seen=new WeakMap()) {
  if(!value || typeof value!=='object' || ArrayBuffer.isView(value))return value;
  if(value.className==='PageBlockButtonRow')return undefined;
  if(seen.has(value))return seen.get(value);
  const copy=Array.isArray(value)?[]:Object.assign(Object.create(Object.getPrototypeOf(value)),value);
  seen.set(value,copy);
  for(const [key,child] of Object.entries(value)) {
    if(['originalArgs','photos','documents','users'].includes(key))continue;
    const result=withoutButtonRows(child,seen);
    if(Array.isArray(copy)) {if(result!==undefined)copy.push(result);}
    else copy[key]=result;
  }
  return copy;
}

export function telegramContent(message) {
  const legacy=typeof message?.message==='string'?message.message:'';
  const buttons=(message?.replyMarkup?.rows||[]).slice(0,100).flatMap(row=>(row.buttons||[]).slice(0,100));
  const rich=message?.richMessage,nodes=rich?richNodes(rich):[],urls=[];
  let text=legacy;
  if(nodes.length) {
    try {
      if(!text.trim())text=Rich.toPlainText(withoutButtonRows(rich));
      for(const node of nodes) {
        if(node.className==='PageBlockButtonRow')
          for(const button of (node.buttons||[]).slice(0,100))
            buttons.push({...button,text:Rich.renderRichText(button.text)});
        if(node.className==='TextUrl' && typeof node.url==='string')
          urls.push({label:Rich.renderRichText(node.text),url:node.url});
      }
    } catch { /* Unsupported rich blocks still leave legacy content available. */ }
  }
  return {text:String(text||'').slice(0,65536),buttons:buttons.slice(0,10000),urls:urls.slice(0,200)};
}

export const messageText=message=>telegramContent(message).text;
