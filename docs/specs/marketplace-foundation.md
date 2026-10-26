# Marketplace foundation

The hosted service requires an active, verified member for catalog metadata, search, model pages, app code, previews, saved designs, GLB, executable source, module and other catalog bytes. This includes HEAD, range, direct-object and agent routes. Public landing, docs, authentication and legal/help remain separate. The deliberately public open-source local toolkit is a distinct distribution; membership does not revoke copies already delivered.

## Runtime and identity

The target is Workers and D1 on the free tier only. R2 activation was declined. Local tests may use a simulated private object binding; production uses a server-only Supabase private-bucket adapter. Resend supplies transactional email. Both require free-only account configuration and fail closed on missing configuration, quota or service errors. No real provider writes were performed in this slice. A narrow immutable object read/write interface keeps production independent of R2. No deployment, paid plan or remote resource creation is part of this slice. Better Auth owns magic-link verification, signup/login and database sessions. Database session caching is disabled. Application membership and capabilities are read from SQL on each request, so a valid old session does not retain revoked authority. Registration creates members only. Recovery repeats verified mailbox access. No submitted role/capability field can grant authority.

Actual local auth uses the same maintained library and token verification with a local-only email sink. The sink has no HTTP retrieval route and requires local mode plus loopback origin. It is test mail delivery, not a production identity provider or deployed email success. Production requires configured email delivery credentials/from address and an auth secret; missing configuration fails closed. OAuth may be added after a provider is chosen and configured. No custom password encryption or password hashing is implemented.

Server requests accept only the configured origin. Cookie-authenticated mutations require its exact Origin and JSON where appropriate. Scoped agent tokens use random secrets with stored digests, expiration and revocation. They can receive only ordinary member scopes, never reviewer, publisher or administrator capabilities. Account suspension blocks future protected requests and revokes sessions/tokens. Delivered or already streaming bytes cannot be recalled.

## Version and review authority

An immutable version digest binds contributor, asset identity, selected review subject and its artifact manifest. Contributor evidence is not verification authority. Immutable SQL constraints prohibit silently changing a sealed version or approved artifact descriptors. Upload routes verify bounded bytes against their manifest and use private immutable object keys. Replaced or missing object bytes fail revalidation. Files remain unavailable to ordinary members until the exact version is published.

Draft, submitted, processing, awaiting review, changes requested, rejected, approved, published and withdrawn are server-owned states. Contributors may create/submit their own versions and request withdrawal; they cannot assign reviewers, grant roles, fabricate technical attestation, approve or publish. Trusted verification and authored reviews remain separate records. Review identities come from the authenticated caller, not JSON. Existing review-record validation and category/coverage rules remain authoritative. Technical, visual, portability and executable-source/provenance passes must bind the exact subject; reviewers must be active, independently authorized and different from the contributor. One qualified independent reviewer can cover multiple categories. No reviewer-count rule is added.

Approval and publication check current authority, all exact evidence, record revocations/replacements and coverage. SQL compare-and-set guards include version/review revision and authority epoch so changed evidence, roles, suspension or a competing transition cannot reuse a stale approval. Votes are unique per member/model, idempotent to set/remove and never confer publication or review permission. Administrator actions are explicit, reject self-escalation and append application audit records. Signup never bootstraps an administrator.

This foundation may accept platform operator attestations of work performed separately. It does not claim durable isolated processing has run. Submitted source code is never evaluated in the API, Worker handler or credential environment. Quarantine/archive expansion, durable job scheduling and isolated executable processing remain separately verified F6-2 work.

## Delivery boundary

The existing index.html loads src/studio/main.ts; src/site/site.ts eagerly imports catalog, recipes, buildAsset and preview images. That complete Vite output cannot be the hosted public asset directory. A cosmetic route guard or an authenticated JSON endpoint would still disclose the embedded private catalog.

