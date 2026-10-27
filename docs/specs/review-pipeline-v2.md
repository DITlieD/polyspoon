# Review pipeline v2: ingestion, automated safety pre-review, live human queue

Status: design draft. Phase 1 (ingestion + live queue foundation) is built on branch `review/v2`; the vision safety detectors are not.

Scope note: uploads are 3D file formats, not photographs. Detection therefore looks at shape, texture and text content. Photo hash-matching services do not apply to this input and are out of scope.
Builds on: `marketplace-moderation.md`, `open-review.md`, `processor/DESIGN.md`, `server/processing-design.md`, migrations 0002, 0006 and 0007.

## 0. Invariants

1. **Humans approve, the machine only filters.** The automated pre-review can send a version to `rejected_auto` or `flagged`, or let it through to the human queue. It can never set `approved` or `published`, write `review_record`, or grant a capability. The existing `version_state_machine` trigger and the publisher, reviewer and verifier capability checks stay the only way a model gets accepted.
2. **Automated rejections can be appealed and audited.** Every auto outcome is an immutable record a human can override. There is no hidden or admin-only lane: every outcome is either a human-reviewable flag or an appealable auto-reject.
3. **Uploads are hostile.** Every byte of an uploaded file, every name in it and every texture is untrusted data. None of it is ever treated as instructions.
4. **The verifier is unreachable.** Uploaders can call one thing, the upload API. The safety pipeline has no inbound listener and no public URL, and it accepts no user-chosen parameters.

## 1. Where this fits the existing architecture

Today: `draft → submitted → processing → awaiting_review → approved → published`. Processing is done by an operator-run, pull-based processor (`processor run --once`, Bubblewrap + systemd cgroups, no inbound listener). It claims `processing_job` leases through `/api/processor/claims` using a scoped `processor` secret. Results are immutable `processing_attempt`, `processing_artifact` and `processing_attestation` rows. Files live in Supabase private storage behind `server/storage.ts`.

v2 adds a **safety stage** inside `processing`. It runs as a second processing profile, `safety-v1`, on the same claim, lease and attestation machinery. A version reaches `awaiting_review` only after both the technical profile and the safety profile have passed.

```
upload ─► ingest_upload(pending) ─► normalize (sandbox) ─► asset_version(submitted)
        ─► processing: [technical-v1] + [safety-v1]
             safety outcome:
               pass      ─► awaiting_review  (enters the human queue)
               flag      ─► awaiting_review  with priority=high, findings shown, "flagged" badge
               reject    ─► rejected_auto    (contributor can appeal → human queue)
```

Proposed state-machine change: add the state `rejected_auto`, plus the transitions `processing→rejected_auto` and `rejected_auto→awaiting_review` (only through a human appeal decision). There is no transition from the new state to `approved` or `published`.

## 2. Ingestion

### 2.1 Accepted formats
| Format | Accept | Notes |
|---|---|---|
| `.glb` | yes | canonical |
| `.gltf` + buffers/textures | yes, as `.zip` | the existing ZIP rules apply (no traversal, symlinks, duplicates or compressed-entry tricks; member count and size bounds) |
| `.fbx`, `.obj`+`.mtl` (zip) | phase 3 | converted to GLB in the sandbox; the original is kept, the GLB is canonical |
| `.blend`, `.usdz` | not accepted | `.blend` can run Python. USDZ is deferred. |

Limits (first pass): 50 MB upload, 2M triangles, 64 textures, 4096² max texture size, 256 nodes, no `KHR_*` extensions outside the allowlist already in `processor/glb-extensions.ts`, no external URIs and no embedded scripts. Magic bytes must match the extension.

