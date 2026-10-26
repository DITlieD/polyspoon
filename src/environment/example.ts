import { descriptor } from '../catalog/index.ts';
import { terrainParameters } from './terrain.ts';

export function exampleEnvironment() {
  return {formatVersion:1,terrain:terrainParameters({seed:42,cells:16,cellSize:.5,amplitude:.5,wavelength:16}),tiles:[{x:0,z:0},{x:1,z:0},{x:0,z:1},{x:1,z:1}],placements:[
    {id:'bench-one',design:descriptor('bench').save({}),x:3,z:4,yaw:20,maxSlopeDegrees:20,maxSupportVariation:.25},
    {id:'tree-one',design:descriptor('tree').save({}),x:10,z:8,yaw:15,maxSlopeDegrees:20,maxSupportVariation:.25},
    {id:'boulder-one',design:descriptor('boulder').save({}),x:5,z:11,yaw:55,maxSlopeDegrees:20,maxSupportVariation:.25},
  ]};
}
