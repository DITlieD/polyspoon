import {descriptor} from '../catalog/index.ts';
export function modelDescription(id:string):string {
 return id==='bench'?'A timber bench with adjustable supports, seat proportions and construction details.':descriptor(id).description;
}
