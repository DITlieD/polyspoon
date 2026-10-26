import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Mesh, Triangle, Vector3 } from 'three';
import { buildAsset, disposeAsset } from '../src/catalog/index.ts';
import { geometrySnapshot, inspectGeometry } from '../src/lantern/inspect.ts';

function points(mesh:Mesh) {
  const p=mesh.geometry.getAttribute('position');
  return Array.from({length:p.count},(_,i)=>new Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld));
}
function surfaceArea(mesh:Mesh) {
  const p=points(mesh);let area=0;
  for(let i=0;i<p.length;i+=3)area+=new Triangle(p[i]!,p[i+1]!,p[i+2]!).getArea();
  return area;
}
function inside(mesh:Mesh,point:Vector3) {
  const p=points(mesh);let winding=0;
  for(let i=0;i<p.length;i+=3) {
    const a=p[i]!.clone().sub(point),b=p[i+1]!.clone().sub(point),c=p[i+2]!.clone().sub(point);
    const la=a.length(),lb=b.length(),lc=c.length();
    if(Math.min(la,lb,lc)<1e-7)return true;
    winding+=2*Math.atan2(a.dot(b.clone().cross(c)),la*lb*lc+a.dot(b)*lc+b.dot(c)*la+c.dot(a)*lb);
  }
  return Math.abs(winding)>Math.PI*2;
}

test('conifer uses supported sprays with descending lower growth and exact bounds across tier and aspect boundaries',()=>{
  for(const input of [{},{tierCount:5,seed:0},{tierCount:10,seed:65535},{height:2,crownSpread:7,tierCount:5},{height:12,crownSpread:1,tierCount:10}]) {
    const build=buildAsset('conifer',input);
    try {
      build.root.updateMatrixWorld(true);
      assert.ok(Math.abs(build.dimensions.y-Number(build.config.applied.height))<1e-5);
      assert.ok(Math.abs(Math.max(build.dimensions.x,build.dimensions.z)-Number(build.config.applied.crownSpread))<1e-5);
      assert.ok(Math.abs(build.bounds.min.y)<1e-6);
      const fans=build.root.children.filter((o):o is Mesh=>o instanceof Mesh&&/^foliage-\d+-\d+-\d+$/.test(o.name));
      for(const fan of fans) {
        const branch=build.root.getObjectByName(fan.userData.connectedTo) as Mesh;
        assert.ok(branch);
        assert.ok(points(branch).some(p=>inside(fan,p)),fan.name+' must contain real branch surface');
        const cloud=points(fan).map(p=>({r:Math.hypot(p.x,p.z),y:p.y})),r0=Math.min(...cloud.map(p=>p.r)),r1=Math.max(...cloud.map(p=>p.r));
        const inner=cloud.filter(p=>p.r<r0+(r1-r0)*.25),outer=cloud.filter(p=>p.r>r0+(r1-r0)*.75);
        const mean=(p:typeof cloud)=>p.reduce((sum,v)=>sum+v.y,0)/p.length;
        if(Number(fan.name.split('-')[1])<Number(build.config.applied.tierCount)*.6)assert.ok(mean(inner)>mean(outer),fan.name+' lower growth must sweep down toward its outer end');
      }
      const tiers=new Set(fans.map(p=>p.name.split('-')[1]));
      assert.equal(tiers.size,build.config.applied.tierCount);
      assert.deepEqual(inspectGeometry(build.root).errors,[]);
    }finally{disposeAsset(build);}
  }
});

test('boulder moss forms a shared exterior growth region and conserves solid surface area',()=>{
  for(const form of ['field','slab','standing'])for(const seed of [0,317]) {
    const bare=buildAsset('boulder',{form,seed,moss:'none'}),low=buildAsset('boulder',{form,seed,moss:'top',mossCoverage:.2}),high=buildAsset('boulder',{form,seed,moss:'top',mossCoverage:.8});
    try {
      const bareArea=surfaceArea(bare.root.getObjectByName('stone-mass') as Mesh);
      let previous=0;
      for(const build of [low,high]) {
        const stone=build.root.getObjectByName('stone-mass') as Mesh,moss=build.root.getObjectByName('moss-region') as Mesh;
        assert.ok(moss);
        const area=surfaceArea(moss);
        assert.ok(area>previous);previous=area;
        assert.ok(Math.abs(surfaceArea(stone)+area-bareArea)<bareArea*1e-5);
        const patches=moss.userData.patches as Array<{vertices:number[][]}>;
        const groups=patches.map(p=>p.vertices.map(v=>new Vector3(...v as [number,number,number])));
        assert.ok(groups.some((a,i)=>groups.some((b,j)=>i!==j&&a.filter(p=>b.some(q=>p.distanceTo(q)<1e-6)).length>=2)),'moss must cross a shared face edge');
        assert.ok(Math.abs(build.bounds.min.y)<1e-6);
        assert.deepEqual(build.anchors.top,bare.anchors.top);
        assert.deepEqual(inspectGeometry(build.root).errors,[]);
      }
    }finally{disposeAsset(bare);disposeAsset(low);disposeAsset(high);}
  }
});

