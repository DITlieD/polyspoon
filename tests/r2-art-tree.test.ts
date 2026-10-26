import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Mesh, Vector3 } from 'three';
import { buildAsset, disposeAsset } from '../src/catalog/index.ts';
import { geometrySnapshot, inspectGeometry } from '../src/lantern/inspect.ts';

function clearance(mesh:Mesh,point:Vector3) {
  const local=mesh.worldToLocal(point.clone()),positions=mesh.geometry.getAttribute('position');
  let minimum=Infinity;
  for(let i=0;i<positions.count;i+=3) {
    const a=new Vector3().fromBufferAttribute(positions,i),b=new Vector3().fromBufferAttribute(positions,i+1),c=new Vector3().fromBufferAttribute(positions,i+2);
    const normal=b.sub(a).cross(c.sub(a)).normalize();
    minimum=Math.min(minimum,-normal.dot(local.clone().sub(a)));
  }
  return minimum;
}

test('tree root toes retain ground area instead of terminating at needle points',()=>{
  for(const growth of ['young','mature'])for(const trunkGirth of [.12,.35]) {
    const build=buildAsset('tree',{growth,trunkGirth});
    try {
      const trunk=build.root.getObjectByName('trunk') as Mesh;
      const roots=build.root.children.filter((object):object is Mesh=>object instanceof Mesh&&object.name.startsWith('root-'));
      assert.equal(roots.length,5);
      for(const root of roots) {
        const positions=root.geometry.getAttribute('position'),points=new Map<string,Vector3>();
        for(let i=0;i<positions.count;i++) {
          const p=new Vector3().fromBufferAttribute(positions,i);
          if(Math.abs(p.y)<1e-6)points.set(p.toArray().join(','),p);
        }
        const ground=[...points.values()],direction=new Box3().setFromObject(root).getCenter(new Vector3()).setY(0).normalize();
        const furthest=Math.max(...ground.map(p=>p.dot(direction)));
        const toe=ground.filter(p=>p.dot(direction)>furthest-trunkGirth*.25);
        assert.ok(toe.length>=2,root.name+' needs a blunt supported toe');
        assert.ok(toe.some(a=>toe.some(b=>a.distanceTo(b)>trunkGirth*.3)),root.name+' needs visible toe width');
        assert.ok(new Box3().setFromObject(root).intersectsBox(new Box3().setFromObject(trunk)));
      }
      assert.ok(Math.abs(build.bounds.min.y)<1e-6);
    }finally{disposeAsset(build);}
  }
});

test('tree unequal crowns form a connected growth envelope with an exposed fork across construction interactions',()=>{
  const cases=[{},
    {height:3,spread:3.75,canopyFullness:.65,forkHeight:.43,branchCount:8,lean:.1},
    {height:6,spread:3.3,canopyFullness:.65,forkHeight:.43,branchCount:2,lean:-.1,architecture:'upright',growth:'young'},
    {height:6,spread:5.4,canopyFullness:1.16,branchCount:8,growth:'mature'},
  ];
  for(const parameters of cases)for(const seed of [0,7,65535]) {
    const build=buildAsset('tree',{...parameters,seed});
    try {
      build.root.updateMatrixWorld(true);
      const main=build.root.getObjectByName('crown-main') as Mesh,mainBox=new Box3().setFromObject(main),mainSize=mainBox.getSize(new Vector3());
      const crowns=build.root.children.filter((object):object is Mesh=>object instanceof Mesh&&object.name.startsWith('crown-'));
      assert.equal(crowns.length,build.config.applied.branchCount);
      const volumes=crowns.map(c=>new Box3().setFromObject(c).getSize(new Vector3())).map(s=>s.x*s.y*s.z);
      assert.ok(volumes[0]!/volumes.reduce((sum,v)=>sum+v,0)<.65,'primary crown must leave room for supporting growth');
      const connected=new Set<Mesh>([main]);
      for(let pass=0;pass<crowns.length;pass++)for(const crown of crowns)if(!connected.has(crown)) {
        for(const parent of connected) {
          let penetration=-Infinity;
          for(let i=0;i<=32;i++){const witness=parent.position.clone().lerp(crown.position,i/32);penetration=Math.max(penetration,Math.min(clearance(parent,witness),clearance(crown,witness)));}
          if(penetration>Number(build.config.applied.spread)*.008){connected.add(crown);break;}
        }
      }
      assert.equal(connected.size,crowns.length,'each crown must share volume with the connected growth envelope');
      for(const crown of crowns) {
        const branch=build.root.getObjectByName(crown.name.replace('crown-','branch-')) as Mesh;
        assert.ok(new Vector3(...branch.userData.tip).distanceTo(crown.position)<1e-6);
        assert.ok(clearance(crown,crown.position)>0);
        if(crown===main)continue;
        const size=new Box3().setFromObject(crown).getSize(new Vector3());
        assert.ok(size.x*size.y*size.z<mainSize.x*mainSize.y*mainSize.z*.65,'primary mass must dominate');
      }
      const canopyFloor=Math.min(...crowns.map(c=>new Box3().setFromObject(c).min.y));
      assert.ok(canopyFloor>build.anchors.fork![1]!+Number(build.config.applied.height)*.08,'fork needs exposed support below the crown');
      assert.ok(Math.abs(build.bounds.max.y-Number(build.config.applied.height))<1e-5);
      assert.deepEqual(inspectGeometry(build.root).errors,[]);
      assert.equal(build.root.userData.units,'meters');
      assert.deepEqual(build.anchors.ground,[0,0,0]);
    }finally{disposeAsset(build);}
  }
});

