export type ModelStats={triangles:number;materials:number;size:[number,number,number]};
type Node={mesh?:number;children?:number[];matrix?:number[];translation?:number[];rotation?:number[];scale?:number[]};
type Accessor={count:number;min?:number[];max?:number[]};
type Primitive={attributes:{POSITION?:number};indices?:number;mode?:number};
type Gltf={scene?:number;scenes?:{nodes?:number[]}[];nodes?:Node[];meshes?:{primitives:Primitive[]}[];accessors?:Accessor[];materials?:unknown[]};
type Matrix=number[];
const identity=():Matrix=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function multiply(a:Matrix,b:Matrix){const out=new Array<number>(16).fill(0);for(let column=0;column<4;column++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)out[column*4+row]!+=a[k*4+row]!*b[column*4+k]!;return out;}
function local(node:Node):Matrix{
 if(node.matrix?.length===16)return node.matrix;
 const [x=0,y=0,z=0,w=1]=node.rotation??[],[sx=1,sy=1,sz=1]=node.scale??[],[tx=0,ty=0,tz=0]=node.translation??[];
 return [(1-2*(y*y+z*z))*sx,2*(x*y+z*w)*sx,2*(x*z-y*w)*sx,0,2*(x*y-z*w)*sy,(1-2*(x*x+z*z))*sy,2*(y*z+x*w)*sy,0,2*(x*z+y*w)*sz,2*(y*z-x*w)*sz,(1-2*(x*x+y*y))*sz,0,tx,ty,tz,1];
}
export function readGltfJson(bytes:Uint8Array):Gltf{
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(bytes.length<20||view.getUint32(0,true)!==0x46546c67||view.getUint32(16,true)!==0x4e4f534a)throw Error('not_glb');
 const length=view.getUint32(12,true);if(20+length>bytes.length)throw Error('truncated_glb');
 return JSON.parse(new TextDecoder().decode(bytes.subarray(20,20+length))) as Gltf;
}
export function glbStats(bytes:Uint8Array):ModelStats{
 const gltf=readGltfJson(bytes),nodes=gltf.nodes??[],accessors=gltf.accessors??[],meshes=gltf.meshes??[];
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];let triangles=0;
 const visit=(index:number,parent:Matrix,depth:number)=>{
  const node=nodes[index];if(!node||depth>64)return;const world=multiply(parent,local(node));
  for(const primitive of node.mesh===undefined?[]:meshes[node.mesh]?.primitives??[]){
   const mode=primitive.mode??4,position=primitive.attributes.POSITION===undefined?undefined:accessors[primitive.attributes.POSITION],count=primitive.indices===undefined?position?.count??0:accessors[primitive.indices]?.count??0;
   if(mode===4)triangles+=Math.floor(count/3);else if(mode===5||mode===6)triangles+=Math.max(0,count-2);
   if(!position?.min||!position.max)continue;
   for(let corner=0;corner<8;corner++){const p=[corner&1?position.max[0]!:position.min[0]!,corner&2?position.max[1]!:position.min[1]!,corner&4?position.max[2]!:position.min[2]!];for(let axis=0;axis<3;axis++){const value=world[axis]!*p[0]!+world[4+axis]!*p[1]!+world[8+axis]!*p[2]!+world[12+axis]!;min[axis]=Math.min(min[axis]!,value);max[axis]=Math.max(max[axis]!,value);}}
  }
  for(const child of node.children??[])visit(child,world,depth+1);
 };
 const roots=gltf.scenes?.[gltf.scene??0]?.nodes??nodes.map((_,index)=>index);
 for(const root of roots)visit(root,identity(),0);
 const size=[0,1,2].map(axis=>Number.isFinite(min[axis]!)?Math.round((max[axis]!-min[axis]!)*100)/100:0) as [number,number,number];
 return {triangles,materials:gltf.materials?.length??0,size};
}
