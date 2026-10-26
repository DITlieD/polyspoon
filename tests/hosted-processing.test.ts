import test from 'node:test';
import assert from 'node:assert/strict';
import {processingCopy} from '../hosted/app/processing.ts';
import type {ProcessingJob} from '../hosted/app/types.ts';

const job=(value:Partial<ProcessingJob>):ProcessingJob=>({id:'synthetic-job',profile:'package-replay-v1',status:'pending',attempts:0,leaseExpiresAt:null,firstFailure:null,technicalRecordId:null,ready:false,result:null,...value});
test('processing status distinguishes queued, running, technical success and lost readiness',()=>{
 assert.match(processingCopy(job({}),'submitted').title,/Queued/);assert.match(processingCopy(job({status:'running',attempts:1}),'processing').detail,/1 of 3/);
 const passed=processingCopy(job({status:'passed',ready:true}),'awaiting_review');assert.match(passed.title,/Technical processing passed/);assert.match(passed.detail,/Publication also requires current visual, portability and source reviews/);assert.doesNotMatch(passed.title,/approved|published/i);
 assert.match(processingCopy(job({status:'passed',ready:false}),'awaiting_review').detail,/Approval remains unavailable/);
});
test('immutable failures request a corrected version and exhausted infrastructure does not offer a blind retry',()=>{
 const failed=processingCopy(job({status:'failed',attempts:1,firstFailure:{check:'validate',code:'glb_invalid'}}),'changes_requested');assert.match(failed.detail,/corrected version/i);assert.doesNotMatch(failed.detail,/submit this version again/i);
 const unsupported=processingCopy(job({status:'failed',firstFailure:{check:'input-check',code:'required_case_unavailable'}}),'changes_requested');assert.match(unsupported.detail,/coverage/i);
 const exhausted=processingCopy(job({status:'exhausted',attempts:3,firstFailure:{check:'compile',code:'supervisor_unavailable'}}),'submitted');assert.match(exhausted.detail,/support/i);assert.match(exhausted.detail,/does not start another attempt/i);
});

test('human review changes do not become technical failure or bypass lost readiness',()=>{
 const reviewed=processingCopy(job({status:'passed',ready:true}),'changes_requested');assert.equal(reviewed.title,'Technical processing passed');assert.match(reviewed.detail,/Reviewers requested changes/);assert.match(processingCopy(job({status:'passed',ready:false}),'changes_requested').detail,/Approval remains unavailable/);
});
