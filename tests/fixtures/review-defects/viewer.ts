import {Stage} from '../../../src/studio/stage.ts';
import type {View} from '../../../src/studio/stage.ts';
import {disposeAsset} from '../../../src/catalog/index.ts';
import type {SemanticAssetBuild} from '../../../src/catalog/types.ts';
import {geometrySnapshot,inspectGeometry} from '../../../src/lantern/inspect.ts';
import {buildFixture,fixtureFindings} from './bench-fixtures.ts';
import type {FixtureId} from './bench-fixtures.ts';

const host=document.getElementById('preview');
if(!host)throw new Error('Missing fixture preview');
const stage=new Stage(host),frame=buildFixture('changed-width'),bounds=frame.bounds.clone(),dimensions=frame.dimensions.clone();
disposeAsset(frame);
stage.setDiagnostic(true);stage.setMode('shaded');
let current:SemanticAssetBuild|undefined;
const api={
 async show(id:FixtureId,view:View){
  const previous=current;
  current=buildFixture(id);
  stage.replace({...current,bounds,dimensions});
  if(previous)disposeAsset(previous);
  stage.setView(view,view==='right'?1.3:2.8);
  for(let i=0;i<6;i++)await new Promise(requestAnimationFrame);
  stage.render();
  return {id,view,camera:stage.cameraState(),configuration:current.config,geometry:geometrySnapshot(current.root),inspection:inspectGeometry(current.root),findings:fixtureFindings(current,id)};
 },
 dispose(){stage.dispose();if(current){disposeAsset(current);current=undefined;}},
};
Object.assign(window,{fixtureReview:api});
