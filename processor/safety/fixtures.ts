// Deterministic GLB + PNG builders for the canary set and tests. Fixtures are generated from code (no binary
// blobs in the repo) and hashed, so a canary run proves exactly which inputs were checked.
import {deflateSync} from 'node:zlib';
type Mesh={name:string;positions:number[];indices:number[];uvs?:number[];texture?:Uint8Array};
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function crc32(b:Uint8Array){let c=0xffffffff;for(const x of b)c=CRC[(c^x)&0xff]!^(c>>>8);return (c^0xffffffff)>>>0;}
export function encodePng(w:number,h:number,rgba:(x:number,y:number)=>[number,number,number,number]){
 const raw=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++){raw[y*(w*4+1)]=0;for(let x=0;x<w;x++)raw.set(rgba(x,y),y*(w*4+1)+1+x*4);}
 const chunk=(type:string,data:Buffer)=>{const len=Buffer.alloc(4);len.writeUInt32BE(data.length);const td=Buffer.concat([Buffer.from(type),data]);const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(td));return Buffer.concat([len,td,crc]);};
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;
 return new Uint8Array(Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
}
export function box(cx:number,cy:number,cz:number,sx:number,sy:number,sz:number,name='box'):Mesh{
 const p:number[]=[],i:number[]=[],uv:number[]=[];const hx=sx/2,hy=sy/2,hz=sz/2;
 const faces:[number[],number[],number[]][]=[[[1,0,0],[0,0,-1],[0,1,0]],[[-1,0,0],[0,0,1],[0,1,0]],[[0,1,0],[1,0,0],[0,0,-1]],[[0,-1,0],[1,0,0],[0,0,1]],[[0,0,1],[1,0,0],[0,1,0]],[[0,0,-1],[-1,0,0],[0,1,0]]];
 for(const [n,u,v] of faces){const b=p.length/3;for(const [a,c] of [[-1,-1],[1,-1],[1,1],[-1,1]]){p.push(cx+(n[0]!+a!*u[0]!+c!*v[0]!)*hx,cy+(n[1]!+a!*u[1]!+c!*v[1]!)*hy,cz+(n[2]!+a!*u[2]!+c!*v[2]!)*hz);uv.push((a!+1)/2,(1-c!)/2);}i.push(b,b+1,b+2,b,b+2,b+3);}
 return {name,positions:p,indices:i,uvs:uv};
}
export function merge(name:string,parts:Mesh[]):Mesh{const out:Mesh={name,positions:[],indices:[],uvs:[]};for(const m of parts){const base=out.positions.length/3;out.positions.push(...m.positions);out.indices.push(...m.indices.map(x=>x+base));out.uvs!.push(...(m.uvs??[]));}return out;}
export function glb(meshes:Mesh[],opts:{extras?:Record<string,unknown>;generator?:string}={}){
 const chunks:Buffer[]=[],views:object[]=[],accessors:object[]=[],gm:object[]=[],nodes:object[]=[],images:object[]=[],textures:object[]=[],materials:object[]=[];let offset=0;
 const view=(b:Buffer,target?:number)=>{const pad=(4-b.length%4)%4;chunks.push(b,Buffer.alloc(pad));views.push({buffer:0,byteOffset:offset,byteLength:b.length,...(target?{target}:{})});offset+=b.length+pad;return views.length-1;};
 meshes.forEach((m,k)=>{
  const pos=Buffer.from(new Float32Array(m.positions).buffer),idx=Buffer.from(new Uint32Array(m.indices).buffer);const min=[0,1,2].map(a=>Math.min(...m.positions.filter((_,j)=>j%3===a))),max=[0,1,2].map(a=>Math.max(...m.positions.filter((_,j)=>j%3===a)));
  accessors.push({bufferView:view(pos,34962),componentType:5126,count:m.positions.length/3,type:'VEC3',min,max});const pa=accessors.length-1;
  accessors.push({bufferView:view(idx,34963),componentType:5125,count:m.indices.length,type:'SCALAR'});const ia=accessors.length-1;
  const attributes:Record<string,number>={POSITION:pa};if(m.uvs?.length){accessors.push({bufferView:view(Buffer.from(new Float32Array(m.uvs).buffer),34962),componentType:5126,count:m.uvs.length/2,type:'VEC2'});attributes.TEXCOORD_0=accessors.length-1;}
  const material:Record<string,unknown>={pbrMetallicRoughness:{baseColorFactor:[0.8,0.8,0.8,1],metallicFactor:0,roughnessFactor:0.8}};
  if(m.texture){images.push({bufferView:view(Buffer.from(m.texture)),mimeType:'image/png'});textures.push({source:images.length-1});(material.pbrMetallicRoughness as Record<string,unknown>).baseColorTexture={index:textures.length-1};(material.pbrMetallicRoughness as Record<string,unknown>).baseColorFactor=[1,1,1,1];}
  materials.push(material);gm.push({name:m.name,primitives:[{attributes,indices:ia,material:materials.length-1}]});nodes.push({mesh:k,name:m.name});
 });
 const bin=Buffer.concat(chunks);
 const doc:Record<string,unknown>={asset:{version:'2.0',generator:opts.generator??'polyspoon-canary'},buffers:[{byteLength:bin.length}],bufferViews:views,accessors,meshes:gm,materials,nodes,scenes:[{nodes:nodes.map((_,k)=>k)}],scene:0,...(images.length?{images,textures}:{}),...(opts.extras?{extras:opts.extras}:{})};
 let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,0x20)]);
 const total=12+8+json.length+8+bin.length,out=Buffer.alloc(total);out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(total,8);out.writeUInt32LE(json.length,12);out.writeUInt32LE(0x4e4f534a,16);json.copy(out,20);const b=20+json.length;out.writeUInt32LE(bin.length,b);out.writeUInt32LE(0x004e4942,b+4);bin.copy(out,b+8);
 return new Uint8Array(out);
}
/** Swastika outline as a predicate on [-1,1]² (used for the known-bad canaries only). */
export function swastikaAt(x:number,y:number,t=0.2){return (Math.abs(x)<=t&&Math.abs(y)<=1)||(Math.abs(y)<=t&&Math.abs(x)<=1)||(y>=1-2*t&&y<=1&&x>=0&&x<=1)||(x>=1-2*t&&x<=1&&y<=0&&y>=-1)||(y<=-1+2*t&&y>=-1&&x<=0&&x>=-1)||(x<=-1+2*t&&x>=-1&&y>=0&&y<=1);}
export function extrudedSwastika(){const t=0.2,d=0.3;return merge('emblem',[box(0,0,0,2*t,2,d),box(0,0,0,2,2*t,d),box(0.5,1-t,0,1,2*t,d),box(1-t,-0.5,0,2*t,1,d),box(-0.5,-1+t,0,1,2*t,d),box(-1+t,0.5,0,2*t,1,d)]);}
export function plusSign(){return merge('plus',[box(0,0,0,0.4,2,0.3),box(0,0,0,2,0.4,0.3)]);}
export function texturedPanel(rgba:(x:number,y:number)=>[number,number,number,number]){return {...box(0,0,0,2,2,0.05,'panel'),texture:encodePng(256,256,rgba)};}
