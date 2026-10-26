import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Raycaster, Vector3 } from 'three';
import { arrangement, buildWorkshop } from '../src/catalog/workshop.ts';

test('courtyard leaves an approach, supports props and keeps default-camera sightlines clear', () => {
  const build=buildWorkshop();
  try {
    const children=build.root.children, bounds=children.map(o=>new Box3().setFromObject(o,true));
    assert.deepEqual(arrangement.map(e=>e.family),['cottage','tree','fence','fence','crate','work-lantern','boulder']);
    const cottage=children[0]!,crate=bounds[4]!,lantern=bounds[5]!;
    assert.ok(bounds[2]!.min.z-bounds[0]!.max.z>=0.10,'left fence requires 0.10 m cottage clearance');
    const entrance=new Vector3(...(cottage.userData.anchors.entrance as [number,number,number])).applyMatrix4(cottage.matrixWorld);
    const route=new Box3(new Vector3(entrance.x-0.8,0.001,entrance.z),new Vector3(entrance.x+0.8,2.2,4.5));
    for(let i=1;i<bounds.length;i++)assert.ok(!route.intersectsBox(bounds[i]!),'approach blocked by '+i);
    assert.ok(Math.abs(lantern.min.y-crate.max.y)<1e-6);
    assert.ok(lantern.min.x>=crate.min.x && lantern.max.x<=crate.max.x && lantern.min.z>=crate.min.z && lantern.max.z<=crate.max.z);
    for(let i=0;i<bounds.length;i++)for(let j=i+1;j<bounds.length;j++){
      const overlap=bounds[i]!.clone().intersect(bounds[j]!);
      if(!overlap.isEmpty())assert.ok(overlap.getSize(new Vector3()).toArray().some(n=>n<1e-6),'physical overlap '+i+'/'+j);
    }
    const direction=new Vector3(2.7,1.85,3.5).normalize();
    for(const index of [4,5]) {
      const target=bounds[index]!.getCenter(new Vector3());
      const hits=new Raycaster(target.clone().addScaledVector(direction,50),direction.clone().negate()).intersectObjects(children.filter((_,i)=>i!==index),true);
      assert.ok(!hits.some(hit=>hit.distance<49.99),'prop hidden '+index);
    }
    for(const height of [0.45,1.0,1.7]) {
      const target=new Vector3(0,height,0).applyMatrix4(children[1]!.matrixWorld);
      const hits=new Raycaster(target.clone().addScaledVector(direction,50),direction.clone().negate()).intersectObjects(children.filter((_,i)=>i!==1),true);
      assert.ok(!hits.some(hit=>hit.distance<49.99),'trunk hidden '+height);
    }
    const endpoints=children.slice(2,4).flatMap(o=>['start','end'].map(key=>new Vector3(...(o.userData.anchors[key] as [number,number,number])).applyMatrix4(o.matrixWorld)));
    for(let i=0;i<endpoints.length;i++)for(let j=i+1;j<endpoints.length;j++)assert.ok(endpoints[i]!.distanceTo(endpoints[j]!)>0.2);
  } finally {build.dispose();}
});
