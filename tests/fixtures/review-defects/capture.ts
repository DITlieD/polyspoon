import '../../../scripts/node-platform.ts';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,resolve} from 'node:path';
import {chromium} from 'playwright-core';
import {createServer} from 'vite';
import {sourceProvenance,sha256} from '../../../scripts/provenance.ts';
import {disposeAsset} from '../../../src/catalog/index.ts';
import {exportAsset} from '../../../src/catalog/export.ts';
import {measurements} from '../../../src/catalog/measure.ts';
import {geometrySnapshot} from '../../../src/lantern/inspect.ts';
import {fixtureCases,buildFixture,fixtureFindings} from './bench-fixtures.ts';
import type {FixtureId,FixtureFinding} from './bench-fixtures.ts';
import {invalidGlbBytes,validateFixtureExport} from './export-check.ts';
import type {View} from '../../../src/studio/stage.ts';

type BrowserResult={id:FixtureId;view:View;camera:unknown;configuration:unknown;geometry:unknown;inspection:{errors:string[]};findings:FixtureFinding[]};
type FixtureApi={show(id:FixtureId,view:View):Promise<BrowserResult>;dispose():void};
const root=fileURLToPath(new URL('../../../',import.meta.url));
process.chdir(root);
const output=resolve(process.argv[2]??'evidence/revision14/defect-fixtures/diagnostic-01');
assert.ok(output.startsWith(join(root,'evidence/revision14/defect-fixtures/')));
await mkdir(output,{recursive:false});
await mkdir(join(output,'cases'));await mkdir(join(output,'renders'));
const relevant=[
 'examples/recipes/bench/index.ts','src/engine/geometry.ts','src/engine/parameters.ts','src/engine/style.ts',
 'src/catalog/index.ts','src/catalog/build.ts','src/catalog/appearance.ts','src/catalog/semantics.ts','src/catalog/measure.ts','src/catalog/export.ts',
 'src/recipes/index.ts','src/recipes/registry.ts','src/lantern/inspect.ts','src/studio/stage.ts','src/studio/framing.ts','src/studio/effects.ts',
 'tests/fixtures/review-defects/bench-fixtures.ts','tests/fixtures/review-defects/export-check.ts','tests/fixtures/review-defects/viewer.ts','tests/fixtures/review-defects/viewer.html','tests/fixtures/review-defects/capture.ts',
];
const hashes=async()=>Object.fromEntries(await Promise.all(relevant.map(async path=>[path,sha256(await readFile(path))])));
const sourceBefore=await sourceProvenance(),relevantBefore=await hashes();
await writeFile(join(output,'source-before.json'),JSON.stringify({production:sourceBefore,relevant:relevantBefore},null,2)+'\n');
const cases:unknown[]=[],captures:unknown[]=[],files:Record<string,string>={},cameras=new Map<View,unknown>(),expected=new Map<string,string>();
async function save(path:string,data:string|Uint8Array){await writeFile(join(output,path),data,{flag:'wx'});files[path]=sha256(data);}
for(const definition of fixtureCases){
 const build=buildFixture(definition.id);
 try{
  const glb=await exportAsset(build),validation=await validateFixtureExport(glb,definition.id),findings=fixtureFindings(build,definition.id);
  const geometryHash=sha256(JSON.stringify(geometrySnapshot(build.root)));
  assert.equal(validation.status,'passed');
  expected.set(definition.id,geometryHash);
  await save('cases/'+definition.id+'.glb',glb);
  await save('cases/'+definition.id+'.design.json',JSON.stringify(build.config,null,2)+'\n');
  const record={...definition,caseStatus:findings.some(f=>f.status==='failed')?'failed':'passed',geometryHash,configuration:build.config,measurements:measurements(build),validation,findings:findings.map(f=>({...f,view:f.code==='support-contact'?'oblique':'front',evidence:['cases/'+definition.id+'.glb','cases/'+definition.id+'.json','renders/'+definition.id+(f.code==='support-contact'?'-oblique.png':'-front.png')],observation:f.code==='support-contact'?'Opposing vertical surface rays measured '+Number(f.measured.gapMeters).toFixed(6)+' m between the leg top and support underside.':'Outside seat geometry measured '+Number(f.measured.actualMeters).toFixed(6)+' m for the '+f.measured.requestedMeters+' m width request.',...(f.status==='failed'?{defect:f.code==='support-contact'?'A shortened front-right leg leaves a measured unsupported gap.':'The fixture adapter discarded the width request; the seat remains at default width.'}:{})}))};
  cases.push(record);await save('cases/'+definition.id+'.json',JSON.stringify(record,null,2)+'\n');
 }finally{disposeAsset(build);}
}
const invalid=await validateFixtureExport(invalidGlbBytes,'invalid-glb');assert.equal(invalid.status,'failed');
await save('cases/invalid-glb.glb',invalidGlbBytes);await save('cases/invalid-glb.json',JSON.stringify({...invalid,view:'not-renderable',evidence:['cases/invalid-glb.glb'],observation:'The actual glTF validator rejected the supplied bytes.',defect:'Bytes contain no valid GLB header or chunks.'},null,2)+'\n');
const server=await createServer({root,configFile:false,server:{host:'127.0.0.1',port:0},logLevel:'error'});
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
let cleanup={browserClosed:false,serverClosed:false};
try{
 await server.listen();
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:800,height:800},deviceScaleFactor:1}),errors:string[]=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(server.resolvedUrls!.local[0]!+'tests/fixtures/review-defects/viewer.html');
 await page.waitForFunction(()=>Boolean((window as unknown as {fixtureReview:FixtureApi}).fixtureReview));
 for(const definition of fixtureCases)for(const view of ['front','right','oblique'] as const){
  const before=await sourceProvenance();
  assert.deepEqual(await hashes(),relevantBefore,'Relevant construction source changed before capture');
  const result=await page.evaluate(async ({id,view})=>(window as unknown as {fixtureReview:FixtureApi}).fixtureReview.show(id,view),{id:definition.id,view});
  assert.deepEqual(result.inspection.errors,[]);
  const geometryHash=sha256(JSON.stringify(result.geometry));assert.equal(geometryHash,expected.get(definition.id),'Node and browser fixture geometry differ');
  if(cameras.has(view))assert.deepEqual(result.camera,cameras.get(view),'Camera changed between fixture cases');else cameras.set(view,result.camera);
  const path='renders/'+definition.id+'-'+view+'.png';await save(path,await page.locator('canvas').screenshot());
  const after=await sourceProvenance();assert.deepEqual(await hashes(),relevantBefore,'Relevant construction source changed during capture');
  const {geometry,...metadata}=result;
  captures.push({...metadata,file:path,sha256:files[path],geometryHash,sourceBefore:before.sourceHash,sourceAfter:after.sourceHash,width:800,height:800});
  console.log('Captured '+definition.id+' '+view);
 }
 assert.deepEqual(errors,[]);
 await page.evaluate(()=>(window as unknown as {fixtureReview:FixtureApi}).fixtureReview.dispose());
 const sourceAfter=await sourceProvenance();
 await save('source-after.json',JSON.stringify({production:sourceAfter,relevant:await hashes()},null,2)+'\n');
 const manifest={kind:'test-only original bench diagnostic fixture evidence',notPublicationApproval:true,sourceBefore:sourceBefore.sourceHash,sourceAfter:sourceAfter.sourceHash,fullSourceStable:sourceBefore.sourceHash===sourceAfter.sourceHash,relevantConstructionStable:true,relevantHashes:relevantBefore,browser:browser.version(),stage:{diagnostic:true,ground:false,mode:'shaded',viewport:[800,800],sharedFraming:'changed-width bench bounds for every case; fixed span 2.8 m front/oblique, 1.3 m right'},cases,invalidExport:invalid,captures,files,coverage:['one front-right leg/support contact','outside seat-width control response','real production GLB exporter and glTF validator','fresh independent production repair','three original neutral views per case'],limits:['No general automated aesthetic judgment.','One contact sample does not prove all joints.','Valid GLB structure does not establish support contact or effective controls.','Diagnostic fixture evidence is not a successful terminal review report or publication approval.','Full production source may change during parallel work; relevant construction and node/browser geometry are checked explicitly.']};
 await writeFile(join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
}finally{
 await browser?.close();cleanup.browserClosed=true;
 await server.close();cleanup.serverClosed=true;
 await writeFile(join(output,'cleanup.json'),JSON.stringify(cleanup,null,2)+'\n');
}
console.log('Diagnostic fixture evidence saved: '+output);
