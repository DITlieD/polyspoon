# Free-only hosted release operations

Production uses one explicitly configured Cloudflare Worker with D1, an exact public asset manifest, Supabase private objects and Resend transactional login mail. The local Wrangler config remains local-only. Production must contain no R2 binding, local object binding, local mail sink, paid-plan selection, automatic overage setting or alternate origin fallback. Root `npm run build` is not the hosted deployment artifact; use the separately verified hosted public/application release.

The production target is `https://polyspoon.com`, Worker and D1 name `polyspoon-production`, and private bucket `polyspoon-private`. Existing unrelated resources are preserved. Worker preview URLs and workers.dev exposure stay disabled. Public assets use the public build only, with worker-first routing and no automatic SPA fallback. Private application assets stay behind authenticated manifest lookup and the private object gateway.

## Required provider proof

A Free Website zone does not establish a Workers Free account. Before remote writes, verify the actual Workers plan, Supabase organization/project plan, Resend account plan and remaining shared account quotas. Do not enable a paid subscription or paid overages to pass a check. Project/API-key access alone does not prove billing configuration. Record account evidence privately; credentials, raw account responses and owner contact details never belong in source or deployment reports.

Workers Free currently permits 100,000 requests/day and 10 ms CPU per invocation. D1 Free includes 5 million rows read/day, 100,000 rows written/day and 5 GB total storage. Actual execution must meet the Free CPU limit; local response time is not CPU qualification. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/).