Hosting must produce two explicit entries. The public shell contains only landing/docs/legal/auth UI and deliberate public promotional content, with no imports of catalog, recipes, family metadata, private previews or generated package/module indexes. The authenticated application bundle and every referenced private asset are stored behind the Worker membership gateway, including hashed app JS/CSS and source maps if retained. No public fallback serves private application or catalog paths. Any future private object provider has no unauthenticated origin; local simulated R2 has no public bucket or endpoint; raw object keys are not external URLs. All downloads pass through the authenticated gateway, without reusable public signed URLs.

The current public toolkit may be published separately and explicitly. That distribution must not accidentally become the hosted catalog origin or include future member submissions. The public-shell/authenticated-app split needs dedicated frontend/build wiring; this server task does not modify or overwrite existing frontend or public catalog output.

## Local verification and limits

Dedicated server tests first cover state transitions, member/capability access and immutable identity. Actual HTTP tests run the Worker locally against persistent D1 and simulated private-object state and the library-backed auth flow. They exercise anonymous catalog/metadata/GLB/source/HEAD/range denial, invalid/expired/replayed login links, member-only signup, logout/session revocation, publication bypass/self-review, revoked roles with old sessions, immutable-version/approval races, vote retry/concurrency, suspension and restart persistence. Test data must not be represented as production users or external delivery success.

Provider credentials, actual outbound email/OAuth, private-origin deployment, free-tier resource/CPU measurements, backup restoration, adversarial executable sandbox checks and the member/contributor/moderator/admin browser journeys remain explicit acceptance gaps until exercised. No local development credential or test outbox is a production authentication bypass.

## API and operation

The current routes are:

| Route | Purpose |
| --- | --- |
| `/api/auth/*` | Better Auth magic-link and session endpoints |
| `GET /api/me` | Current verified member, email, display name and capabilities |
| `GET /api/account/tokens` | Own token metadata without secrets |
| `GET /api/account/sessions` | Own session metadata without tokens |
| `GET /api/account/versions` | Own contributor version/status list |
| `GET /api/review-queue` | Qualified, state-filtered review queue |
| `GET /api/admin/members?q=` | Bounded administrator member search |
| `POST /api/account/tokens` | Create a scoped token; the secret is returned once |
| `DELETE /api/account/tokens/:id` | Revoke an owned token |
| `DELETE /api/account/sessions/:id?` | Revoke one or all owned sessions |
| `GET /api/catalog?q=` | Published models, search and vote totals |
| `GET /api/catalog/:version` | Published model metadata and artifact descriptors |
| `GET, HEAD /api/catalog/:version/files?path=` | Verified private artifact bytes and single byte ranges |
| `PUT, DELETE /api/catalog/:assetId/vote` | Idempotent member vote |
| `POST /api/versions` | Create an immutable draft from a recipe/preset review subject |
| `GET /api/versions/:version` | Contributor or qualified operator inspection |
| `PUT /api/versions/:version/artifacts?path=` | Upload manifest-bound bytes to an owned draft |
| `PUT /api/review-evidence/:sha256` | Upload a qualified reviewer's immutable attachment |
| `POST /api/versions/:version/reviews` | Record an independent category review or technical attestation |
| `POST /api/versions/:version/transition` | Request an authorized state transition |
| `POST /api/reviews/:recordId/revoke` | Publisher/admin revocation with withdrawal |
| `PUT, DELETE /api/admin/members/:id/capabilities` | Other-member capability administration |
| `PUT /api/admin/members/:id/status` | Other-member suspension/reactivation |

The service uses `APP_ENV`, `APP_ORIGIN`, `AUTH_SECRET` and the D1 `DB` binding. Production mail requires `RESEND_API_KEY` and `MAIL_FROM`. Production objects require `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` and `SUPABASE_PRIVATE_BUCKET`. These values stay server-side. The adapter checks that the bucket is private before object operations. Modern Supabase secret keys use `apikey`; legacy service-role JWTs also use Bearer authorization. Uploads prohibit overwrites. No public or signed download endpoint is generated.

