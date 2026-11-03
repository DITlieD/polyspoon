import {el,button} from '../shared/dom.ts';
import {loaderFor,sourceUrlFor} from './recipe-loader.ts';
import type {ModelDetail} from './types.ts';
const metres=(value:number)=>value.toFixed(value<10?2:1).replace(/\.?0+$/,'');
export const fileSlug=(title:string)=>title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'model';
export async function recipeDescription(family:string|undefined){
 const load=family?loaderFor(family):null;if(!load)return null;
 try{return (await load()).metadata.description||null;}catch{return null;}
}
export function describeModel(data:ModelDetail,recipe:string|null){
 const stats=data.stats,kind=data.type?data.type.toLowerCase().replace(/s$/,''):'model';
 const shape=stats?' about '+metres(stats.size[0])+' × '+metres(stats.size[1])+' × '+metres(stats.size[2])+' m':'';
 const base=data.title+': a free low-poly '+kind+shape+(stats?', '+stats.triangles.toLocaleString('en-US')+' triangles':'')+'.';
 return recipe?base+' '+recipe:base+' Download it as a GLB for any glTF engine.';
}
export function factsList(data:ModelDetail,bytes:number|null,editable:boolean){
 const stats=data.stats,items:string[]=[];
 if(stats){items.push(stats.triangles.toLocaleString('en-US')+' triangles · '+stats.materials+' '+(stats.materials===1?'material':'materials'));items.push(metres(stats.size[0])+' × '+metres(stats.size[1])+' × '+metres(stats.size[2])+' m, real-world scale, +Y up');}
 if(bytes)items.push('GLB '+(bytes<1048576?Math.round(bytes/1024)+' KB':(bytes/1048576).toFixed(1)+' MB'));
 items.push(editable?'Editable recipe: change it here or in the source you download':'Static mesh');
 items.push('Free, no account needed to download');
 return el('ul','model-facts',...items.map(item=>el('li','',item)));
}
export function recipeSourceButton(family:string,feedback:HTMLElement){
 const url=sourceUrlFor(family);if(!url)return null;
 const control=button('Download recipe source','button-secondary');
 control.addEventListener('click',()=>{const a=document.createElement('a');a.href=url;a.download=family+'.recipe.mjs';a.click();feedback.textContent='Recipe source download started: '+a.download+'.';});
 return control;
}
export function usageBlock(data:ModelDetail,family:string|null){
 const file=fileSlug(data.title)+'.glb',page='https://polyspoon.com/asset/'+data.id;
 const tabs:Array<[string,string]>=[
  ['three.js · GLB',"import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';\n\nnew GLTFLoader().load('./"+file+"', gltf => {\n  scene.add(gltf.scene);\n});"],
  ['Unity · Godot · Blender','Unity: add glTFast (com.unity.cloud.gltfast), then drop '+file+' into Assets.\nGodot 4: drop '+file+' into the project; it imports as a scene.\nBlender: File > Import > glTF 2.0 and pick '+file+'.\nAll formats are in metres with +Y up.'],
  ['Your agent','Use the Polyspoon toolkit (https://polyspoon.com/docs) to rebuild '+(family?'the '+family+' recipe':'this model')+' from '+page+'.\nMake it 20% wider, keep the palette, and export a GLB to assets/models/.'],
 ];
 const root=el('section','panel use-it',el('h2','','Use it')),bar=el('div','use-tabs'),code=el('pre','use-code'),copy=button('Copy','button-secondary use-copy');bar.setAttribute('role','tablist');
 const select=(index:number)=>{code.textContent=tabs[index]![1];for(const [position,tab] of [...bar.children].entries())tab.setAttribute('aria-selected',String(position===index));};
 for(const [index,[label]] of tabs.entries()){const tab=button(label,'use-tab');tab.setAttribute('role','tab');tab.addEventListener('click',()=>select(index));bar.append(tab);}
 copy.addEventListener('click',()=>{void navigator.clipboard?.writeText(code.textContent??'').then(()=>{copy.textContent='Copied';setTimeout(()=>copy.textContent='Copy',1500);});});
 select(0);root.append(bar,el('div','use-body',code,copy));return root;
}