### 2.2 Upload API (Worker)
- `POST /api/uploads` → `{uploadId, putUrl, expiresAt, maxBytes}`. Requires an interactive session or a token with the new `uploads:write` scope. Each upload reserves storage in the existing `storage_reservation` budget, and a per-member daily cap applies.
- The client PUTs the file to a short-lived, single-object signed Supabase URL under `ingest/<uploadId>/original`. The key is server-generated and never contains the user's filename.
- `POST /api/uploads/:id/complete` accepts `{title, kind:'static', category?, description?}`. The Worker checks the size and hash, inserts `ingest_upload(status='received')` and enqueues normalization. It returns 202 `{versionId?:null, status}`.
- `GET /api/uploads/:id` returns the status for the owner only: `received | normalizing | queued | in_review | rejected_auto | needs_changes`. Reasons are coarse category labels only (for example "prohibited symbol", "sexual content", "text policy", "invalid file"). Scores, crops and model names are never returned.

The title and description are user text. They go through the text-safety stage as data (§4.4).

### 2.3 zenov ingestion
zenov (the owner's local generation system) uses the **same API**. It gets no side door.
- The owner creates a dedicated agent token with scopes `uploads:write` and `catalog:read` only. That token cannot vote, review or moderate.
- A small `scripts/zenov-upload.ts` CLI (phase 2) runs `POST /api/uploads` → PUT → complete, then polls the status. It can optionally attach `source:'zenov'` and a provenance JSON (generator, seed, prompt hash) as **untrusted metadata**. Provenance is shown to humans and has no effect on any gate.
- zenov models go through the full safety stage and the full human review. Owner or admin status gives no fast path.

### 2.4 Normalization (sandboxed, before any rendering)
This runs in the existing Bubblewrap processor jail with network off. It parses the file with a pinned glTF validator and checks it against the limits. It re-encodes textures to PNG/KTX2 (decoding hostile images inside the jail) and strips unknown extras and extensions. It writes `normalized.glb` and a `strings.json` with every string extracted from the file: node, mesh, material, texture and animation names, `extras`, `asset.generator`, `copyright`, URIs, and the original filename. Size and length limits apply to each. Parse failure → `rejected_auto` with reason `invalid_file`.

## 3. Rendering for review

Done by the processor host in the jail, headless: Chromium + three.js with SwiftShader/ANGLE, using the same renderer as `review-raster.ts`, so humans and the machine see the same thing. No network, fixed viewport, deterministic camera.

- **Full views (14 at 1024², transparent and neutral grey backgrounds):** 6 axis views (±X ±Y ±Z), 8 isometric octant views, and 1 turntable strip (12 × 256² frames, used by humans only). Lighting is a fixed 3-point setup plus a flat-unlit pass. The unlit pass catches symbols that are only visible in the albedo.
- **Material passes:** albedo-only, normal-only, and wireframe for 4 of the views. This catches content hidden by lighting or shaped into the geometry.
- **Interior and hidden geometry:** a clipped-plane sweep (3 slices per axis) and a render with backface culling off. This catches content inside a hollow shell.
- **Texture sheets:** every texture image is analyzed directly at full resolution and tiled into 1024² crops with 25% overlap. Hidden decals are most often found here.
- **Zoom crops:** (a) a grid crop of each full view (3×3 tiles at 2× upscale); (b) saliency crops, where the bounding boxes of high-detail regions (edge density, texture entropy, small disconnected mesh islands) are rendered close up at 1024²; (c) each disconnected mesh component smaller than 5% of the bounding box, rendered on its own from 4 angles, since small attachments are a common way to hide content.
- Budget: about 120–250 images per model, with a hard cap of 400. All images are stored privately under `review/<versionId>/safety/` with SHA-256 receipts in `processing_artifact` (the existing 2 MB per-file bound applies; JPEG for crops).

## 4. Automated safety analysis

### 4.1 Detectors (ensemble, run on every image and on texture tiles)
| Category | Primary | Secondary |
|---|---|---|
| Sexual/NSFW (genitalia, sexual acts) | a self-hosted NSFW image classifier (an open-weights NSFW detector or an equivalent, run in the processor) | a vision LLM classifier pass (§4.3) |
| Hate symbols (swastika, SS runes, other extremist iconography) | a dedicated symbol detector: template plus learned matching on silhouettes and texture tiles, including rotated, mirrored and 3D-extruded forms, run on both renders and depth/normal maps | a vision LLM pass |
| Sexualised child-like figures | the shape/render classifier combination "child-like figure × sexual-likely" plus the text scan on names and OCR | a vision LLM pass. Clear positive → `reject`, otherwise `flag` |
| Violence/gore (flag only) | a vision LLM pass | — |
| Text: slurs, hate, sexual text | OCR (PaddleOCR or Tesseract, run in the jail) on renders and texture tiles, plus every `strings.json` entry and the title/description → a normalizer (Unicode NFKC, confusables, leetspeak, reversed and mirrored text, separator stripping) → a curated multilingual wordlist and a text classifier | a text LLM classifier pass |

### 4.2 Thresholds and outcomes (initial values, tuned on a labelled set)
- `reject`: child-like ≥ 0.5 together with sexual ≥ 0.6 on any image (clearly sexualised content); sexual-explicit ≥ 0.85 on two or more images, or ≥ 0.95 on one; hate symbol ≥ 0.9; a wordlist hit on a "severe" term (slurs, explicit Nazi terms) after normalization.
- `flag` (goes to humans with high priority): child-like together with sexual ≥ 0.3 below the reject bar; any category score between its flag threshold (about 0.4) and its reject threshold; disagreement between detectors; an OCR hit on a "context" term; any hidden or interior geometry or tiny-island content; an LLM pass reporting `suspicious_instructions` (§5.3).
- `pass`: everything below the flag thresholds. **Passing only makes a model eligible for human review.** It does not accept the model.
- Fail closed: a crashed detector, a timeout or an exhausted budget → `flag` with reason `analysis_incomplete`. This never becomes a pass.

Thresholds live in an immutable `safety_policy` row (versioned, the same pattern as `processing_profile`). Changing them means a new policy version, and that bumps the authority epoch.

### 4.3 Vision/text LLM pass
This is an optional second opinion in the ensemble, called only by the processor's trusted parent (§5) with a fixed system prompt and a **structured-output** schema: `{categories:{sexual,child_like,hate_symbol,slur_text,violence}:0..1, suspicious_instructions:bool}`. Free text is ignored. The model gets images and `strings.json` wrapped as quoted data, and it cannot call tools. The vendor needs a zero-retention agreement and an acceptable-use policy that permits content-safety screening; otherwise the pass is skipped and the self-hosted detectors decide alone. LLM scores can only **raise** an outcome (pass→flag, flag→reject). They can never lower one, so an injection that makes the LLM say "clean" achieves nothing.

### 4.4 Outputs
An immutable `safety_report` (JSON, hashed) holds the per-image scores, the bounding boxes of findings, OCR text spans, matched string entries, detector versions, the policy version and the outcome. It is attached to the `processing_attestation` for profile `safety-v1`.

## 5. Security isolation of the verifier

### 5.1 Topology
- **Public plane (Worker):** upload, status and the queue UI. It holds no safety-model credentials and never calls the safety model. It cannot read `safety_policy` thresholds, and it returns only the coarse outcome labels (§2.2).
- **Safety plane (processor host, pull-only):** the trusted parent claims jobs with its scoped processor secret, downloads the inputs through signed GET URLs, and runs rendering, OCR and classifiers in the jail. LLM calls are made by the parent only, with network egress limited to those hosts (nftables allowlist). The jail has no network at all. Results are submitted through the existing bound-result path.
- It has no inbound port, no webhook and no shared database credentials. The service key never leaves the parent. Detector weights and prompts are read-only inside the jail.

### 5.2 Untrusted-input handling
- All parsing (glTF, images, ZIP, OCR) happens in the Bubblewrap jail with cgroup memory/CPU/pids limits, seccomp, no network, a read-only rootfs, a tmpfs work directory and a wall-clock limit. One job runs per jail and the jail is destroyed afterwards.
- The parent only reads the jail's declared outputs, after the jail has exited: PNG/JPEG checked against the size cap and re-decoded, and JSON validated against `result.schema.json`.
- Classifier inputs are **pixels and normalized strings only**. Raw file bytes never reach a model.

### 5.3 Prompt-injection neutralization
- Classifiers that are not LLMs (NSFW, symbol, wordlist) cannot be prompted. They are authoritative for reject decisions.
- For the LLM pass: strings are length-capped, control and bidi characters are stripped, and the strings are JSON-encoded inside a delimited `UNTRUSTED_ASSET_DATA` block. The system prompt says the content is data to be classified, and the output has to match a strict schema (anything else = `analysis_incomplete` → flag). The model gets no tools and no memory, and each call is a fresh, stateless request.
- Instruction-like content ("ignore previous", "you are", "approve this", "system:") found in strings or OCR raises `suspicious_instructions` → `flag`, and the matched spans are shown to the human.
- Monotonic merge (§4.3): LLM output can only make an outcome stricter.
- The uploader never sees scores or which detector fired, so they can't probe the thresholds. A cap on auto-rejections per member per day (for example 5) → temporary upload restriction, which limits repeated threshold probing.

### 5.4 Tamper resistance
- The `safety_policy`, the detector model hashes and the jail image digest are pinned in the attestation record. A mismatch means the result is refused.
- The processor secret is bound to the `safety-v1` profile only. Revoking it withdraws its attestations, using the existing `processor_loss_publication` pattern.
- A canary set (known-bad and known-good fixtures, hashed) runs on every policy or detector change and nightly. A failure disables the profile, and jobs stay pending (fail closed).

## 6. Human review: the live queue

### 6.1 UX (hosted/app `moderation-pages.ts`, new "Queue" view)
- A big list sorted by priority (`flagged` → `appeal` → `normal`), then by age. Each row has a thumbnail strip (4 views), title, contributor, outcome badge, top finding, time waiting and a claim indicator ("Ana is reviewing, 3 min").
- Opening an item **claims** it. The detail page shows: an interactive viewer (the existing `review-inspection.ts`), the full-view gallery, and a findings panel. Each finding shows its crop with the bounding box, the detector, the score band (not raw thresholds) and the OCR/string span. It also has the auto report, provenance, and the version's decision history.
- Actions: the existing review decisions (visual/portability records, approve via publisher, changes requested, reject). New ones: "override auto-flag: clean" and "confirm violation" (feeds the labelled set). Keyboard shortcuts: J/K to move, A/R/C to decide, Esc to release the claim.

### 6.2 Data model (migration `0014_review_pipeline_v2.sql` sketch)
```sql
CREATE TABLE ingest_upload(id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES member(user_id),
  source TEXT NOT NULL CHECK(source IN ('web','token','zenov')), object_key TEXT NOT NULL, sha256 TEXT, bytes INTEGER,
  status TEXT NOT NULL CHECK(status IN ('reserved','received','normalizing','queued','failed')),
  version_id TEXT REFERENCES asset_version(id), provenance TEXT CHECK(provenance IS NULL OR json_valid(provenance)),
  created_at INTEGER NOT NULL);
CREATE TABLE safety_policy(id TEXT PRIMARY KEY, version TEXT NOT NULL UNIQUE, thresholds TEXT NOT NULL CHECK(json_valid(thresholds)),
  detectors TEXT NOT NULL CHECK(json_valid(detectors)), enabled INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL);
  -- immutable trigger + epoch bump, like processing_profile
CREATE TABLE safety_report(id TEXT PRIMARY KEY, version_id TEXT NOT NULL REFERENCES asset_version(id),
  attempt_id TEXT NOT NULL UNIQUE REFERENCES processing_attempt(id), policy_id TEXT NOT NULL REFERENCES safety_policy(id),
  outcome TEXT NOT NULL CHECK(outcome IN ('pass','flag','reject','incomplete')),
  summary TEXT NOT NULL CHECK(json_valid(summary)), report_sha256 TEXT NOT NULL, created_at INTEGER NOT NULL);
  -- immutable + no-delete triggers
CREATE TABLE safety_finding(report_id TEXT NOT NULL REFERENCES safety_report(id), idx INTEGER NOT NULL,
  category TEXT NOT NULL, detector TEXT NOT NULL, band TEXT NOT NULL CHECK(band IN ('low','flag','reject')),
  artifact_path TEXT, bbox TEXT, text_span TEXT, PRIMARY KEY(report_id,idx));
CREATE TABLE review_queue_item(version_id TEXT PRIMARY KEY REFERENCES asset_version(id),
  priority INTEGER NOT NULL, reason TEXT NOT NULL CHECK(reason IN ('pass','flag','appeal','incomplete','report')),
  claimed_by TEXT REFERENCES member(user_id), claim_expires_at INTEGER, revision INTEGER NOT NULL DEFAULT 0,
  enqueued_at INTEGER NOT NULL);
CREATE INDEX queue_order ON review_queue_item(priority DESC, enqueued_at);
CREATE TABLE review_event(seq INTEGER PRIMARY KEY AUTOINCREMENT, version_id TEXT NOT NULL, actor_id TEXT,
  kind TEXT NOT NULL CHECK(kind IN ('enqueued','claimed','released','decided','auto_outcome','override')),
  detail TEXT CHECK(detail IS NULL OR json_valid(detail)), created_at INTEGER NOT NULL);
  -- append-only triggers
```
Plus the state-machine change from §1. Guards: a trigger refuses any `asset_version` move to `approved` unless the latest `safety_report.outcome IN ('pass','flag')` **or** an `override` event by a human with `moderator`/`admin` exists. The existing human `review_record` and publisher requirements still apply on top. A claimant cannot claim their own content (same rule as `marketplace-moderation.md`).

**Claim/lock:** `UPDATE review_queue_item SET claimed_by=?, claim_expires_at=now+10min, revision=revision+1 WHERE version_id=? AND (claimed_by IS NULL OR claim_expires_at<now)`. Zero changed rows means 409 `already_claimed`. A heartbeat extends the claim. Deciding checks `claimed_by=actor AND revision=expected` in the same D1 batch as the `review_record` insert, so two reviewers can never both decide the same item.

### 6.3 Live updates
- **Phase 1 (D1 only):** `GET /api/moderation/queue/events?after=<seq>` long-polls. The Worker re-checks `review_event` every 1 s for up to 25 s, then returns. Clients apply the deltas. It stays within free-plan limits and needs no new infrastructure.
- **Phase 2 (recommended):** a single `ReviewQueueHub` Durable Object holds WebSocket connections for moderators (WebSocket Hibernation API). Every queue mutation, after its D1 commit, POSTs `{seq}` to the DO, which broadcasts the event, and clients refetch the row. D1 remains the source of truth. The DO only fans out, and clients reconcile from `seq` on reconnect. The socket is authenticated by an interactive moderator session, same origin, re-checked on connect and every 5 min. A Durable Object may require the Workers paid plan or its SQLite-backed free tier: **open question**.

### 6.4 Queue API
`GET /api/moderation/queue?cursor=`, `POST /api/moderation/queue/:versionId/claim`, `POST …/heartbeat`, `POST …/release`, `POST …/decision` (wraps the existing review and decision endpoints), `POST …/override` `{outcome:'clean'|'violation', reason}`, `GET …/safety-report` (moderator/admin only; crops come through short-lived signed URLs, never public), `GET /api/moderation/queue/events` or `/ws`. All of these require an interactive moderator or admin session. Scoped tokens get 403 (the existing rule).

## 7. Phased build plan
1. **P1, data and queue (Worker only):** migration 0014, the queue claim/lock and events API, the long-poll queue UI with the existing renders, and the upload API for GLB only. Today's human review keeps working; the queue replaces the list.
2. **P2, safety v1 (processor):** sandboxed normalization, the multi-angle and crop renderer, OCR + wordlist + string extraction, a self-hosted NSFW classifier and the symbol detector, outcome merge, fail-closed, canary set, and the zenov CLI. Everything first runs in *shadow mode* on preflight: findings are shown to humans but don't gate. Gating is switched on only after the labelled-set metrics pass.
3. **P3, hardening:** the vision LLM second opinion with monotonic merge, the DO WebSocket hub, glTF-zip/FBX/OBJ conversion, appeal path for `rejected_auto`, and override-to-label feedback.
4. **P4, ops:** threshold tuning, review metrics (time in queue, override rate), and backups and a restore drill for the new tables.
Each phase: unit and integration tests, deploy to preflight only, and a human sign-off before gating is enabled.

## 8. Decided defaults (owner: "decide it yourself")
1. **LLM second opinion:** a third-party vision API with zero retention, used only to make outcomes stricter.
2. **Where the safety processor runs:** a dedicated always-on worker host rather than lied.
3. **Live updates:** D1 polling first; Durable Object push only if polling feels slow.
4. **Strictness:** `flag` goes to humans. Weapons and violence are allowed; sexual and hate content are not.
5. **Formats for v1:** GLB (and glTF JSON with embedded data URIs) only.
6. **Limits:** 50 MB, 2M triangles, a daily per-member upload cap (20).
7. **Wordlist:** English + Japanese to start, kept in-repo.

## 9. Phase 1 as built
Table names in the built migration (`migrations/0014_review_pipeline_v2.sql`) are `uploads`, `safety_report`, `safety_finding`, `review_queue` and `queue_event_log`. `safety_policy` and the `rejected_auto` state change land in P2 with the detectors.

## 9a. Phase 2 + 3 as built (branch `review/v2`)
The automated check is a pre-filter only. Its strongest result is `reject`, which is an appealable auto-rejection and only applies when the active policy has `enforce=1`. The shipped policy is shadow mode, so a reject is shown to humans at priority 90. Nothing in the pipeline writes `review_record`, approves, publishes or grants a capability. Triggers enforce this (`approval_requires_safety_clearance`, `processing_reject_is_auto`, `rejected_auto_appeal_by_human`).

**Detectors (all real; the always-0 stubs are only a fallback):**

| id | status | what it does | what going fully live needs |
|---|---|---|---|
| `render-v1` | real | Headless three.js in a no-network bwrap jail inside a cgroup scope. Produces 14 views (lit and unlit), normal and wireframe passes, 9 slices, backface views, island close-ups and texture tiles. Re-encodes the scene to `normalized.glb`. | Nothing. |
| saliency crops (part of `render-v1`) | real | Per view, picks 5 windows at 1/3 and 4 at 1/5 by edge and colour-rarity saliency, then re-renders them at full resolution (replaces the fixed 3×3 grid). | Nothing. |
| `nsfw-mobilenet-v2-v1` | real (learned) | Open-weights NSFWJS MobileNetV2 on TF.js. Runs in the jail on the WASM-SIMD backend, with the weights and wasm bundled so nothing is fetched. Batched over about 170 inputs per model in about 6 s. Score = porn + hentai + 0.5·sexy. | Tuning on a labelled 3D set: it was trained on photos and drawings, so low-poly genitalia may score low. Humans and the vision LLM cover that. |
| `child-like-proportion-v1` | real (heuristic) | Head-to-height ratio of upright silhouettes. The policy only acts on it together with a sexual score. | A learned age-likeness model would be better. None with suitable open weights was available here. |
| `hate-symbol-template-v2` | real (heuristic) | Chiral template bank: swastika (thin through near-filled; distance-transform erosion handles very thick forms), triskelion, Wolfsangel and Sonnenrad. Works at any rotation, handedness and polarity, on silhouettes and luminance blobs. | Not covered: SS runes (two blobs), Odal rune (mirror-symmetric), Celtic cross, and stylised or foreshortened forms. Those rely on the LLM and humans. |
| `ocr-tesseract-v1` | real | Tesseract **eng + jpn** (`tesseract-ocr-jpn` installed on lied) in its own jail and cgroup. | Install `tesseract-ocr-jpn` on the production processor host. |
| `wordlist-v1`, `instruction-v1` | real | EN and JA normalised wordlist plus reviewer-directed instruction detection. | Nothing. |
| `geometry-visibility-v1` | real | Hidden-island and tiny-part detection. | Nothing. |
| `antigravity-vision-flash-low-v1` | real adapter, **not reachable yet** | OpenAI-compatible call to the zenov antigravity bridge. It is the live cover for sexual, child-like, symbols and text. It can only make the verdict stricter; if unreachable or off-schema, the model is flagged for a human. | The bridge has to be running at `ANTIGRAVITY_BRIDGE_URL` (default `http://127.0.0.1:8811/v1`; it was down during the build). `ANTIGRAVITY_BRIDGE_MODEL` must be set to the exact flash-low id the bridge lists (default `gemini-3.8-flash-low`; the zenov config lists `gemini-3.5-flash-low`). The model used is recorded in each report. |

**Isolation and hardening:**
- Every jail (Chromium and Tesseract) runs as `systemd-run --user --scope` with `MemoryMax` (3G for Chromium, 768M for OCR), `MemorySwapMax=0`, `CPUQuota` (200% / 100%) and `TasksMax` (512 / 64), all set through `SAFETY_JAIL_*`. If the scope can't start, the stage fails closed and the model goes to a human.
- A processor never scans an upload owned by its own owner. The claim query filters these out, and the `safety_attempt_not_own_upload` trigger blocks them too.
- The detector hash covers the safety source, the wordlist and the bundled NSFWJS version. Any change needs a fresh passing canary before claims resume.

**Moderator serving:**
- Queue images use `GET /api/moderation/queue/:id/image-url`, which returns a 2-minute Supabase signed URL (`signedRead`), so bytes never stream through the Worker. Local mode falls back to the moderator-only byte route.
- The viewer loads `normalized.glb`: the jail's three.js re-encode, with no extensions, extras or unknown chunks. It is stored immutably in `safety_normalized`. The original is only served when no normalized copy exists.

**Appeals (migration `0016_safety_v1_hardening.sql`):**
- The owner files once with `POST /api/uploads/:id/appeal {message}`, and only for `rejected_auto` uploads. The owner sees only a coarse reason.
- Moderators and admins (never the owner, and never with token sessions) use `GET /api/moderation/appeals` and `POST /api/moderation/appeals/:versionId {decision: accept|decline, reason}`.
- Accepting logs an `override` event with outcome `appeal_accepted` and moves the version from `rejected` to `awaiting_review`, into the live queue (reason `appeal`, priority 85). Approval still needs a reviewer, a safety clearance (override `clean`) and the publisher.
- UI: an appeals panel under the live queue for moderators, and "Your direct uploads" with the appeal form on the Contribute page.

**Remaining (Phase 3+ leftovers):**
1. Start the antigravity bridge and confirm the model id (3.5 vs 3.8). Then run the canary with the LLM enabled.
2. A labelled 3D fixture set and threshold tuning before `enforce=1`. NSFW positives can't be generated synthetically here.
3. A learned child-likeness model and learned symbol detection (SS runes, Celtic cross, stylised forms).
4. Durable Object WebSocket live push. Long-polling is in use now.
5. FBX, OBJ and glTF-zip ingestion. GLB and embedded glTF only for now.
6. Override-to-label feedback and review metrics (Phase 4). Backups and a restore drill for the new tables.
7. A dedicated always-on processor host with the same packages (`bubblewrap`, a user systemd, Chrome, `tesseract-ocr-eng`/`jpn`).

## 10. Risks
- **False negatives:** novel symbol designs and stylized low-poly genitalia that classifiers trained on photos miss. Mitigations: humans always review, geometry and silhouette crops, a labelled 3D fixture set.
- **False positives:** low-poly shapes (towers, mushrooms) flagged as NSFW, and crosses or windmills flagged as swastikas. These are flags, not rejects; humans override and the labels feed back.
- **Hostile parsers:** glTF and image decoder exploits. Contained by the jail, no network, and a destroyed jail per job.
- **Cost and latency:** 150–400 images per model × several detectors. Mitigations: run the cheap detectors first, call the LLM only on crops that scored above "low", and use the per-day budget triggers (existing pattern).
- **Availability:** a pull-only processor means models wait while the host is offline. This is accepted and fails closed.
- **Moderator exposure** to harmful content: blur flagged crops by default and require a click to reveal.