For local manual development, install the root dependencies and pinned nested dependencies, then run these commands from the repository root:

```sh
npm ci --prefix server
cd server
npx wrangler d1 migrations apply polyspoon-local --local
npm run dev -- --ip 127.0.0.1 --port 8793
```

Set a random secret of at least 32 characters in ignored `server/.dev.vars` as `AUTH_SECRET`. The checked-in Wrangler configuration is local-only, has a dummy database identifier and simulates R2 without activation. It is not a production deployment configuration. Local login links are held in the local D1 outbox with no HTTP retrieval endpoint. Automated tests create isolated local state and apply the SQL migrations themselves:

```sh
node --import tsx --test --test-concurrency=1 tests/server-domain.test.ts tests/server-http.test.ts tests/server-marketplace.test.ts tests/server-provider.test.ts tests/server-delivery.test.ts tests/server-full-subject.test.ts
npm run typecheck --prefix server
npx tsc --noEmit
```

For a private app release, the operator must create a separate bundle with paths rooted at `/app/`. Store each asset as `applications/<release_hash>/<path>` and insert its exact SHA-256, length and media type into the immutable `app_asset` manifest. Set `PRIVATE_APP_RELEASE` to the 64-character release hash. `/app`, `/catalog`, `/asset/*` and `/contribute` and `/editor` serve that release's `index.html`; `/app/*` selects manifest paths. The manifest and objects must be provisioned through a trusted operator path. No public client can install them. Missing configuration returns 503. Referenced modules, styles, previews and source maps must all use protected paths. The existing Vite build does not yet meet this contract.

New receipt-profile versions accept at most 256 files including `report.json`, 16 MiB total, 2 MiB per file and four attachments per review. Migrated legacy versions retain synchronous revalidation. Reads verify the complete bounded object before HEAD/range delivery. This buffers the file; it is not unbounded streaming. The unchanged original 194-file bench subject passes byte ingestion and submission. Static-model review subjects and releases outside these bounds remain unsupported. HTTP publication tests use synthetic policy evidence with real local accounts; they do not establish artistic acceptance or validate the existing catalog.

Authority changes invalidate pending approvals through a global epoch. Repeating approval rechecks current evidence and authority. A later role change does not itself withdraw an already published version. Explicit review revocation withdraws approved or published versions. Registration has no administrator bootstrap endpoint; initial trusted authority needs an operator-controlled database operation.

## Primary references

- Better Auth native D1: https://better-auth.com/blog/1-5
- Maintained magic-link flow: https://better-auth.com/docs/plugins/magic-link
- Database sessions/cookie cache: https://better-auth.com/docs/concepts/session-management
- D1 prepared statements and atomic batches: https://developers.cloudflare.com/d1/worker-api/d1-database/
- Private R2 Worker API: https://developers.cloudflare.com/r2/api/workers/workers-api-reference/
- Worker limits: https://developers.cloudflare.com/workers/platform/limits/

- Resend email API: https://resend.com/docs/api-reference/emails/send-email
- Resend errors: https://resend.com/docs/api-reference/errors
- Supabase private buckets: https://supabase.com/docs/guides/storage/buckets/fundamentals
- Supabase uploads: https://supabase.com/docs/guides/storage/uploads/standard-uploads
- Supabase API keys: https://supabase.com/docs/guides/api/api-keys

Catalog delivery capabilities come from uploaded immutable artifact descriptors. GLB requires a GLB descriptor. Source requires the exact validated recipe source-package path; an unrelated ZIP or static-only submission cannot imply executable source. Operator-seeded static fixtures test metadata delivery only; the submission/review API still accepts recipe/preset subjects.

## Hosted account and moderation reads

`GET /api/me` returns the authenticated user's maintained email and display name. Token and session lists require an interactive session and return owned metadata only, without token values, digests or other users' records. Own versions require the submission scope for agent callers. The review queue accepts only interactive verifier, category reviewer or publisher authority, returns relevant state metadata and excludes the caller's own submissions. It is a qualified work queue, not a new assignment system. Member search requires an interactive administrator, bounds the query to 100 characters and returns at most 50 records. Catalog lists return the newest published version per asset, tie-breaking equal publication times by descending version ID, plus a caller-specific boolean vote. Missing descriptions and previews remain absent.

