import { BufferGeometry,Float32BufferAttribute,Mesh,MeshStandardMaterial } from 'three';
import { bounded,fields } from './validation.ts';

export interface TerrainParameters {seed:number;cells:number;cellSize:number;amplitude:number;wavelength:number;baseHeight:number}
export interface TerrainTile {x:number;z:number}
export interface SurfaceSample {height:number;normal:[number,number,number];slopeDegrees:number}
const defaults:TerrainParameters={seed:1,cells:24,cellSize:1,amplitude:2,wavelength:24,baseHeight:0};
export function terrainParameters(input:unknown={}):TerrainParameters {
  const value={...defaults,...fields(input,Object.keys(defaults))};
  bounded(value.seed,0,2**32-1,true);bounded(value.cells,4,128,true);bounded(value.amplitude,0,12);bounded(value.wavelength,4,128);bounded(value.baseHeight,-20,20);
  if(![.25,.5,1,2,4].includes(value.cellSize))throw new Error('Cell size must be binary exact');
  return value;
}
export function terrainTile(input:unknown):TerrainTile {
  const value=fields(input,['x','z']);return {x:bounded(value.x,-1024,1024,true),z:bounded(value.z,-1024,1024,true)};
}
function random(seed:number,x:number,z:number):number {
  let hash=(seed^Math.imul(x,0x45d9f3b)^Math.imul(z,0x27d4eb2d))>>>0;
  hash=Math.imul(hash^(hash>>>16),0x7feb352d);hash=Math.imul(hash^(hash>>>15),0x846ca68b);
  return ((hash^(hash>>>16))>>>0)/0xffffffff*2-1;
}
function noise(seed:number,x:number,z:number):number {
  const ix=Math.floor(x),iz=Math.floor(z),u=x-ix,v=z-iz,s=u*u*(3-2*u),t=v*v*(3-2*v);
  const a=random(seed,ix,iz),b=random(seed,ix+1,iz),c=random(seed,ix,iz+1),d=random(seed,ix+1,iz+1);
  return (a+(b-a)*s)*(1-t)+(c+(d-c)*s)*t;
}
export function createSurface(input:TerrainParameters) {
  const p=terrainParameters(input);
  function vertex(x:number,z:number):number {
    const wx=x*p.cellSize/p.wavelength,wz=z*p.cellSize/p.wavelength;
    return Math.fround(p.baseHeight+p.amplitude*(noise(p.seed,wx,wz)+.5*noise(p.seed^0xa24baed4,wx*2,wz*2)+.25*noise(p.seed^0x9fb21c65,wx*4,wz*4))/1.75);
  }
  function sample(x:number,z:number):SurfaceSample {
    bounded(x,-(2**20),2**20);bounded(z,-(2**20),2**20);
    const gx=Math.floor(x/p.cellSize),gz=Math.floor(z/p.cellSize),u=x/p.cellSize-gx,v=z/p.cellSize-gz;
    const a=vertex(gx,gz),b=vertex(gx+1,gz),c=vertex(gx,gz+1),d=vertex(gx+1,gz+1);
    const lower=u+v<=1,height=lower?a+u*(b-a)+v*(c-a):d+(1-u)*(c-d)+(1-v)*(b-d),dx=(lower?b-a:d-c)/p.cellSize,dz=(lower?c-a:d-b)/p.cellSize,length=Math.hypot(dx,1,dz);
    return {height,normal:[-dx/length,1/length,-dz/length],slopeDegrees:Math.atan(Math.hypot(dx,dz))*180/Math.PI};
  }
  function vertexNormal(x:number,z:number):[number,number,number] {
    const dx=(vertex(x+1,z)-vertex(x-1,z))/(2*p.cellSize),dz=(vertex(x,z+1)-vertex(x,z-1))/(2*p.cellSize),length=Math.hypot(dx,1,dz);
    return [-dx/length,1/length,-dz/length];
  }
  return {sample,vertex,vertexNormal};
}
export function buildTerrainTile(input:TerrainParameters,tileInput:TerrainTile):Mesh<BufferGeometry,MeshStandardMaterial> {
  const p=terrainParameters(input),tile=terrainTile(tileInput),surface=createSurface(p),positions:number[]=[],normals:number[]=[],indices:number[]=[],stride=p.cells+1;
  for(let z=0;z<=p.cells;z++)for(let x=0;x<=p.cells;x++){
    const gx=tile.x*p.cells+x,gz=tile.z*p.cells+z;
    positions.push(gx*p.cellSize,surface.vertex(gx,gz),gz*p.cellSize);normals.push(...surface.vertexNormal(gx,gz));
  }
  for(let z=0;z<p.cells;z++)for(let x=0;x<p.cells;x++){const a=z*stride+x,b=a+1,c=a+stride,d=c+1;indices.push(a,c,b,b,c,d);}
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new Float32BufferAttribute(normals,3));geometry.setIndex(indices);geometry.computeBoundingBox();
  const mesh=new Mesh(geometry,new MeshStandardMaterial({color:'#71805a',roughness:1}));mesh.name='terrain-'+tile.x+'-'+tile.z;mesh.userData.terrain={...p,tile};return mesh;
}
