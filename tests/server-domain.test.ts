import test from 'node:test';
import assert from 'node:assert/strict';
import {allowedTransition,requireActive,requireCapability,memberTokenScopes,strictObject,versionIdentity,digest} from '../server/domain.ts';
import {readFile} from 'node:fs/promises';
import {subjectInput} from '../server/repository.ts';
import {identity,withoutIdentity} from '../src/review/identity.ts';
import type {ReviewSubject} from '../src/review/types.ts';

test('private operations require active verified membership and present capability',()=>{
 const member={id:'member-a',status:'active',verified:true,capabilities:[]};assert.doesNotThrow(()=>requireActive(member));
 for(const candidate of [null,{...member,status:'suspended'},{...member,verified:false}])assert.throws(()=>requireActive(candidate));
 assert.throws(()=>requireCapability(member,'publisher'));assert.doesNotThrow(()=>requireCapability({...member,capabilities:['publisher']},'publisher'));
});
test('server transition rules do not turn votes or author claims into publication',()=>{
 assert.equal(allowedTransition('draft','submitted','contributor'),true);assert.equal(allowedTransition('submitted','processing','verifier'),true);assert.equal(allowedTransition('awaiting_review','approved','publisher'),true);
 for(const capability of ['member','contributor','voter'])assert.equal(allowedTransition('awaiting_review','published',capability),false);
 assert.equal(allowedTransition('changes_requested','withdrawn','contributor'),true);assert.equal(allowedTransition('changes_requested','withdrawn','publisher'),false);assert.equal(allowedTransition('rejected','withdrawn','contributor'),false);
 assert.equal(allowedTransition('approved','published','publisher'),true);assert.equal(allowedTransition('published','draft','admin'),false);
});
test('version identity binds exact values and input cannot install arbitrary authority',async()=>{
 const input={contributor:'author',asset:'asset',subject:{subjectId:'a'.repeat(64)},artifacts:{'selected.glb':{sha256:'b'.repeat(64),bytes:4}}};
 assert.equal(await versionIdentity(input),await versionIdentity({...input,artifacts:input.artifacts}));assert.notEqual(await versionIdentity(input),await versionIdentity({...input,contributor:'different'}));
 assert.throws(()=>strictObject({title:'asset',role:'admin'},['title']));assert.throws(()=>memberTokenScopes(['publisher']));assert.deepEqual(memberTokenScopes(['catalog:read','assets:read']),['assets:read','catalog:read']);
});

test('full-subject admission keeps exact file count, aggregate and per-file bounds',async()=>{
 const base=JSON.parse(await readFile('evidence/revision14/final/bench-review-01/subject.json','utf8')) as ReviewSubject;
 const seal=(subject:ReviewSubject)=>{subject.artifactManifestHash=identity(subject.artifacts);subject.subjectId=identity(withoutIdentity(subject as unknown as Record<string,unknown>,'subjectId'));return subject;};
 const artifacts:Record<string,{sha256:string;bytes:number}>={...base.artifacts},empty=await digest('');for(let index=Object.keys(artifacts).length;index<255;index++)artifacts['bounds/'+index+'.bin']={sha256:empty,bytes:0};
 assert.doesNotThrow(()=>subjectInput(seal({...structuredClone(base),artifacts})));assert.throws(()=>subjectInput(seal({...structuredClone(base),artifacts:{...artifacts,'bounds/extra.bin':{sha256:empty,bytes:0}}})),/invalid_or_unsupported/);
 const large=structuredClone(base);for(const path of Object.keys(large.artifacts).slice(0,9))large.artifacts[path]={...large.artifacts[path]!,bytes:2*1024*1024};assert.throws(()=>subjectInput(seal(large)),/invalid_or_unsupported/);
 const perFile=structuredClone(base),path=Object.keys(perFile.artifacts)[0]!;perFile.artifacts[path]={...perFile.artifacts[path]!,bytes:2*1024*1024};assert.doesNotThrow(()=>subjectInput(seal(perFile)));perFile.artifacts[path]!.bytes++;assert.throws(()=>subjectInput(seal(perFile)),/invalid_or_unsupported/);
});
