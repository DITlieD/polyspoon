import {brandArtwork} from '../../src/site/brand.ts';
import {explain} from './http.ts';
export function el<K extends keyof HTMLElementTagNameMap>(tag:K,className='',...children:Array<Node|string>){
 const node=document.createElement(tag);node.className=className;node.append(...children);return node;
}
export function link(label:string,href:string,className=''){const node=el('a',className,label);node.href=href;return node;}
export function button(label:string,className='button'){const node=el('button',className,label);node.type='button';return node;}
export function field(label:string,input:HTMLElement){const wrapper=el('label','field',el('span','field-label',label),input);return wrapper;}
export function input(name:string,type='text',required=true){const node=el('input');node.name=name;node.type=type;node.required=required;return node;}
export function status(text=''){const node=el('p','status',text);node.setAttribute('role','status');node.setAttribute('aria-live','polite');return node;}
export function heading(title:string,description:string){return el('div','page-heading',el('h1','',title),el('p','muted',description));}
export function brand(){const a=link('','/','hosted-brand');a.setAttribute('aria-label','Polyspoon home');a.append(brandArtwork());return a;}
export function shell(navigation:Array<[string,string]>,member=false){
 document.body.className=member?'member-site':'public-site';
 const nav=el('nav','navigation',...navigation.map(([name,path])=>link(name,path)));nav.setAttribute('aria-label','Main');
 const main=el('main','page'),header=el('header','header',brand(),nav),footer=el('footer','footer',brand(),el('p','muted','Polyspoon · Editable models, your own project.'),link('Help','/help'),link('Legal','/legal'));
 document.body.replaceChildren(header,main,footer);return main;
}
export function empty(title:string,copy:string){return el('section','empty',el('h2','',title),el('p','muted',copy));}
export async function action(control:HTMLButtonElement,feedback:HTMLElement,work:()=>Promise<void>){
 control.disabled=true;feedback.textContent='Working…';
 try{await work();}catch(error){feedback.textContent=explain(error);feedback.classList.add('error');}finally{control.disabled=false;}
}
export function when(value:string|number|null|undefined){if(value===null||value===undefined||(typeof value==='string'&&!value.trim()))return 'Not yet';const numeric=Number(value),date=new Date(Number.isFinite(numeric)?numeric:value);return Number.isFinite(date.getTime())?date.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}):'Not yet';}
export function humanState(state:string){return ({draft:'Draft',submitted:'Submitted',processing:'Being checked',awaiting_review:'Awaiting review',changes_requested:'Changes requested',rejected:'Not accepted',approved:'Approved',published:'Published',withdrawn:'Withdrawn'} as Record<string,string>)[state]??state.replaceAll('_',' ');}
