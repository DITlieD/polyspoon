import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Box3, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from 'three';
import { families, buildFamily, saveFamilyConfiguration, loadFamilyConfiguration, disposeFamily, fixtures } from '../src/families/index.ts';
import { descriptor } from '../src/catalog/index.ts';
import { geometrySnapshot, inspectGeometry } from '../src/lantern/inspect.ts';

for (const family of Object.keys(families) as Array<keyof typeof families>) {
  const definition = families[family];
  test(family + ': strict inputs and versioned configuration', () => {
    const saved = saveFamilyConfiguration(family, {});
    assert.deepEqual(saved.applied, descriptor(family).defaults);
    assert.deepEqual(loadFamilyConfiguration(JSON.parse(JSON.stringify(saved))), saved);
    for (const bad of [null, [], 2, 'x', new Date(), { unknown: 1 }, { colorway: 'pink' }, { colorway: null }]) assert.throws(() => buildFamily(family, bad));
    for (const control of definition.controls) {
      for (const bad of [undefined, NaN, Infinity, -Infinity, '1', true, control.min - 0.01, control.max + 0.01]) assert.throws(() => buildFamily(family, { [control.key]: bad }));
      if (control.integer) assert.throws(() => buildFamily(family, { [control.key]: control.min + 0.5 }));
    }
    assert.throws(() => loadFamilyConfiguration({ ...saved, familyVersion: '9' }));
    assert.throws(() => loadFamilyConfiguration({ ...saved, unexpected: true }));
    assert.throws(() => loadFamilyConfiguration({ ...saved, applied: { ...saved.applied, colorway: 'ember' } }));
    assert.throws(() => loadFamilyConfiguration({ ...saved, applied: {} }));
  });
  test(family + ': deterministic builds and geometry-independent palette', () => {
    const base = buildFamily(family, {});
    for (const colorway of ['forest', 'harbor', 'ember']) {
      const next = buildFamily(family, { colorway });
      assert.deepEqual(geometrySnapshot(next.root), geometrySnapshot(base.root));
      if (colorway !== 'forest') assert.notDeepEqual(Object.values(next.materials).map(m => m.color.getHex()), Object.values(base.materials).map(m => m.color.getHex()));
      disposeFamily(next);
    }
    disposeFamily(base);
  });
  for (const fixture of fixtures(family)) {
    test(family + ': valid geometry ' + fixture.id, () => {
      const build = buildFamily(family, fixture.parameters);
      const report = inspectGeometry(build.root);
      assert.deepEqual(report.errors, []);
      assert.ok(Math.abs(build.bounds.min.y) < 1e-6);
      assert.ok(build.dimensions.x > 0 && build.dimensions.y > 0 && build.dimensions.z > 0);
      build.root.traverse(object => {
        if (object instanceof Mesh) {
          assert.ok(!Array.isArray(object.material));
          const role=object.userData.materialRole,actual=object.material;
          assert.ok(actual instanceof MeshStandardMaterial);
          assert.ok(build.materials[role],'semantic color role must remain registered');
          assert.equal(actual,build.materials[actual.name],'actual material identity must match its registered key');
          if(family==='crate'&&/^wood-tone-[0-2]$/.test(actual.name)){
            assert.equal(role,'wood','all board tones remain selectable/recolorable as wood');
            const index=Number(actual.name.at(-1));
            assert.deepEqual(actual.color.toArray(),build.materials.wood!.color.clone().multiplyScalar(1+(index-1)*Number(build.config.applied.toneVariation)).toArray());
          }else assert.equal(actual,build.materials[role]);
        }
      });
      assert.deepEqual(build.anchors.ground, [0, 0, 0]);
      disposeFamily(build);
    });
  }
}
const part = (build: ReturnType<typeof buildFamily>, name: string) => {
  const object = build.root.getObjectByName(name);
  assert.ok(object, name);
  return new Box3().setFromObject(object);
};
test('relationship violations reject otherwise in-range dimensions', () => {
  for (const [family, input] of [
    ['cottage', { width: 3.6, roofRise: 2 }],
    ['tree', { height: 3, spread: 5.4 }],
    ['tree', { height: 6, spread: 2.4 }],
    ['fence', { length: 6, bays: 1 }],
    ['fence', { length: 1.2, bays: 4 }],
    ['crate', { width: 0.45, height: 1.2 }],
    ['boulder', { width: 0.6, height: 1.8 }],
  ] as const) assert.throws(() => buildFamily(family, input), /relationship/);
});
test('cottage width redistributes bays and roof but preserves real recessed human-scale door', () => {
  const small = buildFamily('cottage', { width: 3.6, roofRise: 1.2 });
  const large = buildFamily('cottage', { width: 7.2 });
  for (const build of [small, large]) {
    const door = part(build, 'entrance-door');
    const size = door.getSize(new Vector3());
    assert.ok(Math.abs(size.x - 1.05) < 1e-6);
    assert.ok(Math.abs(size.y - 2.05) < 1e-6);
    const ray = new Raycaster(new Vector3(0, 1.4, 10), new Vector3(0, 0, -1));
    const hit = ray.intersectObject(build.root, true)[0]!;
    assert.ok(hit.object.name === 'entrance-door' || hit.object.name.startsWith('door-board-'));
    assert.ok(hit.point.z < Number(build.config.applied.depth) / 2 - 0.12);
  }
  assert.ok(large.dimensions.x > small.dimensions.x);
  assert.ok(large.root.children.filter(x => x.name.startsWith('front-window-')).length > small.root.children.filter(x => x.name.startsWith('front-window-')).length);
  disposeFamily(small); disposeFamily(large);
});
test('tree seed is deterministic and changes bounded crown structure', () => {
  const a = buildFamily('tree', { seed: 29 });
  const b = buildFamily('tree', { seed: 29 });
  const c = buildFamily('tree', { seed: 30 });
  assert.deepEqual(geometrySnapshot(a.root), geometrySnapshot(b.root));
  assert.notDeepEqual(geometrySnapshot(a.root), geometrySnapshot(c.root));
  for (const build of [a, b, c]) {
    assert.ok(build.dimensions.x <= Number(build.config.applied.spread) * 1.05);
    assert.ok(build.dimensions.y <= Number(build.config.applied.height) * 1.001);
    for (const name of ['main',...Array.from({length:Number(build.config.applied.branchCount)-1},(_,i)=>String(i+1))]) assert.ok(part(build, 'branch-' + name).intersectsBox(part(build, 'crown-' + name)));
    disposeFamily(build);
  }
});
test('fence joints overlap the post volumes and modular endpoints use configured length', () => {
  for (const fixture of fixtures('fence')) {
    const build = buildFamily('fence', fixture.parameters);
    const n = Number(build.config.applied.bays);
    for (let i = 0; i < n; i++) for (let level=0;level<Number(build.config.applied.railCount);level++) {
      const rail = part(build, 'rail-' + i + '-' + level);
      assert.ok(rail.intersectsBox(part(build, 'post-' + i)));
      assert.ok(rail.intersectsBox(part(build, 'post-' + (i + 1))));
    }
    assert.equal(build.anchors.end![0]! - build.anchors.start![0]!, build.config.applied.length);
    disposeFamily(build);
  }
});
test('crate lid closes its grouped planks and boulder has a stable flat base', () => {
  for (const fixture of fixtures('crate')) {
    const build = buildFamily('crate', {...fixture.parameters,lid:'closed'});
    assert.ok(part(build, 'lid-plank-0').max.y <= Number(build.config.applied.height) + 1e-6);
    const lidBoards=build.root.children.filter(p=>p.name.startsWith('lid-plank-'));
    assert.ok(lidBoards.length>=2,'closed lid has a real board assembly');
    const spans=lidBoards.map(board=>{
      const box=new Box3().setFromObject(board,true),center=box.getCenter(new Vector3());
      const hit=new Raycaster(new Vector3(center.x,3,center.z),new Vector3(0,-1,0)).intersectObject(board)[0];
      assert.ok(hit,'each lid board has a real upward-facing surface');
      return box;
    }).sort((a,b)=>a.min.x-b.min.x);
    for (const x of [-0.3, 0, 0.3]) {
      const worldX=x*Number(build.config.applied.width);
      const ray = new Raycaster(new Vector3(worldX, 3, 0), new Vector3(0, -1, 0));
      const hits=ray.intersectObject(build.root,true);
      if(!hits.length){
        const gap=spans.slice(1).map((right,i)=>({left:spans[i]!,right})).find(({left,right})=>worldX>=left.max.x&&worldX<=right.min.x);
        assert.ok(gap,'miss outside an authored lid gap');
        assert.ok(gap.right.min.x-gap.left.max.x<=Number(build.config.applied.slatGap)+1e-6,'lid gap exceeds its requested width');
      }else assert.ok(hits[0]!.point.y>=0,'closed lid ray hits above the ground');
    }
    disposeFamily(build);
  }
  for (const fixture of fixtures('boulder')) {
    const build = buildFamily('boulder', fixture.parameters);
    const mesh = build.root.getObjectByName('stone-mass') as Mesh;
    const p = mesh.geometry.getAttribute('position');
    const base = Array.from({ length: p.count }, (_, i) => [p.getX(i), p.getY(i), p.getZ(i)]).filter(v => Math.abs(v[1]!) < 1e-7);
    assert.ok(base.length >= 6);
    assert.ok(Math.max(...base.map(v => v[0]!)) > 0 && Math.min(...base.map(v => v[0]!)) < 0);
    assert.ok(Math.abs(build.dimensions.y - Number(build.config.applied.height)) < 1e-6);
    disposeFamily(build);
  }
});

