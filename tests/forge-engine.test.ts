import test from 'node:test';
import assert from 'node:assert/strict';
import '../scripts/node-platform.ts';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {Mesh,Vector3} from 'three';
import {validateBytes} from 'gltf-validator';
import {buildAsset,disposeAsset} from '../src/catalog/index.ts';
import {exportDeliverable} from '../src/catalog/delivery.ts';
import {recipe,registry,catalogCategories} from '../src/recipes/index.ts';
import {forgeRecipes} from '../src/recipes/forge.ts';
import {convertGlbReport,readGlb} from '../src/formats/index.ts';
import {geometryQa,nearDuplicate} from '../src/formats/qa.ts';
import {planJobs,explicitJobs,scaleProblem} from '../scripts/forge-batch.ts';

function glb(json:any,bin:Uint8Array){
 const pad=(b:Uint8Array,fill:number)=>{const o=new Uint8Array(Math.ceil(b.length/4)*4).fill(fill);o.set(b);return o;};
 const j=pad(new TextEncoder().encode(JSON.stringify(json)),0x20),b=pad(bin,0),out=new Uint8Array(28+j.length+b.length),v=new DataView(out.buffer);
 v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true);v.setUint32(8,out.length,true);v.setUint32(12,j.length,true);v.setUint32(16,0x4e4f534a,true);out.set(j,20);
 v.setUint32(20+j.length,b.length,true);v.setUint32(24+j.length,0x004e4942,true);out.set(b,28+j.length);return out;
}
// Closed tetrahedron (positive volume) as indexed triangles; `lift` moves it off the ground.
function tetra(lift=0,extra:number[]=[]){
 const p=new Float32Array([0,lift,0, 1,lift,0, 0,lift,1, 0,1+lift,0]),idx=new Uint16Array([0,1,2, 0,3,1, 0,2,3, 1,3,2,...extra]);
 const bin=new Uint8Array(p.byteLength+idx.byteLength+((idx.byteLength%4)?2:0));bin.set(new Uint8Array(p.buffer),0);bin.set(new Uint8Array(idx.buffer),p.byteLength);
 return glb({asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0,name:'t'}],meshes:[{primitives:[{attributes:{POSITION:0},indices:1}]}],
  accessors:[{bufferView:0,componentType:5126,count:4,type:'VEC3',min:[0,lift,0],max:[1,1+lift,1]},{bufferView:1,componentType:5123,count:idx.length,type:'SCALAR'}],
  bufferViews:[{buffer:0,byteOffset:0,byteLength:p.byteLength},{buffer:0,byteOffset:p.byteLength,byteLength:idx.byteLength}],buffers:[{byteLength:bin.length}]},bin);
}

test('geometry QA passes a closed grounded solid and flags lift, non-manifold, degenerate and budget failures',()=>{
 const ok=geometryQa(tetra(),{category:'Props'});assert.equal(ok.ok,true,ok.errors.join());assert.equal(ok.openEdges,0);assert.equal(ok.nonManifoldEdges,0);
 assert.match(geometryQa(tetra(0.2),{category:'Props'}).errors.join(),/not grounded/);
 const flipped=geometryQa(tetra(0,[]).map(x=>x),{category:'Props'});assert.equal(flipped.invertedMeshes.length,0);
 const fin=geometryQa(tetra(0,[0,1,2]),{category:'Props'});assert.ok(fin.nonManifoldEdges>0);assert.equal(fin.ok,false);
 assert.match(geometryQa(tetra(0,[0,0,1]),{category:'Props'}).errors.join(),/degenerate/);
 assert.match(geometryQa(tetra(),{category:'Nope'}).errors.join(),/no budget/);
 assert.equal(nearDuplicate(ok.signature,{...ok.signature}),true);
 assert.equal(nearDuplicate(ok.signature,{...ok.signature,dimensions:[2,1,1]}),false);
});

test('every forge family builds, validates with zero glTF issues and passes the QA gate across validation cases',async()=>{
 assert.ok(forgeRecipes.length>=5);
 for(const r of forgeRecipes){
  for(const c of r.validationCases){
   const b=buildAsset(r.descriptor.id,c.parameters);
   try{
    const bytes=await exportDeliverable(b),v=await validateBytes(bytes,{maxIssues:20});
    assert.equal(v.issues.numErrors+v.issues.numWarnings,0,r.descriptor.id+'/'+c.id+' validator');
    const qa=geometryQa(bytes,{category:r.presentation.category,openEdges:'error'});
    assert.equal(qa.ok,true,r.descriptor.id+'/'+c.id+': '+qa.errors.join('; '));
   }finally{disposeAsset(b);}
  }
 }
});

test('catalog categories are a fixed shelf list and orders are unique',()=>{
 const orders=registry.descriptors.map(d=>recipe(d.id).presentation.order);assert.equal(new Set(orders).size,orders.length);
 for(const d of registry.descriptors)assert.ok((catalogCategories as readonly string[]).includes(recipe(d.id).presentation.category),d.id);
});

