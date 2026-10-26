import manifest from './model-controls.json' with {type:'json'};
import {readGlb,bounds} from './gltf-read.ts';
import {exportFormats} from './index.ts';
type Family=(typeof manifest.families)[keyof typeof manifest.families];
const hex=(v:number)=>Math.round(Math.min(1,Math.max(0,v<=0.0031308?v*12.92:1.055*v**(1/2.4)-0.055))*255).toString(16).padStart(2,'0');
export function familyControls(id:string):Family|null{return (manifest.families as Record<string,Family>)[id]??null;}
/** Machine-readable description of one model: its knobs (with ranges, defaults, units and the applied value), materials and real-world size. */
export function controlsDocument({design,glb,title}:{design:{family?:string;familyVersion?:string;applied?:Record<string,unknown>;appearance?:unknown}|null|undefined;glb?:Uint8Array|null;title?:string}){
 const family=design?.family?familyControls(design.family):null,applied=design?.applied??{};
 let materials:unknown[]=[],size:unknown=null;
 if(glb){const scene=readGlb(glb),b=bounds(scene);materials=scene.materials.filter((_,i)=>scene.meshes.some(m=>m.material===i)).map(m=>({name:m.name,baseColor:m.color,hex:'#'+hex(m.color[0])+hex(m.color[1])+hex(m.color[2]),metallic:m.metallic,roughness:m.roughness}));size={min:b.min,max:b.max,dimensions:b.max.map((v,i)=>v-b.min[i]!)};}
 return {
  formatVersion:1,kind:'polyspoon.model-controls',title:title??family?.title??design?.family??null,
  family:design?.family??null,familyVersion:design?.familyVersion??null,recipeVersion:family?.version??null,
  units:manifest.units,
  parameters:(family?.controls??[]).map(control=>({...control,value:Object.hasOwn(applied,control.key)?applied[control.key]:control.default})),
  applied,appearance:design?.appearance??null,presets:family?.presets??[],palettes:family?.palettes??[],
  materials,bounds:size,
  formats:['glb',...Object.keys(exportFormats)],
  note:family?'Change parameters in the Polyspoon editor or with the agent toolkit, then export again; downloaded meshes are static snapshots.':'This recipe is not a built-in family, so knob metadata is not listed; applied values are the exact saved design.',
 };
}