Supabase Free currently includes 1 GB file storage and 5 GB egress, and inactive Free projects may pause after a week. Free-plan use does not incur charges; a spend-cap setting on another plan does not make that plan free. Application reservations must leave room for private application releases, backups and unrelated usage. [Supabase pricing](https://supabase.com/pricing), [spend cap](https://supabase.com/docs/guides/platform/spend-cap).

Resend Free currently permits 100 transactional messages/day and 3,000/month, including received mail and account-wide recipients. The application reserves at most 90/day and 2,700/month before provider calls, but other account activity can consume that margin. Verify the sending domain and actual delivery before launch. Failed or unknown sends remain charged locally and are not blindly retried. [Resend quotas](https://resend.com/docs/knowledge-base/account-quotas-and-limits).

## Release preflight and configuration

Preflight verifies both hosted manifests, exact file inventories, digests, byte counts, private release identity and allowed public paths before generating a production config. Private files must fit the existing 2 MiB object-read limit. Public file-list variables must fit Workers environment-variable limits. Reject symlinks, traversal, undeclared files and public imports of private application/model modules. A preflight pass does not replace source or browser review.

Configuration generation is local and explicit. It requires actual account/database bindings and the frozen hosted release. It does not create resources, upload secrets, deploy or activate a domain. Secrets are supplied through private operator files/stdin only; no production key or owner address is embedded in committed config.

## Remaining activation gates

Review exact proposed remote operations and verified free-plan status before creating a project Worker/D1/private bucket or changing routing. Apply migrations to the intended D1 database without resetting existing state. Provision and read back immutable private assets, register their exact manifest, set production origin and secrets, and bootstrap only the verified deployment owner's account through an operator-controlled path. Ordinary signups never gain administrative authority.

Authentication throttling must use a trusted platform address, ignoring arbitrary forwarded headers. Cloudflare same-zone Worker subrequests can affect CF-Connecting-IP through x-real-ip; review trusted ingress and Pseudo IPv4 configuration before relying on address controls. [Cloudflare request headers](https://developers.cloudflare.com/fundamentals/reference/http-request-headers/).

Processing remains the existing isolated operator-pull service. Missing operator capacity leaves jobs pending and must be visible operationally. No unreviewed production profile or rig safety dependency is enabled as a deployment shortcut. F5 rig integration remains a separate production safety gate.

Back up D1 and the matching private object inventory outside the source repository before migration or activation. D1 Free Time Travel currently retains seven days, but it does not back up Supabase object bytes. Restore drills must prove matching bytes and prevent stale database state from reviving revoked authority, tokens or withdrawn publications. Roll back application code/release independently of current data when possible. A point-in-time data restore requires quarantining authority and publication until current restrictions/revocations are reconciled. [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/).

Final activation requires actual hosted authentication, mail delivery, anonymous denial, current membership/role revocation, protected byte downloads, provider limits, backup recovery and rollback evidence. Provider readiness and local tests alone do not establish full production readiness.

## Operator preparation

Run `node --import tsx server/deployment.ts --release FROZEN_HOSTED_RELEASE --out NEW_PRIVATE_DIRECTORY`. This verifies local inputs and writes a private operation-plan file. It performs no network calls or deployment. Migration SQL files are discovered and hashed dynamically, including later additions; no last migration number is pinned. Regenerate the candidate after source, package, runtime or migration identity changes.

To also generate the explicit production Wrangler config, supply `--bindings PRIVATE_BINDING_FILE`. The mode-0600 input contains only `account_id`, actual `database_id` and `supabase_url`. Do not substitute the local dummy database ID. Generated files remain private and are not committed. Supplying a config does not authorize running deployment commands. The operation plan keeps activation disabled pending review and qualification. A controlled preactivation qualification origin must be reviewed separately; do not enable an account-wide workers.dev subdomain or alter unrelated routes as a shortcut.

`server/owner-bootstrap.ts` exposes an operator-only D1 batch helper, not an HTTP endpoint. It grants admin only to the expected email's active, verified member when no admin exists, verifies the exact resulting owner and writes one audit event. Repeating a successful bootstrap is harmless. A missing, unverified or suspended owner, or an existing different admin, fails closed. Complete the owner's actual maintained email login before bootstrap. No signup payload can request this authority.

## Backup, recovery and rollback

Before changes, record the currently active Worker version, private release hash, migration hashes, D1 recovery bookmark and provider usage privately. Export D1 to a private local SQL file through the authenticated operator tooling. Inventory required Supabase object keys, digests and sizes, and retain matching immutable originals or verified downloads within the remaining free egress budget. D1 SQL alone cannot restore private objects. Keep secrets separately in private recovery storage; never include them in a source repository or public artifact.

Test an export/import in an isolated database before a production restore. `server/recovery-quarantine.sql` is an explicit post-restore safety step: it withdraws approvals/publications, revokes tokens, removes sessions and capabilities, disables processors/profiles and restricts restored active members. It retains version/artifact/review/audit history and creates recovery restriction notices. Repeating it does not revive authority. This SQL is intentionally not applied by the preparation command.

Keep routing closed during data restoration and quarantine. Reconcile current restrictions and review revocations, verify the expected owner through maintained login, then explicitly restore the owner's active status and bootstrap authority through the operator path. Restore other authority only after review. Do not automatically republish versions or revive old tokens from a backup. A local SQLite export/import drill validates quarantine semantics; it does not prove remote D1 Time Travel or Supabase restoration.

For an application-only rollback, retain the current database, auth secret and revocation state and select the previously verified Worker/private release. Recheck manifest identities, authenticated and anonymous behavior and required schema compatibility. Do not roll back D1 merely to roll back code. After either rollback, perform a bounded current-authority and byte check before reopening routing.


## Worker bundle and runtime qualification

The official Worker-size documentation checked on 24 October 2026 specifies a 64 MiB uncompressed script limit for Workers Free and Paid. It lists no compressed-size limit. Record Wrangler's Total Upload and gzip values separately; the gzip figure is reference data. This policy is separate from the private object gateway's 2 MiB per-file limit. Recheck the official policy for each final release. [Worker size](https://developers.cloudflare.com/workers/platform/limits/#worker-size).

Run Wrangler's local dry-run against a review config and capture its upload report. Pass that log with `--bundle-log PRIVATE_LOG` when preparing the candidate. Oversized or missing/malformed size data cannot qualify a bundle. A successful local bundle check establishes neither the one-second startup requirement nor the Free request CPU budget. The final coherent source, assets, package and processor runtime identities must be qualified together on the actual Free service before activation.
