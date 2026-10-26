import { verifiedArtifactBytes } from './artifact-integrity.ts';
import type { Design } from '../catalog/index.ts';
import { designInput } from '../catalog/appearance.ts';

export interface ProceduralPackage {
  id:string;
  version:string;
  url:string;
  sha256:string;
  bytes:number;
  dependencies:{three:'0.186.1'};
  configuration:{kind:'default'};
}
export function proceduralPackageFor(input:unknown,id:string,version:string):ProceduralPackage|undefined {
  if(!input||typeof input!=='object'||!('formatVersion' in input)||input.formatVersion!==1||!('packages' in input)||!Array.isArray(input.packages))return;
  if(!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id)||!/^\d+\.\d+\.\d+$/.test(version))return;
  const entries=input.packages.filter(value=>value&&typeof value==='object'&&value.id===id&&value.version===version);
  if(entries.length!==1)return;
  const p=entries[0];
  if(p.url!=='procedural-modules/'+id+'/'+version+'/asset.mjs'||typeof p.sha256!=='string'||!/^[a-f0-9]{64}$/.test(p.sha256)||!Number.isSafeInteger(p.bytes)||p.bytes<=0||p.dependencies?.three!=='0.186.1'||p.configuration?.kind!=='default')return;
  return p as ProceduralPackage;
}
export async function verifiedModule(bytes:Uint8Array,p:ProceduralPackage):Promise<string> {
  const copy=await verifiedArtifactBytes(bytes,p,'Procedural module');
  const code=new TextDecoder('utf-8',{fatal:true}).decode(copy);
  if(code.trimStart().startsWith('<'))throw new Error('Procedural module HTML content');
  return code;
}
export function currentDesignSnippet(design:Design):string {
  return 'import { createAsset } from "./'+design.family+'-'+design.familyVersion+'.mjs";\nconst asset = createAsset('+JSON.stringify(designInput(design),null,2)+');';
}
export function mountProceduralDownload(host:HTMLElement,configuration:()=>Design,currentDesignReady:()=>boolean=()=>true){
  const section=document.createElement('section');section.className='procedural-download';
  const link=document.createElement('a');link.id='procedural-module';link.textContent='Procedural module (.mjs, family default)';
  const note=document.createElement('p');note.textContent='Uses Three 0.186.1. No arguments builds the family default. Use these parameters for your current design.';
  const snippet=document.createElement('pre');snippet.id='procedural-current-snippet';
  const current=document.createElement('a');current.id='procedural-current-design';current.textContent='Current saved design (.json)';
  const readiness=document.createElement('p');readiness.className='current-design-readiness';readiness.setAttribute('role','status');
  const status=document.createElement('p');status.className='procedural-download-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const retry=document.createElement('button');retry.type='button';retry.textContent='Retry procedural download';
  section.append(link,note,current,readiness,snippet,status,retry);host.append(section);
  const base=new URL(import.meta.env.BASE_URL,location.origin);
  let signature='',revision=0,moduleURL:string|undefined,designURL:string|undefined,serialized='',request:AbortController|undefined,disposed=false;
  function clearModule(){
    if(moduleURL)URL.revokeObjectURL(moduleURL);moduleURL=undefined;
    link.removeAttribute('href');delete link.dataset.sha256;link.tabIndex=-1;link.setAttribute('aria-disabled','true');
  }
  function clearDesign(){
    if(designURL)URL.revokeObjectURL(designURL);designURL=undefined;serialized='';
    current.removeAttribute('href');current.tabIndex=-1;current.setAttribute('aria-disabled','true');snippet.textContent='';snippet.hidden=true;
  }
  async function refresh(force=false){
    if(disposed)return;
    const design=configuration();
    if(currentDesignReady()){
      const json=JSON.stringify(design,null,2)+'\n';
      if(json!==serialized){
        clearDesign();serialized=json;
        designURL=URL.createObjectURL(new Blob([json],{type:'application/json'}));
        current.href=designURL;current.download=design.family+'-current.design.json';
      }
      current.removeAttribute('tabindex');current.removeAttribute('aria-disabled');
      snippet.textContent=currentDesignSnippet(design);snippet.hidden=false;readiness.textContent='Current saved design is ready.';
    }else{
      clearDesign();readiness.textContent='Current design unavailable while edits are pending or invalid. Correct or cancel the edits to download.';
    }
    const next=design.family+'@'+design.familyVersion;
    if(next===signature&&!force)return;
    signature=next;const ticket=++revision;request?.abort();request=new AbortController();
    const options:RequestInit={signal:request.signal,cache:force?'reload':'default'};
    clearModule();status.textContent='Loading procedural module…';retry.disabled=true;retry.hidden=false;
    try{
      const metadata=await fetch(new URL('procedural-modules/index.json',base),options);
      if(!metadata.ok)throw new Error('Procedural index unavailable');
      const entry=proceduralPackageFor(await metadata.json(),design.family,design.familyVersion);
      if(ticket!==revision)return;
      if(!entry)throw new Error('Procedural module metadata unavailable for this family version');
      const url=new URL(entry.url,base);if(url.origin!==location.origin)throw new Error('Procedural module origin mismatch');
      const response=await fetch(url,options);
      if(!response.ok||response.headers.get('content-type')?.includes('text/html'))throw new Error('Procedural module unavailable');
      const bytes=new Uint8Array(await response.arrayBuffer());
      await verifiedModule(bytes,entry);
      if(ticket!==revision)return;
      moduleURL=URL.createObjectURL(new Blob([bytes],{type:'text/javascript'}));
      link.href=moduleURL;link.download=entry.id+'-'+entry.version+'.mjs';link.dataset.sha256=entry.sha256;
      link.removeAttribute('tabindex');link.removeAttribute('aria-disabled');status.textContent='Procedural module verified.';retry.hidden=true;
    }catch(error){if(ticket===revision)status.textContent='Procedural download unavailable. '+(error instanceof Error?error.message:'Request failed');}
    finally{if(ticket===revision)retry.disabled=false;}
  }
  retry.addEventListener('click',()=>{void refresh(true);});
  function dispose(){disposed=true;++revision;request?.abort();clearModule();clearDesign();window.removeEventListener('pagehide',dispose);}
  window.addEventListener('pagehide',dispose);
  return {refresh,dispose};
}
