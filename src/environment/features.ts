import { BufferGeometry,Float32BufferAttribute,Mesh,MeshStandardMaterial,ShapeUtils,Vector2 } from 'three';
import { createSurface } from './terrain.ts';
import type { EnvironmentManifest,EnvironmentPoint,EnvironmentRoad } from './manifest.ts';

type Point=EnvironmentPoint;
const cross=(a:Point,b:Point,c:Point)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
function area(points:Point[]):number {
  const origin=points[0]!;let result=0;
  for(let i=1;i+1<points.length;i++)result+=cross(origin,points[i]!,points[i+1]!)/2;
  return Math.abs(result);
}
function clip(points:Point[],distance:(point:Point)=>number):Point[] {
  const output:Point[]=[];
  for(let i=0;i<points.length;i++){
    const a=points[i]!,b=points[(i+1)%points.length]!,da=distance(a),db=distance(b);
    if(da>=0)output.push(a);
    if((da<0&&db>0)||(da>0&&db<0)){const t=da/(da-db);output.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});}
  }
  return output;
}
function ribbon(road:EnvironmentRoad):Point[] {
  const path=road.path,half=road.width/2,directions=path.slice(1).map((point,i)=>{
    const dx=point.x-path[i]!.x,dz=point.z-path[i]!.z,length=Math.hypot(dx,dz);
    if(length<.001)throw new Error('Road path contains repeated or adjacent points');return {x:dx/length,z:dz/length};
  });
  const left:Point[]=[],right:Point[]=[];
  for(let i=0;i<path.length;i++){
    const before=directions[Math.max(0,i-1)]!,after=directions[Math.min(i,directions.length-1)]!,nx=-before.z-after.z,nz=before.x+after.x,denominator=nx*(-after.z)+nz*after.x;
    if(denominator<.5)throw new Error('Road bend is too sharp');
    const dx=nx*half/denominator,dz=nz*half/denominator,point=path[i]!;
    left.push({x:point.x+dx,z:point.z+dz});right.push({x:point.x-dx,z:point.z-dz});
  }
  const polygon=[...left,...right.reverse()];
  for(let i=0;i<polygon.length;i++)for(let j=i+1;j<polygon.length;j++){
    if(j===i+1||i===0&&j===polygon.length-1)continue;
    const a=polygon[i]!,b=polygon[(i+1)%polygon.length]!,c=polygon[j]!,d=polygon[(j+1)%polygon.length]!;
    if(cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0&&Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x))<=Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x))&&Math.max(Math.min(a.z,b.z),Math.min(c.z,d.z))<=Math.min(Math.max(a.z,b.z),Math.max(c.z,d.z)))throw new Error('Road ribbon intersects itself');
  }
  if(area(polygon)<1e-8)throw new Error('Road ribbon has no area');return polygon;
}
export function buildSurfaceFeatures(config:EnvironmentManifest):Mesh<BufferGeometry,MeshStandardMaterial>[] {
  const meshes:Mesh<BufferGeometry,MeshStandardMaterial>[]=[],surface=createSurface(config.terrain),step=config.terrain.cellSize,cells=config.terrain.cells;
  let jobs=0,vertices=0;
  function build(id:string,footprint:Point[],triangulated:boolean,elevation?:number){
    const triangles=triangulated?ShapeUtils.triangulateShape(footprint.map(p=>new Vector2(p.x,p.z)),[]):[];
    const pieces=triangulated?triangles.map(indices=>indices.map(i=>footprint[i]!)):[footprint];
    const positions:number[]=[],minX=Math.min(...footprint.map(p=>p.x)),maxX=Math.max(...footprint.map(p=>p.x)),minZ=Math.min(...footprint.map(p=>p.z)),maxZ=Math.max(...footprint.map(p=>p.z));
    const originX=Math.floor(minX/step)*step,originZ=Math.floor(minZ/step)*step;
    let covered=0;
    for(const tile of config.tiles){
      const x0=Math.max(tile.x*cells,Math.floor(minX/step)),x1=Math.min((tile.x+1)*cells,Math.ceil(maxX/step)),z0=Math.max(tile.z*cells,Math.floor(minZ/step)),z1=Math.min((tile.z+1)*cells,Math.ceil(maxZ/step));
      for(let z=z0;z<z1;z++)for(let x=x0;x<x1;x++){
        const a={x:x*step,z:z*step},b={x:(x+1)*step,z:z*step},c={x:x*step,z:(z+1)*step},d={x:(x+1)*step,z:(z+1)*step};
        for(const terrain of [[a,b,c],[b,d,c]])for(const piece of pieces){
          if(++jobs>2000000)throw new Error('Surface clipping budget exceeded');
          let polygon=piece;
          for(let edge=0;edge<3;edge++){const start=terrain[edge]!,end=terrain[(edge+1)%3]!;polygon=clip(polygon,p=>cross(start,end,p));}
          const coveredArea=area(polygon);if(coveredArea<1e-12)continue;covered+=coveredArea;
          if(elevation!==undefined)polygon=clip(polygon,p=>elevation-surface.sample(p.x,p.z).height);
          if(area(polygon)<1e-12)continue;
          for(let i=1;i+1<polygon.length;i++){
            const triangle=[polygon[0]!,polygon[i+1]!,polygon[i]!];if(area(triangle)<1e-12)continue;
            for(const p of triangle){const px=Math.fround(p.x-originX),pz=Math.fround(p.z-originZ);positions.push(px,elevation??surface.sample(px+originX,pz+originZ).height+.015,pz);}
            vertices+=3;if(vertices>262144)throw new Error('Surface vertex budget exceeded');
          }
        }
      }
    }
    const expected=area(footprint);
    if(Math.abs(covered-expected)>Math.max(1e-7,expected*1e-8))throw new Error('Surface feature extent outside supplied terrain: '+id);
    if(!positions.length)throw new Error('Surface feature is fully dry or empty: '+id);
    const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.computeVertexNormals();geometry.computeBoundingBox();
    const mesh=new Mesh(geometry,new MeshStandardMaterial({color:elevation===undefined?'#9a8161':'#4d94b3',roughness:elevation===undefined?.95:.3,metalness:0}));mesh.position.set(originX,0,originZ);mesh.name=id;mesh.userData.surfaceFeature={kind:elevation===undefined?'road':'water',offset:elevation===undefined?.015:0};meshes.push(mesh);
  }
  try{
    for(const road of config.roads)build('road-'+road.id,ribbon(road),true);
    for(const water of config.water)build('water-'+water.id,[{x:water.x-water.width/2,z:water.z-water.depth/2},{x:water.x+water.width/2,z:water.z-water.depth/2},{x:water.x+water.width/2,z:water.z+water.depth/2},{x:water.x-water.width/2,z:water.z+water.depth/2}],false,water.elevation);
    return meshes;
  }catch(error){for(const mesh of meshes){mesh.geometry.dispose();mesh.material.dispose();}throw error;}
}
