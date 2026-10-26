import type {Design} from '../../src/catalog/index.ts';
export function serializeEditedDesign(design:Design,origin:unknown){return new TextEncoder().encode(JSON.stringify({...design,origin},null,2)+'\n');}
export async function readCurrentEditedDesign(file:Pick<File,'text'>,current:()=>boolean,apply:(value:unknown)=>void){
 const text=await file.text();if(current())apply(JSON.parse(text));
}
