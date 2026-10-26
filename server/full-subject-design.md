# Full sealed subject ingestion

Revised recommendation: retain private Supabase objects, add resumable server-owned per-file verification receipts, and verify expected length and SHA-256 on every delivery and processing/review read. Do not copy artifact bytes into D1. The bounded receipt path is implemented and locally verified; deployed Free CPU qualification remains unverified.

## Measured input and limits

The original `evidence/revision14/final/bench-review-01/subject.json` contains 193 artifacts plus `report.json`: 194 files, 12,032,698 bytes, largest 543,625 bytes, nine empty files, 19 cases and 13 views. All original files and canonical identities match. Raw/canonical subject sizes are 78,511/65,117 bytes; descriptor JSON is 28,118 bytes. [Measurements](test-evidence/full-subject-measurements.json) preserve the exact identities and verification results. Resolve files against the subject's `run`, not its review directory.

The previous 32-file count cap blocked ingestion. Existing 512 KiB JSON and 2 MiB per-file limits already fit. D1 permits 2,000,000-byte rows, 100,000-byte SQL text, 100 bound parameters and 50 queries per Free invocation. Bind metadata values as now; this input does not require multipart manifest ingestion. [D1 limits](https://developers.cloudflare.com/d1/platform/limits/)

Raising the old cap alone would have left approval making at least 195 external fetches: 194 files plus the bucket check, before attachments. Approval and publication repeat that work. Workers Free permits 50 external subrequests, 10 ms CPU, 128 MB memory and 100,000 requests/day. Network waits are excluded from CPU; parsing, hashing and review checks are not. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)

## Integrity versus availability

A receipt proves the server read exact sealed bytes at its verification time. It does not prove those bytes remain available. Even the existing synchronous reread leaves a gap before a later request. The requirement is that altered bytes never cross the verified gateway and that publication authority binds the exact subject; it does not require an atomic availability snapshot.

| Provider event | Required behavior |
| --- | --- |
| Missing/corrupt bytes before first receipt | Verification fails; submission/publication readiness stays incomplete. |
| Bytes disappear/change after verification, not yet observed | Metadata may be approved/published from historical receipts and valid reviews. There is no claim of current availability. The next byte request fails closed. |
| Missing/corrupt bytes observed before approval/publication | Record failed observation, invalidate readiness, deny the transition until an exact successful reread restores readiness. |
| Missing/corrupt bytes observed after publication | Return the existing missing/changed artifact error with no unverified bytes. Keep metadata publication separate from availability; do not invent an automatic moderation withdrawal policy. |
| Identical bytes restored | A new successful server read can restore byte readiness. The version/subject/manifest identity remains unchanged. |
| Transient provider quota/service failure | Fail the request with the existing quota/unavailable error. Do not claim a digest failure or silently bypass checks. |

The earlier [D1 byte-copy option](test-evidence/full-subject-d1-option.md) adds availability independent of staging, but consumes about 12 MB of D1 per version and duplicates storage. Its 128 MiB pilot holds only about eleven such sets. That machinery is unnecessary for the integrity/authority requirement. Reject that option for this milestone.

## Smallest request flow

1. Keep the original subject format, version identity and atomic complete manifest seal. Raise the supported full-subject admission bound to 256 files including the report and 16 MiB total; retain the current 2 MiB file and 512 KiB JSON bounds. Preserve all 194 files, including empties and other-family evidence. No pruning or fabricated passes.
2. Retain `PUT /api/versions/:id/artifacts?path=` and immutable version-bound object keys. The version digest already binds the manifest; no global deduplication service is required. Verify input bytes as now, put without overwrite, read back through `checkedObject`, then persist a server-owned receipt and uploaded/readiness state atomically. Use one shared readback for new writes and immutable duplicates, avoiding an extra retry fetch. A receipt binds version, sealed subject/manifest/report and exact path/hash/length through the immutable parent/descriptor. Clients cannot submit verified flags or pass records.
3. Store immutable receipt facts and separate server observations of failures/restoration. A failed read invalidates current byte readiness without rewriting a historical receipt. Fence updates so an older successful read cannot clear a newer failed observation. Reuse the existing append-only audit approach. Final state writes require an exact complete receipt set and no unresolved known failures in SQL, alongside current actor capability, authority epoch and review revision. Receipts cannot replace reviews or technical attestation.
4. Extend protected `GET /api/versions/:id` with bounded verification progress and pending/failed paths. Successful PUT keeps `uploaded:true` and may add verification fields. If the response is lost, repeating the same PUT uses existing immutable-object verification and idempotent receipt handling. The caller resumes pending paths after restart. No lease scheduler, background job or new orchestration service is needed for one-file requests.
5. Existing new-version clients keep create/upload/submit URLs and payloads. Submission readiness checks all receipts, not a client count. Legacy versions without receipts retain their current at-most-32 synchronous revalidation profile until migrated; derive the profile server-side. No client can choose an easier publication path. An interrupted upload with no receipt can be retried using the same PUT.
6. Approval/publication check current qualified independent reviews, the sealed complete byte-proof set and atomic authority guards. Replace the full object reread with bounded metadata queries. Receipt readiness must include `report.json`, which is outside the original artifact-map hash. Review attachments need equivalent server readback receipts; batch their proof lookup rather than externally rereading each attachment at publication.
7. Centralize fresh descriptor-bound reads for published downloads and unpublished processing/review reads. Add only the missing protected version-file read path needed by reviewers/operators, reusing existing version inspection authorization, `checkedObject` and byte response logic. Every GET, HEAD, preview and range verifies the whole bounded object before responding. No raw provider or signed URLs. Never evaluate submitted source in the API or credential environment.

## Per-request budget and compatibility

An ordinary artifact PUT uses at most three provider requests: bucket check, immutable put, readback. It hashes at most two bounded files, input and readback; it never processes 194 files in one invocation. Retry behavior remains idempotent. Final approval/publication make no staging-object requests and use a joined completeness/receipt check plus existing authority reads. Target fewer than 12 domain D1 statements per upload/final transition, with actual authentication queries measured separately.

The existing client can drive roughly 194 separate uploads instead of 194 uploads plus a second mandatory 194-request job. Current private download URLs, selected source descriptor, member checks and cache policy remain. Failed post-storage readback returns failure; retry obtains the receipt rather than pretending success. If measured Free CPU cannot accommodate both hashes, split readback into a bounded one-file verification endpoint and return explicit pending status. Do not add that extra endpoint preemptively or fall back to a paid plan. Actual 10 ms compliance remains unmeasured.

Supabase Free includes 1 GB storage and separate 5 GB uncached/cached egress. One original set occupies about 1.2% of storage; a complete verification read uses about 0.24% of uncached egress. Plan private gateway reads as uncached. D1 stores metadata, not 12 MB byte copies. Quota failures remain closed, accounts remain Free, and no billable fallback is authorized. [Storage](https://supabase.com/docs/guides/platform/manage-your-usage/storage-size), [egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress), [cost control](https://supabase.com/docs/guides/platform/cost-control)

## Acceptance

Use the unchanged original subject and all 194 original files through actual HTTP. Verify interruption/restart, duplicate/concurrent PUTs, all nine empty files, readback hash/length failures, incomplete/known-failed readiness denial and existing in-flight authority protections. Corrupt/delete objects before and after publication: no read may return unverified bytes, including HEAD/range and review/processing paths. Metadata may outlive unobserved storage availability, as stated above. Restore identical bytes and prove recovery. Positive reviews must describe the actual original evidence. Receipt success never substitutes for independent artistic/provenance review or separately required isolated executable processing. Production Free CPU qualification is distinct from local functional proof.
