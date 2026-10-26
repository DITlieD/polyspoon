import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Mesh,Raycaster,Vector3} from 'three';
import type {Object3D} from 'three';
import {buildAsset,disposeAsset} from '../src/catalog/index.ts';
import {inspectGeometry,geometrySnapshot} from '../src/lantern/inspect.ts';

const bounds=(object:Object3D)=>new Box3().setFromObject(object,true);
const meshes=(root:Object3D,predicate:(name:string)=>boolean)=>{
 const result:Mesh[]=[];
 root.traverse(object=>{if(object instanceof Mesh&&predicate(object.name))result.push(object);});
 return result;
};
const heightAt=(objects:Object3D[],x:number,z:number)=>new Raycaster(new Vector3(x,12,z),new Vector3(0,-1,0)).intersectObjects(objects)[0]?.point.y;
const assertFasciaContact=(root:Object3D)=>{
 root.updateMatrixWorld(true);
 const deck=meshes(root,name=>name.startsWith('roof-deck-')),fascias=meshes(root,name=>name.startsWith('eave-fascia-'));
 assert.ok(deck.length&&fascias.length,'missing roof deck or eave trim');
 for(const fascia of fascias){
  const box=bounds(fascia),center=box.getCenter(new Vector3());
  for(const dx of [-.05,0,.05])for(const fraction of [.15,.5,.85]){
   const x=center.x+dx,z=box.min.z+(box.max.z-box.min.z)*fraction;
   const top=heightAt([fascia],x,z),deckTop=heightAt(deck,x,z);
   const underside=new Raycaster(new Vector3(x,0,z),new Vector3(0,1,0)).intersectObjects(deck)[0]?.point.y;
   assert.ok(top!==undefined&&deckTop!==undefined&&underside!==undefined,'eave contact ray misses its physical surface');
   assert.ok(top-underside>=.004&&top<=deckTop+1e-6,'eave fascia must seat into the deck underside '+JSON.stringify({part:fascia.name,x,z,top,underside,deckTop}));
  }
 }
};
const trimCases=[
 {width:3.6,depth:5.5,wallHeight:2.5,roofRise:1.44,roofCharacter:1,ridgeSag:1.15,roofThickness:.38,eaveOverhang:.55,workBay:'left',bayDepth:2.3,detail:'inspection',colorway:'forest'},
 {},
 {width:7.2,depth:3,roofRise:2,roofCharacter:1,ridgeSag:1.15,roofThickness:.14,eaveOverhang:.25},
 {width:3.6,depth:5.5,roofRise:1.44,roofCharacter:0,ridgeSag:.25,roofThickness:.38,eaveOverhang:.55},
];
const assertRidgeContact=(root:Object3D)=>{
 root.updateMatrixWorld(true);
 const covering=meshes(root,name=>/^roof-(left|right)-(band|course)-/.test(name)),caps=meshes(root,name=>name.startsWith('ridge-cap-'));
 assert.ok(covering.length&&caps.length);
 for(const cap of caps){
  const box=bounds(cap),half=box.getSize(new Vector3()).x/2;
  for(const xf of [-.6,0,.6])for(const zf of [.1,.25,.5,.75,.9]){
   const x=xf*half,z=box.min.z+(box.max.z-box.min.z)*zf;
   const surface=heightAt(covering,x,z),top=heightAt([cap],x,z);
   const underside=new Raycaster(new Vector3(x,0,z),new Vector3(0,1,0)).intersectObject(cap)[0]?.point.y;
   assert.ok(surface!==undefined&&top!==undefined&&underside!==undefined,'ridge contact surface is missing');
   assert.ok(surface-underside>=.002&&surface-underside<=.04,'ridge must meet covering without a daylight gap or deep penetration '+JSON.stringify({part:cap.name,x,z,surface,underside}));
   assert.ok(top>surface+.02&&top-underside<=.12,'ridge repair must retain a fitted cap instead of a thick filler');
  }
 }
};
const assertRakeContact=(root:Object3D)=>{
 root.updateMatrixWorld(true);
 const deck=meshes(root,name=>name.startsWith('roof-deck-')),rakes=meshes(root,name=>name.startsWith('roof-rake-'));
 assert.ok(deck.length&&rakes.length);
 for(const rake of rakes){
  const box=bounds(rake),z=box.getCenter(new Vector3()).z-Math.sign(box.getCenter(new Vector3()).z)*.04;
  for(const fraction of [.1,.3,.5,.7,.9]){
   const x=box.min.x+(box.max.x-box.min.x)*fraction,top=heightAt([rake],x,z),deckTop=heightAt(deck,x,z);
   const underside=new Raycaster(new Vector3(x,0,z),new Vector3(0,1,0)).intersectObjects(deck)[0]?.point.y;
   assert.ok(top!==undefined&&deckTop!==undefined&&underside!==undefined,'rake contact surface is missing');
   assert.ok(top-underside>=.004&&top<=deckTop+1e-6,'rake must follow the actual deck underside '+JSON.stringify({part:rake.name,x,z,top,underside,deckTop}));
  }
 }
};

