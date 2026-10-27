import test from 'node:test';
import assert from 'node:assert/strict';
import {logDerivedFailure} from '../server/catalog.ts';

test('derived format failures are logged once without emails or secrets',()=>{
  const lines:string[]=[];const original=console.error;console.error=(line:unknown)=>{lines.push(String(line));};
  try{logDerivedFailure('v1',new TypeError('fetch https://x/obj?token=abc123&key=zzz failed for a@b.co'));}finally{console.error=original;}
  assert.equal(lines.length,1);const entry=JSON.parse(lines[0]!);
  assert.equal(entry.event,'derived_formats_failed');assert.equal(entry.versionId,'v1');assert.equal(entry.error,'TypeError');
  assert.doesNotMatch(lines[0]!,/abc123|zzz|a@b\.co/);
});