for (const family of Object.keys(families) as Array<keyof typeof families>) {
  test(family + ': every control changes observable geometry across its valid limits', () => {
    for (const control of families[family].controls) {
      const limits = fixtures(family).filter(f => f.id === control.key + '-min' || f.id === control.key + '-max');
      const low = buildFamily(family, limits[0]!.parameters), high = buildFamily(family, limits[1]!.parameters);
      assert.notDeepEqual(geometrySnapshot(low.root), geometrySnapshot(high.root), control.key);
      if (['width', 'length', 'spread'].includes(control.key)) assert.ok(high.dimensions.x > low.dimensions.x, control.key);
      if (['height', 'wallHeight', 'roofRise'].includes(control.key)) assert.ok(high.dimensions.y > low.dimensions.y, control.key);
      if (control.key === 'depth') assert.ok(high.dimensions.z > low.dimensions.z, control.key);
      disposeFamily(low); disposeFamily(high);
    }
  });
}

test('fence reported bounds measure transformed vertices instead of rotated local bounding boxes', () => {
  const build = buildFamily('fence', {});
  const cap=part(build,'post-cap-0');
  const postWidth=cap.max.x-cap.min.x;
  assert.ok(Math.abs(build.dimensions.z - postWidth) < 1e-6);
  assert.ok(Math.abs(build.dimensions.x - Number(build.config.applied.length) - postWidth) < 1e-6);
  disposeFamily(build);
});

