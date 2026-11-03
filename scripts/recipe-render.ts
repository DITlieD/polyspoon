import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { descriptor, resolveExport, buildAsset, disposeAsset, loadDesign } from '../src/catalog/index.ts';
import type { Design } from '../src/catalog/index.ts';
import type { View, Mode } from '../src/studio/stage.ts';
import { sourceProvenance, sha256 } from './provenance.ts';

export interface RecipeRenderOptions { family:string; output:string; preset?:string; config?:string }
interface RecipeDiagnostics {
  select(id:string):boolean;
  apply(input:unknown,frame?:boolean):boolean;
  configuration():Design;
  view(view:View,span?:number):void;
  mode(mode:Mode):void;
  diagnostic(enabled:boolean):void;
  render():void;
  inspect():{errors:string[]};
  camera():unknown;
}

export function prepareRenderDesign(family:string,input:unknown,migration?:Design['migration']):Design {
 const build=buildAsset(family,input);
 try{return loadDesign({...build.config,...(migration?{migration}:{} )});}finally{disposeAsset(build);}
}

export const renderConfigurationReadySource=`expected=>{
 const ordered=value=>{
  if(Array.isArray(value))return value.map(ordered);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,item])=>[key,ordered(item)]));
  return value;
 };
 const actual=window.workshopDiagnostics.configuration();
 return JSON.stringify(ordered(actual))===JSON.stringify(ordered(expected));
}`;

export function applyRenderInput(input:unknown) {
  const api=(window as unknown as {workshopDiagnostics:RecipeDiagnostics}).workshopDiagnostics;
  const reset=document.getElementById('reset');
  if(!reset)throw new Error('Render reset control is missing');
  reset.click();
  if(!api.apply(input,true))throw new Error('Render parameters rejected');
}

export function parseRenderOptions(args:string[]):RecipeRenderOptions {
  const values = new Map<string,string>();
  for(let i=0;i<args.length;i+=2) {
    const key=args[i]!,value=args[i+1];
    if(!['--family','--out','--preset','--config'].includes(key) || !value || value.startsWith('--') || values.has(key)) throw new Error('Use --family ID --out fresh-directory [--preset ID | --config path]');
    values.set(key,value);
  }
  const family=values.get('--family'),output=values.get('--out');
  if(!family || !output)throw new Error('--family and --out are required');
  if(values.has('--preset') && values.has('--config'))throw new Error('Choose preset or config, not both');
  const d=descriptor(family),preset=values.get('--preset');
  if(preset && !d.presets.some(p=>p.id===preset))throw new Error('Unknown preset: '+preset);
  return {family,output:resolve(output),preset,config:values.has('--config')?resolve(values.get('--config')!):undefined};
}

export async function renderRecipe(options:RecipeRenderOptions) {
  const d=descriptor(options.family);
  const savedText=options.config?await readFile(options.config,'utf8'):undefined;
  const selected=options.config || options.preset
    ? resolveExport({family:options.family,preset:options.preset},savedText===undefined?undefined:JSON.parse(savedText))
    : {family:options.family,input:{},migration:undefined};
  const before=await sourceProvenance();
  await mkdir(dirname(resolve(options.output)),{recursive:true});await mkdir(options.output,{recursive:false});
  const server=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),server:{host:'127.0.0.1',port:0},logLevel:'error'});
  let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
  const errors:string[]=[],captures:unknown[]=[],files:Record<string,string>={};
  try {
    await server.listen();
    browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
    const page=await browser.newPage({viewport:{width:768,height:768},deviceScaleFactor:1});
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(server.resolvedUrls!.local[0]!+'?diagnostic=1');
    await page.waitForFunction(()=>Boolean((window as unknown as {workshopDiagnostics:RecipeDiagnostics}).workshopDiagnostics));
    const accepted=await page.evaluate(id=>(window as unknown as {workshopDiagnostics:RecipeDiagnostics}).workshopDiagnostics.select(id),d.id);
    assert.equal(accepted,true,'Diagnostic stage rejected recipe');
    async function capture(name:string,input:unknown,view:View,size:number,migration?:Design['migration']) {
      const expected=prepareRenderDesign(d.id,input,migration);
      await page.setViewportSize({width:size,height:size});
      if(migration){
        await page.locator('#file').setInputFiles({name:'selected.design.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(expected))});
        await page.waitForFunction(renderConfigurationReadySource,expected);
      }else await page.evaluate(applyRenderInput,input);
      const state=await page.evaluate(async (view)=>{
        const api=(window as unknown as {workshopDiagnostics:RecipeDiagnostics}).workshopDiagnostics;
        api.diagnostic(true);api.mode('shaded');api.view(view);
        for(let i=0;i<6;i++)await new Promise(requestAnimationFrame);
        api.render();
        return {configuration:api.configuration(),inspection:api.inspect(),camera:api.camera()};
      },view);
      assert.deepEqual(state.configuration,expected,'Browser and canonical configuration differ');
      assert.deepEqual(state.inspection.errors,[]);
      const bytes=await page.locator('canvas').screenshot();
      await writeFile(join(options.output,name),bytes,{flag:'wx'});
      files[name]=sha256(bytes);
      captures.push({file:name,view,mode:'shaded',width:size,height:size,...state,configurationSha256:sha256(JSON.stringify(state.configuration))});
    }
    for(const view of ['front','rear','left','right','top','oblique','rear-oblique'] as const)await capture('selected-'+view+'.png',selected.input,view,768,selected.migration);
    for(const preset of d.presets) {
      await capture('preset-'+preset.id+'-oblique.png',preset.parameters,'oblique',768);
      await capture(d.id+'-'+preset.id+'.png',preset.parameters,'oblique',512);
    }
    if(errors.length)throw new Error(errors.join('; '));
    const after=await sourceProvenance();
    assert.equal(after.sourceHash,before.sourceHash,'Sources changed during rendering; do not accept this capture directory');
    const renderer=await page.evaluate(()=>{
      const gl=document.querySelector('canvas')!.getContext('webgl2')!;
      const extension=gl.getExtension('WEBGL_debug_renderer_info');
      return {vendor:gl.getParameter(extension?.UNMASKED_VENDOR_WEBGL??gl.VENDOR),renderer:gl.getParameter(extension?.UNMASKED_RENDERER_WEBGL??gl.RENDERER)};
    });
    const manifest={family:d.id,version:d.version,before,after,browser:browser.version(),renderer,inputFileSha256:savedText===undefined?undefined:sha256(savedText),stage:{diagnostic:true,ground:false,framing:'orthographic',mode:'shaded',colorSpace:'sRGB',toneMapping:'none'},captures,files};
    await writeFile(join(options.output,'manifest.json'),JSON.stringify(manifest,null,2),{flag:'wx'});
    return {output:options.output,images:Object.keys(files).length,sourceHash:before.sourceHash};
  } finally {await browser?.close();await server.close();}
}

async function main() {
  const options=parseRenderOptions(process.argv.slice(2));
  process.chdir(fileURLToPath(new URL('../',import.meta.url)));
  console.log(JSON.stringify(await renderRecipe(options)));
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await main();
