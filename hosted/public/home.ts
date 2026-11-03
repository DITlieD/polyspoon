import {el,link} from '../shared/dom.ts';
import {trimPreview} from '../shared/trim-preview.ts';
type Latest={id:string;title:string;type:string|null;triangles?:number|null;preview:{path:string}|null};
type Numbers={models:number;contributors:number;stars:number};
const reducedMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const fallback:Numbers={models:141,contributors:1,stars:5};
const remembered=():Numbers=>{try{return {...fallback,...JSON.parse(localStorage.getItem('polyspoon-numbers')??'{}') as Partial<Numbers>};}catch{return fallback;}};
const heroModule='/app/hero.js';
export function rotatingWord(words:string[]){
 const holder=el('span','rotating-word'),word=el('span','',words[0]!);holder.append(word);
 if(words.length<2)return holder;
 let index=0;setInterval(()=>{if(document.hidden)return;const swap=()=>{index=(index+1)%words.length;word.textContent=words[index]!;word.classList.remove('out');};if(reducedMotion()){swap();return;}word.classList.add('out');setTimeout(swap,260);},2400);
 return holder;
}
export function mountHeroStage(){
 const stage=el('div','hero-stage'),poster=el('img','hero-poster');poster.src='/brand/hero-fruit-stall.webp';poster.alt='A market fruit stall built from an editable Polyspoon recipe';poster.width=1200;poster.height=1200;poster.fetchPriority='high';stage.append(poster);
 const start=()=>{if(!window.WebGLRenderingContext)return;void (import(/* @vite-ignore */ heroModule) as Promise<{mountHero(host:HTMLElement,options:{reducedMotion:boolean}):Promise<()=>void>}>).then(module=>module.mountHero(stage,{reducedMotion:reducedMotion()})).then(()=>stage.classList.add('ready')).catch(()=>stage.classList.add('static'));};
 if(document.readyState==='complete')setTimeout(start,50);else addEventListener('load',()=>setTimeout(start,50),{once:true});
 return stage;
}
export function latestModels(){
 const grid=el('div','latest-grid');
 for(let index=0;index<8;index++)grid.append(el('div','latest-card skeleton'));
 void fetch('/api/catalog',{credentials:'same-origin'}).then(response=>response.ok?response.json() as Promise<{models:Latest[];total:number}>:Promise.reject(new Error('catalog'))).then(data=>{
  const models=data.models.filter(model=>model.preview).slice(0,8);
  grid.replaceChildren(...models.map(model=>{const image=el('img');image.src='/api/catalog/'+model.id+'/files?path='+encodeURIComponent(model.preview!.path);image.alt=model.title;image.loading='lazy';image.decoding='async';image.addEventListener('load',()=>trimPreview(image,[239,240,236]),{once:true});const card=link('','/asset/'+model.id,'latest-card');card.append(el('div','latest-visual',image),el('div','latest-copy',el('strong','',model.title),el('span','muted',model.triangles?model.triangles.toLocaleString('en-US')+' tris':model.type??'Model')));return card;}));
  store({models:data.total});
 }).catch(()=>grid.replaceChildren(link('Browse the catalog','/catalog','button-secondary')));
 return grid;
}
const listeners=new Set<(numbers:Numbers)=>void>();
function store(patch:Partial<Numbers>){const next={...remembered(),...patch};try{localStorage.setItem('polyspoon-numbers',JSON.stringify(next));}catch{}for(const listener of listeners)listener(next);}
export function communityNumbers(api:string){
 const value=(key:keyof Numbers,label:string)=>{const number=el('strong','',''),node=el('div','number',number,el('span','muted',label));return {node,set:(numbers:Numbers)=>{number.textContent=numbers[key].toLocaleString('en-US');}};};
 const items=[value('models','published models'),value('contributors','code contributors'),value('stars','GitHub stars')],row=el('div','numbers',...items.map(item=>item.node));
 const render=(numbers:Numbers)=>{for(const item of items)item.set(numbers);};render(remembered());listeners.add(render);
 void fetch(api).then(response=>response.ok?response.json() as Promise<{stargazers_count:number}>:Promise.reject(new Error('github'))).then(repo=>store({stars:repo.stargazers_count})).catch(()=>{});
 void fetch(api+'/contributors?per_page=100&anon=1').then(response=>response.ok?response.json() as Promise<unknown[]>:Promise.reject(new Error('github'))).then(list=>store({contributors:Math.max(1,list.length)})).catch(()=>{});
 return row;
}
