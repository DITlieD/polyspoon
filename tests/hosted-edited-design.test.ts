import test from 'node:test';
import assert from 'node:assert/strict';
import {readCurrentEditedDesign} from '../hosted/app/edited-design.ts';

test('a file read completing after editor disposal does not apply the loaded design',async()=>{
 let active=true,finish:((value:string)=>void)|undefined,applied=0;
 const pending=readCurrentEditedDesign({text:()=>new Promise(resolve=>{finish=resolve;})},()=>active,()=>{applied++;});
 active=false;finish!('{"family":"bench"}');await pending;assert.equal(applied,0);
});

test('an older file read cannot replace changes made while its bytes were pending',async()=>{
 let revision=1,finish:((value:string)=>void)|undefined,applied=0;const ticket=revision;
 const pending=readCurrentEditedDesign({text:()=>new Promise(resolve=>{finish=resolve;})},()=>ticket===revision,()=>{applied++;});revision++;finish!('{"family":"bench"}');await pending;assert.equal(applied,0);
 await readCurrentEditedDesign({text:async()=>'{"family":"bench"}'},()=>true,value=>{assert.deepEqual(value,{family:'bench'});applied++;});assert.equal(applied,1);
});
