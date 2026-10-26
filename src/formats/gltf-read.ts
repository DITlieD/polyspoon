// Minimal, dependency-free GLB reader used by format conversion. It runs in
// Node and in Cloudflare Workers. It bakes node transforms into world space
// (meters, +Y up, right handed, as glTF requires) and keeps base-color
// materials. Textures, skins and animations are not carried over.
export interface ReadMaterial {name:string;color:[number,number,number,number];metallic:number;roughness:number;doubleSided:boolean}
export interface ReadMesh {name:string;positions:Float64Array;normals:Float64Array|null;uvs:Float64Array|null;indices:Uint32Array;material:number}
export interface ReadScene {meshes:ReadMesh[];materials:ReadMaterial[];skinned:boolean;animated:boolean;textured:boolean}
type Matrix=Float64Array;
const identity=():Matrix=>Float64Array.of(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1);
function multiply(a:Matrix,b:Matrix):Matrix{const out=new Float64Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++){let sum=0;for(let k=0;k<4;k++)sum+=a[k*4+r]!*b[c*4+k]!;out[c*4+r]=sum;}return out;}
function compose(t=[0,0,0],q=[0,0,0,1],s=[1,1,1]):Matrix{
 const [x,y,z,w]=q as [number,number,number,number],[sx,sy,sz]=s as [number,number,number];
 return Float64Array.of((1-2*(y*y+z*z))*sx,2*(x*y+z*w)*sx,2*(x*z-y*w)*sx,0,2*(x*y-z*w)*sy,(1-2*(x*x+z*z))*sy,2*(y*z+x*w)*sy,0,2*(x*z+y*w)*sz,2*(y*z-x*w)*sz,(1-2*(x*x+y*y))*sz,0,t[0]!,t[1]!,t[2]!,1);
}
function normalMatrix(m:Matrix){
 const a=m[0]!,b=m[1]!,c=m[2]!,d=m[4]!,e=m[5]!,f=m[6]!,g=m[8]!,h=m[9]!,i=m[10]!,det=a*(e*i-f*h)-d*(b*i-c*h)+g*(b*f-c*e)||1;
 // inverse transpose of the upper 3x3, row-major [r][c]
 return [[(e*i-f*h)/det,(c*h-b*i)/det,(b*f-c*e)/det],[(f*g-d*i)/det,(a*i-c*g)/det,(c*d-a*f)/det],[(d*h-e*g)/det,(b*g-a*h)/det,(a*e-b*d)/det]];
}
export function parseGlb(input:Uint8Array):{json:any;bin:Uint8Array}{
 const view=new DataView(input.buffer,input.byteOffset,input.byteLength);
 if(input.byteLength<20||view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2)throw Error('glb_invalid');
 let offset=12,json:any=null,bin:Uint8Array=new Uint8Array(0);
 while(offset+8<=input.byteLength){const length=view.getUint32(offset,true),type=view.getUint32(offset+4,true),chunk=input.subarray(offset+8,offset+8+length);if(type===0x4e4f534a)json=JSON.parse(new TextDecoder().decode(chunk));else if(type===0x004e4942)bin=chunk;offset+=8+length;}
 if(!json)throw Error('glb_invalid');return {json,bin};
}
const sizes:Record<string,number>={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
function accessor(json:any,bin:Uint8Array,index:number):{values:Float64Array;size:number}{
 const a=json.accessors?.[index];if(!a)throw Error('glb_accessor_missing');const size=sizes[a.type]!,count=a.count,values=new Float64Array(count*size);
 if(a.bufferView===undefined)return {values,size};
 const bv=json.bufferViews[a.bufferView];if((bv.buffer??0)!==0)throw Error('glb_external_buffer');
 const bytes:Record<number,number>={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4},width=bytes[a.componentType]!,stride=bv.byteStride||width*size,base=(bv.byteOffset??0)+(a.byteOffset??0),view=new DataView(bin.buffer,bin.byteOffset,bin.byteLength);
 const read=(o:number)=>{switch(a.componentType){case 5126:return view.getFloat32(o,true);case 5125:return view.getUint32(o,true);case 5123:return a.normalized?view.getUint16(o,true)/65535:view.getUint16(o,true);case 5121:return a.normalized?view.getUint8(o)/255:view.getUint8(o);case 5122:return a.normalized?Math.max(view.getInt16(o,true)/32767,-1):view.getInt16(o,true);case 5120:return a.normalized?Math.max(view.getInt8(o)/127,-1):view.getInt8(o);default:throw Error('glb_component_type');}};
 for(let i=0;i<count;i++)for(let c=0;c<size;c++)values[i*size+c]=read(base+i*stride+c*width);
 if(a.sparse)throw Error('glb_sparse_unsupported');return {values,size};
}
export function readGlb(input:Uint8Array):ReadScene{
 const {json,bin}=parseGlb(input),meshes:ReadMesh[]=[];
 const materials:ReadMaterial[]=(json.materials??[]).map((m:any,i:number)=>({name:String(m.name||'material_'+i),color:(m.pbrMetallicRoughness?.baseColorFactor??[1,1,1,1]) as ReadMaterial['color'],metallic:m.pbrMetallicRoughness?.metallicFactor??1,roughness:m.pbrMetallicRoughness?.roughnessFactor??1,doubleSided:!!m.doubleSided}));
 let fallback=-1;const fallbackMaterial=()=>{if(fallback<0){fallback=materials.length;materials.push({name:'default',color:[0.8,0.8,0.8,1],metallic:0,roughness:1,doubleSided:false});}return fallback;};
 const scene=json.scenes?.[json.scene??0],used=new Map<string,number>();
 const visit=(index:number,parent:Matrix)=>{
  const node=json.nodes[index],local=node.matrix?Float64Array.from(node.matrix):compose(node.translation,node.rotation,node.scale),world=multiply(parent,local);
  if(node.mesh!==undefined){const mesh=json.meshes[node.mesh],n=normalMatrix(world);
   mesh.primitives.forEach((p:any,pi:number)=>{
    if((p.mode??4)!==4||p.attributes.POSITION===undefined)return;
    const pos=accessor(json,bin,p.attributes.POSITION).values,count=pos.length/3,positions=new Float64Array(count*3);
    for(let v=0;v<count;v++){const x=pos[v*3]!,y=pos[v*3+1]!,z=pos[v*3+2]!;for(let r=0;r<3;r++)positions[v*3+r]=world[r]!*x+world[4+r]!*y+world[8+r]!*z+world[12+r]!;}
    let normals:Float64Array|null=null;if(p.attributes.NORMAL!==undefined){const src=accessor(json,bin,p.attributes.NORMAL).values;normals=new Float64Array(count*3);for(let v=0;v<count;v++){const x=src[v*3]!,y=src[v*3+1]!,z=src[v*3+2]!;let nx=n[0]![0]!*x+n[0]![1]!*y+n[0]![2]!*z,ny=n[1]![0]!*x+n[1]![1]!*y+n[1]![2]!*z,nz=n[2]![0]!*x+n[2]![1]!*y+n[2]![2]!*z;const l=Math.hypot(nx,ny,nz)||1;normals[v*3]=nx/l;normals[v*3+1]=ny/l;normals[v*3+2]=nz/l;}}
    const uvs=p.attributes.TEXCOORD_0!==undefined?accessor(json,bin,p.attributes.TEXCOORD_0).values:null;
    let indices:Uint32Array;if(p.indices!==undefined)indices=Uint32Array.from(accessor(json,bin,p.indices).values);else indices=Uint32Array.from({length:count},(_,i)=>i);
    const determinant=world[0]!*(world[5]!*world[10]!-world[6]!*world[9]!)-world[4]!*(world[1]!*world[10]!-world[2]!*world[9]!)+world[8]!*(world[1]!*world[6]!-world[2]!*world[5]!);
    if(determinant<0)for(let t=0;t<indices.length;t+=3){const s=indices[t+1]!;indices[t+1]=indices[t+2]!;indices[t+2]=s;}
    let base=String(node.name||mesh.name||'mesh').replace(/[^A-Za-z0-9_]/g,'_')||'mesh';if(/^[0-9]/.test(base))base='m_'+base;if(mesh.primitives.length>1)base+='_'+pi;
    const seen=used.get(base)??0;used.set(base,seen+1);
    meshes.push({name:seen?base+'_'+seen:base,positions,normals,uvs,indices,material:p.material??fallbackMaterial()});
   });
  }
  for(const child of node.children??[])visit(child,world);
 };
 for(const root of scene?.nodes??[])visit(root,identity());
 return {meshes,materials,skinned:!!json.skins?.length,animated:!!json.animations?.length,textured:!!json.textures?.length};
}
export function bounds(scene:Pick<ReadScene,'meshes'>){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const m of scene.meshes)for(let i=0;i<m.positions.length;i+=3)for(let c=0;c<3;c++){min[c]=Math.min(min[c]!,m.positions[i+c]!);max[c]=Math.max(max[c]!,m.positions[i+c]!);}return {min,max};}
