import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {verifyTrustedRecipe} from '../hosted/trusted-build.ts';
import {matchTrustedRecipe,sameDesign} from '../hosted/app/runtime-identity.ts';

test('published runtime requires exact recipe, archive and canonical design identity',async()=>{
 const index=JSON.parse(await readFile('public/recipe-packages/index.json','utf8')),entry=index.packages.find((entry:{id:string})=>entry.id==='bench'),record=await verifyTrustedRecipe(entry,await readFile('public/'+entry.url),path=>readFile(path)),claim={recipe:{id:record.id,version:record.version,deliveryRevision:record.deliveryRevision},sourcePackage:{...record.archive,media_type:'application/zip'},design:{family:record.id,familyVersion:record.version}};
 assert.equal(matchTrustedRecipe([record],claim),record);
 for(const bad of [{...claim,recipe:{...claim.recipe,version:'9.9.9'}},{...claim,sourcePackage:{...claim.sourcePackage,sha256:'0'.repeat(64)}},{...claim,design:{family:'fence',familyVersion:record.version}},{...claim,sourcePackage:undefined},{...claim,recipe:undefined}])assert.equal(matchTrustedRecipe([record],bad),undefined);
 assert.equal(sameDesign({applied:{width:1},requested:{}},{requested:{},applied:{width:1}}),true);assert.equal(sameDesign({applied:{width:1}},{applied:{width:2}}),false);assert.equal(sameDesign({requested:{}},{requested:{},migration:{}}),false);
});