test('cottage ridge cap follows cover and deck stations through sag and both roof coverings',()=>{
 for(const input of trimCases)for(const roofCover of ['thatch','shingle']){
  const build=buildAsset('cottage',{...input,roofCover});
  try{assertRidgeContact(build.root);assert.deepEqual(inspectGeometry(build.root).errors,[]);}finally{disposeAsset(build);}
 }
 const build=buildAsset('cottage',{...trimCases[0],roofCover:'shingle'});
 try{
  meshes(build.root,name=>name.startsWith('ridge-cap-'))[0]!.position.y+=.15;
  assert.throws(()=>assertRidgeContact(build.root),/meet covering/);
 }finally{disposeAsset(build);}
});

test('cottage adjoining rakes follow the piecewise deck rather than a ridge-to-eave chord',()=>{
 for(const input of trimCases)for(const roofCover of ['thatch','shingle']){
  const build=buildAsset('cottage',{...input,roofCover});
  try{assertRakeContact(build.root);}finally{disposeAsset(build);}
 }
 const build=buildAsset('cottage');
 try{
  meshes(build.root,name=>name.startsWith('roof-rake-'))[0]!.position.y-=.15;
  assert.throws(()=>assertRakeContact(build.root),/follow the actual deck underside/);
 }finally{disposeAsset(build);}
});

test('cottage eave fascia follows the physical deck through cover and roof boundary settings',()=>{
 for(const input of [{width:3.6,depth:5.5,roofRise:1.44},{width:7.2,depth:3,roofRise:2}])for(const roofCover of ['thatch','shingle'])for(const roofThickness of [.14,.38])for(const eaveOverhang of [.25,.55])for(const roofCharacter of [0,1]){
  const build=buildAsset('cottage',{...input,roofCover,roofThickness,eaveOverhang,roofCharacter,ridgeSag:1.15});
  try{assertFasciaContact(build.root);assert.deepEqual(inspectGeometry(build.root).errors,[]);}finally{disposeAsset(build);}
 }
 const build=buildAsset('cottage');
 try{
  meshes(build.root,name=>name.startsWith('eave-fascia-'))[0]!.position.y-=.05;
  assert.throws(()=>assertFasciaContact(build.root),/seat into the deck underside/);
 }finally{disposeAsset(build);}
});

test('roof cover has local sections and consistent depth instead of full-length raised shelves',()=>{
 for(const roofCover of ['thatch','shingle'])for(const input of [{},{width:3.6,depth:5.5,roofRise:1.4,roofThickness:.38,roofCharacter:1},{width:7.2,depth:3,roofThickness:.14,roofCharacter:0}]){
  const build=buildAsset('cottage',{...input,roofCover});
  try{
   const cover=meshes(build.root,name=>/^roof-(left|right)-(band|course)-/.test(name));
   const deck=meshes(build.root,name=>name.startsWith('roof-deck-'));
   const depth=Number(build.config.applied.depth),half=Number(build.config.applied.width)/2+Number(build.config.applied.eaveOverhang);
   assert.ok(cover.length>0);
   for(const piece of cover)assert.ok(bounds(piece).getSize(new Vector3()).z<=(depth+.8)*.55,'cover section spans the entire roof');
   for(const x of [.12,half*.35,half*.68,half-.12])for(const z of [-depth*.4,0,depth*.4]){
    const top=heightAt(cover,x,z),support=heightAt(deck,x,z);
    assert.ok(top!==undefined&&support!==undefined,'cover or deck has a daylight opening');
    assert.ok(top>=support,'support protrudes through cover');
    const underside=new Raycaster(new Vector3(x,0,z),new Vector3(0,1,0)).intersectObjects(cover)[0]?.point.y;
    assert.ok(underside!==undefined&&underside<=support+1e-6,'cover floats above its deck '+JSON.stringify({roofCover,input,x,z,underside,support}));
    assert.ok(top-support<=Number(build.config.applied.roofThickness)*1.25+.10,'courses build into a raised shelf');
   }
   assert.deepEqual(inspectGeometry(build.root).errors,[]);
  }finally{disposeAsset(build);}
 }
});

