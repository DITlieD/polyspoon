import {el,button,field,status,link} from '../shared/dom.ts';
import {explain,verifyArtifact} from '../shared/http.ts';
import {rasterType,RasterEvidenceError} from './review-raster.ts';
import type {Context,Resources} from './types.ts';
import type {ReviewView,ReviewSubject,FileDigest} from '../../src/review/types.ts';

const openGalleries=new WeakMap<Resources,()=>void>();
export const galleryViewLimit=64;
export function galleryViewPlan(declared:ReviewView[]){
 const views:ReviewView[]=[],seen=new Set<string>();let duplicates=0,excess=0;
 for(const view of declared){const key=JSON.stringify([view.caseId,view.view,view.evidence]);if(seen.has(key)){duplicates++;continue;}if(views.length===galleryViewLimit){excess++;continue;}seen.add(key);views.push(view);}
 return {views,duplicates,excess};
}

export function declaredViews(context:Context,versionId:string){
 let active=true,loaded=false,loading=false,revision=0,pending:AbortController|undefined,url:string|undefined,image:HTMLImageElement|undefined;
 const root=el('details','declared-gallery',el('summary','','Inspect declared views')),feedback=status(),chooser=el('select'),open=button('Open selected view','button-secondary'),close=button('Close image','button-secondary'),download=button('Download exact file','button-secondary'),selection=el('div'),preview=el('figure','item');
 root.setAttribute('aria-label','Declared visual evidence');chooser.setAttribute('aria-label','Declared view');open.disabled=true;download.disabled=true;close.disabled=true;selection.append(field('Declared view',chooser),el('div','actions',open,download,close));root.append(el('p','muted','Choose one sealed view at a time. Image bytes are checked through the protected API before preview or download.'),feedback,selection,preview);
 let selected:Array<{view:ReviewView;expected:FileDigest|undefined}>=[];
 function clearPreview(){if(openGalleries.get(context.resources)===clearPreview)openGalleries.delete(context.resources);revision++;pending?.abort();pending=undefined;image?.removeAttribute('src');image=undefined;if(url){context.resources.release(url);url=undefined;}preview.replaceChildren();close.disabled=true;open.disabled=!loaded||!selected.length;download.disabled=open.disabled;}
 context.resources.add(()=>{active=false;clearPreview();selected=[];chooser.replaceChildren();selection.replaceChildren();feedback.textContent='';});
 async function load(){
  loading=true;feedback.textContent='Loading declared view list…';
  try{const detail=await context.api.json<{subject:ReviewSubject}>('/api/versions/'+versionId);if(!active)return;const plan=galleryViewPlan(detail.subject.coverage.views);selected=plan.views.map(view=>({view,expected:detail.subject.artifacts[view.evidence]}));chooser.replaceChildren();
   for(const [index,{view}] of selected.entries()){const option=el('option','',view.caseId+' · '+view.view+' · '+view.evidence);option.value=String(index);chooser.append(option);}
   loaded=true;open.disabled=!selected.length;download.disabled=open.disabled;chooser.disabled=!selected.length;feedback.textContent=selected.length?selected.length+' declared views listed. Open a view to inspect its image.':'No raster views are declared for this version.';
   if(plan.duplicates)feedback.textContent+=' '+plan.duplicates+' repeated declarations were collapsed.';
   if(plan.excess)feedback.textContent+=' '+plan.excess+' further declarations are not shown. Only the first '+galleryViewLimit+' unique views are listed. This gallery does not cover the full declaration. Inspect the full submission details separately before approval.';
  }catch(error){if(active)feedback.textContent=explain(error);}finally{loading=false;}
 }
 async function show(downloadOnly=false){
  const entry=selected[Number(chooser.value)];if(!active||!entry)return;const previous=openGalleries.get(context.resources);if(previous!==clearPreview)previous?.();clearPreview();openGalleries.set(context.resources,clearPreview);const own=revision,controller=new AbortController();pending=controller;open.disabled=true;download.disabled=true;close.disabled=false;const checking=status('Checking sealed image bytes…');preview.append(el('figcaption','',entry.view.caseId+' · '+entry.view.view),checking);
  try{
   const path=entry.view.evidence,expected=entry.expected;if(typeof path!=='string'||!expected||!downloadOnly&&!/^.*\.(png|jpe?g)$/i.test(path))throw new RasterEvidenceError('This declared evidence is not a PNG or JPEG preview.');
   if(!Number.isSafeInteger(expected.bytes)||expected.bytes<0||expected.bytes>2097152)throw new RasterEvidenceError('Evidence image exceeds the 2 MiB preview limit.');
   const bytes=await context.api.bytes('/api/versions/'+versionId+'/files?path='+encodeURIComponent(path),{signal:controller.signal});await verifyArtifact(bytes,expected);if(!active||own!==revision||controller.signal.aborted)return;
   const type=downloadOnly?'application/octet-stream':rasterType(bytes);url=context.resources.create(new Blob([Uint8Array.from(bytes)],{type}));if(downloadOnly){const file=link('Download '+path,url,'button-secondary');file.download=path.split('/').at(-1)??'evidence';preview.append(el('p','asset-path',path),file);checking.textContent='Exact file SHA-256 and byte count verified. Image preview was not loaded.';file.click();return;}const currentImage=el('img');image=currentImage;currentImage.alt=entry.view.caseId+' · '+entry.view.view+' sealed evidence';currentImage.style.maxWidth='100%';currentImage.style.height='auto';
   currentImage.addEventListener('error',()=>{if(active&&own===revision){clearPreview();preview.append(status('The sealed image could not be decoded. Download the exact file for separate inspection.'));}});currentImage.src=url;
   const download=link('Download '+path,url,'button-secondary');download.download=path.split('/').at(-1)??'evidence';preview.append(currentImage,el('p','asset-path',path),download);checking.textContent='SHA-256 and byte count verified.';
  }catch(error){if(active&&own===revision&&!controller.signal.aborted){const message=error instanceof RasterEvidenceError?error.message:explain(error);clearPreview();preview.append(status(message));}}finally{if(active&&own===revision){pending=undefined;open.disabled=false;download.disabled=false;}}
 }
 chooser.addEventListener('change',clearPreview);open.addEventListener('click',()=>void show());download.addEventListener('click',()=>void show(true));close.addEventListener('click',clearPreview);root.addEventListener('toggle',()=>{if(!root.open)clearPreview();else if(!loaded&&!loading)void load();});return root;
}