test('organic catalog retains deterministic controls, semantic roles and invalid-input rejection',()=>{
  for(const family of ['conifer','boulder']) {
    const a=buildAsset(family),b=buildAsset(family);
    try {
      assert.deepEqual(geometrySnapshot(a.root),geometrySnapshot(b.root));
      assert.equal(a.root.userData.units,'meters');
      assert.deepEqual(a.anchors.ground,[0,0,0]);
      for(const material of Object.values(a.materials))assert.ok(material.name);
      assert.throws(()=>buildAsset(family,{seed:-1}));
      assert.throws(()=>buildAsset(family,{unknownControl:true}));
    }finally{disposeAsset(a);disposeAsset(b);}
  }
  assert.throws(()=>buildAsset('conifer',{tierCount:11}));
  assert.throws(()=>buildAsset('boulder',{width:.6,height:1.8}));
});

test('conifer tier and seed changes alter supported construction and a detached fan fails the contact witness',()=>{
  const a=buildAsset('conifer',{tierCount:5}),b=buildAsset('conifer',{tierCount:10}),c=buildAsset('conifer',{tierCount:5,seed:901});
  try {
    assert.notEqual(a.root.children.length,b.root.children.length);
    assert.notDeepEqual(geometrySnapshot(a.root),geometrySnapshot(c.root));
    const fan=a.root.getObjectByName('foliage-0-0-0') as Mesh,branch=a.root.getObjectByName(fan.userData.connectedTo) as Mesh;
    assert.ok(points(branch).some(p=>inside(fan,p)));
    fan.position.y+=Number(a.config.applied.height)*2;a.root.updateMatrixWorld(true);
    assert.equal(points(branch).some(p=>inside(fan,p)),false);
  }finally{disposeAsset(a);disposeAsset(b);disposeAsset(c);}
});

test('moss shoulder boundary varies beyond a single planar cap while retaining a shared surface',()=>{
  const build=buildAsset('boulder',{moss:'top',mossCoverage:.8,facetGrade:2});
  try {
    const cloud=points(build.root.getObjectByName('moss-region') as Mesh),edges=new Map<string,{a:Vector3;b:Vector3;count:number}>();
    for(let i=0;i<cloud.length;i+=3)for(let e=0;e<3;e++) {
      const a=cloud[i+e]!,b=cloud[i+(e+1)%3]!,key=[a,b].map(v=>v.toArray().map(n=>n.toFixed(6)).join(',')).sort().join('|');
      const old=edges.get(key);if(old)old.count++;else edges.set(key,{a,b,count:1});
    }
    const boundary=[...edges.values()].filter(e=>e.count===1).flatMap(e=>[e.a,e.b]);
    assert.ok(boundary.length>=4);
    const origin=boundary[0]!,second=[...boundary].sort((a,b)=>b.distanceToSquared(origin)-a.distanceToSquared(origin))[0]!;
    const normal=boundary.reduce((best,p)=>{const n=second.clone().sub(origin).cross(p.clone().sub(origin));return n.lengthSq()>best.lengthSq()?n:best;},new Vector3()).normalize();
    assert.ok(Math.max(...boundary.map(p=>Math.abs(p.clone().sub(origin).dot(normal))))>build.dimensions.y*.035,'moss edge must descend by different broad shoulder amounts');
  }finally{disposeAsset(build);}
});

test('conifer upper growth intervals connect into the narrow leader',()=>{
  for(const tierCount of [5,8,10]) {
    const build=buildAsset('conifer',{tierCount});
    try {
      const height=Number(build.config.applied.height),intervals=build.root.children.filter(o=>o.name.startsWith('foliage-')).map(o=>new Box3().setFromObject(o)).filter(b=>b.max.y>height*.7).sort((a,b)=>a.min.y-b.min.y);
      let reach=height*.7;
      for(const interval of intervals) {
        if(interval.max.y<reach)continue;
        assert.ok(interval.min.y-reach<height*.035,'upper trunk interval lacks supporting needle growth');
        reach=Math.max(reach,interval.max.y);
      }
      assert.ok(reach>height*.98);
    }finally{disposeAsset(build);}
  }
});

test('boulder stone and moss share exact float32 edge subdivisions at reported seam cases',()=>{
  const cases=[{}, {form:'slab',width:2.6,height:.65,depth:1.8,crest:-.24,shoulderHeight:.48,burialDepth:.08,moss:'top',mossCoverage:.75}, {form:'field',facetGrade:2,burialDepth:.4,mossCoverage:.8,seed:65535}];
  for(const input of cases) {
    const build=buildAsset('boulder',input);
    try {
      const edges=new Map<string,{count:number;orientation:number}>();
      build.root.traverse(o=>{
        if(!(o instanceof Mesh))return;
        const cloud=points(o);
        for(let i=0;i<cloud.length;i+=3)for(let side=0;side<3;side++) {
          const a=cloud[i+side]!.toArray().join(','),b=cloud[i+(side+1)%3]!.toArray().join(','),key=[a,b].sort().join('|');
          const edge=edges.get(key)??{count:0,orientation:0};edge.count++;edge.orientation+=a<b?1:-1;edges.set(key,edge);
        }
      });
      for(const [key,edge] of edges) {
        assert.equal(edge.count,2,'unpaired combined exterior edge '+key);
        assert.equal(edge.orientation,0,'opposing winding required on shared exterior edge '+key);
      }
    }finally{disposeAsset(build);}
  }
});
