import type { Descriptor } from '../catalog/index.ts';
import type { AssetSemantics } from '../catalog/semantics.ts';

const styles:Record<string,string>={
 'stylized-humanoid':'faceted-low-poly','stylized-fox':'faceted-low-poly',
 'work-lantern':'faceted-low-poly',cottage:'faceted-low-poly',tree:'faceted-low-poly',fence:'faceted-low-poly',crate:'faceted-low-poly',boulder:'faceted-low-poly',
 bench:'faceted-low-poly',planter:'faceted-low-poly','treasure-chest':'faceted-low-poly',wheelbarrow:'faceted-low-poly','stone-well':'faceted-low-poly',conifer:'faceted-low-poly',
 'smithy-anvil':'faceted-low-poly',bookcase:'faceted-low-poly','dining-set':'faceted-low-poly','campfire-cookpot':'faceted-low-poly','alchemy-bench':'faceted-low-poly','weapon-rack':'faceted-low-poly',
 windmill:'faceted-low-poly',watchtower:'faceted-low-poly',footbridge:'faceted-low-poly','market-stall':'faceted-low-poly',pier:'faceted-low-poly','stone-arch':'faceted-low-poly',tent:'faceted-low-poly',
 barrel:'faceted-low-poly',signpost:'faceted-low-poly','lamp-post':'faceted-low-poly','mushroom-cluster':'faceted-low-poly','rock-cluster':'faceted-low-poly','bamboo-clump':'faceted-low-poly','pond':'faceted-low-poly','log-pile':'faceted-low-poly','crystal-cluster':'faceted-low-poly','shrub':'faceted-low-poly','flower-bed':'faceted-low-poly','cactus':'faceted-low-poly','palm-tree':'faceted-low-poly',
 rowboat:'faceted-low-poly','cart-wagon':'faceted-low-poly',sailboat:'faceted-low-poly','hot-air-balloon':'faceted-low-poly','rigged-rabbit':'faceted-low-poly',slime:'faceted-low-poly',
 'scifi-cargo':'clean-hard-surface',
};
export const styleLabels:Record<string,string>={'faceted-low-poly':'Faceted low poly','clean-hard-surface':'Clean hard surface',unclassified:'Unclassified'};
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
