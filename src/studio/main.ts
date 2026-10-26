import './style.css';
import { Mesh } from 'three';
import { mountSite } from '../site/site.ts';
import { catalog, descriptor, buildAsset, disposeAsset, loadDesign } from '../catalog/index.ts';
import type { AssetBuild } from '../catalog/index.ts';
import type { ParameterIssue } from '../engine/parameters.ts';
import { applyPalette } from '../engine/parameters.ts';
import { buildDesignSnapshot } from './design-snapshot.ts';
import type { EffectKey } from './effects.ts';
import { DesignSession } from '../catalog/session.ts';
import { buildWorkshop } from '../catalog/workshop.ts';
import { exportDeliverable } from '../catalog/delivery.ts';
import {exportStudioBundle,exportSnapshotModule} from './export-delivery.ts';
import { inspectGeometry } from '../lantern/inspect.ts';
import { Stage } from './stage.ts';
import type { Mode, View } from './stage.ts';
import { ControlPanel, readableRegion } from './controls.ts';

function element<T extends HTMLElement>(id:string):T {
  const found=document.getElementById(id);
  if(!found) throw new Error('Missing element '+id);
  return found as T;
}
function download(data:BlobPart,filename:string,type:string) {
  const url=URL.createObjectURL(new Blob([data],{type})),link=document.createElement('a');
  link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const bundleButton=document.createElement('button');bundleButton.id='export-bundle';bundleButton.textContent='Download ZIP';
const moduleButton=document.createElement('button');moduleButton.id='export-module';moduleButton.textContent='Snapshot .mjs';
document.querySelector('.document-actions')!.append(bundleButton,moduleButton);
let site:ReturnType<typeof mountSite>|undefined;
const viewerValues=new Map<EffectKey,string>();
const diagnostic=new URLSearchParams(location.search).has('diagnostic');
if(diagnostic)document.body.classList.add('diagnostic');
const session=new DesignSession(),stage=new Stage(element('canvas-host'));
stage.setDiagnostic(diagnostic);
let draft:Record<string,unknown>={...session.config.requested};
let issues:ParameterIssue[]=[],workshop:ReturnType<typeof buildWorkshop>|undefined,mounted='',exporting=false,group='shape',selectedRole:string|undefined;
const pending=new Set<string>();
const notice=element('notice'),error=element('error'),selector=element<HTMLSelectElement>('family'),preset=element<HTMLSelectElement>('preset');
for(const d of catalog){const option=document.createElement('option');option.value=d.id;option.textContent=d.title;selector.append(option);}
const panel=new ControlPanel(element('controls'),{
  change:(key,value)=>{
    if(value===undefined){
      if(Object.hasOwn(session.config.requested,key))draft[key]=session.config.requested[key];else delete draft[key];
      issues=descriptor(session.config.family).state(draft).issues;refresh();return true;
    }
    draft={...draft,[key]:value};return apply(draft);
  },
  reset:key=>{const next={...draft};delete next[key];apply(next);},
  palette:id=>{
    apply(applyPalette(descriptor(session.config.family),draft,id));
  },
  begin:()=>session.beginGesture(),
  end:()=>{session.endGesture();refresh();},
  pending:(key,active)=>{if(active)pending.add(key);else pending.delete(key);refresh();},
  select:role=>selectRole(role),
});
function showGroup(next:string) {
  group=next;document.body.classList.remove('collapsed');panel.show(group);
  element('group-title').textContent=group==='construction'?'Construction':group==='colors'?'Materials':group==='parts'?'Parts':'Shape';
  document.querySelectorAll<HTMLButtonElement>('[data-group]').forEach(button=>{
    if(button.matches('button'))button.setAttribute('aria-pressed',String(button.dataset.group===group));
  });
}
function selectRole(role:string) {
  if(!descriptor(session.config.family).controls.some(c=>c.kind==='color'&&c.role===role))return;
  selectedRole=role;showGroup('colors');site?.openGroup('colors');stage.selectRole(role);panel.select(role);
  const c=descriptor(session.config.family).controls.find(c=>c.kind==='color'&&c.role===role)!;
  const note=element('selection-note');note.hidden=false;note.textContent='Editing all '+readableRegion(c.label).toLowerCase()+' pieces';
}
const inactiveParts=document.createElement('p');inactiveParts.id='inactive-part-colors';element('inspector').append(inactiveParts);
const partEditor=document.createElement('section');partEditor.className='viewer-popover part-color-editor';partEditor.hidden=true;
const partSelect=document.createElement('select');partSelect.setAttribute('aria-label','Part to recolor');
const partTitle=document.createElement('strong'),partColor=document.createElement('input'),partReset=document.createElement('button'),partClose=document.createElement('button');
partColor.type='color';partColor.setAttribute('aria-label','Selected part color');partReset.textContent='Reset part';partClose.textContent='Close';
partEditor.append(partTitle,partSelect,partColor,partReset,partClose);element('app').append(partEditor);
let selectedPart:string|undefined;
function changePartColor(color?:string){
  if(!selectedPart)return;
  const appearance=session.config.appearance??{version:1 as const,palette:'None' as const,shading:'None' as const,partColors:{}};
  const partColors={...appearance.partColors};if(color)partColors[selectedPart]=color;else delete partColors[selectedPart];
  const old=session.setAppearance({...appearance,partColors});present(old);
}
partColor.addEventListener('change',()=>changePartColor(partColor.value));partReset.addEventListener('click',()=>changePartColor());
partClose.addEventListener('click',()=>{partEditor.hidden=true;});
function pickPart(part:string){
  partSelect.replaceChildren();session.build.root.traverse(object=>{if(object instanceof Mesh){const option=document.createElement('option');option.value=object.name;option.textContent=object.name.replaceAll('-',' ');partSelect.append(option);}});partSelect.value=part;
  selectedPart=part;partTitle.textContent=part.replaceAll('-',' ');partEditor.hidden=false;site?.openGroup('parts');
  const mesh=session.build.root.getObjectByName(part) as Mesh;
  const material=mesh.material as typeof session.build.materials[string];
  partColor.value=session.config.appearance?.partColors[part]??'#'+material.color.getHexString();
}
partSelect.addEventListener('change',()=>pickPart(partSelect.value));
stage.onPick=(role,part)=>{if(workshop)return;if(document.body.classList.contains('website'))pickPart(part);else selectRole(role);};
function mount() {
  const d=descriptor(session.config.family);
  if(mounted===d.id)return;
  partEditor.hidden=true;selectedPart=undefined;mounted=d.id;selector.value=d.id;panel.mount(d);preset.replaceChildren();
  const custom=document.createElement('option');custom.value='';custom.textContent='Custom design';preset.append(custom);
  for(const p of d.presets){const option=document.createElement('option');option.value=p.id;option.textContent=p.name;preset.append(option);}
  element('asset-title').textContent=d.title;document.title=d.title+' · Asset studio';selectedRole=undefined;stage.selectRole(undefined);element('selection-note').hidden=true;showGroup(group);
}
function refresh() {
  const d=descriptor(session.config.family);
  panel.refresh(d,session.config,draft,issues,pending);
  const match=d.presets.find(p=>JSON.stringify(d.save(p.parameters).applied)===JSON.stringify(session.config.applied));
  preset.value=match?.id??'';element('preset-description').textContent=match?.name??'Custom design';
  const invalid=issues.length>0 || pending.size>0;
  element<HTMLButtonElement>('save').disabled=invalid || Boolean(workshop);
  element<HTMLButtonElement>('export').disabled=invalid || exporting || Boolean(workshop);
  bundleButton.disabled=invalid||exporting||Boolean(workshop);moduleButton.disabled=bundleButton.disabled;
  element<HTMLButtonElement>('undo').disabled=!session.canUndo;
  element<HTMLButtonElement>('redo').disabled=!session.canRedo;
  error.hidden=issues.length===0;
  error.textContent=issues.map(i=>i.message).join(' ');
  element('view-status').textContent=invalid?'Draft · last valid preview':workshop?'Scene preview':'Live preview';
  const shown=workshop??session.build;
  element('dimensions').textContent=shown.dimensions.toArray().map(n=>n.toFixed(2)).join(' × ')+' m';
  element('triangles').textContent=inspectGeometry(shown.root).triangles.toLocaleString();
  const inactive=session.build.root.userData.inactivePartColors as string[]|undefined;
  element('inactive-part-colors').textContent=inactive?.length?'Saved colors for hidden parts: '+inactive.join(', '):'';
  site?.refresh();
}
function present(old?:AssetBuild,frame=false) {
  const previous=workshop;workshop=undefined;document.body.classList.remove('workshop-scene');element('back-editor').hidden=true;
  stage.replace(session.build,frame);stage.setWireMode(viewerValues.get('wireframe')??(element<HTMLInputElement>('wireframe').checked?'Mesh':'None'));
  if(old)disposeAsset(old);previous?.dispose();
  mount();refresh();
}
function apply(input:unknown,frame=false):boolean {
  draft={...(input as Record<string,unknown>)};
  try{
    const old=session.apply(input);draft={...session.config.requested};issues=[];present(old,frame);return true;
  }catch(problem){
    issues=typeof problem==='object'&&problem && 'issues' in problem?(problem as {issues:ParameterIssue[]}).issues:[{code:'invalid',keys:[],message:problem instanceof Error?problem.message:String(problem)}];
    refresh();return false;
  }
}
function select(family:string):boolean {
  try{
    const old=session.select(family);draft={...session.config.requested};issues=[];pending.clear();present(old,true);return true;
  }catch(problem){selector.value=session.config.family;notice.textContent=String(problem);return false;}
}
function history(direction:'undo'|'redo') {
  const old=session[direction]();if(!old)return;
  draft={...session.config.requested};issues=[];pending.clear();present(old);notice.textContent=direction==='undo'?'Change undone.':'Change restored.';
}
function showWorkshop() {
  partEditor.hidden=true;selectedPart=undefined;
  session.endGesture();session.revision++;
  const previous=workshop;workshop=buildWorkshop();stage.selectRole(undefined);stage.replace(workshop,true);previous?.dispose();
  document.body.classList.add('workshop-scene');element('back-editor').hidden=false;refresh();
}
selector.addEventListener('change',()=>select(selector.value));
preset.addEventListener('change',()=>{
  const p=descriptor(session.config.family).presets.find(p=>p.id===preset.value);if(p){session.endGesture();pending.clear();apply(p.parameters);}
});
document.querySelectorAll<HTMLButtonElement>('.tool-rail [data-group]').forEach(button=>button.addEventListener('click',()=>{
  if(group===button.dataset.group&&!document.body.classList.contains('collapsed'))document.body.classList.add('collapsed');
  else showGroup(button.dataset.group!);
}));
element('collapse').addEventListener('click',()=>document.body.classList.add('collapsed'));
element('show-workshop').addEventListener('click',showWorkshop);
element('back-editor').addEventListener('click',()=>present(undefined,true));
element('undo').addEventListener('click',()=>history('undo'));
element('redo').addEventListener('click',()=>history('redo'));
element('reset').addEventListener('click',()=>{pending.clear();const old=session.reset();draft={...session.config.requested};issues=[];present(old);});
element('frame').addEventListener('click',()=>stage.setView(element<HTMLSelectElement>('view').value as View));
element<HTMLSelectElement>('view').addEventListener('change',event=>stage.setView((event.target as HTMLSelectElement).value as View));
element<HTMLSelectElement>('mode').addEventListener('change',event=>{stage.setMode((event.target as HTMLSelectElement).value as Mode);stage.setWireframe(element<HTMLInputElement>('wireframe').checked);});
element<HTMLInputElement>('wireframe').addEventListener('change',event=>stage.setWireframe((event.target as HTMLInputElement).checked));
element('fullscreen').addEventListener('click',async()=>{
  try{if(document.fullscreenElement)await document.exitFullscreen();else await element('app').requestFullscreen();}
  catch{notice.textContent='Fullscreen is unavailable in this browser.';}
});
element('save').addEventListener('click',()=>{
  if(issues.length||pending.size)return;
  download(JSON.stringify(session.config,null,2),session.config.family+'.design.json','application/json');notice.textContent='Design file saved.';
});
element('load').addEventListener('click',()=>element<HTMLInputElement>('file').click());
element<HTMLInputElement>('file').addEventListener('change',async event=>{
  const input=event.target as HTMLInputElement,file=input.files?.[0];if(!file)return;
  const ticket=session.beginLoad();
  try{
    if(file.size>65536)throw new Error('Design files must be smaller than 64 KB.');
    const saved=loadDesign(JSON.parse(await file.text())),old=session.finishLoad(ticket,saved);
    if(old){draft={...session.config.requested};pending.clear();issues=[];present(old,true);notice.textContent=saved.migration?.notice??'Design loaded.';}
  }catch(problem){if(ticket===session.revision)notice.textContent='Load failed: '+(problem instanceof Error?problem.message:String(problem));}
  finally{input.value='';}
});
element('export').addEventListener('click',async()=>{
  if(workshop||issues.length||pending.size||exporting)return;
  const snapshot=buildDesignSnapshot(session.config),ticket=session.revision;
  exporting=true;refresh();
  try{
    const bytes=await exportDeliverable(snapshot);download(bytes as Uint8Array<ArrayBuffer>,snapshot.config.family+'.glb','model/gltf-binary');
    if(ticket===session.revision)notice.textContent='Complete GLB exported in meters with current colors. Preview visibility is not exported.';
  }catch(problem){if(ticket===session.revision)notice.textContent='Export failed: '+String(problem);}
  finally{disposeAsset(snapshot);exporting=false;refresh();}
});
async function exportPackage(kind:'zip'|'module'){
  if(workshop||issues.length||pending.size||exporting)return;
  const snapshot=buildDesignSnapshot(session.config),ticket=session.revision;
  exporting=true;refresh();
  try{
    if(kind==='zip'){const bundle=await exportStudioBundle(snapshot);download(bundle.bytes as Uint8Array<ArrayBuffer>,snapshot.config.family+'.zip','application/zip');}
    else{download(await exportSnapshotModule(snapshot),snapshot.config.family+'.mjs','text/javascript');}
    if(ticket===session.revision)notice.textContent=kind==='zip'?'ZIP saved: GLB, design, snapshot module and HTML preview. HTML preview needs internet for Three.js.':'Static snapshot module saved. Import it in a project with Three.js.';
  }catch(problem){if(ticket===session.revision)notice.textContent='Export failed: '+String(problem);}
  finally{disposeAsset(snapshot);exporting=false;refresh();}
}
bundleButton.addEventListener('click',()=>exportPackage('zip'));
moduleButton.addEventListener('click',()=>exportPackage('module'));
document.addEventListener('keydown',event=>{
  if(event.key==='Escape')partEditor.hidden=true;
  if(!(event.ctrlKey||event.metaKey)||event.key.toLowerCase()!=='z'||(event.target instanceof HTMLInputElement))return;
  event.preventDefault();history(event.shiftKey?'redo':'undo');
});
present(undefined,true);
if(new URLSearchParams(location.search).has('scene'))showWorkshop();
const diagnostics={
  apply,select,configuration:()=>session.config,inspect:()=>inspectGeometry(session.build.root),
  view:(view:View,span?:number)=>stage.setView(view,span),mode:(mode:Mode)=>stage.setMode(mode),
  memory:()=>({...stage.renderer.info.memory}),render:()=>stage.render(),projected:()=>stage.projectedBounds(),
  diagnostic:(enabled:boolean)=>stage.setDiagnostic(enabled),showWorkshop,camera:()=>stage.cameraState(),selectRole,
  history:(direction:'undo'|'redo')=>history(direction),
};
if(diagnostic)Object.assign(window,{workshopDiagnostics:diagnostics});
window.addEventListener('pagehide',()=>{stage.dispose();workshop?.dispose();session.dispose();});

site=mountSite({
  select,apply,kit:showWorkshop,configuration:()=>session.config,currentDesignReady:()=>issues.length===0&&pending.size===0&&!workshop,
  appearance:input=>{
    try{const old=session.setAppearance(input);present(old);}
    catch(problem){notice.textContent=String(problem);}
  },
  effect:(key,value)=>{viewerValues.set(key,value);stage.setEffect(key,value);},
  materialCount:()=>Object.keys(session.build.materials).length,
  brush:()=>{let first:string|undefined;session.build.root.traverse(object=>{if(object instanceof Mesh&&!first)first=object.name;});if(first)pickPart(first);},
  control:next=>showGroup(next),
  visibility:()=>{
    const parts:Array<{name:string;visible:boolean}>=[];
    session.build.root.traverse(object=>{if(object instanceof Mesh)parts.push({name:object.name,visible:object.visible});});
    return parts;
  },
  togglePart:(name,visible)=>{const object=session.build.root.getObjectByName(name);if(object){object.visible=visible;stage.selectRole(undefined);stage.refreshVisibility();}},
  resetVisibility:()=>{session.build.root.traverse(object=>{object.visible=true;});stage.refreshVisibility();},
});

if(document.body.classList.contains('website')){stage.setBackground('#f4f6fa');stage.setFramePadding(1.65);document.body.classList.remove('collapsed');}
