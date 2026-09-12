import fs from 'node:fs/promises';
import {deflateSync} from 'node:zlib';
// Code-drawn shelf mark; no external image or font dependency.
const size=256,raw=Buffer.alloc((size*4+1)*size);
for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
  const mark=(x>=52&&x<68&&y>=48&&y<204)||(x>=112&&x<128&&y>=48&&y<204)||(x>=188&&x<204&&y>=48&&y<204)||(y>=188&&y<204&&x>=52&&x<204)||(y>=48&&y<64&&x>=52&&x<128)||(x>=150&&x<168&&y>=68&&y<174);
  const offset=y*(size*4+1)+1+x*4;raw.set(mark?[160,228,198,255]:[23,25,28,255],offset);
}
const crc=buffer=>{let n=0xffffffff;for(const byte of buffer){n^=byte;for(let i=0;i<8;i++) n=(n>>>1)^((n&1)?0xedb88320:0);}return (n^0xffffffff)>>>0;};
const chunk=(name,data)=>{const body=Buffer.concat([Buffer.from(name),data]),header=Buffer.alloc(4),tail=Buffer.alloc(4);header.writeUInt32BE(data.length);tail.writeUInt32BE(crc(body));return Buffer.concat([header,body,tail]);};
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=6;
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
const header=Buffer.alloc(22);header.writeUInt16LE(1,2);header.writeUInt16LE(1,4);header.writeUInt16LE(1,10);header.writeUInt16LE(32,12);header.writeUInt32LE(png.length,14);header.writeUInt32LE(22,18);
await fs.mkdir('src/desktop/assets',{recursive:true});
await fs.writeFile('src/desktop/assets/icon.ico',Buffer.concat([header,png]));
await fs.writeFile('src/desktop/assets/icon.png',png);