test('tree retains deterministic construction, parameter effects and invalid-input rejection',()=>{
  const base=buildAsset('tree'),repeat=buildAsset('tree');
  try {
    assert.deepEqual(geometrySnapshot(base.root),geometrySnapshot(repeat.root));
    for(const change of [{seed:91},{growth:'young'},{architecture:'upright'},{lean:-.08},{canopyFullness:.65},{forkHeight:.43},{branchCount:8},{height:5},{spread:4.5}]) {
      const variant=buildAsset('tree',change);
      try{assert.notDeepEqual(geometrySnapshot(variant.root),geometrySnapshot(base.root));}
      finally{disposeAsset(variant);}
    }
    const autumn=buildAsset('tree',{season:'autumn'});
    try{assert.notEqual(autumn.materials.foliage!.color.getHex(),base.materials.foliage!.color.getHex());}
    finally{disposeAsset(autumn);}
    for(const invalid of [{seed:-1},{branchCount:9},{height:6,spread:2.4},{unknownGrowth:true}])assert.throws(()=>buildAsset('tree',invalid));
  }finally{disposeAsset(base);disposeAsset(repeat);}
});

test('additional tree branches contribute to a neutral projected contour instead of staying inside larger crowns',()=>{
  for(const canopyFullness of [.65,1])for(const architecture of ['spreading','upright']) {
    const build=buildAsset('tree',{branchCount:8,canopyFullness,architecture});
    try {
      const crowns=build.root.children.filter((object):object is Mesh=>object instanceof Mesh&&object.name.startsWith('crown-'));
      const points=crowns.map(c=>{const p=c.geometry.getAttribute('position');return Array.from({length:p.count},(_,i)=>new Vector3().fromBufferAttribute(p,i).add(c.position));});
      const directions=Array.from({length:48},(_,i)=>i*Math.PI*2/48).flatMap(angle=>[new Vector3(Math.cos(angle),Math.sin(angle),0),new Vector3(0,Math.sin(angle),Math.cos(angle)),new Vector3(Math.cos(angle)*.707,Math.sin(angle),Math.cos(angle)*.707)]);
      for(let i=3;i<crowns.length;i++) {
        const exposed=directions.some(direction=>Math.max(...points[i]!.map(p=>p.dot(direction)))>Math.max(...points.flatMap((cloud,j)=>j===i?[]:cloud.map(p=>p.dot(direction))))+Number(build.config.applied.spread)*.006);
        assert.ok(exposed,crowns[i]!.name+' must change a front, side or oblique silhouette');
      }
    }finally{disposeAsset(build);}
  }
});
