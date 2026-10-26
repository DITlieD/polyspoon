import './node-platform.ts';
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Mesh,Vector3} from 'three';
import {buildAsset,disposeAsset} from '../src/catalog/index.ts';
import {exportAsset} from '../src/catalog/export.ts';
import {validateBytes} from 'gltf-validator';
const rows=[];
for(const [name,family,input] of [
 ['lantern-default','work-lantern',{}],
 ['lantern-wide-low','work-lantern',{bodyWidth:.44,bodyHeight:.18,handleClearance:.075,hoodFlare:.3}],
 ['boulder-default','boulder',{}]
] as const){
 const b=buildAsset(family,input);
 try{
  const bytes=await exportAsset(b),validation=await validateBytes(bytes);
  if(validation.issues.numErrors||validation.issues.numWarnings)throw new Error(JSON.stringify(validation.issues));
  await writeFile('evidence/revision4/physical-repair/'+name+'.glb',bytes);
  let moss;
  if(family==='boulder'){
   const mesh=b.root.getObjectByName('moss-region') as Mesh,p=mesh.geometry.getAttribute('position'),direction=new Vector3(2.7,1.85,3.5).normalize();
   let visible=0,total=0;
   for(let i=0;i<p.count;i+=3){
    const a=new Vector3().fromBufferAttribute(p,i),v=new Vector3().fromBufferAttribute(p,i+1),c=new Vector3().fromBufferAttribute(p,i+2),n=v.sub(a).cross(c.sub(a)),area=n.length()/2;
    total+=area;if(n.normalize().dot(direction)>.15)visible+=area;
   }
   moss={visibleAreaRatio:visible/total,visibleArea:visible,totalArea:total,patches:mesh.userData.patches.length};
  }
  rows.push({name,configuration:b.config,handleGap:b.handleGap,moss,sha256:createHash('sha256').update(bytes).digest('hex'),validation:{errors:validation.issues.numErrors,warnings:validation.issues.numWarnings}});
 }finally{disposeAsset(b);}
}
await writeFile('evidence/revision4/physical-repair/measurements.json',JSON.stringify(rows,null,2));
console.log(JSON.stringify(rows.map(({name,handleGap,moss,validation})=>({name,handleGap,moss,validation}))));
