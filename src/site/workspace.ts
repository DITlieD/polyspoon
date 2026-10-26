import {toolIcon} from './icons.ts';
import {descriptor,formatControl} from '../catalog/index.ts';
import {mountSourceDownload} from './source-download.ts';
import type {Design} from '../catalog/index.ts';
import {paletteNames,shadingNames} from '../catalog/appearance.ts';
import {effectChoices} from '../studio/effects.ts';
import type {EffectKey} from '../studio/effects.ts';

export interface WorkspaceActions {
 configuration():Design;
 currentDesignReady():boolean;
 appearance(input:unknown):void;
 effect(key:EffectKey,value:string):void;
 control(group:string):void;
 brush():void;
 materialCount():number;
}
function node<K extends keyof HTMLElementTagNameMap>(tag:K,className='',text=''){const element=document.createElement(tag);element.className=className;element.textContent=text;return element;}
function iconButton(label:string,icon:string){const button=node('button','viewer-tool');button.append(toolIcon(icon));button.type='button';button.title=label;button.setAttribute('aria-label',label);return button;}
export function mountWorkspace(app:HTMLElement,below:HTMLElement,parts:HTMLElement,actions:WorkspaceActions){
 const workspace=node('div','asset-workspace'),left=node('div','asset-workspace-left'),sidebar=node('aside','editor-sidebar'),card=node('section','download-card');sidebar.setAttribute('aria-label','Customize model');
 const viewport=app.querySelector<HTMLElement>('.viewport')!,rail=app.querySelector<HTMLElement>('.tool-rail')!,inspector=app.querySelector<HTMLElement>('.inspector')!,controls=document.getElementById('controls')!;
 const title=node('h2'),description=node('p','asset-summary'),banner=node('div','download-banner');banner.append(title,node('span','local-badge','Local preview'));
 const metrics=node('ul','asset-metrics'),triangles=node('li'),dimensions=node('li'),materials=node('li'),provenance=node('p','model-provenance');metrics.append(triangles,dimensions,materials);
 const downloads=app.querySelector<HTMLElement>('.document-actions')!;card.append(banner,description,provenance,metrics,downloads,node('p','download-note','Palette, shading and part colors are exported. Preview visibility and viewer effects are not.'));
 const sourceDownload=mountSourceDownload(card,actions.configuration,actions.currentDesignReady);
 const history=app.querySelector<HTMLElement>('.history')!,reset=document.getElementById('reset')!,editActions=node('div','edit-history');editActions.append(history,reset);card.append(editActions,document.getElementById('notice')!);
 const currentHeading=document.getElementById('group-title')!,groupHeading=node('h2');groupHeading.id='group-title';groupHeading.textContent=currentHeading.textContent;currentHeading.replaceWith(groupHeading);
 const readiness=node('p','editor-readiness');readiness.setAttribute('role','status');
 const tabs=node('div','editor-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Model controls');
 const scroll=node('div','editor-scroll');scroll.tabIndex=0;scroll.setAttribute('aria-label','Scrollable model controls');
 const materialSettings=node('section','appearance-controls'),partsPanel=node('section','editor-parts'),partEditor=document.querySelector<HTMLElement>('.part-color-editor')!;
 const brush=node('button','','Recolor a part');brush.type='button';brush.addEventListener('click',actions.brush);partsPanel.append(node('p','','Select a part in the model, or choose one to recolor. Part colors are included in exports.'),brush,partEditor,parts);
 scroll.append(materialSettings,controls,partsPanel,document.getElementById('error')!,document.getElementById('inactive-part-colors')!);inspector.append(scroll);sidebar.append(tabs,readiness,inspector,card);
 app.before(workspace);left.append(app,below);workspace.append(left,sidebar);
 const retained=node('div');retained.hidden=true;retained.append(...rail.childNodes);app.append(retained);rail.replaceChildren();
 const groups=[['shape','Shape'],['construction','Construction'],['colors','Materials'],['parts','Parts']];let group='shape',family='';
 function selectGroup(next:string,focus=false){
  group=next;actions.control(group);inspector.setAttribute('aria-labelledby','editor-tab-'+group);document.body.classList.remove('collapsed');materialSettings.hidden=group!=='colors';partsPanel.hidden=group!=='parts';controls.hidden=group==='parts';
  for(const tab of tabs.querySelectorAll<HTMLButtonElement>('button')){const active=tab.dataset.editorGroup===group;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;if(active&&focus)tab.focus({preventScroll:true});}
  scroll.scrollTop=0;
 }
 for(const [key,label] of groups){const tab=node('button','',label);tab.type='button';tab.dataset.editorGroup=key;tab.id='editor-tab-'+key;tab.setAttribute('role','tab');tab.setAttribute('aria-controls','inspector');tab.addEventListener('click',()=>selectGroup(key!));tab.addEventListener('keydown',event=>{const index=groups.findIndex(entry=>entry[0]===group);const next=event.key==='ArrowRight'?(index+1)%groups.length:event.key==='ArrowLeft'?(index+groups.length-1)%groups.length:event.key==='Home'?0:event.key==='End'?groups.length-1:-1;if(next>=0){event.preventDefault();selectGroup(groups[next]![0]!,true);}});tabs.append(tab);}
 inspector.setAttribute('role','tabpanel');inspector.setAttribute('aria-label','Selected model controls');
 function appearanceSelect(key:'palette'|'shading',label:string,choices:readonly string[]){
  const field=node('label','display-setting',label),select=node('select');select.id='appearance-'+key;select.setAttribute('aria-label',label);
  for(const choice of choices){const option=node('option','',choice);option.value=choice;select.append(option);}field.append(select);materialSettings.append(field);
  select.addEventListener('change',()=>{const previous=actions.configuration().appearance??{version:1,palette:'None',shading:'None',partColors:{}};actions.appearance({...previous,[key]:select.value});});return select;
 }
 materialSettings.append(node('h3','','Exported appearance'));const palette=appearanceSelect('palette','Palette',paletteNames),shading=appearanceSelect('shading','Shading',shadingNames);materialSettings.append(node('p','','Recipe colors below apply to material regions. Individual overrides are in Parts.'));
 const frame=iconButton('Frame asset','frame');frame.addEventListener('click',()=>document.getElementById('frame')!.click());rail.append(frame);
 const effects=node('details','viewer-effects');effects.append(node('summary','','Viewer effects'),node('p','','Viewer only. These effects are not included in downloads.'));
 for(const [key,choices] of Object.entries(effectChoices)){
  const label=node('label','display-setting',key[0]!.toUpperCase()+key.slice(1)),select=node('select');select.setAttribute('aria-label','Viewer '+key);
  for(const choice of choices){const option=node('option','',choice);option.value=choice;select.append(option);}select.addEventListener('change',()=>actions.effect(key as EffectKey,select.value));label.append(select);effects.append(label);
 }
 app.after(effects);
 function keepEffectsTogether(){
  if(!effects.open||workspace.hidden)return;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{if(effects.open&&!workspace.hidden)window.scrollTo(0,Math.max(0,app.getBoundingClientRect().top+window.scrollY-8));}));
 }
 effects.addEventListener('toggle',()=>{workspace.classList.toggle('effects-open',effects.open);if(effects.open)keepEffectsTogether();});
 effects.addEventListener('change',keepEffectsTogether);window.addEventListener('resize',keepEffectsTogether);
 const full=document.getElementById('fullscreen')!;full.classList.add('viewer-fullscreen');viewport.append(full);const technical=node('a','technical-link','Open technical editor ↗');technical.href='/editor';viewport.append(technical);app.querySelector<HTMLElement>('.view-tools')!.hidden=true;
 document.getElementById('collapse')!.hidden=true;selectGroup('shape');
 return {element:workspace,selectGroup,refresh(name:string,copy:string){
  const config=actions.configuration(),d=descriptor(config.family);if(family!==config.family){family=config.family;selectGroup(group);}
  void sourceDownload.refresh();readiness.textContent=actions.currentDesignReady()?'Current design is ready to save and export.':'Unfinished or invalid input. Preview shows the last valid design. Return to the edited field, then finish the value or press Escape to cancel that field.';title.textContent=name;description.textContent=constructionCopy(config,copy);provenance.textContent='Recipe v'+d.version+' · No publication review status is available in this local preview.';
  materials.textContent=actions.materialCount()+' materials';triangles.textContent=(document.getElementById('triangles')?.textContent??'')+' triangles';dimensions.textContent=document.getElementById('dimensions')?.textContent??'';palette.value=config.appearance?.palette??'None';shading.value=config.appearance?.shading??'None';
 },route(hidden:boolean){workspace.hidden=hidden;document.body.classList.remove('collapsed');}};
}
function constructionCopy(design:Design,fallback:string){
 const p=design.applied;if(design.family==='fence')return p.bays+' span'+(p.bays===1?'':'s')+' with '+p.railCount+' rails per span and '+p.postHead+' post caps.';
 const controls=descriptor(design.family).controls.filter(c=>c.group==='construction'&&c.kind!=='color').slice(0,3);
 return controls.length?controls.map(c=>{const value=p[c.key];const label=c.kind==='toggle'?(value?'Included':'Not included'):c.kind==='choice'?c.options.find(option=>option.value===value)?.label??String(value):c.kind==='range'||c.kind==='integer'?formatControl(c,Number(value)):String(value);return c.label+': '+label;}).join(' · '):fallback;
}
