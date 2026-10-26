import type {TrustedRecipe} from './trusted-types.ts';
function object(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value);}
export function sameDesign(left:unknown,right:unknown):boolean {
 if(left===right)return true;
 if(Array.isArray(left)&&Array.isArray(right))return left.length===right.length&&left.every((value,index)=>sameDesign(value,right[index]));
 if(!object(left)||!object(right))return false;
 const keys=Object.keys(left);return keys.length===Object.keys(right).length&&keys.every(key=>Object.hasOwn(right,key)&&sameDesign(left[key],right[key]));
}
export function matchTrustedRecipe(records:TrustedRecipe[],claim:unknown):TrustedRecipe|undefined {
 if(!object(claim)||!object(claim.recipe)||!object(claim.sourcePackage)||!object(claim.design)||claim.sourcePackage.media_type!=='application/zip')return;
 const recipe=claim.recipe,archive=claim.sourcePackage,design=claim.design;
 return records.find(record=>recipe.id===record.id&&recipe.version===record.version&&recipe.deliveryRevision===record.deliveryRevision&&archive.path===record.archive.path&&archive.sha256===record.archive.sha256&&archive.bytes===record.archive.bytes&&design.family===record.id&&design.familyVersion===record.version);
}
