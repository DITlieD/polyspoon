import { controlMetadata } from '../engine/parameters.ts';
import '../../scripts/node-platform.ts';
import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { constants } from 'node:fs';
import { open, realpath, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { catalog, descriptor, buildAsset, disposeAsset, resolveExport } from '../catalog/index.ts';
import { exportDeliverable } from '../catalog/delivery.ts';
import { measurements } from '../catalog/measure.ts';
import { recipe } from '../recipes/index.ts';
import { sha256, sourceProvenance } from '../../scripts/provenance.ts';

const familySchema=z.enum(catalog.map(d=>d.id) as [string,...string[]]).describe('Family id returned by search_assets.');
const parametersSchema=z.record(z.string(),z.union([z.number(),z.string(),z.boolean()])).optional().describe('Use each control inputUnit from get_asset: meter dimensions, dimensionless ratios, integer counts/seeds and explicitly declared degree angles. Unknown parameters reject.');
const appearanceSchema=z.object({version:z.literal(1),palette:z.enum(['None','Reduced4','GameBoy','PICO8','CGA','Mono']),shading:z.enum(['None','Toon3bands','Flat']),partColors:z.record(z.string(),z.string().regex(/^#[0-9a-f]{6}$/i))}).strict().optional();
const designSchema=z.object({formatVersion:z.literal(1),family:familySchema,familyVersion:z.string(),requested:z.record(z.string(),z.unknown()),applied:z.record(z.string(),z.union([z.number(),z.string(),z.boolean()])),migration:z.object({fromVersion:z.string(),toVersion:z.string(),notice:z.string()}).strict().optional(),appearance:appearanceSchema}).strict().optional().describe('Saved versioned design, validated and migrated through the catalog. Cannot be combined with parameters or appearance.');
const variantSchema=z.object({family:familySchema.optional(),parameters:parametersSchema,appearance:appearanceSchema,design:designSchema}).strict();
function resolveVariant(input:z.infer<typeof variantSchema>){
 if(input.design!==undefined){
  if(Object.hasOwn(input,'parameters')||Object.hasOwn(input,'appearance'))throw new Error('Choose either design or parameters/appearance');
  return resolveExport({family:input.family},input.design);
 }
 if(!input.family)throw new Error('Family is required without a design');
 return {family:input.family,input:{...(input.parameters??{}),...(input.appearance?{appearance:input.appearance}:{})},migration:undefined};
}
const readonlyAnnotations={readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false};
function constraintMessages(id:string):string[] {
  return recipe(id).constraints;
}
async function result(operation:()=>unknown|Promise<unknown>) {
  try {
    const data=await operation() as Record<string,unknown>;
    return {content:[{type:'text' as const,text:JSON.stringify(data)}],structuredContent:data};
  } catch(error) {
    return {isError:true,content:[{type:'text' as const,text:error instanceof Error?error.message:String(error)}]};
  }
}
export async function createAssetServer(outputRoot:string) {
  const provenance=await sourceProvenance(), rootStat=await stat(outputRoot);
  const server=new McpServer({name:'woodland-workshop',version:'0.1.0'});
  server.registerTool('search_assets',{
    title:'Search local asset families',description:'Search registered local procedural asset families by id, title or description. Empty query lists every family. No network search.',
    inputSchema:z.object({query:z.string().max(200).default('')}).strict(),annotations:readonlyAnnotations,
  },async({query})=>result(()=>({assets:catalog.filter(d=>query.trim().toLowerCase().split(/\s+/).every(word=>(d.id+' '+d.title+' '+d.description).toLowerCase().includes(word))).map(d=>({id:d.id,version:d.version,title:d.title,description:d.description}))})));
  server.registerTool('get_asset',{
    title:'Describe an asset family',description:'Get family controls, units, constraints, defaults, palettes, presets and actual material roles before choosing variant parameters.',
    inputSchema:z.object({family:familySchema}).strict(),annotations:readonlyAnnotations,
  },async({family})=>result(()=>{
    const d=descriptor(family), b=buildAsset(family);
    try{return {id:d.id,version:d.version,title:d.title,description:d.description,units:'meters',up:'+Y',front:'+Z',controls:controlMetadata(d.controls),constraints:constraintMessages(family),defaults:b.config.applied,presets:d.presets,palettes:d.palettes,materialRoles:Object.keys(b.materials),semantics:b.semantics};}
    finally{disposeAsset(b);}
  }));
  server.registerTool('build_variant',{
    title:'Validate and build a variant',description:'Build a deterministic variant from parameters or a saved design through the production catalog. Returns resolved versioned configuration, dimensions in meters, triangles, anchors and part/material counts. Writes no files.',
    inputSchema:variantSchema,annotations:readonlyAnnotations,
  },async(input)=>result(()=>{
    const resolved=resolveVariant(input),b=buildAsset(resolved.family,resolved.input);
    if(resolved.migration)b.config.migration=resolved.migration;
    try {const measured=measurements(b);return {configuration:b.config,dimensions:b.dimensions.toArray(),dimensionsOrder:['width','height','depth'],dimensionsUnit:'m',triangles:measured.triangles,anchors:b.anchors,parts:measured.parts.length,materialRoles:Object.keys(b.materials),semantics:b.semantics};}
    finally{disposeAsset(b);}
  }));
  server.registerTool('export_asset',{
    title:'Export a local GLB',description:'Validate parameters or migrate a saved design and export through the shared production GLB exporter. Creates one new file in the startup output directory. Existing filenames are rejected; omit filename for a unique name.',
    inputSchema:variantSchema.extend({filename:z.string().max(100).regex(/^[a-z0-9][a-z0-9._-]*\.glb$/).optional().describe('Simple lowercase GLB basename only. No paths, directories or overwrite option.')}).strict(),
    annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:false},
  },async(input)=>result(async()=>{
    const current=await sourceProvenance();
    if(current.sourceHash!==provenance.sourceHash)throw new Error('Project sources changed after server startup. Restart the MCP server before exporting.');
    if(await realpath(outputRoot)!==outputRoot)throw new Error('Output directory identity changed. Restart the server.');
    const now=await stat(outputRoot);
    if(now.ino!==rootStat.ino||now.dev!==rootStat.dev)throw new Error('Output directory identity changed. Restart the server.');
    const resolved=resolveVariant(input),b=buildAsset(resolved.family,resolved.input);
    if(resolved.migration)b.config.migration=resolved.migration;
    try {
      const bytes=await exportDeliverable(b);
      if((await sourceProvenance()).sourceHash!==provenance.sourceHash)throw new Error('Project sources changed during export. Restart the MCP server.');
      const path=join(outputRoot,input.filename??resolved.family+'-'+randomUUID()+'.glb');
      let file;
      try {file=await open(path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);}
      catch(error) {
        if((error as NodeJS.ErrnoException).code==='EEXIST')throw new Error('Output already exists. Choose a new filename; files are never overwritten.');
        throw error;
      }
      try{await file.writeFile(bytes);await file.sync();}finally{await file.close();}
      return {path,bytes:bytes.byteLength,sha256:sha256(bytes),configuration:b.config,configSha256:sha256(JSON.stringify(b.config)),provenance:{sourceHash:provenance.sourceHash,lockHash:provenance.lockHash,node:provenance.node}};
    }finally{disposeAsset(b);}
  }));
  return server;
}
