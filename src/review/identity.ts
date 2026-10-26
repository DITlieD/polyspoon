import {createHash} from 'node:crypto';

export function canonical(value:unknown):string {
 if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
 if(typeof value==='number'){if(!Number.isFinite(value))throw Error('Nonfinite review value');return JSON.stringify(value);}
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(typeof value==='object'&&value&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null))return '{'+Object.keys(value).filter(key=>(value as Record<string,unknown>)[key]!==undefined).sort().map(key=>JSON.stringify(key)+':'+canonical((value as Record<string,unknown>)[key])).join(',')+'}';
 throw Error('Review records require plain JSON values');
}
export function identity(value:unknown):string{return createHash('sha256').update(canonical(value)).digest('hex');}
export function withoutIdentity(value:Record<string,unknown>,key:string){return Object.fromEntries(Object.entries(value).filter(([name])=>name!==key));}
