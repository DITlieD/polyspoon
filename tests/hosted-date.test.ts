import test from 'node:test';
import assert from 'node:assert/strict';
import {when} from '../hosted/shared/dom.ts';

test('hosted dates format auth ISO strings and millisecond values while keeping missing or invalid dates explicit',()=>{
 const iso='2026-10-23T20:00:00.000Z',milliseconds=Date.parse(iso),expected=new Date(milliseconds).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});
 for(const value of [iso,milliseconds,String(milliseconds)])assert.equal(when(value),expected);
 assert.equal(when(0),new Date(0).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}));
 for(const value of [null,undefined,'','   ','invalid-date',NaN,Infinity,'Infinity'])assert.equal(when(value),'Not yet');
});
