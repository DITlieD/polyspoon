import './node-platform.ts';
import { z } from 'zod';
import { catalog, buildAsset, disposeAsset, descriptor, loadDesign } from '../src/catalog/index.ts';
import { designInput } from '../src/catalog/appearance.ts';
import { exportDeliverable } from '../src/catalog/delivery.ts';
import { inspectGeometry } from '../src/lantern/inspect.ts';
import { measurements } from '../src/catalog/measure.ts';
import { sha256, sourceProvenance } from './provenance.ts';

const requestSchema=z.discriminatedUnion('operation',[
  z.object({protocolVersion:z.literal(1),operation:z.literal('catalog')}).strict(),
  z.object({protocolVersion:z.literal(1),operation:z.literal('resolve'),design:z.unknown()}).strict(),
  z.object({protocolVersion:z.literal(1),operation:z.literal('build'),family:z.string().optional(),preset:z.string().optional(),
    parameters:z.record(z.string(),z.unknown()).optional(),design:z.unknown().optional(),edits:z.record(z.string(),z.unknown()).optional()}).strict(),
]);

async function readRequest():Promise<string> {
  const chunks:Buffer[]=[];
  let size=0;
  for await(const chunk of process.stdin) {
    const bytes=Buffer.from(chunk);
    size+=bytes.length;
    if(size>1024*1024)throw new Error('Request exceeds 1 MiB');
    chunks.push(bytes);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function run():Promise<void> {
  if(process.argv.length!==2)throw new Error('No command-line arguments are supported');
  const inputRequest=JSON.parse(await readRequest());
  for(const key of Object.keys(inputRequest?.edits??{}))if(['__proto__','constructor','prototype'].includes(key))throw new Error('Unknown edit control: '+key);
  const request=requestSchema.parse(inputRequest);
  const before=await sourceProvenance();
  if(request.operation==='catalog') {
    process.stdout.write(JSON.stringify({protocolVersion:1,sourceHash:before.sourceHash,recipes:catalog.map(d=>({
      id:d.id,version:d.version,title:d.title,description:d.description,controls:d.controls,defaults:d.defaults,presets:d.presets,palettes:d.palettes,
    }))}));
    return;
  }
  if(request.operation==='resolve') {
    if(request.design===undefined)throw new Error('Resolve requires a saved design');
    const design=loadDesign(request.design);
    if((await sourceProvenance()).sourceHash!==before.sourceHash)throw new Error('Source changed during resolution');
    process.stdout.write(JSON.stringify({protocolVersion:1,sourceHash:before.sourceHash,design}));
    return;
  }
  if(request.design!==undefined && (request.family!==undefined || request.preset!==undefined || request.parameters!==undefined))
    throw new Error('Saved design cannot be combined with family, preset or parameters');
  const saved=request.design===undefined?undefined:loadDesign(request.design);
  if(!saved && !request.family)throw new Error('Build requires a family or saved design');
  const family=saved?.family??request.family!;
  const d=descriptor(family);
  if(request.edits!==undefined&&!saved)throw new Error('Edits require a saved design');
  for(const key of Object.keys(request.edits??{}))if(!d.controls.some(control=>control.key===key))throw new Error('Unknown edit control: '+key);
  const preset=request.preset===undefined?undefined:d.presets.find(p=>p.id===request.preset);
  if(request.preset!==undefined && !preset)throw new Error('Unknown preset: '+request.preset);
  const input=saved?{...designInput(saved),...request.edits}:{...preset?.parameters,...request.parameters};
  const build=buildAsset(family,input);
  if(saved?.migration)build.config.migration=saved.migration;
  try {
    const geometry=inspectGeometry(build.root);
    if(geometry.errors.length)throw new Error(geometry.errors.join('; '));
    const bytes=await exportDeliverable(build);
    if(bytes.byteLength>16*1024*1024)throw new Error('GLB exceeds 16 MiB');
    if((await sourceProvenance()).sourceHash!==before.sourceHash)throw new Error('Source changed during generation');
    process.stdout.write(JSON.stringify({protocolVersion:1,sourceHash:before.sourceHash,design:build.config,geometry,
      measurements:measurements(build),glbSha256:sha256(bytes),glbBase64:Buffer.from(bytes).toString('base64')}));
  } finally {disposeAsset(build);}
}

const deadline=setTimeout(()=>{process.stderr.write('Unity bridge: process deadline exceeded\n');process.exit(1);},30000);
run().catch(error=>{process.stderr.write('Unity bridge: '+String(error instanceof Error?error.message:error).slice(0,8192)+'\n');process.exitCode=1;})
  .finally(()=>{clearTimeout(deadline);});
