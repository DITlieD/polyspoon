import '../scripts/node-platform.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Raycaster,Vector3 } from 'three';
import { validateBytes } from 'gltf-validator';
import { descriptor } from '../src/catalog/index.ts';
import { terrainParameters,createSurface,buildTerrainTile,loadEnvironment,saveEnvironment,buildEnvironment,exportEnvironment } from '../src/environment/index.ts';

const manifest=()=>({formatVersion:1,terrain:terrainParameters({seed:42}),tiles:[{x:0,z:0},{x:1,z:0}],placements:[{id:'bench-one',design:descriptor('bench').save({}),x:4,z:4,yaw:35,maxSlopeDegrees:80}]});
test('terrain rejects malformed values and supports bounded extrema deterministically',()=>{
  for(const input of [{seed:-1},{seed:2**32},{amplitude:13},{wavelength:0},{cells:129},{cellSize:.3},{baseHeight:NaN},{extra:1},null,[]])assert.throws(()=>terrainParameters(input));
  for(const input of [{amplitude:0,baseHeight:-20,cells:4,cellSize:.25},{amplitude:12,baseHeight:20,cells:128,cellSize:4,wavelength:4,seed:2**32-1}]){const p=terrainParameters(input),a=createSurface(p),b=createSurface(p);assert.deepEqual(a.sample(-.3,2.7),b.sample(-.3,2.7));assert.ok(Number.isFinite(a.sample(0,0).height));}
  assert.notEqual(createSurface(terrainParameters({seed:1})).sample(3,5).height,createSurface(terrainParameters({seed:2})).sample(3,5).height);
  assert.throws(()=>createSurface(terrainParameters()).sample(Infinity,0));
});
test('adjacent tiles share exact edge samples and global-neighbor shading normals',()=>{
  const p=terrainParameters({seed:8,cells:8}),a=buildTerrainTile(p,{x:-1,z:0}),b=buildTerrainTile(p,{x:0,z:0});
  try{for(let row=0;row<=p.cells;row++)for(const attribute of ['position','normal']){const x=a.geometry.getAttribute(attribute),y=b.geometry.getAttribute(attribute),ai=row*(p.cells+1)+p.cells,bi=row*(p.cells+1);for(let component=0;component<3;component++)assert.equal(x.getComponent(ai,component),y.getComponent(bi,component));}}
  finally{a.geometry.dispose();a.material.dispose();b.geometry.dispose();b.material.dispose();}
});
test('height slope queries agree with actual terrain triangles and normals',()=>{
  const p=terrainParameters({cells:8,seed:45}),surface=createSurface(p),mesh=buildTerrainTile(p,{x:-1,z:-1});mesh.updateMatrixWorld(true);
  try{for(const[x,z]of [[-7.8,-6.7],[-5.2,-4.1],[-.75,-.75],[-3,-2]]){const sample=surface.sample(x!,z!),hits=new Raycaster(new Vector3(x,100,z),new Vector3(0,-1,0)).intersectObject(mesh);assert.ok(hits.length);assert.ok(Math.abs(hits[0]!.point.y-sample.height)<1e-7);if(!Number.isInteger(x)&&!Number.isInteger(z))assert.ok(hits[0]!.face!.normal.dot(new Vector3(...sample.normal))>1-1e-10);assert.ok(sample.slopeDegrees>=0&&sample.slopeDegrees<90);}}
  finally{mesh.geometry.dispose();mesh.material.dispose();}
});
test('scene manifests round trip canonical designs and preserve grounded anchor metadata',async()=>{
  const source=manifest();source.terrain=terrainParameters({seed:42,amplitude:0});const loaded=loadEnvironment(source);assert.deepEqual(loadEnvironment(JSON.parse(saveEnvironment(loaded))),loaded);
  const build=buildEnvironment(loaded);try{const wrapper=build.root.getObjectByName('placement-bench-one')!;assert.ok(wrapper);assert.equal(wrapper.position.y,createSurface(loaded.terrain).sample(4,4).height);assert.deepEqual(wrapper.userData.groundAnchor,[4,wrapper.position.y,4]);const bytes=await exportEnvironment(build,{sourceHash:'a'.repeat(64)}),validation=await validateBytes(bytes);assert.equal(validation.issues.numErrors,0);assert.equal(validation.issues.numWarnings,0);const length=new DataView(bytes.buffer,bytes.byteOffset).getUint32(12,true),json=JSON.parse(new TextDecoder().decode(bytes.subarray(20,20+length)));assert.ok(json.nodes.some((n:any)=>n.extras?.environment?.formatVersion===1));}finally{build.dispose();}
  for(const bad of [{...source,formatVersion:2},{...source,tiles:[source.tiles[0],source.tiles[0]]},{...source,placements:[source.placements[0],source.placements[0]]},{...source,placements:[{...source.placements[0],x:1000}]},{...source,terrain:{...source.terrain,unknown:1}}])assert.throws(()=>buildEnvironment(bad));
});

test('upright footprints reject excessive support variation and off-terrain support',()=>{
 const source=manifest();source.placements[0]!.design=descriptor('cottage').save({});source.placements[0]!.x=12;source.placements[0]!.z=12;
 assert.throws(()=>buildEnvironment({...source,placements:[{...source.placements[0],maxSupportVariation:0}]}),/support variation/);
 assert.throws(()=>buildEnvironment({...source,placements:[{...source.placements[0],maxSlopeDegrees:0}]}),/slope limit/);
 assert.throws(()=>buildEnvironment({...source,placements:[{...source.placements[0],x:0,z:0}]}),/footprint outside terrain/);
});