Read payloads use `{tokens:[{id,label,scopes,expiresAt,revokedAt}]}`, `{sessions:[{id,createdAt,updatedAt,expiresAt,current}]}`, `{versions:[{id,asset_id,title,kind,state,created_at,published_at}]}` for own versions, and `{members:[{id,status,email,displayName,verified,capabilities}]}` for admin search. Review queue version rows add `contributor_id` and omit `published_at`. Catalog rows contain `id`, `asset_id`, `title`, `kind`, `published_at`, `votes` and `voted`. Lists other than member search return at most 100 rows. Metadata detail retains `design`, `artifacts` and derived `capabilities`; full contributor review subjects stay on the qualified version-inspection route.

## Hosted static wiring and document navigation

A `PUBLIC_ASSETS` binding serves only the separate public directory with Worker-first routing and both asset HTML handling and not-found fallback disabled. `PUBLIC_FILES` is a JSON array of exact URL paths. Static delivery requires both a matching allowlist entry and a public prefix (`/public-assets/`, `/brand/` or `/agent-bundles/`). Only `/`, `/docs`, `/sign-in`, `/help` and `/legal` map to the listed public `/index.html`. Private release manifests are never included. No unknown path uses a public index fallback.

Unauthenticated GET navigation to `/catalog`, `/asset/<version hash>`, `/contribute` or `/editor` with `Accept: text/html` and no Range redirects to fixed `/sign-in`. APIs, private app assets, HEAD and range requests retain authentication errors and no-store. Restricted members receive 403 with an explicit access restriction; they do not loop through login.

The local helper is `localService(directory, secret, initialize=true, options={})`. Options are `port`, `appOrigin`, `publicDirectory`, `publicFiles` and `privateRelease`. The default port remains 8793; hosted browser fixtures can select 8794. The directory holds persistent D1/object state and generated local Wrangler configuration. Origins must match the chosen loopback port. Pass the exact public directory and `Object.keys(publicManifest.files).map(path=>'/'+path)` from the `{formatVersion:1,files:{relativePath:{sha256,bytes,media_type}}}` public manifest. Private fixture provisioning uses the returned `env.LOCAL_OBJECTS.put(key,bytes)` and prepared `env.DB` inserts into `app_asset`. The returned `stop()` releases the service and proxy. The helper neither builds frontend assets nor publishes resources.

## In-flight authority changes

State-transition and review-revocation writes must check the acting member's current active status, verified email and required capability in the same SQL statement that changes state. Contributor transitions also check ownership at write time. A principal loaded earlier cannot authorize a write after role loss, suspension or verification revocation. Publication's review authority epoch and revision guards remain additional requirements. Revocation retries remain idempotent for currently qualified moderators. Deterministic regression tests change authority after principal authorization and before the authority snapshot or write, using the real D1 database rather than only a later request.

Model detail returns `votes` and caller-specific boolean `voted` from the same published-version SQL read. Vote state is keyed by asset identity, matching catalog lists and vote mutations. Reload after a set or deletion reads current database state; another member sees the same count and their own independent vote state.

Admin role and status mutation batches check current active, verified administrator authority for every guarded write, including suspension session/token revocation. A guarded no-op caused by lost authority returns 409 and records an attempt, without claiming a successful change. Authorized repeated grant/revoke requests retain idempotent success.

Published model detail exposes `recipe: {id,version,deliveryRevision} | null` from the sealed recipe/preset subject and `sourcePackage: {path,sha256,bytes,media_type} | null` for its exact uploaded source-package descriptor. The source path uses the existing canonical source package filename authority. Static models and unrelated ZIPs cannot imply an editable recipe. `design` retains the existing selected design. These facts do not authorize executing submitted JavaScript; clients activate editing only for their own exact trusted built-in implementation/package identity.

