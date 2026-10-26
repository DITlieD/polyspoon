import test from 'node:test';

test('original four-family default and custom saves migrate across an explicit version boundary',()=>{
 const originals=[
  {family:'tree',defaults:{height:4.5,spread:3.8,seed:7,colorway:'forest'},custom:{height:5.3,spread:5.4,seed:91,colorway:'ember'}},
  {family:'fence',defaults:{length:3,height:1.1,bays:2,colorway:'forest'},custom:{length:4.8,height:1.5,bays:3,colorway:'harbor'}},
  {family:'crate',defaults:{width:0.9,height:0.7,depth:0.7,colorway:'forest'},custom:{width:0.8,height:1.15,depth:0.8,colorway:'ember'}},
  {family:'boulder',defaults:{width:1.6,height:1,depth:1.2,lean:0.08,colorway:'forest'},custom:{width:2.6,height:0.65,depth:1.8,lean:-0.14,colorway:'harbor'}},
 ];
 for(const fixture of originals)for(const requested of [{},fixture.custom]) {
  const applied={...fixture.defaults,...requested};
  const old={formatVersion:1,family:fixture.family,familyVersion:'0.1.0',requested,applied:Object.fromEntries(Object.entries(applied).reverse())};
  const migrated=loadDesign(old);
  assert.equal(migrated.familyVersion,'0.4.0');assert.equal(descriptor(fixture.family).version,'0.4.0');
  assert.equal(migrated.migration?.fromVersion,'0.1.0');assert.equal(migrated.migration?.toVersion,'0.4.0');
  for(const [key,value] of Object.entries(applied))assert.equal(migrated.applied[key],value);
  assert.deepEqual(loadDesign(JSON.parse(JSON.stringify(migrated))),migrated);
  assert.throws(()=>loadDesign({...old,applied:{...applied,colorway:'unknown'}}));
  assert.throws(()=>loadDesign({...old,applied:{...applied,extra:1}}));
  const incomplete={...migrated.applied};delete incomplete[Object.keys(incomplete).find(key=>key.startsWith('color.'))!];
  assert.throws(()=>loadDesign({...migrated,applied:incomplete}),/applied/i);
 }
});


test('current applied maps compare exact values independently of JSON key order',()=>{
  for(const family of ['cottage','work-lantern','tree','fence','crate','boulder']) {
    const saved=descriptor(family).save({});
    const reordered=Object.fromEntries(Object.entries(saved.applied).reverse());
    assert.deepEqual(loadDesign({...saved,applied:reordered}),saved);
    assert.throws(()=>loadDesign({...saved,applied:{...reordered,colorway:'harbor'}}),/applied/i);
    assert.throws(()=>loadDesign({...saved,applied:{...reordered,unknown:1}}),/applied/i);
    const missingColor={...reordered};delete missingColor[Object.keys(missingColor).find(key=>key.startsWith('color.'))!];
    assert.throws(()=>loadDesign({...saved,applied:missingColor}),/applied/i);
    const incomplete={...reordered};delete incomplete.colorway;
    assert.throws(()=>loadDesign({...saved,applied:incomplete}),/applied/i);
  }
});


import { buildAsset, disposeAsset, descriptor, loadDesign, resolveExport } from '../src/catalog/index.ts';
import { geometrySnapshot } from '../src/lantern/inspect.ts';
import { Raycaster, Vector3, Box3 } from 'three';

