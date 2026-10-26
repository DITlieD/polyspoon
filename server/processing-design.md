# Required submission processing

New version identities include processing requirement `package-replay-v1` and policy version `linux-bwrap-cgroup-v1`. Existing versions retain the migration default `legacy`. Requests cannot select either field. Submission seals the existing receipt-complete inputs and creates one durable job.

Administrators enroll a dedicated processor against an active verified owner. A random `pc_` credential authenticates only processor routes and exact claimed-version reads. The owner cannot process their own contribution. Every mutation checks current credential, owner, enabled processor, claim and profile authority in SQL.

A trusted operator registry starts empty. A claim pins its reviewed configuration, runtime digests and policy digest. One processor and one job can hold one current attempt. Claims last 600 seconds and stop after three attempts. Claim keys and terminal results are idempotent. Expired claims return to pending without a daemon. Unsupported, cancelled and infrastructure failures do not claim recipe failure. Semantic compilation or output failure requests changes.

Passed results bind all input identities, full required cases, five ordered successful terminated stages, eleven successful checks and exactly three receipt-backed files. Required files are outputs.zip (ZIP, at least128bytes), validation.json and execution.json (JSON, at least64bytes each). Each is at most2097152bytes. The service constructs technical records under a scoped processor principal. Manual records cannot satisfy required processing. Review and publication require current job, registry, credential, input and result receipts. Independent visual, portability and source reviews remain required.

HTTP tests use synthetic registry identities and artifacts. They establish service authorization and validation, never genuine isolated execution or artistic acceptance. Missing registry configuration leaves jobs pending.

## HTTP interface

`POST /api/admin/processors` accepts `{label,ownerUserId,profiles:["package-replay-v1"]}` and returns safe processor metadata plus a one-time credential. `GET` lists metadata; `DELETE /api/admin/processors/:id` disables it. These routes require current administrator authority and a same-origin member session.

`POST /api/processor/claims` uses `Authorization: Bearer pc_...` and `{idempotencyKey,profile:"package-replay-v1"}`. It returns `{job:null,reason?}` or `{job:{id,attemptId,leaseId,leaseExpiresAt,profile,version,subject,requiredCoverage,runtime,policy,requiredArtifacts}}`. Time is Unix milliseconds. `version` supplies exact report, sourcePackage and selectedDesign descriptors. A credential cannot read catalog or account routes.

Claimed operations require the same credential plus `X-Processor-Lease` and `X-Processor-Attempt`. `GET/HEAD /api/versions/:id/files?path=` freshly verifies input bytes. `PUT /api/processor/jobs/:id/artifacts?path=` accepts bounded raw bytes and returns a verified descriptor. `POST /api/processor/jobs/:id/result` accepts the exact shared result schema. Identical accepted results remain idempotent after lease expiry while the processor, profile and job remain authorized. Conflicting results fail. A passed wall time above 120000 milliseconds fails.

`GET /api/versions/:id/processing` exposes bounded job status, first failure and the accepted result manifest to the contributor and qualified human inspectors. `GET/HEAD /api/versions/:id/processing/files?path=` serves freshly verified accepted result files to those same human callers. It invalidates a known failed receipt and fences concurrent observations. Processor credentials cannot use this inspection route. The trusted `processing_profile` table has no member or processor write route. An operator may install a reviewed configuration containing exactly `{runtime:{capsuleSha256,harnessSha256,dependencyManifestSha256,nodeVersion:"22.22.1"},policy:{id:"linux-bwrap-cgroup-v1",sha256}}`. Its row also names profile `package-replay-v1` and policy version `linux-bwrap-cgroup-v1`. Migration seeds no configuration. Synthetic test configurations never authorize a real deployment.
