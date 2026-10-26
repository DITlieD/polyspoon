import './editor.css';
import records from 'virtual:hosted-trusted-recipes';
import {Stage} from '../../src/studio/stage.ts';
import {ControlPanel} from '../../src/studio/controls.ts';
import {DesignSession} from '../../src/catalog/session.ts';
import {descriptor,disposeAsset,loadDesign} from '../../src/catalog/index.ts';
import {applyPalette} from '../../src/engine/parameters.ts';
import type {ParameterIssue} from '../../src/engine/parameters.ts';
import {buildDesignSnapshot} from '../../src/studio/design-snapshot.ts';
import {zipFiles} from '../../src/catalog/export.ts';
import {exportDeliverable} from '../../src/catalog/delivery.ts';
import {serializeEditedDesign,readCurrentEditedDesign} from './edited-design.ts';
import {matchTrustedRecipe,sameDesign} from './runtime-identity.ts';
import {el,button,link,field,input,status,heading,action} from '../shared/dom.ts';
import {verifyArtifact} from '../shared/http.ts';
import type {Context,ModelDetail} from './types.ts';

export async function editor(context:Context,id:string){
 const root=el('section','hosted-editor'),feedback=status('Checking this published recipe…');root.append(link('Back to published model','/asset/'+id,'back-link'),feedback);
 let active=true,session:DesignSession|undefined,stage:Stage|undefined;
 context.resources.add(()=>{active=false;stage?.dispose();session?.dispose();});
 const data=await context.api.json<ModelDetail>('/api/catalog/'+id),trusted=matchTrustedRecipe(records,data);
 if(!trusted){feedback.textContent='Customization is unavailable for this recipe version. Preview and verified downloads remain available on its model page.';return root;}
 const designFile=data.artifacts.find(file=>file.path==='selected.design.json');
 if(!designFile||!data.sourcePackage){feedback.textContent='This version has no verified editable design. Return to the model page for its available downloads.';return root;}
 const path=(file:string)=>'/api/catalog/'+id+'/files?path='+encodeURIComponent(file);
 const [archive,designBytes]=await Promise.all([context.api.bytes(path(trusted.archive.path)),context.api.bytes(path(designFile.path))]);
 await Promise.all([verifyArtifact(archive,trusted.archive),verifyArtifact(designBytes,designFile)]);
 const saved=JSON.parse(new TextDecoder().decode(designBytes));if(!sameDesign(saved,data.design)){feedback.textContent='The published design does not match its verified file. Customization is unavailable.';return root;}
 let canonical;try{canonical=loadDesign(saved);if(canonical.migration||!sameDesign(saved,canonical))throw Error('Unsupported canonical design');}catch{feedback.textContent='This design cannot be loaded by its exact trusted recipe without changes. Customization is unavailable.';return root;}
 if(!active)throw Error('Session changed');
 session=new DesignSession();disposeAsset(session.load(canonical));
 const current=session,viewport=el('div','editor-viewport'),controls=el('div','editor-controls'),sidebar=el('aside','panel editor-sidebar'),dimensions=el('p','muted'),tools=el('div','actions'),tabs=el('div','actions editor-tabs'),pending=new Set<string>(),exportControls:HTMLButtonElement[]=[];let issues:ParameterIssue[]=[],draft={...current.config.requested};
 const downloads=el('div','actions editor-downloads'),readyUrls=new Map<string,string>();let exportEpoch=0;
 const invalidateDownloads=()=>{exportEpoch++;for(const url of readyUrls.values())context.resources.release(url);readyUrls.clear();downloads.replaceChildren();};
 context.resources.add(invalidateDownloads);
 const undo=button('Undo','button-secondary'),redo=button('Redo','button-secondary'),reset=button('Reset to published design','button-secondary');
 stage=new Stage(viewport);const view=stage;
 const refresh=()=>{for(const control of exportControls)control.disabled=!!pending.size||!!issues.length;panel.refresh(descriptor(current.config.family),current.config,draft,issues,pending);dimensions.textContent=current.build.dimensions.toArray().map(value=>value.toFixed(2)).join(' × ')+' m';undo.disabled=!current.canUndo;redo.disabled=!current.canRedo;feedback.textContent=issues.length?issues.map(issue=>issue.message).join(' '):'Local edits. The published model is unchanged.';};
 const present=(old?:typeof current.build,frame=false)=>{invalidateDownloads();view.replace(current.build,frame);if(old)disposeAsset(old);draft={...current.config.requested};issues=[];refresh();};
 const apply=(value:Record<string,unknown>)=>{if(!active)return false;invalidateDownloads();draft=value;try{present(current.apply(value));return true;}catch(error){issues=typeof error==='object'&&error&&'issues' in error?(error as {issues:ParameterIssue[]}).issues:[{code:'invalid',keys:[],message:'This change cannot be applied.'}];refresh();return false;}};
 const panel=new ControlPanel(controls,{change(key,value){return apply({...draft,[key]:value});},reset(key){const next={...draft};delete next[key];apply(next);},palette(id){apply(applyPalette(descriptor(current.config.family),draft,id));},begin(){current.beginGesture();},end(){current.endGesture();refresh();},pending(key,value){if(value)invalidateDownloads();if(value)pending.add(key);else pending.delete(key);refresh();},select(role){view.selectRole(role);panel.select(role);}});
 panel.mount(descriptor(current.config.family));panel.show('shape');
 for(const [group,label] of [['shape','Shape'],['construction','Construction'],['colors','Colors']] as const){const tab=button(label,'button-secondary');tab.addEventListener('click',()=>panel.show(group));tabs.append(tab);}
 undo.addEventListener('click',()=>{const old=current.undo();if(old)present(old);});redo.addEventListener('click',()=>{const old=current.redo();if(old)present(old);});reset.addEventListener('click',()=>present(current.load(canonical),true));
 const frame=button('Frame model','button-secondary');frame.addEventListener('click',()=>view.setView());
 const origin={publishedVersion:id,recipe:data.recipe,sourcePackage:data.sourcePackage,sourceHash:trusted.sourceHash},encode=(value:unknown)=>new TextEncoder().encode(JSON.stringify(value,null,2)+'\n');
 const download=(bytes:Uint8Array,name:string,type:string,label:string,ticket:number)=>{if(!active||ticket!==exportEpoch)return;const previous=readyUrls.get(name);if(previous)context.resources.release(previous);const url=context.resources.create(new Blob([Uint8Array.from(bytes)],{type}));readyUrls.set(name,url);const existing=Array.from(downloads.querySelectorAll('a')).find(a=>a.download===name);existing?.remove();const a=link(label,url);a.download=name;downloads.append(a);};
 const exportable=()=>{if(!active||pending.size||issues.length)throw Error('Resolve the current controls before exporting.');};
 const save=button('Save edited design','button-secondary');save.addEventListener('click',()=>void action(save,feedback,async()=>{exportable();const ticket=exportEpoch;await context.api.json('/api/me');if(!active||ticket!==exportEpoch)return;download(serializeEditedDesign(current.config,origin),trusted.id+'-edited.design.json','application/json','Download edited design',ticket);feedback.textContent='Edited design ready. Use the download link to save it with its published origin.';}));
 const glb=button('Export edited GLB','button-secondary'),bundle=button('Export edited model and notices','button-secondary');
 const exported=async(includeNotices:boolean)=>{exportable();const ticket=exportEpoch;await context.api.json('/api/me');if(!active||ticket!==exportEpoch)return;const snapshot=buildDesignSnapshot(current.config),editedDesign=serializeEditedDesign(snapshot.config,origin);try{snapshot.root.userData.publishedOrigin=origin;snapshot.root.userData.licenses=trusted.licenses;snapshot.root.userData.notices=trusted.notices;const bytes=await exportDeliverable(snapshot);if(!active||ticket!==exportEpoch)return;if(includeNotices){const files:Record<string,Uint8Array>={'edited.glb':bytes,'edited.design.json':editedDesign,'origin.json':encode(origin),...Object.fromEntries(Object.entries(trusted.notices).map(([path,text])=>[path,new TextEncoder().encode(text)]))};download(zipFiles(files),trusted.id+'-edited.zip','application/zip','Download edited model and notices',ticket);}else download(bytes,trusted.id+'-edited.glb','model/gltf-binary','Download edited GLB',ticket);feedback.textContent='Local edited export ready. Use the download link to save it. It has not been reviewed or published.';}finally{disposeAsset(snapshot);}};
 glb.addEventListener('click',()=>void action(glb,feedback,()=>exported(false)));bundle.addEventListener('click',()=>void action(bundle,feedback,()=>exported(true)));
 exportControls.push(save,glb,bundle);
 const load=input('edited-design','file',false);load.accept='.json,application/json';load.addEventListener('change',()=>{void action(save,feedback,async()=>{const file=load.files?.[0];if(!file)return;invalidateDownloads();if(file.size>65536){feedback.textContent='Edited designs must be smaller than 64 KiB.';return;}const ticket=current.beginLoad();await readCurrentEditedDesign(file,()=>active&&ticket===current.revision,value=>{if(!value||typeof value!=='object'||Array.isArray(value)||!('origin' in value)||!sameDesign(value.origin,origin)){feedback.textContent='This edited design belongs to a different published version or recipe.';return;}const {origin:ignored,...design}=value as Record<string,unknown>;if(design.family!==trusted.id||design.familyVersion!==trusted.version){feedback.textContent='This design requires a different recipe version.';return;}const next=loadDesign(design);if(next.migration||!sameDesign(next,design)){feedback.textContent='This edited design does not match the current trusted recipe.';return;}const old=current.finishLoad(ticket,next);if(old)present(old,true);});});});
 tools.append(undo,redo,reset,frame);if(current.build.root.animations.length)sidebar.append(el('p','muted','Static preview. GLB exports include the bound skeleton and animation clips.'));sidebar.append(tabs,controls,dimensions,save,glb,bundle,downloads,field('Load an edited design from this published version',load),el('p','muted','These edits stay on this device. Download the model and notices together when sharing an edited export.'));
 root.replaceChildren(link('Back to published model','/asset/'+id,'back-link'),heading(data.title,'Edit parameters and export to your project.'),tools,feedback,el('div','editor-layout',viewport,sidebar));present(undefined,true);return root;
}
