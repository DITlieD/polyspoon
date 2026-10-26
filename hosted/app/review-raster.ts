export class RasterEvidenceError extends Error {}
function dimensions(width:number,height:number){if(!width||!height||width>8192||height>8192||width*height>16777216)throw new RasterEvidenceError('Evidence image dimensions exceed the preview limit. Download the exact file for separate inspection.');}
export function rasterType(bytes:Uint8Array):'image/png'|'image/jpeg'{
 if(bytes.length>2097152)throw new RasterEvidenceError('Evidence image exceeds 2 MiB.');
 if(bytes.length>=24&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)&&[73,72,68,82].every((v,i)=>bytes[12+i]===v)){const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);dimensions(view.getUint32(16),view.getUint32(20));return 'image/png';}
 if(bytes[0]===255&&bytes[1]===216){let offset=2;while(offset+3<bytes.length){if(bytes[offset++]!==255)break;while(bytes[offset]===255)offset++;const marker=bytes[offset++];if(marker===218||marker===217)break;if(offset+2>bytes.length)break;const length=bytes[offset]!*256+bytes[offset+1]!;if(length<2||offset+length>bytes.length)break;if([192,193,194].includes(marker!)){if(length<8)break;dimensions(bytes[offset+5]!*256+bytes[offset+6]!,bytes[offset+3]!*256+bytes[offset+4]!);return 'image/jpeg';}offset+=length;}}
 throw new RasterEvidenceError('Only bounded PNG or JPEG evidence can be previewed. Download the exact file for separate inspection.');
}