test('actual exported float32 triangles agree with queries at negative diagonal and tile boundaries',async()=>{
 const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');const terrain=terrainParameters({seed:9,cells:8,cellSize:.5}),source={formatVersion:1,terrain,tiles:[{x:-1,z:-1},{x:0,z:-1}],placements:[]},build=buildEnvironment(source);
 try{const bytes=await exportEnvironment(build),loaded=await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer,'');loaded.scene.updateMatrixWorld(true);const surface=createSurface(terrain);for(const[x,z]of[[-3.8,-3.7],[-2.75,-1.75],[-2.5,-1.5],[0,-2],[0,-4],[.3,-1.2]]){const expected=surface.sample(x!,z!),hits=new Raycaster(new Vector3(x,100,z),new Vector3(0,-1,0)).intersectObject(loaded.scene,true);assert.ok(hits.length,'missing exported triangle '+x+','+z);assert.ok(Math.abs(hits[0]!.point.y-expected.height)<1e-7);}}
 finally{build.dispose();}
});
test('saved canonical migration and part colors survive environment rebuild and reject forged notices',async()=>{
 const {pathToFileURL}=await import('node:url'),{resolve}=await import('node:path'),module=await import(pathToFileURL(resolve('public/procedural-modules/cottage/0.5.0/asset.mjs')).href),root=module.createAsset();const prior=structuredClone(root.userData.configuration);module.disposeAsset(root);prior.appearance={version:1,palette:'None',shading:'Flat',partColors:{'ridge-cap-0':'#aabbcc'}};
 const source=manifest();source.terrain=terrainParameters({amplitude:0});source.placements[0]={...source.placements[0]!,design:prior,x:12,z:12};const config=loadEnvironment(source);assert.ok(config.placements[0]!.design.migration);const build=buildEnvironment(config);try{const design=build.root.getObjectByName('cottage')!.userData.configuration;assert.deepEqual(design,config.placements[0]!.design);assert.equal(design.appearance!.partColors['ridge-cap-0'],'#aabbcc');assert.deepEqual(loadEnvironment(JSON.parse(saveEnvironment(config))),config);}finally{build.dispose();}
 const forged=structuredClone(config);forged.placements[0]!.design.migration!.notice='forged';assert.throws(()=>loadEnvironment(forged));
});

test('z seams and corner normals stay exact and maximum terrain topology remains valid',async()=>{
 const {inspectGeometry}=await import('../src/lantern/inspect.ts');const p=terrainParameters({cells:8,seed:3}),a=buildTerrainTile(p,{x:0,z:-1}),b=buildTerrainTile(p,{x:0,z:0});
 try{for(let column=0;column<=p.cells;column++)for(const name of ['position','normal']){const left=a.geometry.getAttribute(name),right=b.geometry.getAttribute(name);for(let component=0;component<3;component++)assert.equal(left.getComponent(p.cells*(p.cells+1)+column,component),right.getComponent(column,component));}}
 finally{a.geometry.dispose();a.material.dispose();b.geometry.dispose();b.material.dispose();}
 const extreme=buildTerrainTile(terrainParameters({cells:128,cellSize:4,amplitude:12,wavelength:4,seed:2**32-1}),{x:-1024,z:1024});try{assert.deepEqual(inspectGeometry(extreme).errors,[]);assert.equal(extreme.geometry.getAttribute('position').count,129*129);}finally{extreme.geometry.dispose();extreme.material.dispose();}
});
test('sampled footprint maximum prevents sampled penetration and exported scene bytes repeat',async()=>{
 const {buildAsset,disposeAsset}=await import('../src/catalog/index.ts'),source=manifest(),build=buildEnvironment(source),reference=buildAsset('bench');
 try{const p=source.placements[0]!,wrapper=build.root.getObjectByName('placement-'+p.id)!,surface=createSurface(source.terrain),step=source.terrain.cellSize/2,nx=Math.ceil(reference.dimensions.x/step),nz=Math.ceil(reference.dimensions.z/step),angle=p.yaw*Math.PI/180;
  for(let z=0;z<=nz;z++)for(let x=0;x<=nx;x++){const u=(x/nx-.5)*reference.dimensions.x,v=(z/nz-.5)*reference.dimensions.z,h=surface.sample(p.x+u*Math.cos(angle)+v*Math.sin(angle),p.z-u*Math.sin(angle)+v*Math.cos(angle)).height;assert.ok(wrapper.position.y>=h-1e-10);}
  const center=reference.bounds.getCenter(new Vector3()),anchor=new Vector3(center.x,reference.bounds.min.y,center.z).applyMatrix4(wrapper.children[0]!.matrixWorld);assert.ok(anchor.distanceTo(wrapper.position)<1e-9);
  const second=buildEnvironment(source);try{assert.deepEqual(await exportEnvironment(build),await exportEnvironment(second));}finally{second.dispose();}
 }finally{build.dispose();disposeAsset(reference);}
 const {terrain,...missingTerrain}=source;assert.throws(()=>loadEnvironment(missingTerrain));
});