test('versioned construction explicitly migrates validated old configurations',()=>{
  for(const [family,version,applied] of [
    ['cottage','0.1.0',{width:5,depth:4,wallHeight:2.8,roofRise:1.4,colorway:'forest'}],
    ['work-lantern','1.0.0',{bodyWidth:0.32,bodyHeight:0.26,handleClearance:0.115,colorway:'forest'}],
  ] as const) {
    const old={formatVersion:1,family,familyVersion:version,requested:{},applied};
    const next=loadDesign(old);assert.equal(next.familyVersion,'0.4.0');assert.equal(next.migration?.fromVersion,version);
    assert.equal(resolveExport({},old).migration?.fromVersion,version);
    assert.deepEqual(loadDesign(JSON.parse(JSON.stringify(next))),next);
    assert.throws(()=>loadDesign({...old,applied:{...applied,colorway:'harbor'}}));
  }
});
test('construction controls alter actual named parts and colors remain isolated',()=>{
  for(const family of ['cottage','work-lantern']) {
    const original=buildAsset(family),role=family==='cottage'?'roof':'body';
    const colored=buildAsset(family,{['color.'+role]:'#123456'});
    try {
      assert.deepEqual(geometrySnapshot(original.root),geometrySnapshot(colored.root));
      for(const key of Object.keys(original.materials))assert.equal(colored.materials[key]!.color.getHexString(),key===role?'123456':original.materials[key]!.color.getHexString());
      assert.deepEqual(descriptor(family).defaults,original.config.applied);
      for(const c of descriptor(family).controls)if(c.kind==='toggle')assert.throws(()=>buildAsset(family,{[c.key]:'true'}));
    }finally{disposeAsset(original);disposeAsset(colored);}
  }
  const plain=buildAsset('cottage',{chimney:false,workBay:'none',shutters:false});
  try {assert.ok(!plain.root.children.some(p=>/chimney|work-bay|shutter/.test(p.name)));assert.ok(!plain.anchors.chimney);}finally{disposeAsset(plain);}
  const sparse=buildAsset('work-lantern',{guardLayout:'sparse'}),guard=buildAsset('work-lantern',{guardLayout:'crossbar'});
  try{assert.equal(sparse.root.children.filter(p=>p.name.startsWith('guard-crossbar-')).length,0);assert.equal(guard.root.children.filter(p=>p.name.startsWith('guard-crossbar-')).length,2);assert.equal(sparse.root.children.filter(p=>p.name.startsWith('guard-upright-')).length,4);assert.equal(guard.root.children.filter(p=>p.name.startsWith('guard-upright-')).length,4);}finally{disposeAsset(sparse);disposeAsset(guard);}
});
test('new cottage opening depth and worktop contact survive width and bay side',()=>{
  for(const width of [3.6,5,7.2])for(const side of ['left','right']) {
    const b=buildAsset('cottage',{width,roofRise:1.2,workBay:side});
    try {
      const top=b.root.getObjectByName('work-bay-surface')!,base=b.root.getObjectByName('work-bay')!;
      const tb=new Box3().setFromObject(top,true),bb=new Box3().setFromObject(base,true);
      assert.ok(tb.min.y<=bb.max.y+1e-6,'counter must rest on plinth');
      const window=b.root.getObjectByName('front-window-0')!;
      const center=new Vector3();window.getWorldPosition(center);
      const hit=new Raycaster(new Vector3(center.x+0.12,center.y-0.15,10),new Vector3(0,0,-1)).intersectObject(b.root,true)[0]!;
      assert.ok(hit.object.name.endsWith('backing'),hit.object.name);
      assert.ok(hit.point.z<Number(b.config.applied.depth)/2-0.12,'window must be recessed');
      const ray=new Raycaster(new Vector3(0,1.4,10),new Vector3(0,0,-1));
      assert.ok(ray.intersectObject(b.root,true)[0]!.point.z<Number(b.config.applied.depth)/2-0.12);
      assert.equal(Math.sign(b.anchors.workSurface![0]!),side==='left'?-1:1);
    }finally{disposeAsset(b);}
  }
});

import assert from 'node:assert/strict';
import { parseControls, ParameterError } from '../src/engine/parameters.ts';
import type { Control } from '../src/engine/parameters.ts';
import { profileSolid, profiledBeam, framedPanel, repeatSpan } from '../src/engine/geometry.ts';
import { inspectGeometry } from '../src/lantern/inspect.ts';
import { Group, Mesh, MeshStandardMaterial } from 'three';

const base = { group:'construction' as const,unit:'none' as const,hint:'fixture',affects:['geometry' as const],targets:['fixture'] };
const controls:Control[]=[
  {...base,key:'width',label:'Width',kind:'range',default:1,min:0.5,max:2,step:0.1},
  {...base,key:'count',label:'Count',kind:'integer',default:2,min:1,max:4,step:1},
  {...base,key:'shape',label:'Shape',kind:'choice',default:'square',options:[{value:'square',label:'Square'},{value:'tapered',label:'Tapered'}]},
  {...base,key:'cap',label:'Cap',kind:'toggle',default:true},
  {...base,key:'color.body',label:'Body',kind:'color',default:'#abcdef',role:'body',affects:['material']},
];
test('synthetic recipe controls retain typed values and reject misleading input',()=>{
  const recipes={fixture:(input:unknown)=>parseControls(controls,input)};
  assert.equal(recipes.fixture({width:1.037}).width,1.037);
  assert.equal(recipes.fixture({cap:false}).cap,false);
  assert.equal(recipes.fixture({'color.body':'#ABCDEF'})['color.body'],'#abcdef');
  for(const input of [{count:1.5},{cap:'true'},{shape:'round'},{'color.body':'red'},{width:Infinity},{unknown:1}]) assert.throws(()=>recipes.fixture(input),ParameterError);
});
test('shared profiles reject collapsed construction and build valid framed parts',()=>{
  assert.throws(()=>profileSolid([{y:0,width:1,depth:1,chamfer:0.6},{y:1,width:1,depth:1,chamfer:0.1}]));
  assert.throws(()=>profiledBeam([0,0,0],[0,0,0],0.1,0.1,0.01));
  assert.throws(()=>framedPanel(1,1,0.6,0.1,0.05));
  const root=new Group(), material=new MeshStandardMaterial();
  for(const [name,part] of Object.entries(framedPanel(1,1,0.1,0.15,0.07))) {const mesh=new Mesh(part.geometry,material);mesh.name=name;mesh.position.set(...part.position);root.add(mesh);}
  assert.deepEqual(inspectGeometry(root).errors,[]);
  const span=repeatSpan(2,0.4,0.02);
  assert.ok(span.count>=4);assert.ok(Math.abs(span.count*span.width+(span.count-1)*0.02-2)<1e-9);
});
