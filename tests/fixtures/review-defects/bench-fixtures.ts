import {Box3,Mesh,Raycaster,Vector3} from 'three';
import {buildAsset} from '../../../src/catalog/index.ts';
import type {SemanticAssetBuild} from '../../../src/catalog/types.ts';

export const fixtureCases = [
 {id:'baseline',requested:{width:1.6},injection:'none'},
 {id:'broken-support',requested:{width:1.6},injection:'shorten leg-1-1 to 55% with its foot grounded'},
 {id:'repaired',requested:{width:1.6},injection:'none; independent fresh production build after broken-support'},
 {id:'changed-width',requested:{width:2.2},injection:'none'},
 {id:'ignored-width',requested:{width:2.2},injection:'ignore requested width and build 1.6 m'},
] as const;
export type FixtureId=typeof fixtureCases[number]['id'];
export interface FixtureFinding {
 caseId:string;
 code:string;
 status:'passed'|'failed';
 part?:string;
 control?:string;
 measured:Record<string,number|string>;
 expectedRelation:string;
 proposedCorrection:string;
}
export function buildFixture(id:FixtureId):SemanticAssetBuild {
 const definition=fixtureCases.find(c=>c.id===id);
 if(!definition)throw new Error('Unknown fixture '+id);
 const build=buildAsset('bench',{width:id==='ignored-width'?1.6:definition.requested.width});
 if(id==='broken-support'){
  const leg=build.root.getObjectByName('leg-1-1');
  if(!(leg instanceof Mesh))throw new Error('Fixture leg-1-1 is missing');
  leg.scale.y=.55;
  leg.position.y*=.55;
  build.root.updateMatrixWorld(true);
  build.bounds=new Box3().setFromObject(build.root,true);
  build.dimensions=build.bounds.getSize(new Vector3());
 }
 return build;
}
export function supportFinding(build:SemanticAssetBuild,caseId:string):FixtureFinding {
 build.root.updateMatrixWorld(true);
 const leg=build.root.getObjectByName('leg-1-1'),support=build.root.getObjectByName('seat-support-1');
 if(!leg||!support)throw new Error('Support fixture is missing named parts');
 const center=new Box3().setFromObject(leg,true).getCenter(new Vector3());
 const legTop=new Raycaster(new Vector3(center.x,10,center.z),new Vector3(0,-1,0)).intersectObject(leg)[0]?.point.y;
 const supportBottom=new Raycaster(new Vector3(center.x,-10,center.z),new Vector3(0,1,0)).intersectObject(support)[0]?.point.y;
 if(legTop===undefined||supportBottom===undefined)throw new Error('Support surface ray missed leg-1-1 or seat-support-1');
 const gap=supportBottom-legTop;
 return {caseId,code:'support-contact',status:gap<=.002?'passed':'failed',part:'leg-1-1 / seat-support-1',measured:{legTopMeters:legTop,supportBottomMeters:supportBottom,gapMeters:gap,toleranceMeters:.002},expectedRelation:'Leg upper surface meets or overlaps seat-support-1 underside; gap <= 0.002 m.',proposedCorrection:gap>.002?'Restore the full supporting leg height so its shoulder seats into seat-support-1.':'No correction required for this sampled contact.'};
}
export function widthFinding(build:SemanticAssetBuild,caseId:string,requestedWidth:number):FixtureFinding {
 const bounds=new Box3();
 build.root.updateMatrixWorld(true);
 build.root.traverse(o=>{if(o instanceof Mesh&&o.name.startsWith('seat-slat-'))bounds.expandByObject(o,true);});
 if(bounds.isEmpty())throw new Error('Width fixture has no seat-slat geometry');
 const measuredWidth=bounds.getSize(new Vector3()).x,deviation=Math.abs(measuredWidth-requestedWidth);
 return {caseId,code:'effective-width-control',status:deviation<=1e-5?'passed':'failed',control:'width',part:'seat-slat-*',measured:{requestedMeters:requestedWidth,actualMeters:measuredWidth,deviationMeters:deviation,toleranceMeters:1e-5},expectedRelation:'Measured outside seat width equals the requested width within 0.00001 m.',proposedCorrection:deviation>1e-5?'Forward the requested width through buildAsset instead of replacing it with the default.':'No correction required for this width request.'};
}
export function fixtureFindings(build:SemanticAssetBuild,id:FixtureId):FixtureFinding[] {
 const definition=fixtureCases.find(c=>c.id===id)!;
 return [supportFinding(build,id),widthFinding(build,id,definition.requested.width)];
}