test('format conversion reports dropped skins and animations for rigged assets and nothing for static props',async()=>{
 const fox=buildAsset('stylized-fox'),barrel=buildAsset('barrel');
 try{
  const foxGlb=await exportDeliverable(fox),barrelGlb=await exportDeliverable(barrel);
  const lost=convertGlbReport(foxGlb,'fbx','fox').dropped.join();assert.match(lost,/skins/);assert.match(lost,/animations/);
  assert.deepEqual(convertGlbReport(barrelGlb,'usdz','barrel').dropped,[]);
 }finally{disposeAsset(fox);disposeAsset(barrel);}
});

test('FBX keeps one geometry with per-polygon materials when a glTF mesh has several primitives',()=>{
 const p=new Float32Array([0,0,0,1,0,0,0,1,0, 2,0,0,3,0,0,2,1,0]);const bin=new Uint8Array(p.buffer);
 const bytes=glb({asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0,name:'two'}],materials:[{name:'a',pbrMetallicRoughness:{baseColorFactor:[1,0,0,1]}},{name:'b',pbrMetallicRoughness:{baseColorFactor:[0,0,1,1]}}],
  meshes:[{primitives:[{attributes:{POSITION:0},material:0},{attributes:{POSITION:1},material:1}]}],
  accessors:[{bufferView:0,byteOffset:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[1,1,0]},{bufferView:0,byteOffset:36,componentType:5126,count:3,type:'VEC3',min:[2,0,0],max:[3,1,0]}],
  bufferViews:[{buffer:0,byteLength:bin.length}],buffers:[{byteLength:bin.length}]},bin);
 assert.equal(readGlb(bytes).meshes.length,2);
 const fbx=convertGlbReport(bytes,'fbx','two').bytes,loaded=new FBXLoader().parse(Uint8Array.from(fbx).buffer,'');
 const meshes:Mesh[]=[];loaded.traverse(o=>{if(o instanceof Mesh)meshes.push(o);});
 assert.equal(meshes.length,1);assert.ok(Array.isArray(meshes[0]!.material));assert.equal((meshes[0]!.material as unknown[]).length,2);
 assert.equal(meshes[0]!.geometry.groups.length,2);
});

test('forge batch plan is deterministic, valid and shardable',()=>{
 const o={families:['barrel','rock-cluster'],presets:['all'],palettes:['all'],variants:2,vary:0.15,shard:[0,1] as [number,number],limit:0};
 const a=planJobs(o),b=planJobs(o);assert.deepEqual(a,b);assert.ok(a.length>=20);
 for(const j of a)recipe(j.family).descriptor.save(j.parameters);
 assert.equal(new Set(a.map(j=>j.family+'/'+j.slug)).size,a.length);
 const s0=planJobs({...o,shard:[0,2]}),s1=planJobs({...o,shard:[1,2]});assert.equal(s0.length+s1.length,a.length);
 assert.ok(s0.every(j=>!s1.some(k=>k.family===j.family&&k.slug===j.slug)));
});

test('dedupe scans bare GLB folders, silhouettes catch proportion-only variants, and variants respect QA limits',async()=>{
 const {mkdtemp,mkdir,writeFile}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join}=await import('node:path');
 const {priorEntries,withinLimits}=await import('../scripts/forge-batch.ts');
 const root=await mkdtemp(join(tmpdir(),'forge-scan-')),a=buildAsset('barrel'),b=buildAsset('barrel',{height:0.93}),c=buildAsset('barrel',{height:1.3,radius:0.5,bulge:0});
 try{
  const ga=await exportDeliverable(a);await mkdir(join(root,'assets','barrel'),{recursive:true});await writeFile(join(root,'assets','barrel','model.glb'),ga);
  const found=await priorEntries([root]);assert.equal(found.length,1);assert.equal(found[0]!.family,'barrel');
  const sa=geometryQa(ga,{category:'Props'}).signature,sb=geometryQa(await exportDeliverable(b),{category:'Props'}).signature,sc=geometryQa(await exportDeliverable(c),{category:'Props'}).signature;
  assert.equal(sa.silhouettes?.length,3);assert.equal(nearDuplicate(sa,sb),true,'3% taller barrel is a visual duplicate');assert.equal(nearDuplicate(sa,sc),false);
 }finally{disposeAsset(a);disposeAsset(b);disposeAsset(c);}
 assert.equal(withinLimits('barrel',{}),true);
});

test('work-lantern carry hoop is a closed manifold tube',async()=>{
 for(const preset of recipe('work-lantern').descriptor.presets){const b=buildAsset('work-lantern',preset.parameters);try{const qa=geometryQa(await exportDeliverable(b),{category:'Props'});assert.equal(qa.nonManifoldEdges,0,preset.id);assert.equal(qa.ok,true,preset.id+': '+qa.errors.join());}finally{disposeAsset(b);}}
});