test('cottage entrance and work-bay retain recessed openings and supported joins',()=>{
 for(const workBay of ['left','right'])for(const detail of ['scene','inspection'])for(const input of [{},{width:3.6,depth:3,wallHeight:2.5,roofRise:1.4,bayDepth:2.3,beamSection:.7}]){
  const build=buildAsset('cottage',{...input,workBay,detail});
  try{
   const door=bounds(build.root.getObjectByName('entrance-door')!),lintel=bounds(build.root.getObjectByName('entrance-lintel')!);
   assert.ok(lintel.max.z-door.max.z>.25,'door has lost its wall reveal');
   assert.ok(door.min.y>=.219&&door.max.y<lintel.max.y);
   const plate=bounds(build.root.getObjectByName('door-latch-plate')!);
   const doorPanels=meshes(build.root,name=>name==='entrance-door'||name.startsWith('door-board-'));
   assert.ok(doorPanels.some(panel=>bounds(panel).expandByScalar(1e-6).intersectsBox(plate)),'latch plate floats off the selected door detail');
   for(const side of [-1,1])assert.ok(bounds(build.root.getObjectByName('entrance-jamb-'+side)!).intersectsBox(lintel));
   const roof=bounds(build.root.getObjectByName('work-bay-roof')!);
   const cover=meshes(build.root,name=>name.startsWith('work-bay-cover-'));
   assert.ok(cover.length>0,'work bay has no protective cover over its support deck');
   for(const piece of cover)assert.ok(bounds(piece).intersectsBox(roof),'work-bay cover floats above its support');
   for(const end of [-1,1])assert.ok(bounds(build.root.getObjectByName('work-bay-header-'+end)!).intersectsBox(roof),'bay header floats from roof');
   const side=workBay==='left'?-1:1,w=Number(build.config.applied.width);
   assert.ok(side<0?roof.max.x>-w/2:roof.min.x<w/2,'bay roof is detached from its wall');
  }finally{disposeAsset(build);}
 }
});

test('utility hood forms a pitched protective mass through flare limits',()=>{
 for(const bodyWidth of [.22,.44])for(const hoodFlare of [.08,.3]){
  const build=buildAsset('work-lantern',{construction:'utility',bodyWidth,bodyHeight:.18,handleClearance:.075,hoodFlare});
  try{
   const hood=bounds(build.root.getObjectByName('hood')!).getSize(new Vector3());
   assert.ok(hood.y>=hood.x*.23,'utility hood collapses into a broad plate');
   assert.ok(bounds(build.root.getObjectByName('base')!).getSize(new Vector3()).x>=bounds(build.root.getObjectByName('enclosure')!).getSize(new Vector3()).x);
  }finally{disposeAsset(build);}
 }
});

test('utility carry mounts seat into the actual hood surface across their footprint',()=>{
 for(const input of [
  {bodyWidth:.22,bodyHeight:.297,handleClearance:.143},
  {bodyWidth:.4,bodyHeight:.235,handleClearance:.13},
  {bodyWidth:.44,bodyHeight:.18,handleClearance:.075},
  {bodyWidth:.44,bodyHeight:.36,handleClearance:.19},
 ])for(const hoodFlare of [.08,.18,.3])for(const handleProfile of ['square','arched'])for(const enclosureProfile of ['square','octagonal']){
  const build=buildAsset('work-lantern',{...input,construction:'utility',hoodFlare,handleProfile,enclosureProfile});
  try{
   const hood=build.root.getObjectByName('hood')!,w=input.bodyWidth;
   for(const side of [-1,1]){
    const seat=build.root.getObjectByName('handle-seat-'+side)!,center=seat.position.x;
    for(const dx of [-.04,0,.04])for(const zf of [-.05,0,.05]){
     const x=center+dx*w,z=zf*w;
     const surface=new Raycaster(new Vector3(x,5,z),new Vector3(0,-1,0)).intersectObject(hood)[0]?.point.y;
     const underside=new Raycaster(new Vector3(x,0,z),new Vector3(0,1,0)).intersectObject(seat)[0]?.point.y;
     assert.ok(surface!==undefined&&underside!==undefined,'hood or mount footprint is missing');
     const penetration=surface-underside;
     assert.ok(penetration>=w*.004&&penetration<=w*.04,'mount must meet the sloping hood with restrained penetration '+JSON.stringify({input,hoodFlare,handleProfile,enclosureProfile,side,x,z,penetration}));
    }
   }
   const gap=build.handleGap!;
   for(const xf of [-.24,0,.24])for(const yf of [.05,.5,.95])assert.equal(new Raycaster(new Vector3(xf*gap.width,gap.bottom+yf*gap.height,2),new Vector3(0,0,-1)).intersectObject(build.root,true).length,0);
   assert.equal(gap.height,input.handleClearance);
   assert.deepEqual(inspectGeometry(build.root).errors,[]);
  }finally{disposeAsset(build);}
 }
});

