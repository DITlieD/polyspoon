import {sourcePackageFilename} from '../scripts/recipe-package-identity.ts';
import type {ReviewSubject} from '../src/review/types.ts';

type File={path:string;sha256:string;bytes:number};
export function selectPublicDelivery<T extends File>(value:unknown,files:readonly T[]):{primary:T[];previews:T[];preview:T|null}{
 const subject=value as Partial<ReviewSubject>|null,primaryPaths=['selected.glb','selected.design.json'];
 try{if(subject?.recipe)primaryPaths.push('packages/'+sourcePackageFilename(subject.recipe.id,subject.recipe.version,subject.recipe.deliveryRevision));}catch{}
 const byPath=new Map(files.map(file=>[file.path,file])),primary=primaryPaths.flatMap(path=>{const file=byPath.get(path);return file?[file]:[];}),cases=new Set(Array.isArray(subject?.coverage?.cases)?subject.coverage.cases.flatMap(item=>item&&typeof item.id==='string'?[item.id]:[]):[]),paths=new Set<string>();
 const views=Array.isArray(subject?.coverage?.views)?[...subject.coverage.views]:[],priority=(view:typeof views[number])=>view?.caseId==='selected'?(view.view==='oblique'?0:1):2;views.sort((a,b)=>priority(a)-priority(b));
 if(views.length)for(const view of views){if(view&&typeof view.evidence==='string'&&cases.has(view.caseId)&&/\.(png|jpe?g|webp)$/i.test(view.evidence)&&Object.hasOwn(subject?.artifacts??{},view.evidence))paths.add(view.evidence);}
 const previews=[...paths].flatMap(path=>{const file=byPath.get(path),expected=subject?.artifacts?.[path];return file&&expected&&expected.sha256===file.sha256&&expected.bytes===file.bytes?[file]:[];});
 const selectedPaths=new Set(views.filter(view=>view?.caseId==='selected').map(view=>view.evidence)),preview=previews.find(file=>selectedPaths.has(file.path))??null;
 return {primary,previews,preview};
}