test('partial --config accepts requested values only and explains bad input',async()=>{
 const {resolveExport}=await import('../src/catalog/index.ts');
 assert.deepEqual(resolveExport({},{family:'barrel',height:1.1}).input,{height:1.1});
 assert.deepEqual(resolveExport({family:'barrel'},{requested:{hoops:2}}).input,{hoops:2});
 assert.throws(()=>resolveExport({},{height:1}),/needs a family/);
 assert.throws(()=>resolveExport({family:'barrel'},{heigth:1}),/Unknown barrel parameter.*heigth.*Known: height/);
 assert.throws(()=>resolveExport({family:'barrel'},{height:9}),/height allows 0.5..1.4/);
});

test('exported GLBs drop TEXCOORD_0 when no texture samples it',async()=>{
 const {parseGlb}=await import('../src/formats/gltf-read.ts');
 for(const id of ['cottage','stylized-fox']){const b=buildAsset(id);try{const {json}=parseGlb(await exportDeliverable(b,{stripUnusedUvs:true}));assert.equal(json.meshes.flatMap((m:any)=>m.primitives).filter((p:any)=>p.attributes.TEXCOORD_0!==undefined).length,0,id);}finally{disposeAsset(b);}}
});

test('render options accept a timeout and retry count',async()=>{
 const {parseRenderOptions}=await import('../scripts/recipe-render.ts');
 const o=parseRenderOptions(['--family','barrel','--out','/tmp/r','--timeout','90000','--retries','3']);assert.equal(o.timeoutMs,90000);assert.equal(o.retries,3);
 assert.throws(()=>parseRenderOptions(['--family','barrel','--out','/tmp/r','--timeout','5']),/--timeout/);
});

test('rigged recipes vary structure, not just scale, and keep valid rigs',async()=>{
 const sig=async(id:string,p:Record<string,unknown>)=>{const b=buildAsset(id,p);try{return geometryQa(await exportDeliverable(b),{category:recipe(id).presentation.category}).signature;}finally{disposeAsset(b);}};
 const fox=await sig('stylized-fox',{}),curled=await sig('stylized-fox',{tailStyle:'curled',earShape:'rounded'});assert.equal(nearDuplicate(fox,curled),false);assert.ok(curled.dimensions[1]>fox.dimensions[1]);
 const human=await sig('stylized-humanoid',{}),robe=await sig('stylized-humanoid',{tunic:'long',hair:'bun',build:'sturdy'});assert.equal(nearDuplicate(human,robe),false);assert.notEqual(robe.triangles,human.triangles);
});

test('forge batch applies a facet-grade floor to boulders',()=>{
 const jobs=planJobs({families:['boulder'],presets:['field'],palettes:['preset'],variants:0,vary:0,shard:[0,1],limit:0});assert.equal(jobs[0]!.parameters.facetGrade,1);
 assert.equal(planJobs({families:['boulder'],presets:['field'],palettes:['preset'],variants:0,vary:0,shard:[0,1],limit:0,facetFloor:0})[0]!.parameters.facetGrade,0);
});