## Receipt extension contract

New versions use the server-derived `receipts-v1` profile; migrated versions use `legacy` and retain synchronous validation. Full-subject admission permits 256 files including the report, 16 MiB total and 2 MiB per file. Every artifact PUT validates input and one storage readback before atomically recording readiness. A newer observed failure fences older successful reads. Receipt identity binds the immutable version/path/digest/length and therefore the sealed subject, manifest and report. Exact proof completeness joins the current actor/authority predicates in transition SQL.

`GET /api/versions/:id` adds `verification: {profile,totalFiles,totalBytes,uploadedFiles,verifiedFiles,complete,pendingPaths,failedPaths}`. Arrays contain exact manifest paths, including empty files. Existing upload responses retain `uploaded:true` and add `verified:true` only after readback succeeds. Protected `GET, HEAD /api/versions/:id/files?path=` uses existing owner/qualified-inspector authorization and fresh full-object hash checks before range/HEAD delivery. Publication metadata does not guarantee future storage availability. Every serving/processing/review read fails closed on missing or changed bytes; observed failures clear current byte readiness until a new correct read.

For `receipts-v1`, failed paths also appear in pending paths. Clients resume the union, deduplicated; the arrays are not disjoint. `complete` is computed from current exact server receipts and uploaded flags. Legacy completeness describes its historical upload prerequisite; approval still performs synchronous byte validation.

Receipt-profile publication uses one joined proof query for every referenced attachment; all record shape/reference checks remain in memory. The populated 16-record/49-reference policy fixture measured seven metadata statements before and after population, with no object reads. Legacy revalidation remains separate. Missing/changed byte observations update failure fencing and append audit events atomically; successful receipt facts remain immutable.

Stored artifact or review-attachment oversize is a known missing/changed observation: normalize local object-size and streamed read-limit errors to the same fenced readiness failure. Preserve the bounded read and stream cancellation. Incoming oversized uploads and provider quota/service errors do not invalidate stored-byte integrity facts.

### Protected review inspection

`GET /api/versions/:id/reviews` returns immutable technical and human records with `createdAt` and the current `revocation` reason/time, or null when unrevoked. It uses the existing owner or qualified-inspector boundary. Guests are denied. The response exposes no credentials. It returns at most 100 records and a `truncated` flag; a truncated view does not establish complete inspection.

`GET/HEAD /api/versions/:id/reviews/:recordId/files?path=` serves only evidence referenced by that exact version-bound record. Original inputs reuse the sealed artifact read path. Review attachments reuse the recording reviewer's digest/byte descriptor and fresh readback checks. Observed corruption invalidates the receipt; verified recovery retains failure-revision fencing.

The hosted review queue provides Inspect reviews and Inspect declared views. Review text is rendered as text, including observations and revocation reasons. Downloads verify exact descriptors before saving. Declared raster previews use authenticated sealed input bytes, SHA-256 checks and bounded PNG/JPEG identification. Preview images are limited to 2 MiB, 8192 pixels per axis and 16,777,216 pixels total. Session changes dispose their object URLs. These panels neither execute submitted source nor grant approval.

### Published model delivery scope

Catalog metadata and its GET/HEAD/range byte gateway use the same explicit delivery selector. Primary downloads are only `selected.glb`, `selected.design.json` and the exact versioned source package named by `subject.recipe`. Declared raster evidence must belong to a case in that subject and match its sealed descriptor. Reports, logs, validation files, other-family archives and standalone modules remain on authorized version/review routes; guessed catalog paths are denied.

Catalog detail returns `delivery.primary`, `delivery.previews` and `delivery.preview`. The primary preview comes only from the declared `selected` case, preferring its oblique view. A preset view cannot stand in for a missing selected preview. The hosted model page shows only the primary download controls and bounds the preview image inside its desktop/mobile frame without cropping. This does not change the sealed manifest, input bytes or recorded reviews.
