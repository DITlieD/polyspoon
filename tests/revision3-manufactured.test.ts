import '../scripts/node-platform.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Mesh,Vector3,Box3,Raycaster,DoubleSide} from 'three';
import {buildAsset,disposeAsset,descriptor,loadDesign} from '../src/catalog/index.ts';
import {geometrySnapshot,inspectGeometry} from '../src/lantern/inspect.ts';
test('remaining three migrate strict prior configs to 0.5',()=>{
 const old=JSON.parse(readFileSync('evidence/revision3/art-pass2/before/configs.json','utf8'));
 for(const config of old.filter((c:any)=>c.family!=='boulder')){
  const d=loadDesign(config);assert.equal(d.familyVersion,'0.5.0');
  for(const [k,v] of Object.entries(config.applied))assert.equal(d.applied[k],v);
  assert.deepEqual(loadDesign(d),d);
  assert.throws(()=>loadDesign({...config,applied:{...config.applied,unknown:1}}));
 }
});
test('manufactured geometry controls affect deterministic connected builds',()=>{
 const cases:Record<string,Record<string,unknown>>={
  fence:{railCount:4,memberWeight:'light',infill:'pickets',picketSpacing:.25},
  crate:{plankCourses:6,slatGap:.055,frameWeight:'light'},
  'work-lantern':{enclosureProfile:'square',hoodFlare:.3,handleProfile:'square',guardCount:6},
 };
 for(const [family,changes] of Object.entries(cases))for(const [key,value] of Object.entries(changes)){
  const baselineInput=family==='work-lantern'&&key==='handleProfile'?{construction:'utility'}:family==='fence'&&key==='picketSpacing'?{infill:'pickets'}:{};
  const a=buildAsset(family,baselineInput),b=buildAsset(family,{...baselineInput,[key]:value}),c=buildAsset(family,{...baselineInput,[key]:value});
  try{assert.notDeepEqual(geometrySnapshot(a.root),geometrySnapshot(b.root),family+'.'+key);assert.deepEqual(geometrySnapshot(b.root),geometrySnapshot(c.root));assert.deepEqual(inspectGeometry(b.root).errors,[]);assert.ok(Math.abs(b.bounds.min.y)<1e-6);}finally{disposeAsset(a);disposeAsset(b);disposeAsset(c);}
 }
});
test('produce crate has physical board gaps and floor boards rather than a closed backing',()=>{
 const b=buildAsset('crate',{lid:'open-top',plankCourses:4,slatGap:.05,brace:'plain'});
 try{
  assert.equal(b.root.getObjectByName('base-panel'),undefined);assert.equal(b.root.getObjectByName('lid-underlay'),undefined);
  assert.ok(b.root.getObjectByName('floor-board-0'));
  const a=new Box3().setFromObject(b.root.getObjectByName('front-plank-1-0')!,true),c=new Box3().setFromObject(b.root.getObjectByName('front-plank-1-1')!,true);
  assert.ok(Math.abs(c.min.y-a.max.y-.05)<1e-6);
 }finally{disposeAsset(b);}
});
test('new boulder has oblique sides instead of equal-radius upright perimeter',()=>{
 const b=buildAsset('boulder');
 try{
  let verticalArea=0,area=0;
  b.root.traverse(o=>{if(!(o instanceof Mesh))return;const p=o.geometry.getAttribute('position');
   for(let i=0;i<p.count;i+=3){
    const a=new Vector3().fromBufferAttribute(p,i),v=new Vector3().fromBufferAttribute(p,i+1),c=new Vector3().fromBufferAttribute(p,i+2),cross=v.sub(a).cross(c.sub(a)),size=cross.length()/2;
    if(Math.abs(cross.clone().normalize().y)<.08)verticalArea+=size;area+=size;
   }
  });
  assert.ok(verticalArea/area<.15,'too much vertical perimeter');
 }finally{disposeAsset(b);}
});
test('cottage fascia stays behind the lowest covering edge',()=>{
 for(const roofCover of ['thatch','shingle'])for(const eaveOverhang of [.25,.55]){
  const b=buildAsset('cottage',{roofCover,eaveOverhang});
  try{const half=Number(b.config.applied.width)/2+eaveOverhang;
   b.root.traverse(o=>{if(o instanceof Mesh&&o.name.startsWith('eave-fascia-')){
    const box=new Box3().setFromObject(o,true);assert.ok(Math.max(Math.abs(box.min.x),Math.abs(box.max.x))<half,'fascia protrudes at roof edge');
   }});
  }finally{disposeAsset(b);}
 }
});
test('manufactured numeric limits and discrete controls retain valid finite grounded geometry',()=>{
 const inputs:Record<string,Array<Record<string,unknown>>>={fence:[],crate:[],'work-lantern':[]};
 for(const family of Object.keys(inputs)){
  for(const c of descriptor(family).controls){
   if(c.kind==='range'||c.kind==='integer')for(const value of [c.min,c.max]){
    const input:Record<string,unknown>={[c.key]:value};
    if(family==='fence'&&c.key==='length'&&value===6)input.bays=3;
    if(family==='fence'&&c.key==='bays'&&value===1)input.length=2;
    if(family==='fence'&&c.key==='picketSpacing')input.infill='pickets';
    if(family==='crate'&&c.key==='depth'&&value===.4)input.height=.6;
    if(family==='crate'&&c.key==='height'&&value===1.2)input.depth=.8;
    if(family==='work-lantern'&&c.key==='bodyHeight'&&value===.36)input.bodyWidth=.32;
    if(family==='work-lantern'&&c.key==='handleClearance'&&value===.19)input.bodyWidth=.4;
    inputs[family]!.push(input);
   }
   else if(c.kind==='choice'&&c.group!=='colors')for(const option of c.options)inputs[family]!.push({[c.key]:option.value});
  }
 }
 inputs.crate!.push({width:.45,height:.35,depth:.4,plankCourses:6,slatGap:.008,lid:'open-top'},{width:1.5,height:1.2,depth:1.2,plankCourses:6,slatGap:.055});
 inputs.fence!.push({length:1.2,bays:2,height:.7,railCount:4,infill:'pickets',picketSpacing:.1},{length:6,bays:4,height:1.5,railCount:4,infill:'pickets',railStyle:'cross-braced'});
 for(const [family,cases] of Object.entries(inputs))for(const input of cases){
  const b=buildAsset(family,input);try{assert.deepEqual(inspectGeometry(b.root).errors,[],family+JSON.stringify(input));assert.ok(Math.abs(b.bounds.min.y)<1e-5);}finally{disposeAsset(b);}
 }
 assert.throws(()=>buildAsset('crate',{width:.45,height:.35,depth:.4,plankCourses:6,slatGap:.055}),/18 mm/);
 assert.equal(descriptor('fence').state({infill:'open'}).controls.picketSpacing!.enabled,false);
});
test('board tones affect materials only and exported measurements report actual material colors',async()=>{
 const {measurements}=await import('../src/catalog/measure.ts'),{exportAsset}=await import('../src/catalog/export.ts');
 const a=buildAsset('crate',{toneVariation:0}),b=buildAsset('crate',{toneVariation:.12,'color.wood':'#9a7048'});
 try{
  const spatial=(root:typeof a.root)=>geometrySnapshot(root).map(part=>{const p=part as {attributes:Record<string,unknown>};return {...p,attributes:Object.fromEntries(Object.entries(p.attributes).filter(([key])=>key!=='color'))};});
  assert.deepEqual(spatial(a.root),spatial(b.root));
  const bytes=Buffer.from(await exportAsset(b)),gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
  for(const m of measurements(b).materials)assert.deepEqual(gltf.materials.find((x:any)=>x.name===m.name).pbrMetallicRoughness.baseColorFactor,Object.values(m.linearColor));
  assert.notDeepEqual(b.materials['wood-tone-0']!.color,b.materials['wood-tone-2']!.color);
 }finally{disposeAsset(a);disposeAsset(b);}
});
test('all current versions reject unknown missing and forged saved state',()=>{
 for(const family of ['cottage','tree','boulder','fence','crate','work-lantern']){
  const config=descriptor(family).save({});
  for(const version of [undefined,'0.0.0','0.9.0','garbage'])assert.throws(()=>loadDesign({...config,familyVersion:version}));
  assert.throws(()=>loadDesign({...config,unknown:true}));
  assert.throws(()=>loadDesign({...config,[Symbol('unknown')]:true}));
  const applied={...config.applied};delete applied[Object.keys(applied)[0]!];
  assert.throws(()=>loadDesign({...config,applied}));
  assert.throws(()=>loadDesign({...config,migration:{fromVersion:'0.3.0',toVersion:'0.5.0',notice:'approved'}}));
 }
});
test('declared lantern handle region stays genuinely clear at valid dimension extremes',()=>{
 for(const construction of ['utility','rustic'])for(const handleProfile of (construction==='utility'?['arched','square']:['arched']))for(const input of [
  {bodyWidth:.22,bodyHeight:.18,handleClearance:.075},
  {bodyWidth:.22,bodyHeight:.297,handleClearance:.143},
  {bodyWidth:.44,bodyHeight:.36,handleClearance:.19},
  {bodyWidth:.44,bodyHeight:.18,handleClearance:.075},
 ]){
  const b=buildAsset('work-lantern',{...input,construction,handleProfile,hoodFlare:.3});
  try{
   for(const m of Object.values(b.materials))m.side=DoubleSide;
   const gap=b.handleGap!;
   for(const x of [-.49,-.25,0,.25,.49])for(const y of [.01,.25,.5,.75,.99]){
    const ray=new Raycaster(new Vector3(x*gap.width,gap.bottom+y*gap.height,1),new Vector3(0,0,-1));
    assert.equal(ray.intersectObject(b.root,true).length,0,construction+' '+handleProfile+' '+JSON.stringify(input)+' opening '+x+','+y);
   }
  }finally{disposeAsset(b);}
 }
});
test('earlier lantern and manufactured typed migrations preserve inputs through frozen loaders',()=>{
 const lantern={formatVersion:1,family:'work-lantern',familyVersion:'1.0.0',requested:{},applied:{bodyWidth:.32,bodyHeight:.26,handleClearance:.115,colorway:'forest'}};
 const next=loadDesign(lantern);assert.equal(next.familyVersion,'0.5.0');assert.deepEqual(loadDesign(next),next);
 for(const [key,value] of Object.entries(lantern.applied))assert.equal(next.applied[key],value);
 assert.throws(()=>loadDesign({...lantern,applied:{...lantern.applied,bodyWidth:.44}}));
 for(const file of ['family-v020.json','family-v020-custom.json']){
  const records=JSON.parse(readFileSync('tests/fixtures/'+file,'utf8'));
  for(const family of ['fence','crate']){
   const next=loadDesign(records[family]);assert.equal(next.familyVersion,'0.5.0');assert.deepEqual(loadDesign(next),next);
   for(const [key,value] of Object.entries(records[family].applied))assert.equal(next.applied[key],value);
   assert.throws(()=>loadDesign({...records[family],requested:{...records[family].requested,unknown:1}}));
  }
 }
});
