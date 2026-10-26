import {Box3,Mesh,Vector3} from 'three';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import type {SemanticAssetBuild} from '../src/catalog/types.ts';
import type {Family} from '../src/families/config.ts';
import {loadFamilyConfiguration} from '../src/families/revision4-config.ts';
import {loadConfiguration} from '../src/lantern/revision4-config.ts';

export async function buildPriorAsset(family:string,input:unknown={}):Promise<SemanticAssetBuild>{
 const version=['work-lantern','cottage','tree','fence','crate','boulder'].includes(family)?'0.5.0':'1.0.0';
 const module=await import(pathToFileURL(resolve('public/procedural-modules',family,version,'asset.mjs')).href),root=module.createAsset(input);
 delete root.userData.design;
 const bounds=new Box3().setFromObject(root,true),materials:SemanticAssetBuild['materials']={};root.traverse((object:any)=>{if(object instanceof Mesh){if(Array.isArray(object.material))throw new Error('Expected one historical material');materials[object.material.name]=object.material as SemanticAssetBuild['materials'][string];}});
 return {root,config:root.userData.configuration,anchors:root.userData.anchors,materials,bounds,dimensions:bounds.getSize(new Vector3()),semantics:root.userData.openpoly,joints:root.userData.openpoly.joints};
}
export async function loadPriorDesign(input:unknown){
 const family=(input as {family:string}).family;
 if(family==='work-lantern')return loadConfiguration(input);
 if(['cottage','tree','fence','crate','boulder'].includes(family))return loadFamilyConfiguration(input);
 const validator=await import('../src/recipes/legacy-v1/'+family+'.ts');return validator.load(input);
}