test('cottage 0.2.0 working bay keeps supported roof, recessed work area and grounded posts', () => {
  for(const fixture of fixtures('cottage'))for(const workBay of ['left','right']) {
    const build=buildFamily('cottage',{...fixture.parameters,workBay});
    try {
      const counter=part(build,'work-bay-surface'),plinth=part(build,'work-bay');
      assert.ok(Math.abs(counter.min.y-plinth.max.y)<1e-6);
      const anchor=build.anchors.workSurface!,roof=build.root.getObjectByName('work-bay-roof')!;
      const side=workBay==='left'?-1:1,d=Number(build.config.applied.depth);
      const openingY=counter.max.y+0.25;
      const hit=new Raycaster(new Vector3(anchor[0]+side*3,openingY,anchor[2]),new Vector3(-side,0,0)).intersectObject(build.root,true)[0]!;
      assert.equal(hit.object.name,'work-bay-back');
      assert.ok(Math.abs(hit.point.x)<Math.abs(anchor[0]));
      for(const dx of [-1,1])for(const dz of [-1,1]) {
        const post=part(build,'work-bay-post-'+dx+'-'+dz),center=post.getCenter(new Vector3());
        assert.ok(Math.abs(post.min.y)<1e-6);
        const roofHit=new Raycaster(new Vector3(center.x,0.1,center.z),new Vector3(0,1,0)).intersectObject(roof)[0]!;
        assert.ok(roofHit,'missing roof above post');
        assert.ok(post.max.y>=roofHit.point.y-1e-6);
        assert.ok(post.max.y-roofHit.point.y<0.10);
      }
      const front=new Raycaster(new Vector3(anchor[0],openingY,d),new Vector3(0,0,-1)).intersectObject(build.root,true)[0];
      assert.ok(!front||front.point.z<anchor[2]-d*0.52/2+0.2);
    }finally{disposeFamily(build);}
  }
});

