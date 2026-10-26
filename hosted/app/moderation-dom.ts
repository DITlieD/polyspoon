import {el,action} from '../shared/dom.ts';
import {ModerationInputError} from './moderation-actions.ts';
export function messageInput(name:string){const input=el('textarea');input.name=name;input.required=true;input.maxLength=1000;input.rows=4;return input;}
export function moderationState(value:string){return ({open:'Open',dismiss:'Dismissed',withdraw:'Withdrawn',uphold:'Restriction upheld',reinstate:'Reinstated',superseded:'Superseded'} as Record<string,string>)[value]??value.replaceAll('_',' ');}
export function moderationTime(value:number|null){return value===null?'Not available':new Date(value).toLocaleString();}
export async function moderationAction(control:HTMLButtonElement,feedback:HTMLElement,work:()=>Promise<void>){feedback.classList.remove('error');await action(control,feedback,async()=>{try{await work();}catch(error){if(!(error instanceof ModerationInputError))throw error;feedback.textContent=error.message;feedback.classList.add('error');}});}
