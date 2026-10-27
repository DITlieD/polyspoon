import { forgeRecipes } from '../src/recipes/forge.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {Mesh} from 'three';
import {catalog,buildAsset,disposeAsset,loadDesign,resolveExport,descriptor} from '../src/catalog/index.ts';
import {DesignSession} from '../src/catalog/session.ts';
import {saveFamilyConfiguration as saveRevision3} from '../src/families/revision3-config.ts';
import {saveFamilyConfiguration as saveRevision2} from '../src/families/revision2-config.ts';
import {saveConfiguration as saveLantern3} from '../src/lantern/revision3-config.ts';
import {saveConfiguration as saveLantern2} from '../src/lantern/revision2-config.ts';
import type {Family} from '../src/families/config.ts';
import {legacyFamilies} from '../src/families/legacy-config.ts';
import {loadTypedLegacyConfiguration} from '../src/families/legacy-typed-config.ts';
import type {Design} from '../src/engine/parameters.ts';
// Forge families (src/recipes/forge.ts) are new, unpublished additions with no prior baseline.
// Forge families come from the registry list so each new forge family does not need three test edits.
const forgeIds=forgeRecipes.map(r=>r.descriptor.id);
const builtins=['work-lantern','cottage','tree','fence','crate','boulder'];
const publishedPriorFamilies=[...builtins,'bench','planter','treasure-chest','wheelbarrow','stone-well','conifer'];
const priorVersion=(id:string)=>{if(!publishedPriorFamilies.includes(id))throw Error('No published construction baseline for '+id);return builtins.includes(id)?'0.5.0':'1.0.0';};
async function prior(id:string,input={}){const module=await import(pathToFileURL(resolve('public/procedural-modules',id,priorVersion(id),'asset.mjs')).href),root=module.createAsset(input);try{return structuredClone(root.userData.configuration) as Design;}finally{module.disposeAsset(root);}}
// 1.2.0 revisions only add controls whose defaults keep the accepted construction (stone-well roofStyle, conifer lean, planter foot pads and fill).
const addedControls:Record<string,string[]>={'stone-well':['roofStyle'],conifer:['lean'],planter:['footPads','fill']};
const appearance={version:1 as const,palette:'None' as const,shading:'None' as const,partColors:{'ridge-cap-0':'#aabbcc','roof-left-band-0':'#112233','actually-missing':'#123456'}};
test('new construction revisions validate prior public designs and current reloads',async()=>{
 assert.equal(publishedPriorFamilies.length,12);
 assert.deepEqual(catalog.map(d=>d.id).sort(),[...publishedPriorFamilies,'stylized-humanoid','stylized-fox','rigged-rabbit',...forgeIds].sort());
 for(const id of publishedPriorFamilies){const d=descriptor(id);assert.equal(d.version,builtins.includes(d.id)?'0.6.0':['stone-well','conifer','planter'].includes(d.id)?'1.2.0':'1.1.0');const old=await prior(d.id),next=loadDesign(old);assert.equal(next.familyVersion,d.version);{const added=addedControls[d.id]??[],applied=Object.fromEntries(Object.entries(next.applied).filter(([k])=>!added.includes(k)));assert.deepEqual(applied,old.applied);if(d.id==='stone-well')assert.equal(next.applied.roofStyle,'gable');if(d.id==='conifer')assert.equal(next.applied.lean,0);if(d.id==='planter'){assert.equal(next.applied.fill,'none');assert.equal(next.applied.footPads,false);}}assert.equal(next.migration?.fromVersion,old.familyVersion);assert.equal(next.migration?.toVersion,d.version);assert.match(next.migration!.notice,d.id==='fence'?/fence geometry is unchanged/:/prior geometry is not reproduced/);assert.match(next.migration!.notice,/Indexed part layouts/);assert.deepEqual(loadDesign(JSON.parse(JSON.stringify(next))),next);assert.equal(resolveExport({},old).migration?.notice,next.migration?.notice);assert.equal(descriptor(d.id).save({}).migration,undefined);}
});
test('reviewed rig current versions reload without an invented prior publication',()=>{
 for(const [id,version] of Object.entries({'stylized-humanoid':'1.1.0','stylized-fox':'1.2.0'})){
  const d=descriptor(id),saved=d.save({});assert.equal(d.version,version);assert.equal(saved.familyVersion,version);assert.equal(saved.migration,undefined);assert.deepEqual(loadDesign(saved),saved);
 }
});
test('strict prior and current records reject tampering unknown versions and forged notices',async()=>{
 for(const d of catalog)for(const source of [...(publishedPriorFamilies.includes(d.id)?[await prior(d.id)]:[]),d.save({})]){
  const key=Object.keys(source.applied)[0]!,numeric=d.controls.find(c=>c.kind==='range'||c.kind==='integer')! as {key:string;min:number};
  for(const bad of [{...source,extra:true},{...source,formatVersion:2},{...source,familyVersion:'99.0.0'},{...source,requested:{...source.requested,unknown:true}},{...source,requested:{...source.requested,[numeric.key]:numeric.min-1}},{...source,requested:{...source.requested,[numeric.key]:NaN}},{...source,applied:{...source.applied,[key]:'forged'}},{...source,applied:{...source.applied,extra:1}},{...source,migration:{fromVersion:'99.0.0',toVersion:source.familyVersion,notice:'forged'}},{...source,[Symbol('extra')]:true},{...source,applied:{...source.applied,[Symbol('extra')]:true}},{...source,requested:{...source.requested,[Symbol('extra')]:true}}])assert.throws(()=>loadDesign(bad),d.id);
  const incomplete={...source.applied};delete incomplete[key];assert.throws(()=>loadDesign({...source,applied:incomplete}));
 }
 const migrated=loadDesign(await prior('cottage'));for(const patch of [{notice:'forged'},{toVersion:'0.5.0'},{fromVersion:'99.0.0'},{extra:1},{[Symbol('extra')]:1}])assert.throws(()=>loadDesign({...migrated,migration:{...migrated.migration,...patch}}));
});
test('earlier supported built-in validator chains remain available',()=>{
 const original=Object.entries(legacyFamilies).map(([family,schema])=>({formatVersion:1,family,familyVersion:'0.1.0',requested:{},applied:{...schema.defaults}}));
 const lanternOriginal={formatVersion:1,family:'work-lantern',familyVersion:'1.0.0',requested:{},applied:{bodyWidth:.32,bodyHeight:.26,handleClearance:.115,colorway:'forest'}};
 const typed=Object.entries(legacyFamilies).filter(([family])=>family!=='cottage').map(([family,schema])=>{const baseline=saveRevision2(family as Family,{}),keys=Object.keys(schema.defaults),roles=family==='tree'?['timber','foliage','foliageShade','foliageLight']:family==='fence'||family==='crate'?['timber','wood']:['stone'];const candidate={formatVersion:1,family,familyVersion:'0.2.0',requested:{},applied:Object.fromEntries([...keys,...roles.map(role=>'color.'+role)].map(key=>[key,baseline.applied[key]]))};return loadTypedLegacyConfiguration(candidate);});
 const old=[...original,lanternOriginal,...typed,saveLantern2({}),saveLantern3({}),...(['cottage','tree','fence','crate','boulder'] as Family[]).flatMap(f=>[saveRevision2(f,{}),saveRevision3(f,{})])];
 for(const input of old){const next=loadDesign(input);assert.equal(next.familyVersion,'0.6.0');assert.equal(next.migration?.fromVersion,input.familyVersion);assert.deepEqual(loadDesign(next),next);assert.throws(()=>loadDesign({...input,applied:{...input.applied,extra:1}}));}
});
test('migrated part colors remain explicit through load session editing history and export resolution',async()=>{
 const old=await prior('cottage',{width:7.2});old.appearance=appearance;const loaded=loadDesign(old);assert.deepEqual(loaded.appearance,appearance);assert.deepEqual(loadDesign(loaded),loaded);
 const session=new DesignSession();try{
  disposeAsset(session.load(old));const notice=session.config.migration;assert.ok(notice);assert.deepEqual(session.build.root.userData.inactivePartColors,['roof-left-band-0','actually-missing']);
  const cap=session.build.root.getObjectByName('ridge-cap-0') as Mesh;assert.equal((cap.material as any).color.getHexString(),'aabbcc');const newCap=session.build.root.getObjectByName('ridge-cap-5') as Mesh;assert.notEqual((newCap.material as any).color.getHexString(),'aabbcc');
  disposeAsset(session.apply({...session.config.requested,width:7}));assert.deepEqual(session.config.migration,notice);const undo=session.undo();assert.ok(undo);disposeAsset(undo);assert.deepEqual(session.config.migration,notice);const redo=session.redo();assert.ok(redo);disposeAsset(redo);assert.deepEqual(session.config.migration,notice);
  disposeAsset(session.setAppearance({...appearance,partColors:{...appearance.partColors,'ridge-cap-1':'#abcdef'}}));assert.deepEqual(session.config.migration,notice);disposeAsset(session.select('bench'));disposeAsset(session.select('cottage'));assert.deepEqual(session.config.migration,notice);
  const exported=resolveExport({},session.config);assert.deepEqual(exported.migration,notice);const rebuilt=buildAsset(exported.family,exported.input);try{assert.deepEqual(rebuilt.config.appearance,session.config.appearance);assert.deepEqual(rebuilt.root.userData.inactivePartColors,['roof-left-band-0','actually-missing']);}finally{disposeAsset(rebuilt);}
  assert.throws(()=>loadDesign({...old,appearance:{...appearance,partColors:{'ridge-cap-0':'red'}}}));disposeAsset(session.reset());assert.equal(session.config.migration,undefined);
 }finally{session.dispose();}
});
test('boulder copy describes exposed construction without changing controls or solid',()=>{
 const d=descriptor('boulder'),c=(key:string)=>d.controls.find(c=>c.key===key)!;assert.match(c('width').label,/scale/i);assert.match(c('depth').label,/scale/i);assert.match(c('height').hint,/burial/i);assert.match(c('burialDepth').hint,/exposed/i);assert.match(c('mossCoverage').hint,/continuous/i);for(const key of ['crest','shoulderHeight']){assert.match(c(key).hint,/unburied/i);assert.match(c(key).hint,/burial.*exposed height/i);assert.doesNotMatch(c(key).hint,/total height is preserved|normalized to the requested total height/i);}const b=buildAsset('boulder');try{for(const [actual,expected] of b.dimensions.toArray().map((n,i)=>[n,[1.76,.836,1.38][i]!]))assert.ok(Math.abs(actual!-expected!)<.006);}finally{disposeAsset(b);}
});

