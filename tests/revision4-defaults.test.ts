import {buildPriorAsset} from './historical-public.ts';
import '../scripts/node-platform.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Mesh,Vector3} from 'three';
import {buildAsset,disposeAsset,descriptor,loadDesign} from '../src/catalog/index.ts';
import {saveFamilyConfiguration as oldFamily} from '../src/families/revision3-config.ts';
import {saveConfiguration as oldLantern} from '../src/lantern/revision3-config.ts';
const size=(o:Mesh)=>new Box3().setFromObject(o,true).getSize(new Vector3());
test('revision4 defaults and frozen migration preserve prior intent',()=>{
 for(const f of ['cottage','tree','fence','crate','boulder','work-lantern']){
  assert.equal(descriptor(f).version,'0.6.0');
  const old=f==='work-lantern'?oldLantern({}):oldFamily(f as 'crate',{});
  const next=loadDesign(old);assert.equal(next.familyVersion,'0.6.0');
  for(const [k,v] of Object.entries(old.applied))assert.equal(next.applied[k],v,k);
  if(f==='work-lantern')assert.equal(next.applied.construction,'utility');
  const bad=structuredClone(old);bad.applied['unexpected']=true;assert.throws(()=>loadDesign(bad));
 }
 assert.equal(descriptor('crate').defaults.lid,'open-top');
 assert.equal(descriptor('tree').defaults.branchCount,3);
 assert.equal(descriptor('boulder').defaults.form,'field');
 assert.equal(descriptor('work-lantern').defaults.construction,'rustic');
});
test('tree default gives the main crown dominant volume',()=>{
 const b=buildAsset('tree');try{
  const main=size(b.root.getObjectByName('crown-main') as Mesh);const volume=main.x*main.y*main.z;
  for(const o of b.root.children.filter(o=>o.name.startsWith('crown-')&&o.name!=='crown-main')){
   const s=size(o as Mesh);assert.ok(volume>s.x*s.y*s.z*1.6);
  }
 }finally{disposeAsset(b);}
});
test('produce crate posts project above open rim',()=>{
 const b=buildAsset('crate');try{
  assert.ok(!b.root.children.some(o=>o.name.startsWith('lid-plank')));
  const post=new Box3().setFromObject(b.root.getObjectByName('corner-1-1')!,true);
  const rim=new Box3().setFromObject(b.root.getObjectByName('face-rim-1-true')!,true);
  assert.ok(post.max.y-rim.max.y>.015);
 }finally{disposeAsset(b);}
});
test('field boulder has several supported moss patches and independent facet grade in the preserved 0.5 module',async()=>{
 const counts=[];
 for(const facetGrade of [0,2]){
  const b=await buildPriorAsset('boulder',{facetGrade});try{
   const stone=b.root.getObjectByName('stone-mass') as Mesh;
   counts.push(stone.userData.majorFaces.length);
   const patches=b.root.getObjectByName('moss-region')!.userData.patches;
   assert.ok(patches.length>=3);assert.ok(patches.every((p:any)=>p.vertices.length>=4));
   assert.ok(Math.abs(b.bounds.min.y)<1e-6);
  }finally{disposeAsset(b);}
 }
 assert.notEqual(counts[0],counts[1]);
});
test('rustic lantern has reservoir vent cap and oval hoop while utility remains',()=>{
 for(const construction of ['rustic','utility']){
  const b=buildAsset('work-lantern',{construction});try{
   assert.ok(b.root.getObjectByName('handle'));
   assert.equal(Boolean(b.root.getObjectByName('oil-reservoir')),construction==='rustic');
   if(construction==='rustic')assert.ok(b.root.getObjectByName('vented-cap'));
  }finally{disposeAsset(b);}
 }
});
test('timber tints remain normalized through actual GLB export',async()=>{
 const {exportAsset}=await import('../src/catalog/export.ts');
 const {validateBytes}=await import('gltf-validator');
 for(const family of ['fence','crate','cottage']){
  const b=buildAsset(family,{weathering:1,toneVariation:.12});
  try{
   let colored=0;b.root.traverse(o=>{if(o instanceof Mesh){const c=o.geometry.getAttribute('color');if(c){colored++;for(const v of c.array)assert.ok(v>=0&&v<=1);}}});
   assert.ok(colored>0);const result=await validateBytes(await exportAsset(b));
   assert.equal(result.issues.numErrors,0,JSON.stringify(result.issues));
   assert.equal(result.issues.numWarnings,0,JSON.stringify(result.issues));
  }finally{disposeAsset(b);}
 }
});
test('fence caps occupy only the post head',()=>{
 const b=buildAsset('fence');try{
  const cap=new Box3().setFromObject(b.root.getObjectByName('post-cap-0')!,true);
  assert.ok(cap.min.y>Number(b.config.applied.height)*.85);
 }finally{disposeAsset(b);}
});
test('historical dominant tree crown is vertically full and moss boundaries are irregular polygons',async()=>{
 const tree=await buildPriorAsset('tree'),rock=await buildPriorAsset('boulder');
 try{
  const crown=size(tree.root.getObjectByName('crown-main') as Mesh);assert.ok(crown.y/crown.x>.9);
  assert.ok(rock.root.getObjectByName('moss-region')!.userData.patches.every((p:any)=>p.vertices.length>=5&&p.vertices.length<=7));
 }finally{disposeAsset(tree);disposeAsset(rock);}
});
test('new controls alter their declared output and conditional controls disclose inactivity',async()=>{
 const {geometrySnapshot,inspectGeometry}=await import('../src/lantern/inspect.ts');
 const changes:Array<[string,string,unknown,unknown,string]>=[
  ...['fence','crate','cottage'].flatMap(f=>[[f,'weathering',0,1,'geometry'],[f,'timberTone',0,1,'material'],[f,'toneVariation',0,.12,'material']] as Array<[string,string,unknown,unknown,string]>),
  ['cottage','beamSection',.7,1.4,'geometry'],['cottage','ridgeSag',.25,1.15,'geometry'],
  ['tree','season','spring','autumn','material'],['tree','branchCount',2,5,'geometry'],['tree','architecture','spreading','upright','geometry'],
  ['boulder','facetGrade',0,2,'geometry'],['boulder','burialDepth',0,.4,'geometry'],['boulder','mossCoverage',.2,.8,'geometry'],
  ['work-lantern','construction','utility','rustic','geometry'],['work-lantern','carryHoop','round','tall','geometry'],['work-lantern','hoodRise',.75,1.25,'geometry']
 ];
 const material=(b:ReturnType<typeof buildAsset>)=>{
  const colors:unknown[]=[];b.root.traverse(o=>{if(o instanceof Mesh)colors.push(o.name,o.material.color?.getHexString(),Array.from(o.geometry.getAttribute('color')?.array??[]));});return colors;
 };
 for(const [family,key,lo,hi,kind] of changes){
  const a=buildAsset(family,{[key]:lo}),b=buildAsset(family,{[key]:hi});
  try{
   assert.deepEqual(inspectGeometry(a.root).errors,[],family+'.'+key);
   assert.deepEqual(inspectGeometry(b.root).errors,[],family+'.'+key);
   assert.notDeepEqual(kind==='geometry'?geometrySnapshot(a.root):material(a),kind==='geometry'?geometrySnapshot(b.root):material(b),family+'.'+key);
  }finally{disposeAsset(a);disposeAsset(b);}
 }
 const state=descriptor('work-lantern').state;
 assert.equal(state({}).controls.handleProfile!.enabled,false);
 assert.equal(state({construction:'utility'}).controls.carryHoop!.enabled,false);
 assert.equal(state({construction:'utility'}).controls.hoodRise!.enabled,false);
 assert.equal(descriptor('boulder').state({form:'slab'}).controls.facetGrade!.enabled,false);
});
test('curated presets and coupled new extremes retain valid grounded construction',async()=>{
 const {inspectGeometry}=await import('../src/lantern/inspect.ts');
 const cases:Array<[string,Record<string,unknown>]>=['cottage','tree','fence','crate','boulder','work-lantern'].flatMap(f=>descriptor(f).presets.map(p=>[f,p.parameters] as [string,Record<string,unknown>]));
 cases.push(['cottage',{width:3.6,roofRise:1.44,roofThickness:.38,ridgeSag:1.15,beamSection:1.4}],
 ['tree',{height:3,spread:2.4,branchCount:2,canopyFullness:.65}],
 ['tree',{height:6,spread:5.4,branchCount:8,canopyFullness:1.16}],
 ['fence',{height:.7,length:6,bays:3,railCount:4,postHead:'peaked',weathering:1}],
 ['crate',{width:.45,height:.35,depth:.4,plankCourses:3,slatGap:.02,weathering:1}],
 ['boulder',{facetGrade:2,burialDepth:.4,mossCoverage:.8}],
 ['work-lantern',{bodyWidth:.22,bodyHeight:.297,handleClearance:.143,hoodRise:1.25,guardCount:6,carryHoop:'tall'}]);
 for(const [family,input] of cases){const b=buildAsset(family,input);try{
  assert.deepEqual(inspectGeometry(b.root).errors,[],family+JSON.stringify(input));
  assert.ok(Math.abs(b.bounds.min.y)<1e-6);
 }finally{disposeAsset(b);}}
});
test('historical thatch front gable backing closes the elevation to the deck',async()=>{
 const {Raycaster}=await import('three');
 const b=await buildPriorAsset('cottage');try{
  for(const o of b.root.children.filter(o=>o.name.startsWith('roof-')&&o.name.includes('-band-'))){
   const mesh=o as Mesh,p=mesh.geometry.getAttribute('position');
   const x=(p.getX(0)+p.getX(2))/2,z=p.getZ(0);
   const w=Number(b.config.applied.width),d=Number(b.config.applied.depth),h=Number(b.config.applied.wallHeight),rise=Number(b.config.applied.roofRise);
   const sag=Number(b.config.applied.roofCharacter)*Number(b.config.applied.ridgeSag)*rise*.42;
   const y=h+rise-rise*Math.abs(x)/(w/2)+Math.max(0,Math.abs(x)-w/2)*.2-sag*Math.max(0,1-Math.abs(x)/(w/2))*Math.max(0,1-(z/(d/2))**2)+.04;
   const ray=new Raycaster(new Vector3(x,y,z-.2),new Vector3(0,0,1));
   assert.ok(ray.intersectObject(mesh).length>0,mesh.name);
  }
 }finally{disposeAsset(b);}
});
test('all frozen 0.4 presets migrate with exact prior applied controls',async()=>{
 const {families}=await import('../src/families/revision3-config.ts');
 const {presets}=await import('../src/lantern/revision3-config.ts');
 for(const f of ['cottage','tree','fence','crate','boulder','work-lantern']){
  const cases=f==='work-lantern'?presets:families[f as keyof typeof families].presets;
  for(const preset of cases){
   const old=f==='work-lantern'?oldLantern(preset.parameters):oldFamily(f as 'crate',preset.parameters);
   const next=loadDesign(old);
   for(const [key,value] of Object.entries(old.applied))assert.equal(next.applied[key],value,f+'.'+preset.id+'.'+key);
   assert.deepEqual(loadDesign(next),next);
   const bad=structuredClone(old);(bad.applied as Record<string,unknown>).colorway='invented';assert.throws(()=>loadDesign(bad));
  }
 }
});
test('cottage front framing seats on sills and reserves diagonals for broad solid bays',()=>{
 for(const input of [{},{width:3.6,roofRise:1.15},{windowLayout:'sparse'}]){
  const b=buildAsset('cottage',input);try{
   const sills=b.root.children.filter(o=>o.name.startsWith('front-sill-'));assert.equal(sills.length,2);
   for(const sill of sills){const box=new Box3().setFromObject(sill,true);assert.ok(box.max.x<=-.675+1e-6||box.min.x>=.675-1e-6);}
   const diagonals=b.root.children.filter(o=>o.name.startsWith('facade-diagonal-'));
   if(!('windowLayout' in input))assert.equal(diagonals.length,0);
   else assert.ok(diagonals.length>0);
   for(const diagonal of diagonals){
    const {from,to,supports}=diagonal.userData;
    assert.ok(from&&to&&supports);
    for(const [point,names] of [[from,supports[0]],[to,supports[1]]] as Array<[number[],string[]]>){
     assert.ok(names.some(name=>new Box3().setFromObject(b.root.getObjectByName(name)!,true).expandByScalar(1e-6).containsPoint(new Vector3(...point))));
    }
   }
  }finally{disposeAsset(b);}
 }
});
test('rustic hoop keeps full requested clearance and previous useful width at every supported hoop',async()=>{
 const {Raycaster,DoubleSide}=await import('three');
 for(const carryHoop of ['oval','round','tall'])for(const input of [
  {bodyWidth:.22,bodyHeight:.18,handleClearance:.075},
  {bodyWidth:.22,bodyHeight:.297,handleClearance:.143},
  {bodyWidth:.44,bodyHeight:.36,handleClearance:.19},
  {bodyWidth:.44,bodyHeight:.18,handleClearance:.075}
 ]){
  const b=buildAsset('work-lantern',{...input,construction:'rustic',carryHoop,hoodFlare:.3});
  try{
   const gap=b.handleGap!,rx=input.bodyWidth*(carryHoop==='round'?.39:carryHoop==='tall'?.28:.33);
   assert.ok(gap.width>=rx*1.1-1e-8);assert.ok(gap.height>=input.handleClearance);
   for(const m of Object.values(b.materials))m.side=DoubleSide;
   for(const x of [-.5,-.25,0,.25,.5])for(const y of [0,.25,.5,.75,1]){
    const hits=new Raycaster(new Vector3(x*gap.width,gap.bottom+y*gap.height,1),new Vector3(0,0,-1)).intersectObject(b.root,true);
    assert.equal(hits.length,0,carryHoop+' '+JSON.stringify(input)+' '+x+','+y);
   }
  }finally{disposeAsset(b);}
 }
});