test('rustic hood retains its classic sloped cover independently of the raised vent cap',()=>{
 for(const hoodRise of [.75,1.25])for(const hoodFlare of [.08,.3]){
  const build=buildAsset('work-lantern',{construction:'rustic',hoodRise,hoodFlare});
  try{
   const hood=bounds(build.root.getObjectByName('hood')!).getSize(new Vector3());
   assert.ok(hood.y>=hood.x*.13,'rustic cover collapses into stacked flat rims');
   assert.ok(build.root.getObjectByName('oil-reservoir'));
   assert.ok(build.root.getObjectByName('vented-cap'));
   assert.ok(bounds(build.root.getObjectByName('vented-cap')!).max.y>bounds(build.root.getObjectByName('hood')!).max.y);
  }finally{disposeAsset(build);}
 }
});

test('lantern supports and carry openings survive both constructions and valid difficult shapes',()=>{
 for(const construction of ['utility','rustic'])for(const input of [
  {bodyWidth:.22,bodyHeight:.297,handleClearance:.143,guardCount:6,frameWeight:'light',enclosureProfile:'octagonal',handleProfile:'arched',carryHoop:'tall',hoodRise:1.25},
  {bodyWidth:.44,bodyHeight:.18,handleClearance:.075,guardCount:3,frameWeight:'heavy',enclosureProfile:'square',handleProfile:'square',carryHoop:'round',hoodRise:.75},
 ]){
  const build=buildAsset('work-lantern',{...input,construction});
  try{
   assert.deepEqual(inspectGeometry(build.root).errors,[]);
   assert.ok(Math.abs(build.bounds.min.y)<1e-7);
   const gap=build.handleGap!;
   assert.equal(gap.height,input.handleClearance);
   for(const xf of [-.24,0,.24])for(const yf of [.05,.5,.95]){
    const hits=new Raycaster(new Vector3(xf*gap.width,gap.bottom+yf*gap.height,2),new Vector3(0,0,-1)).intersectObject(build.root,true);
    assert.equal(hits.length,0,'declared carrying gap is occluded');
   }
   const guards=meshes(build.root,name=>name.startsWith('guard-upright-'));
   assert.equal(guards.length,input.guardCount);
   const lower=bounds(build.root.getObjectByName('lower-frame')!),upper=bounds(build.root.getObjectByName('upper-frame')!);
   for(const guard of guards){
    assert.ok(bounds(guard).intersectsBox(lower),'guard misses lower support');
    assert.ok(bounds(guard).intersectsBox(upper),'guard misses upper support');
   }
   for(const side of [-1,1])assert.ok(bounds(build.root.getObjectByName('handle-seat-'+side)!).intersectsBox(bounds(build.root.getObjectByName('handle')!)),'carry seat misses handle');
  }finally{disposeAsset(build);}
 }
});

test('lantern color changes leave construction intact and invalid relationships remain rejected',()=>{
 for(const construction of ['utility','rustic']){
  const a=buildAsset('work-lantern',{construction}),b=buildAsset('work-lantern',{construction,'color.body':'#a75f49'});
  try{assert.deepEqual(geometrySnapshot(a.root),geometrySnapshot(b.root));}finally{disposeAsset(a);disposeAsset(b);}
  assert.throws(()=>buildAsset('work-lantern',{construction,bodyWidth:.22,bodyHeight:.36}),/bodyHeight/);
  assert.throws(()=>buildAsset('work-lantern',{construction,bodyWidth:.22,handleClearance:.19}),/handleClearance/);
 }
 assert.throws(()=>buildAsset('cottage',{width:3.6,roofRise:2}),/Roof rise/);
});
