import { sourceDeliveryFor,sourcePackageFilename } from '../../scripts/recipe-package-identity.ts';
import { mountProceduralDownload } from './procedural-download.ts';
import { verifiedArtifactBytes } from './artifact-integrity.ts';
import type { Design } from '../catalog/index.ts';

export interface SourcePackage {
  id:string;
  version:string;
  url:string;
  deliveryRevision?:number;
  sha256:string;
  bytes:number;
  configuration:{path:'config.json';kind:'default'};
  licenses?:{software?:string;content?:string;contentPaths?:string[];thirdParty?:string};
}

export function sourcePackageFor(input:unknown,id:string,version:string):SourcePackage|undefined {
  if(!input || typeof input!=='object' || !('formatVersion' in input) || (input.formatVersion!==1&&input.formatVersion!==2) || !('packages' in input) || !Array.isArray(input.packages))return;
  const entries=input.packages.filter(value=>value && typeof value==='object' && value.id===id && value.version===version);
  if(entries.length!==1)return;
  const entry=entries[0];
  if(!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id) || !/^\d+\.\d+\.\d+$/.test(version))return;
  const delivery=sourceDeliveryFor(input.formatVersion,entry.deliveryRevision);
  if(!delivery)return;
  if(entry.url!=='recipe-packages/'+sourcePackageFilename(id,version,delivery.deliveryRevision) || typeof entry.sha256!=='string' || !/^[a-f0-9]{64}$/.test(entry.sha256) || !Number.isSafeInteger(entry.bytes) || entry.bytes<=0)return;
  if(entry.configuration?.kind!=='default' || entry.configuration.path!=='config.json')return;
  return {id,version,deliveryRevision:delivery.deliveryRevision,url:entry.url,sha256:entry.sha256,bytes:entry.bytes,configuration:{path:'config.json',kind:'default'},licenses:entry.licenses};
}

export async function verifiedSource(bytes:Uint8Array,p:SourcePackage):Promise<Uint8Array<ArrayBuffer>> {
  const copy=await verifiedArtifactBytes(bytes,p,'Source package');
  if(copy[0]!==0x50||copy[1]!==0x4b||copy[2]!==3||copy[3]!==4)throw new Error('Source package ZIP signature mismatch');
  return copy;
}

export function mountSourceDownload(host:HTMLElement,configuration:()=>Design,currentDesignReady:()=>boolean=()=>true) {
  const procedural=mountProceduralDownload(host,configuration,currentDesignReady);
  const section=document.createElement('section');section.className='source-download';
  const link=document.createElement('a');link.id='generator-source';link.textContent='Generator source (.zip, family default)';
  const note=document.createElement('p');note.className='download-note';note.textContent='Source package includes the default design. Use Save design for your current edits.';
  const licenses=document.createElement('p');licenses.className='source-licenses';
  const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const retry=document.createElement('button');retry.type='button';retry.textContent='Retry source download';
  section.append(link,note,licenses,status,retry);host.append(section);
  const base=new URL(import.meta.env.BASE_URL,location.origin);
  let signature='',revision=0,request:AbortController|undefined,blobURL:string|undefined,disposed=false;
  function clear(){
    if(blobURL)URL.revokeObjectURL(blobURL);blobURL=undefined;
    link.removeAttribute('href');delete link.dataset.sha256;link.tabIndex=-1;link.setAttribute('aria-disabled','true');
  }
  async function refresh(force=false) {
    if(disposed)return;
    const design=configuration(),next=design.family+'@'+design.familyVersion;
    if(next===signature&&!force)return;
    signature=next;const ticket=++revision;
    request?.abort();request=new AbortController();
    const options:RequestInit={signal:request.signal,cache:force?'reload':'default'};
    clear();status.textContent='Loading source package…';retry.disabled=true;retry.hidden=false;
    licenses.textContent='Source software: unavailable. Default parameters: unavailable.';
    try {
      const metadata=await fetch(new URL('recipe-packages/index.json',base),options);
      if(!metadata.ok)throw new Error('Source index unavailable');
      const entry=sourcePackageFor(await metadata.json(),design.family,design.familyVersion);
      if(ticket!==revision)return;
      if(!entry)throw new Error('Source package metadata unavailable for this family version');
      const software=entry.licenses?.software==='Apache-2.0'?'Apache-2.0':'unavailable';
      const content=entry.licenses?.content==='CC0-1.0'&&Array.isArray(entry.licenses.contentPaths)&&entry.licenses.contentPaths.length===1&&entry.licenses.contentPaths[0]==='config.json'?'CC0-1.0':'unavailable';
      licenses.textContent='Source software: '+software+'. Default parameters: '+content+'.';
      const url=new URL(entry.url,base);
      if(url.origin!==location.origin)throw new Error('Source package origin mismatch');
      const response=await fetch(url,options);
      if(!response.ok||response.headers.get('content-type')?.includes('text/html'))throw new Error('Source package unavailable');
      const bytes=await verifiedSource(new Uint8Array(await response.arrayBuffer()),entry);
      if(ticket!==revision)return;
      blobURL=URL.createObjectURL(new Blob([bytes],{type:'application/zip'}));
      link.href=blobURL;link.download=sourcePackageFilename(entry.id,entry.version,entry.deliveryRevision??1);link.dataset.sha256=entry.sha256;
      link.removeAttribute('tabindex');link.removeAttribute('aria-disabled');status.textContent='Source package verified.';retry.hidden=true;
    } catch(error) { if(ticket===revision)status.textContent='Source download unavailable. '+(error instanceof Error?error.message:'Request failed'); }
    finally{if(ticket===revision)retry.disabled=false;}
  }
  retry.addEventListener('click',()=>{void refresh(true);});
  function dispose(){disposed=true;++revision;request?.abort();clear();procedural.dispose();window.removeEventListener('pagehide',dispose);}
  window.addEventListener('pagehide',dispose);
  return {refresh(){return Promise.all([refresh(),procedural.refresh()]);},dispose};
}
