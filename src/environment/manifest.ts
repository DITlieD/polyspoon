import { loadDesign,type Design } from '../catalog/index.ts';
import { bounded,fields } from './validation.ts';
import { terrainParameters,terrainTile,type TerrainParameters,type TerrainTile } from './terrain.ts';

export interface EnvironmentPlacement {id:string;design:Design;x:number;z:number;yaw:number;maxSlopeDegrees:number;maxSupportVariation:number}
export interface EnvironmentPoint {x:number;z:number}
export interface EnvironmentRoad {id:string;width:number;path:EnvironmentPoint[]}
export interface EnvironmentWater {id:string;x:number;z:number;width:number;depth:number;elevation:number}
export interface EnvironmentManifest {formatVersion:1;terrain:TerrainParameters;tiles:TerrainTile[];placements:EnvironmentPlacement[];roads:EnvironmentRoad[];water:EnvironmentWater[]}
function identity(value:unknown):string {
  if(typeof value!=='string'||! /^[a-z][a-z0-9-]{0,63}$/.test(value))throw new Error('Invalid surface feature identity');return value;
}
function featureList<T extends {id:string}>(input:unknown,parse:(input:unknown)=>T):T[] {
  if(input===undefined)return [];
  if(!Array.isArray(input)||input.length>8)throw new Error('Surface feature count exceeds eight');
  const result=input.map(parse);if(new Set(result.map(item=>item.id)).size!==result.length)throw new Error('Duplicate surface feature identity');return result;
}
export function loadEnvironment(input:unknown):EnvironmentManifest {
  const value=fields(input,['formatVersion','terrain','tiles','placements','roads','water']);
  if(value.terrain===undefined||value.formatVersion!==1||!Array.isArray(value.tiles)||value.tiles.length<1||value.tiles.length>16||!Array.isArray(value.placements)||value.placements.length>64)throw new Error('Invalid environment manifest');
  const terrain=terrainParameters(value.terrain),tiles=value.tiles.map(terrainTile),tileIds=tiles.map(t=>t.x+','+t.z);
  if(new Set(tileIds).size!==tiles.length)throw new Error('Duplicate terrain tile');
  const placements=value.placements.map(input=>{
    const p=fields(input,['id','design','x','z','yaw','maxSlopeDegrees','maxSupportVariation']);
    if(typeof p.id!=='string'||! /^[a-z][a-z0-9-]{0,63}$/.test(p.id))throw new Error('Invalid placement identity');
    const placement={id:p.id,design:loadDesign(p.design),x:bounded(p.x,-(2**20),2**20),z:bounded(p.z,-(2**20),2**20),yaw:bounded(p.yaw,-360,360),maxSlopeDegrees:bounded(p.maxSlopeDegrees,0,89),maxSupportVariation:bounded(p.maxSupportVariation??.25,0,1)};
    const size=terrain.cells*terrain.cellSize;
    if(!tiles.some(t=>placement.x>=t.x*size&&placement.x<=(t.x+1)*size&&placement.z>=t.z*size&&placement.z<=(t.z+1)*size))throw new Error('Placement outside terrain');
    return placement;
  });
  if(new Set(placements.map(p=>p.id)).size!==placements.length)throw new Error('Duplicate placement identity');
  const roads=featureList(value.roads,input=>{
    const road=fields(input,['id','width','path']);
    if(!Array.isArray(road.path)||road.path.length<2||road.path.length>8)throw new Error('Road requires two to eight points');
    return {id:identity(road.id),width:bounded(road.width,.25,8),path:road.path.map(input=>{const point=fields(input,['x','z']);return {x:bounded(point.x,-(2**20),2**20),z:bounded(point.z,-(2**20),2**20)};})};
  });
  const water=featureList(value.water,input=>{
    const patch=fields(input,['id','x','z','width','depth','elevation']);return {id:identity(patch.id),x:bounded(patch.x,-(2**20),2**20),z:bounded(patch.z,-(2**20),2**20),width:bounded(patch.width,.25,64),depth:bounded(patch.depth,.25,64),elevation:bounded(patch.elevation,-20,32)};
  });
  return {formatVersion:1,terrain,tiles,placements,roads,water};
}
export function saveEnvironment(input:unknown):string {return JSON.stringify(loadEnvironment(input),null,2)+'\n';}