const qaOf=async(family:string,parameters:Record<string,unknown>)=>{const b=buildAsset(family,parameters);try{const bytes=await exportDeliverable(b,{stripUnusedUvs:true});return {qa:geometryQa(bytes,{category:recipe(family).presentation.category}),validation:await validateBytes(bytes,{uri:'m.glb',maxIssues:20}),config:b.config};}finally{disposeAsset(b);}};
test('review fixes: tree palettes reach the crown, boulder stone/moss seams are watertight, monolith pebbles stay close, hipped well is clean',async()=>{
 const [ember]=planJobs({families:['tree'],presets:['young'],palettes:['ember'],variants:0,vary:0,shard:[0,1],limit:0});
 assert.equal(ember!.parameters.colorway,'ember');assert.equal(ember!.parameters['color.foliage'],'#a0894c');
 const boulder=await qaOf('boulder',{form:'field',moss:'top',mossCoverage:0.75,seed:3131});
 assert.ok(boulder.qa.openEdges>0);assert.equal(boulder.qa.combinedOpenEdges,0);assert.equal(boulder.qa.warnings.some(w=>/open boundary/.test(w)),false);
 const monolith=await qaOf('rock-cluster',{count:1,size:2.8,flatness:1.2,pebbles:8,colorway:'mossy',seed:9}),dims=monolith.qa.bounds.max.map((v,i)=>v-monolith.qa.bounds.min[i]!);
 assert.ok(Math.max(dims[0]!,dims[2]!)<3.6,'monolith footprint '+dims.join('x'));
 const well=await qaOf('stone-well',{roofStyle:'hipped'});assert.equal(well.qa.errors.length,0,well.qa.errors.join());assert.equal(well.validation.issues.numErrors+well.validation.issues.numWarnings,0);
});
test('forge-batch --jobs validates explicit jobs and the family scale check flags wolf-sized foxes',()=>{
 assert.throws(()=>explicitJobs([{family:'nope',slug:'x'}]),/unknown family/);
 assert.throws(()=>explicitJobs([{family:'boulder',slug:'a',parameters:{width:99}}]));
 assert.equal(explicitJobs([{family:'boulder',slug:'a',replaces:'batch1/boulder-a'}])[0]!.replaces,'batch1/boulder-a');
 assert.match(scaleProblem('stylized-fox',{min:[0,0,0],max:[0.25,0.66,1.92]})!,/nose-to-tail/);
 assert.equal(scaleProblem('stylized-fox',{min:[0,0,0],max:[0.2,0.52,1.14]}),undefined);
 assert.match(scaleProblem('stylized-humanoid',{min:[0,0,0],max:[1,2.1,0.5]})!,/standing height/);
});
test('hipped stone-well roof: nothing pierces the slate cap across the size range',()=>{
 for(const diameter of [1.8,2.5,3.2])for(const roofSize of [1.15,1.35,1.6])for(const wallHeight of [0.65,1.4]){
  const b=buildAsset('stone-well',{roofStyle:'hipped',diameter,roofSize,wallHeight});
  try{
   b.root.updateMatrixWorld(true);const cap=b.root.getObjectByName('roof-cap') as Mesh;cap.geometry.computeBoundingBox();
   const box=cap.geometry.boundingBox!.clone().applyMatrix4(cap.matrixWorld),y0=box.min.y,y1=box.max.y,wx=(box.max.x-box.min.x)/2,wz=(box.max.z-box.min.z)/2;
   b.root.traverse(o=>{if(!(o instanceof Mesh)||o.name==='roof-cap'||o.name==='roof-finial')return;const pos=o.geometry.attributes.position!,v=new Vector3();
    for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i).applyMatrix4(o.matrixWorld);if(v.y<=y0+1e-6||Math.abs(v.x)>wx||Math.abs(v.z)>wz)continue;
     assert.ok((v.y-y0)/(y1-y0)<=1-Math.max(Math.abs(v.x)/wx,Math.abs(v.z)/wz)+1e-6,o.name+' pierces the cap at '+v.toArray().map(n=>n.toFixed(3))+' d='+diameter+' r='+roofSize);}});
  }finally{disposeAsset(b);}
 }
});
test('near-duplicate gate catches rigged recolours and rescales but not structural variants',async()=>{
 const sig=async(family:string,parameters:Record<string,unknown>)=>{const b=buildAsset(family,parameters);try{return geometryQa(await exportDeliverable(b,{stripUnusedUvs:true}),{category:recipe(family).presentation.category}).signature;}finally{disposeAsset(b);}};
 const fox=await sig('stylized-fox',{}),human=await sig('stylized-humanoid',{});
 assert.equal(fox.rigged,true);
 assert.equal(nearDuplicate(fox,await sig('stylized-fox',{bodyLength:0.5,'color.fur':'#6b6a70'})),true);
 assert.equal(nearDuplicate(human,await sig('stylized-humanoid',{height:1.35,'color.tunic':'#3f6b8a'})),true);
 assert.equal(nearDuplicate(fox,await sig('stylized-fox',{build:'lean',tailStyle:'sweep',heightRatio:0.62,earRatio:0.58})),false);
 assert.equal(nearDuplicate(human,await sig('stylized-humanoid',{build:'sturdy',hair:'crest',height:1.88})),false);
});
import {coplanarOverlaps,floatingParts} from '../src/formats/overlap.ts';
import {Box3} from 'three';
test('visual-defect detectors flag coplanar mixed-material overlaps and floating parts',()=>{
 const quad=(name:string,material:number,y:number,x0:number)=>({name,material,positions:Float64Array.of(x0,y,0,x0+1,y,0,x0+1,y,1,x0,y,1),indices:Uint32Array.of(0,2,1,0,3,2)});
 assert.equal(coplanarOverlaps({meshes:[quad('a',0,1,0),quad('b',1,1,0.5)]} as never).length,1);
 assert.equal(coplanarOverlaps({meshes:[quad('a',0,1,0),quad('b',0,1,0.5)]} as never).length,1,'same-material overlaps z-fight too (cottage-b plaster)');
 assert.equal(coplanarOverlaps({meshes:[quad('a',0,1,0),quad('b',1,1.01,0.5)]} as never).length,0);
 assert.deepEqual(floatingParts({meshes:[quad('ground',0,0,0),quad('hover',0,0.5,3)]} as never).map(p=>p.part),['hover']);
});
test('review round 3 configurations: no roof piercing, z-fighting or floating parts; ties seat on their members',async()=>{
 const cases:[string,Record<string,unknown>][]=[['cottage',{width:3.6,depth:3.2,wallHeight:2.5,roofRise:1.15,colorway:'harbor',windowLayout:'sparse',shutters:true}],['crate',{}],['tree',{height:3,spread:2.4,growth:'young',architecture:'upright',branchCount:2,canopyFullness:0.86,forkHeight:0.4,trunkGirth:0.15,lean:0.025,seed:18}],['fence',{length:4.8,height:1.4,bays:3,railStyle:'cross-braced',railCount:4,memberWeight:'stout'}]];
 for(const [family,parameters] of cases){const q=await qaOf(family,parameters);assert.equal(q.qa.zFight.length,0,family+' '+q.qa.zFight.map(o=>o.a+'/'+o.b).join());assert.equal(q.qa.floating.length,0,family+' '+q.qa.floating.join());}
 const fence=buildAsset('fence',{length:4.8,height:1.4,bays:3,railStyle:'cross-braced'});
 try{const post=new Box3().setFromObject(fence.root.getObjectByName('post-0')!),brace=new Box3().setFromObject(fence.root.getObjectByName('brace-0')!);assert.ok(brace.min.z>=post.min.z-1e-6,'brace stays inside the post depth');}finally{disposeAsset(fence);}
 const lantern=buildAsset('work-lantern',{construction:'rustic',guardLayout:'crossbar',guardCount:6,bodyWidth:0.24,bodyHeight:0.32,enclosureProfile:'square'});
 try{const bar=new Box3().setFromObject(lantern.root.getObjectByName('guard-crossbar-1')!),uprights=lantern.root.children.filter(o=>o.name.startsWith('guard-upright-')).map(o=>new Box3().setFromObject(o));
  assert.ok(uprights.filter(u=>u.intersectsBox(bar)).length>=2,'crossbar ties into two uprights');}finally{disposeAsset(lantern);}
});
test('z-fight detector compares planes locally (tilted near-parallel shells are not coplanar) and round 4 families are clean',async()=>{
 const tri=(name:string,material:number,z:(x:number,y:number)=>number)=>({name,material,positions:Float64Array.of(10,0,z(10,0),11,0,z(11,0),10,1,z(10,1)),indices:Uint32Array.of(0,1,2)});
 // Same origin offset d, but 1.5° apart: 5 mm separation at x=10 m.
 assert.equal(coplanarOverlaps({meshes:[tri('a',0,()=>0),tri('b',1,x=>x*0.026-0.26+0.005)]} as never).length,0);
 assert.equal(coplanarOverlaps({meshes:[tri('a',0,()=>0),tri('b',1,()=>0.0001)]} as never).length,1);
 const cases:[string,Record<string,unknown>][]=[['crate',{width:0.8,height:1.15,depth:0.8,plankCourses:6,slatGap:0.024,lid:'open-top',frameWeight:'light'}],['bench',{}],['planter',{}],['stone-well',{}],['stylized-humanoid',{height:1.35,headRatio:0.21,shoulderRatio:0.3,legRatio:0.44}]];
 for(const [family,parameters] of cases){const q=await qaOf(family,parameters);assert.equal(q.qa.zFight.length,0,family+' '+q.qa.zFight.map(o=>o.a+'/'+o.b).join());assert.equal(q.qa.floating.length,0,family);}
});
test('dedupe ignores candidates already superseded in their folder index',async()=>{
 const {priorEntries}=await import('../scripts/forge-batch.ts');const {mkdtemp,mkdir,writeFile,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const root=await mkdtemp(join(tmpdir(),'forge-sup-'));
 try{const b=buildAsset('crate',{});const bytes=await exportDeliverable(b);disposeAsset(b);const b2=buildAsset('crate',{width:1.1});const bytes2=await exportDeliverable(b2);disposeAsset(b2);
  for(const [n,by] of [['old',bytes],['live',bytes2]] as const){await mkdir(join(root,'assets',n),{recursive:true});await writeFile(join(root,'assets',n,n+'.glb'),by);}
  await writeFile(join(root,'index.json'),JSON.stringify({assets:[{name:'old',status:'superseded'},{name:'live',status:'prepared-not-submitted'}]}));
  const e=await priorEntries([root]);assert.deepEqual(e.map(x=>[x.slug,x.status]).sort(),[['live.glb','prepared-not-submitted'],['old.glb','superseded']]);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('z-fight detector: 3 mm depth tolerance and coverage measured over the shared region only',()=>{
 const quad=(name:string,material:number,y:number,x0:number,x1:number,flip=false)=>({name,material,positions:Float64Array.of(x0,y,0,x1,y,0,x1,y,1,x0,y,1),indices:flip?Uint32Array.of(0,1,2,0,2,3):Uint32Array.of(0,2,1,0,3,2)});
 // 2 mm apart still z-fights at viewing distance (cottage shutter vs corner post was 1.5 mm).
 assert.equal(coplanarOverlaps({meshes:[quad('a',0,1,0,1),quad('b',1,1.002,0.5,1.5)]} as never).length,1);
 assert.equal(coplanarOverlaps({meshes:[quad('a',0,1,0,1),quad('b',1,1.006,0.5,1.5)]} as never).length,0);
 // A third part touching only the far end of the big face must not hide the a/b overlap in the middle.
 assert.equal(coplanarOverlaps({meshes:[quad('a',0,1,0,3),quad('b',1,1,1,2),quad('c',2,1,2.5,3,true)]} as never).length,1);
 // A cover over the whole shared region still hides it (internal contact).
 assert.equal(coplanarOverlaps({meshes:[quad('a',0,1,0,3),quad('b',1,1,1,2),quad('c',2,1,0.9,2.1,true)]} as never).length,0);
});

test('round 6 detector misses: same-material z-fight, 12 mm gaps, edge-only contact, short rods and hovering straps',()=>{
 const box=(name:string,material:number,[x0,y0,z0]:number[],[x1,y1,z1]:number[])=>({name,material,positions:Float64Array.of(x0!,y0!,z0!,x1!,y0!,z0!,x1!,y1!,z0!,x0!,y1!,z0!,x0!,y0!,z1!,x1!,y0!,z1!,x1!,y1!,z1!,x0!,y1!,z1!),
  indices:Uint32Array.of(0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5)});
 const f=(...meshes:unknown[])=>floatingParts({meshes} as never).map(p=>p.part);
 const base=box('base',0,[0,0,0],[1,0.2,1]);
 // cottage-b: wall panel and pier share the plaster material and are coplanar.
 assert.equal(coplanarOverlaps({meshes:[box('wall',0,[0,0,0],[1,1,0.1]),box('pier',0,[0.8,0,0],[1.2,1,0.1])]} as never).length>0,true);
 // Chimney courses stacked 12 mm apart float (the old 1.5 cm AABB tolerance called them touching).
 assert.deepEqual(f(base,box('course',0,[0.2,0.212,0.2],[0.8,0.4,0.8])),['course']);
 assert.deepEqual(f(base,box('course',0,[0.2,0.2,0.2],[0.8,0.4,0.8])),[],'flush face contact holds');
 assert.deepEqual(f(base,box('course',0,[0.2,0.198,0.2],[0.8,0.4,0.8])),[],'2 mm overlap holds');
 assert.deepEqual(f(base,box('course',0,[0.2,0.2005,0.2],[0.8,0.4,0.8])),['course'],'0.5 mm hover is still a gap');
 // Signpost arm touching the post only along an edge.
 assert.deepEqual(f(box('post',0,[0,0,0],[0.1,2,0.1]),box('arm_0',0,[0.1,1.5,0.1],[0.6,1.6,0.2])),['arm_0']);
 // One open surface split by material (fox muzzle -> dark nose tip) is continuous along its seam, not floating.
 const tube=(name:string,z0:number,z1:number)=>{const ring=(z:number)=>[0,1,2,3].map(k=>[Math.cos(k*Math.PI/2)*0.1,0.5+Math.sin(k*Math.PI/2)*0.1,z]);const a=ring(z0),b=ring(z1);
  return {name,material:0,positions:Float64Array.from([...a.flat(),...b.flat()]),indices:Uint32Array.from([0,1,2,3].flatMap(k=>[k,(k+1)%4,4+k,(k+1)%4,4+(k+1)%4,4+k]))};};
 assert.deepEqual(f(box('leg',0,[-0.05,0,-0.05],[0.05,0.5,0.05]),tube('fur',0,0.3),tube('nose_dark',0.3,0.31)),[]);
 // Wheelbarrow brace: one end embedded in the leg, the other 3 mm short of the handle.
 const leg=box('leg',0,[0,0,0],[0.05,0.6,0.05]),handle=box('handle',0,[0.5,0,0],[0.55,0.6,0.05]);
 assert.deepEqual(f(leg,handle,box('leg_brace',1,[0.03,0.3,0.015],[0.497,0.32,0.035])),['leg_brace:end-b']);
 assert.deepEqual(f(leg,handle,box('leg_brace',1,[0.03,0.3,0.015],[0.507,0.32,0.035])),[],'5 mm+ into both members');
 // Strap with both ends sunk into the tray side but standing 4 mm off it in between.
 const side=box('tray_side',0,[0,0,0],[0.02,0.5,0.6]),bar=(n:string,y:number)=>box(n,0,[-0.04,y,0],[0.02,y+0.04,0.6]);
 const strap=(gap:number)=>({name:'strap_0',material:1,positions:Float64Array.of(-gap-0.008,0.05,0.2,-gap,0.05,0.2,-gap,0.45,0.2,-gap-0.008,0.45,0.2,-gap-0.008,0.05,0.23,-gap,0.05,0.23,-gap,0.45,0.23,-gap-0.008,0.45,0.23),indices:base.indices});
 assert.ok(f(side,bar('rail_a',0.03),bar('rail_b',0.43),strap(0.004)).includes('strap_0:gap'));
 assert.deepEqual(f(side,bar('rail_a',0.03),bar('rail_b',0.43),strap(0)),[],'strap lying on the face');
});

test('emissive forge materials survive OBJ and FBX conversion instead of being reported as dropped',async()=>{
 const b=buildAsset('crystal-cluster',{});
 try{
  const bytes=await exportDeliverable(b),scene=readGlb(bytes);
  assert.ok(scene.materials.some(m=>m.emissive&&m.emissive.some(v=>v>0)),'emissive read from glTF');
  assert.ok(!scene.dropped.some(d=>/emissive/.test(d)),scene.dropped.join());
  const obj=convertGlbReport(bytes,'obj','crystal');assert.equal(obj.dropped.length,0,obj.dropped.join());
  const text=new TextDecoder().decode(obj.bytes);assert.match(text,/\nKe [0-9.]+ [0-9.]+ [0-9.]+/);
  const fbx=new TextDecoder('latin1').decode(convertGlbReport(bytes,'fbx','crystal').bytes);assert.match(fbx,/EmissiveColor/);
 }finally{disposeAsset(b);}
});

test('round 7 detector misses: buried and hovering pieces, shade cards, island-level and tilted coplanar faces, interpenetration',async()=>{
 const {interpenetrations}=await import('../src/formats/overlap.ts');
 const box=(name:string,material:number,[x0,y0,z0]:number[],[x1,y1,z1]:number[])=>({name,material,positions:Float64Array.of(x0!,y0!,z0!,x1!,y0!,z0!,x1!,y1!,z0!,x0!,y1!,z0!,x0!,y0!,z1!,x1!,y0!,z1!,x1!,y1!,z1!,x0!,y1!,z1!),
  indices:Uint32Array.of(0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5)});
 const merged=(name:string,material:number,...boxes:Array<ReturnType<typeof box>>)=>({name,material,positions:Float64Array.from(boxes.flatMap(b=>[...b.positions])),indices:Uint32Array.from(boxes.flatMap((b,k)=>[...b.indices].map(i=>i+k*8)))});
 const f=(...meshes:unknown[])=>floatingParts({meshes} as never).map(p=>p.part);
 const base=box('base',0,[0,0,0],[1,0.2,1]);
 // Toadstool spot / hay tuft: wholly buried inside the cap or hay, never touching its skin (the old depth test called it embedded).
 assert.deepEqual(f(base,box('spot',1,[0.4,0.08,0.4],[0.5,0.12,0.5])),['spot']);
 assert.deepEqual(f(base,box('spot',1,[0.4,0.15,0.4],[0.5,0.25,0.5])),[],'a spot breaking through the skin is seated');
 // Mushroom cap hovering 8 mm over its stem, giant-glowcap 18 mm, weapon-rack shield 2 mm off the ground.
 assert.deepEqual(f(base,box('cap',1,[0.3,0.208,0.3],[0.7,0.3,0.7])),['cap']);
 assert.deepEqual(f(box('shield',1,[0,0.002,0],[0.5,0.5,0.02])),['shield'],'2 mm off the ground is not grounded');
 // Cottage window backing / chimney dark interior 10-100 mm behind the wall: no longer exempt.
 assert.deepEqual(f(box('wall',0,[0,0,0],[1,1,0.1]),box('window_backing',2,[0.3,0.3,0.11],[0.7,0.7,0.12])),['window_backing']);
 // Bamboo culm / pond bloom: overlapping coplanar faces inside ONE part (two islands of one mesh).
 assert.equal(coplanarOverlaps({meshes:[merged('culm',0,box('',0,[0,0,0],[1,1,0.1]),box('',0,[0.5,0,0],[1.5,1,0.1]))]} as never).length>0,true);
 // Planter-c: a splayed post (1° lean) running into its foot; the faces coincide only near the joint.
 const lean=0.016,post={name:'post',material:0,positions:Float64Array.of(0,0.05,0,0.05,0.05,0,0.05+lean*0.8,0.85,0,lean*0.8,0.85,0,0,0.05,0.05,0.05,0.05,0.05,0.05+lean*0.8,0.85,0.05,lean*0.8,0.85,0.05),indices:base.indices};
 assert.equal(coplanarOverlaps({meshes:[post,box('foot',0,[0,0,0],[0.05,0.1,0.05])]} as never).length>0,true);
 // Signpost post foot / stone base bottoms stacked on the ground plane: reported only on request (seen from below).
 const stacked=[box('post',0,[0.4,0,0.4],[0.6,2,0.6]),box('footing',1,[0.2,0,0.2],[0.8,0.3,0.8])];
 assert.equal(coplanarOverlaps({meshes:stacked} as never).length,0);
 assert.equal(coplanarOverlaps({meshes:stacked} as never,{groundBases:true}).length,1);
 // Interpenetration: mushroom caps cutting into each other; a brace running out through the far side of its post.
 const ip=(...meshes:unknown[])=>interpenetrations({meshes} as never).map(o=>o.kind+':'+o.a+'/'+o.b);
 assert.deepEqual(ip(box('cap_0',1,[0,0.3,0],[0.3,0.4,0.3]),box('cap_1',1,[0.25,0.32,0],[0.55,0.42,0.3])),['sibling:cap_0/cap_1']);
 assert.deepEqual(ip(box('cap_0',1,[0,0.3,0],[0.3,0.4,0.3]),box('cap_1',1,[0.31,0.32,0],[0.6,0.42,0.3])),[]);
 const posts=[box('post_a',0,[0,0,0],[0.08,1,0.08]),box('post_b',0,[0.92,0,0],[1,1,0.08])];
 assert.deepEqual(ip(...posts,box('brace',0,[-0.02,0.4,0.02],[1.02,0.45,0.06])),['poke-through:brace/post_a','poke-through:brace/post_b']);
 assert.deepEqual(ip(...posts,box('brace',0,[0.04,0.4,0.02],[0.96,0.45,0.06])),[],'brace ending inside both posts');
});
test('round 8 layout detectors: loose items piercing or overhanging their holder, deck steps and gaps, short leaning feet',async()=>{
 const {layoutDefects}=await import('../src/formats/overlap.ts');
 const box=(name:string,material:number,[x0,y0,z0]:number[],[x1,y1,z1]:number[])=>({name,material,positions:Float64Array.of(x0!,y0!,z0!,x1!,y0!,z0!,x1!,y1!,z0!,x0!,y1!,z0!,x0!,y0!,z1!,x1!,y0!,z1!,x1!,y1!,z1!,x0!,y1!,z1!),
  indices:Uint32Array.of(0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5)});
 // A square beam from a to b (in the y-z plane), half-width h.
 const beam=(name:string,a:number[],b:number[],h:number)=>{const dy=b[1]!-a[1]!,dz=b[2]!-a[2]!,l=Math.hypot(dy,dz),ny=-dz/l*h,nz=dy/l*h,c:number[]=[];
  for(const [p] of [[a],[b]] as number[][][])for(const [sx,sn] of [[-h,-1],[h,-1],[h,1],[-h,1]])c.push(p![0]!+sx!,p![1]!+ny*sn!,p![2]!+nz*sn!);
  return {name,material:0,positions:Float64Array.from(c),indices:Uint32Array.of(0,1,2,0,2,3,4,6,5,4,7,6,0,4,5,0,5,1,1,5,6,1,6,2,2,6,7,2,7,3,3,7,4,3,4,0)};};
 const kinds=(...meshes:unknown[])=>layoutDefects({meshes} as never).map(o=>o.kind+':'+o.a+(o.b?'/'+o.b:''));
 // Library: a leaning end book's corner comes out through the case side; inside the side it is fine.
 const side=box('side_r',0,[0.6,0,0],[0.625,1,0.3]);
 assert.deepEqual(kinds(side,box('book_20',1,[0.55,0.1,0.05],[0.64,0.4,0.25])),['pierce:book_20/side_r']);
 assert.deepEqual(kinds(side,box('book_20',1,[0.5,0.1,0.05],[0.59,0.4,0.25])),[]);
 // Royal lab: a flask wider than its rack shelf overhangs the front edge.
 const shelf=box('rack_shelf_0',0,[-0.5,1,0],[0.5,1.02,0.15]);
 assert.deepEqual(kinds(shelf,box('bottle_3',1,[0,1.017,0.1],[0.08,1.2,0.18])),['overhang:bottle_3/rack_shelf_0']);
 assert.deepEqual(kinds(shelf,box('bottle_3',1,[0,1.017,0.03],[0.08,1.2,0.11])),[]);
 // Jetty: one board 8 mm proud is a trip step, a missing board a gap; a level, continuous deck is clean.
 const deck=(raise:number,skip:number)=>Array.from({length:10},(_,k)=>k).filter(k=>k!==skip).map(k=>box('plank_0_'+k,2,[-0.8,1.24+(k===5?raise:0),k*0.2],[0.8,1.3+(k===5?raise:0),k*0.2+0.175]));
 assert.deepEqual(kinds(...deck(0,-1)),[]);
 assert.deepEqual(kinds(...deck(0.008,-1)),['step:plank_0_4/plank_0_5','step:plank_0_5/plank_0_6']);
 assert.deepEqual(kinds(...deck(0,3)),['gap:plank_0_2/plank_0_4']);
 // Post mill: a ladder stile whose foot stops 30 mm above the ground with nothing under it.
 const body=box('body',0,[-1,1.8,-1],[1,3,0]);
 assert.deepEqual(kinds(body,beam('ladder_stile_l',[0,0.03+0.04,-2],[0,2,-0.5],0.04)),['short-foot:ladder_stile_l']);
 assert.deepEqual(kinds(body,beam('ladder_stile_l',[0,0.03+0.04,-2],[0,2,-0.5],0.04),box('pad',0,[-0.2,0,-2.3],[0.2,0.05,-1.7])),[]);
});
