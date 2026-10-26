import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Mesh,Vector3} from 'three';
import {buildAsset,disposeAsset,descriptor,loadDesign} from '../src/catalog/index.ts';
import {geometrySnapshot,inspectGeometry} from '../src/lantern/inspect.ts';
const old=[...JSON.parse(readFileSync('evidence/revision3/art-pass1/before/configs.json','utf8')),...JSON.parse(readFileSync('tests/fixtures/revision2-to-revision3.json','utf8'))];
test('revision3 validates frozen typed configs before migration',()=>{
 for(const config of old){
  const migrated=loadDesign(config);assert.equal(migrated.familyVersion,'0.5.0');
  for(const [k,v] of Object.entries(config.applied))assert.equal(migrated.applied[k],v);
  assert.throws(()=>loadDesign({...config,applied:{...config.applied,width:999}}));
  assert.throws(()=>loadDesign({...config,requested:{...config.requested,newUnknown:true}}));
  assert.deepEqual(loadDesign(migrated),migrated);
 }
 assert.equal(descriptor('fence').version,'0.5.0');assert.equal(descriptor('work-lantern').version,'0.5.0');
});
test('new construction controls have real deterministic shape or material effects',()=>{
 const cases:Record<string,Record<string,unknown>>={
  cottage:{roofCover:'shingle',roofThickness:.38,framingStyle:'upright',windowLayout:'sparse',bayDepth:2.3},
  tree:{forkHeight:.43,canopyFullness:.65,trunkGirth:.48,branchCount:8,architecture:'upright'},
  boulder:{angularity:.3,crest:.24,shoulderHeight:.45,moss:'none',mossCoverage:.8},
 };
 for(const [family,changes] of Object.entries(cases)){
  const baseline=buildAsset(family);
  try{for(const [key,value] of Object.entries(changes)){
   const a=buildAsset(family,{[key]:value}),b=buildAsset(family,{[key]:value});
   try{
    assert.notDeepEqual(geometrySnapshot(a.root),geometrySnapshot(baseline.root),family+'.'+key+' has no effect');
    assert.deepEqual(geometrySnapshot(a.root),geometrySnapshot(b.root));
    assert.deepEqual(inspectGeometry(a.root).errors,[]);
   }finally{disposeAsset(a);disposeAsset(b);}
  }}finally{disposeAsset(baseline);}
 }
});
test('tree paths remain grounded with supported crown endpoints and enough unequal full crowns',()=>{
 for(const growth of ['young','mature'])for(const branchCount of [2,3,5,8])for(const lean of [-.1,.1]){
  const b=buildAsset('tree',{growth,branchCount,lean,forkHeight:.43,canopyFullness:.65});
  try{
   assert.ok(Math.abs(b.bounds.min.y)<1e-6);assert.ok(Math.abs(b.bounds.max.y-4.5)<1e-5);
   const crowns=b.root.children.filter(o=>o.name.startsWith('crown-')) as Mesh[];
   assert.equal(crowns.length,branchCount);
   for(const crown of crowns){
    const branch=b.root.getObjectByName(crown.name.replace('crown-','branch-'))!;
    assert.ok(branch);assert.ok(new Vector3(...branch.userData.tip).distanceTo(crown.position)<1e-6);
   }
  }finally{disposeAsset(b);}
 }
});
test('stone moss shares exterior surface and top anchor remains at exact exposed height',()=>{
 for(const form of ['slab','standing'])for(const angularity of [.3,1])for(const seed of [0,65535]){
  const b=buildAsset('boulder',{form,angularity,seed,moss:'top',mossCoverage:.8});
  try{
   assert.ok(Math.abs(b.bounds.min.y)<1e-6);assert.ok(Math.abs(b.bounds.max.y-(Number(b.config.applied.height)*(1-Number(b.config.applied.burialDepth))))<1e-6);
   assert.equal(b.anchors.top![1],(Number(b.config.applied.height)*(1-Number(b.config.applied.burialDepth))));
   const seen=new Set<string>();
   b.root.traverse(o=>{if(!(o instanceof Mesh))return;const p=o.geometry.getAttribute('position');
    for(let i=0;i<p.count;i+=3){const key=[0,1,2].map(j=>[p.getX(i+j),p.getY(i+j),p.getZ(i+j)].join(',')).sort().join('|');assert.ok(!seen.has(key),'duplicate overlay triangle');seen.add(key);}
   });
   assert.ok(b.root.getObjectByName('moss-region'));
  }finally{disposeAsset(b);}
 }
 assert.equal(descriptor('boulder').state({moss:'none'}).controls['color.moss']!.enabled,false);
});
test('construction presets differ without relying on scale or color',()=>{
 for(const family of ['cottage','tree','boulder']){
  const d=descriptor(family),shapes=[];
  for(const preset of d.presets){
   const b=buildAsset(family,{...preset.parameters,colorway:'forest'});
   try{shapes.push(JSON.stringify(geometrySnapshot(b.root)));assert.deepEqual(inspectGeometry(b.root).errors,[]);}finally{disposeAsset(b);}
  }
  assert.equal(new Set(shapes).size,3);
 }
});
test('revision3 boundaries stay finite grounded and exported colors do not deform shape',()=>{
 for(const family of ['cottage','tree','boulder']){
  const d=descriptor(family);
  for(const c of d.controls.filter(c=>!c.key.startsWith('color.')&&c.key!=='colorway')){
   if(c.kind!=='range'&&c.kind!=='integer')continue;
   for(const value of [c.min,c.max]){
    const input:Record<string,unknown>={[c.key]:value};
    if(family==='tree'&&c.key==='height'&&value===3)input.spread=3.6;
    if(family==='tree'&&c.key==='spread'&&value===2.4)input.height=4.3;
    if(family==='boulder'&&c.key==='width'&&value===.6)input.height=.7;
    if(family==='boulder'&&c.key==='depth'&&value===.5)input.height=.6;
    if(family==='boulder'&&c.key==='height'&&value===1.8)input.depth=1.5;
    const b=buildAsset(family,input);
    try{assert.deepEqual(inspectGeometry(b.root).errors,[]);assert.ok(Math.abs(b.bounds.min.y)<1e-5,family+' '+c.key+' ground');}finally{disposeAsset(b);}
   }
  }
  const a=buildAsset(family),b=buildAsset(family,{['color.'+(family==='tree'?'foliage':family==='cottage'?'roof':'moss')]:'#123456'});
  try{assert.deepEqual(geometrySnapshot(a.root),geometrySnapshot(b.root));}finally{disposeAsset(a);disposeAsset(b);}
 }
});
test('cottage covering closed volumes and sweep outward winding remain positive',()=>{
 for(const family of ['cottage','tree']){
  const b=buildAsset(family);
  try{b.root.traverse(o=>{
   if(!(o instanceof Mesh)||!(o.name.startsWith('roof-')||o.name==='trunk'||o.name.startsWith('branch-')))return;
   const p=o.geometry.getAttribute('position'),idx=o.geometry.index,count=idx?.count??p.count;
   let volume=0;
   for(let i=0;i<count;i+=3){
    const a=new Vector3().fromBufferAttribute(p,idx?idx.getX(i):i),v=new Vector3().fromBufferAttribute(p,idx?idx.getX(i+1):i+1),c=new Vector3().fromBufferAttribute(p,idx?idx.getX(i+2):i+2);
    volume+=a.dot(v.cross(c))/6;
   }
   assert.ok(volume>0,o.name+' reversed surface');
  });}finally{disposeAsset(b);}
 }
});
test('roof cover selects semantic default color and preserves an explicit override',()=>{
 const thatch=descriptor('cottage').save({roofCover:'thatch'}),shingle=descriptor('cottage').save({roofCover:'shingle'});
 assert.notEqual(thatch.applied['color.roof'],shingle.applied['color.roof']);
 assert.equal(descriptor('cottage').save({roofCover:'thatch','color.roof':'#123456'}).applied['color.roof'],'#123456');
 assert.equal(descriptor('cottage').state({workBay:'none'}).controls.bayDepth!.enabled,false);
});
test('original 0.1 and frozen 0.2 records reach 0.5 without trusting forged applied data',()=>{
 const numeric:Record<string,Record<string,number|string>>={
  cottage:{width:5,depth:4,wallHeight:2.8,roofRise:1.4,colorway:'forest'},
  tree:{height:4.5,spread:3.8,seed:7,colorway:'forest'},
  boulder:{width:1.6,height:1,depth:1.2,lean:.08,colorway:'forest'},
 };
 for(const [family,applied] of Object.entries(numeric)){
  const old={formatVersion:1,family,familyVersion:'0.1.0',requested:{},applied};
  assert.equal(loadDesign(old).familyVersion,'0.5.0');
  assert.throws(()=>loadDesign({...old,applied:{...applied,unknown:1}}));
 }
 for(const file of ['family-v020.json','family-v020-custom.json']){
  const saved=JSON.parse(readFileSync('tests/fixtures/'+file,'utf8'));
  for(const family of ['tree','boulder']){
   const config=saved[family],next=loadDesign(config);assert.equal(next.familyVersion,'0.5.0');
   for(const [k,v] of Object.entries(config.applied))assert.equal(next.applied[k],v);
   assert.throws(()=>loadDesign({...config,migration:{fromVersion:'0.1.0',toVersion:'0.2.0',notice:'invented approval'}}));
  }
 }
});
