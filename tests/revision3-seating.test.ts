import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Mesh,Raycaster,Vector3} from 'three';
import {buildAsset,disposeAsset} from '../src/catalog/index.ts';
const hit=(o:Mesh,x:number,z:number,up:boolean)=>new Raycaster(new Vector3(x,up?0:10,z),new Vector3(0,up?1:-1,0)).intersectObject(o)[0]?.point.y;
test('support deck covers side-wall tops through narrow deep and wide sag limits',()=>{
 for(const width of [3.6,7.2])for(const depth of [3,5.5])for(const roofCharacter of [0,1]){
  const b=buildAsset('cottage',{width,depth,roofRise:1.4,roofCharacter,eaveOverhang:.55});
  try{
   const roof=b.root.children.filter(o=>o.name.startsWith('roof-')&&o instanceof Mesh);
   for(const z of [-depth/2,-depth/4,0,depth/4,depth/2])for(const x of [-width/2,width/2]){
    const high=new Raycaster(new Vector3(x,10,z),new Vector3(0,-1,0)).intersectObjects(roof)[0],low=new Raycaster(new Vector3(x,0,z),new Vector3(0,1,0)).intersectObjects(roof)[0];
    assert.ok(high&&low);assert.ok(high.point.y>2.8,'wall protrudes');assert.ok(low.point.y<=2.81,'gap above wall');
   }
  }finally{disposeAsset(b);}
 }
});
test('switch back seats on plate outward face with real exposed depth',()=>{
 for(const bodyWidth of [.22,.44]){
  const b=buildAsset('work-lantern',{construction:'utility',bodyWidth,bodyHeight:.18,handleClearance:.075});
  try{
   const plate=new Box3().setFromObject(b.root.getObjectByName('switch-plate')!,true),button=new Box3().setFromObject(b.root.getObjectByName('switch')!,true);
   assert.ok(button.min.z>=plate.max.z-1e-7,'button penetrates plate');assert.ok(Math.abs(button.min.z-plate.max.z)<1e-7,'button floats');assert.ok(button.max.z>plate.max.z+.002);
  }finally{disposeAsset(b);}
 }
});
test('current shingle courses overlap and thatch bands close to their support deck',()=>{
 for(const roofCover of ['thatch','shingle'])for(const roofThickness of [.14,.38])for(const roofCharacter of [0,1]){
  const b=buildAsset('cottage',{roofCover,roofThickness,roofCharacter});
  try{
   if(roofCover==='thatch'){
    const bands=b.root.children.filter(o=>/^roof-right-band-\d+$/.test(o.name)) as Mesh[];
    assert.equal(bands.length,3);
    const half=Number(b.config.applied.width)/2+Number(b.config.applied.eaveOverhang);
    for(let i=0;i<2;i++)for(const z of [-1.8,-.6,.6,1.8]){
      const bounds=new Box3().setFromObject(bands[i]!,true),next=new Box3().setFromObject(bands[i+1]!,true);
      assert.ok(bounds.intersectsBox(next),'adjacent band envelopes separate');
      const x=(i+1)*half/3;
      for(const dx of [-.10,0,.10]){
        const down=new Raycaster(new Vector3(x+dx,10,z),new Vector3(0,-1,0)).intersectObjects(bands);
        const up=new Raycaster(new Vector3(x+dx,0,z),new Vector3(0,1,0)).intersectObjects(bands);
        assert.ok(down.length&&up.length,'thatch boundary has daylight opening');
        assert.ok(down[0]!.point.y>up[0]!.point.y,'thatch boundary lost solid depth');
      }
    }
    continue;
   }
   let count=0;
   for(const upper of b.root.children.filter(o=>/^roof-right-course-\d+-\d+$/.test(o.name)) as Mesh[]){
    const match=/^roof-right-course-(\d+)-(\d+)$/.exec(upper.name)!,lower=b.root.getObjectByName('roof-right-course-'+(Number(match[1])+1)+'-'+match[2]) as Mesh|undefined;if(!lower)continue;
    const overlap=new Box3().setFromObject(upper,true).intersect(new Box3().setFromObject(lower,true));assert.ok(!overlap.isEmpty());
    const p=overlap.getCenter(new Vector3()),ub=hit(upper,p.x,p.z,true),ut=hit(upper,p.x,p.z,false),lb=hit(lower,p.x,p.z,true),lt=hit(lower,p.x,p.z,false);
    assert.ok(ub!==undefined&&ut!==undefined&&lb!==undefined&&lt!==undefined,'overlap rays miss');
    const penetration=lt-ub,limit=Math.min(ut-ub,lt-lb);
    assert.ok(penetration>=-1e-6,'floating course');assert.ok(penetration<=limit+1e-6,'layer swallowed');assert.ok(ut>=lt-1e-6&&ub>=lb-1e-6,'course order inverted');count++;
   }
   assert.ok(count>0);
  }finally{disposeAsset(b);}
 }
});