test('boulder descriptor changes only labels and hints relative to the published schema',async()=>{
 const module=await import(pathToFileURL(resolve('public/procedural-modules/boulder/0.5.0/asset.mjs')).href);
 const schema=(controls:any[])=>controls.map(({label,hint,inputUnit,displayUnit,...control})=>control);
 assert.deepEqual(schema(descriptor('boulder').controls),schema(module.metadata.controls));
});

test('only the reviewed fence version pair claims unchanged geometry',async()=>{
 const recent=loadDesign(await prior('fence'));assert.match(recent.migration!.notice,/fence geometry is unchanged/);assert.deepEqual(loadDesign(recent),recent);
 for(const input of [saveRevision3('fence',{}),{formatVersion:1,family:'fence',familyVersion:'0.1.0',requested:{},applied:{length:3,height:1.1,bays:2,colorway:'forest'}}]){
  const next=loadDesign(input);assert.match(next.migration!.notice,/Construction revised; prior geometry is not reproduced/);assert.doesNotMatch(next.migration!.notice,/geometry is unchanged/);assert.deepEqual(loadDesign(next),next);
  assert.throws(()=>loadDesign({...next,migration:{...next.migration,notice:recent.migration!.notice}}));
 }
 const {constructionNotice}=await import('../src/engine/construction-migration.ts');assert.doesNotMatch(constructionNotice('fence','0.5.0','0.7.0').notice,/geometry is unchanged/);
});

test('studio snapshots preserve only canonical validated migration metadata',async()=>{
 const {buildDesignSnapshot}=await import('../src/studio/design-snapshot.ts');const old=await prior('cottage',{width:7.2});old.appearance=appearance;const expected=loadDesign(old),snapshot=buildDesignSnapshot(expected),fresh=buildDesignSnapshot(descriptor('cottage').save({}));try{assert.deepEqual(snapshot.config,expected);assert.equal(snapshot.root.userData.configuration.migration.notice,expected.migration!.notice);assert.deepEqual(snapshot.config.appearance,appearance);assert.equal(fresh.config.migration,undefined);assert.equal(fresh.root.userData.configuration.migration,undefined);assert.throws(()=>buildDesignSnapshot({...expected,migration:{...expected.migration,notice:'forged'}}));assert.throws(()=>buildDesignSnapshot({...expected,applied:{...expected.applied,width:6}}));}finally{disposeAsset(snapshot);disposeAsset(fresh);}
});