test('tree crown hulls have asymmetric seeded geometry, outward faces and supported interiors', () => {
  const shapes=new Set<string>();
  for(const seed of [0,7,18,29,30,91,65535]) {
    for(const input of [{height:3,spread:3.75},{height:6,spread:3.3},{height:6,spread:5.4}]) {
      const build=buildFamily('tree',{...input,seed});
      try {
        assert.ok(Math.abs(build.bounds.min.y)<1e-6);
        assert.ok(build.dimensions.x<=input.spread*1.05);
        assert.ok(build.dimensions.z<=input.spread*1.05);
        assert.ok(build.dimensions.y<=input.height*1.001);
        for(const name of ['main',...Array.from({length:Number(build.config.applied.branchCount)-1},(_,i)=>String(i+1))]) {
          const crown=build.root.getObjectByName('crown-'+name) as Mesh;
          assert.ok(crown,name);
          assert.notEqual(crown.geometry.type,'DodecahedronGeometry');
          const position=crown.geometry.getAttribute('position'),normal=crown.geometry.getAttribute('normal');
          const index=crown.geometry.index,count=index?.count??position.count;
          let interior=new Vector3();
          for(let i=0;i<position.count;i++)interior.add(new Vector3().fromBufferAttribute(position,i));
          interior.divideScalar(position.count);
          for(let i=0;i<count;i+=3) {
            const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j);
            const [a,b,c]=ids.map(id=>new Vector3().fromBufferAttribute(position,id)) as [Vector3,Vector3,Vector3];
            const face=b.clone().sub(a).cross(c.clone().sub(a)).normalize();
            assert.ok(face.dot(a.clone().sub(interior))>1e-7,name+': inward face');
            assert.ok(face.dot(a)>-1e-6,name+': branch tip outside convex hull');
            for(const id of ids) {
              const n=new Vector3().fromBufferAttribute(normal,id);
              assert.ok(Math.abs(n.length()-1)<1e-5);
              assert.ok(n.dot(face)>0.99,name+': wrong face normal');
            }
          }
          const branch=build.root.getObjectByName('branch-'+name) as Mesh;
          assert.ok(branch);
          const recordedTip=branch.userData.tip;
          assert.ok(Array.isArray(recordedTip)&&recordedTip.length===3,'swept branch endpoint contract');
          const tip=new Vector3(...recordedTip as [number,number,number]).applyMatrix4(branch.matrixWorld);
          const branchPositions=branch.geometry.getAttribute('position');
          assert.ok(Array.from({length:branchPositions.count},(_,i)=>new Vector3().fromBufferAttribute(branchPositions,i).applyMatrix4(branch.matrixWorld)).some(p=>p.distanceTo(tip)<1e-6),'endpoint must exist in branch geometry');
          assert.ok(tip.distanceTo(crown.position)<1e-6,name+': branch endpoint');
          const box=new Box3().setFromObject(crown,true);
          assert.ok(box.containsPoint(tip));
          if(name==='main'&&input.height===3)shapes.add(JSON.stringify(Array.from(position.array).map(n=>Math.round(n*1000))));
        }
      } finally {disposeFamily(build);}
    }
  }
  assert.equal(shapes.size,7);
  assert.throws(()=>buildFamily('tree',{seed:-1}),/seed/);
  assert.throws(()=>buildFamily('tree',{seed:0.5}),/seed/);
});

test('tree front shoulder overlaps the main volume and crown profiles avoid a level equator', () => {
  for(const seed of [0,7,18,29,30,91,65535]) for(const input of [{height:3,spread:3.75},{height:6,spread:3.3},{height:6,spread:5.4}]) {
    const build=buildFamily('tree',{...input,seed});
    try {
      const main=build.root.getObjectByName('crown-main') as Mesh;
      const shoulders=build.root.children.filter((p):p is Mesh=>p instanceof Mesh&&/^crown-[0-9]+$/.test(p.name));
      assert.equal(shoulders.length,Number(build.config.applied.branchCount)-1);
      const shoulder=[...shoulders].sort((a,b)=>b.position.z-a.position.z)[0]!;
      assert.ok(shoulder.position.z>0,'front-facing supporting lobe');
      const clearance=(mesh:Mesh,point:Vector3) => {
        const local=point.clone().sub(mesh.position),p=mesh.geometry.getAttribute('position');
        let value=Infinity;
        for(let i=0;i<p.count;i+=3) {
          const a=new Vector3().fromBufferAttribute(p,i),b=new Vector3().fromBufferAttribute(p,i+1),c=new Vector3().fromBufferAttribute(p,i+2);
          const n=b.sub(a).cross(c.sub(a)).normalize();
          value=Math.min(value,-n.dot(local.clone().sub(a)));
        }
        return value;
      };
      let overlap=-Infinity;
      for(let i=0;i<=20;i++) {
        const witness=main.position.clone().lerp(shoulder.position,i/20);
        overlap=Math.max(overlap,Math.min(clearance(main,witness),clearance(shoulder,witness)));
      }
      assert.ok(overlap>0.02,'seed '+seed+': shoulder is detached or merely tangent: '+overlap);
      main.geometry.computeBoundingBox();
      const extent=main.geometry.boundingBox!.getSize(new Vector3()),p=main.geometry.getAttribute('position');
      const outerHeights:number[]=[];
      for(let i=0;i<p.count;i++) {
        const radial=Math.hypot(p.getX(i)/(extent.x/2),p.getZ(i)/(extent.z/2));
        if(radial>0.9)outerHeights.push(p.getY(i));
      }
      assert.ok((Math.max(...outerHeights)-Math.min(...outerHeights))/extent.y>0.22,'seed '+seed+': level outer profile');
    } finally {disposeFamily(build);}
  }
});
