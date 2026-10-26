import type { Descriptor } from '../catalog/index.ts';
import type { AssetSemantics } from '../catalog/semantics.ts';

const styles:Record<string,string>={
 'stylized-humanoid':'faceted-low-poly','stylized-fox':'faceted-low-poly',
 'work-lantern':'faceted-low-poly',cottage:'faceted-low-poly',tree:'faceted-low-poly',fence:'faceted-low-poly',crate:'faceted-low-poly',boulder:'faceted-low-poly',
 bench:'faceted-low-poly',planter:'faceted-low-poly','treasure-chest':'faceted-low-poly',wheelbarrow:'faceted-low-poly','stone-well':'faceted-low-poly',conifer:'faceted-low-poly',
};
export const styleLabels:Record<string,string>={'faceted-low-poly':'Faceted low poly',unclassified:'Unclassified'};
export function modelStyle(id:string):string{return Object.hasOwn(styles,id)?styles[id]!:'unclassified';}
export interface DiscoveryModel { id:string;title:string;description:string;type:string;style:string;poseable:boolean;triangles:number }
export interface DiscoveryState { query:string;type:string;style:string;capability:string;sort:string }
export function createDiscoveryModel(d:Descriptor,type:string,semantics:Pick<AssetSemantics,'joints'>,triangles:number):DiscoveryModel {
 return {id:d.id,title:d.title,description:d.description,type,style:modelStyle(d.id),poseable:semantics.joints.length>0,triangles};
}
export function readDiscoveryState(params:URLSearchParams,models:DiscoveryModel[]):DiscoveryState {
 const type=params.get('type')??'',style=params.get('style')??'',capability=params.get('capability')??'',sort=params.get('sort')??'name';
 return {query:params.get('q')??'',type:models.some(m=>m.type===type)?type:'',style:models.some(m=>m.style===style)?style:'',capability:capability==='poseable'?capability:'',sort:['name','name-desc','triangles'].includes(sort)?sort:'name'};
}
export function discoverySearch(state:DiscoveryState):string {
 const params=new URLSearchParams();
 for(const [key,value] of [['q',state.query],['type',state.type],['style',state.style],['capability',state.capability],['sort',state.sort==='name'?'':state.sort]])if(value)params.set(key!,value);
 const search=params.toString();return search?'?'+search:'';
}
export function filterModels(models:DiscoveryModel[],state:DiscoveryState):DiscoveryModel[] {
 const words=state.query.toLocaleLowerCase().trim().split(/\s+/);
 return models.filter(m=>(!state.type||m.type===state.type)&&(!state.style||m.style===state.style)&&(!state.capability||m.poseable)&&words.every(word=>(m.title+' '+m.id+' '+m.description).toLocaleLowerCase().includes(word))).sort((a,b)=>{
  const names=a.title.localeCompare(b.title)||a.id.localeCompare(b.id);
  return state.sort==='triangles'?a.triangles-b.triangles||names:state.sort==='name-desc'?-names:names;
 });
}
