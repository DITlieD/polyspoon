# Marketplace moderation

All application responses are private and uncached. Mutations require a verified interactive session and same-origin request, except existing explicitly scoped submission APIs. Scoped tokens cannot report, moderate, appeal, administer or load the application shell. Current membership and moderation authority are checked again in mutation SQL.

## Reports and moderation

POST `/api/catalog/:versionId/reports` accepts `{category,reason}` for a published version. Categories are `unsafe`, `rights`, `misleading`, `other`; reason is 1–1000 characters. Response 201 `{id,status:"open"}`. Repeating the same reporter/version returns 200 with its existing ID and status. Each member may create ten reports per rolling day.

GET `/api/account/reports` returns only the caller's records: `{reports:[{id,versionId,category,reason,status,createdAt,decisionReason}],nextOffset}`. Records sort newest first. Reporter identity is never included in catalog or moderator report DTOs.

GET `/api/moderation/reports` requires `moderator` or `admin`. It returns `{reports:[{id,versionId,title,category,reason,status,createdAt,decisionReason}],nextOffset}`. POST `/api/moderation/reports/:id/resolve` accepts `{decision:"dismiss"|"withdraw",reason}` and returns `{resolved:true}`. Report statuses are `open`, `dismiss`, `withdraw`. Decisions require a 1–1000 character reason. Withdrawal is terminal for the version and creates an audit event atomically with resolution.

Moderators cannot grant roles, suspend members, act on themselves or act on admin-owned content. Admins cannot act on their own content. Existing role/status administration remains admin-only and the capability enum adds `moderator`.

## Restriction and appeals

GET `/api/me` remains available to suspended verified members. Existing identity fields remain, with `status:"suspended"`, `capabilities:[]` and `scopes:null`. Missing or expired authentication remains 401. Restricted sessions may load `/app`, `/app/*`, `/catalog` shell, own notice and appeal endpoints. Restricted HTML document navigation to `/asset/:id`, `/editor` or `/contribute` redirects to the allowed `/catalog` notice/appeal shell. Other application APIs return 403 `{error:"account_restricted"}`. Maintained magic-link authentication and `/api/auth/sign-out` remain available.

GET `/api/account/restriction` requires an interactive session, including for active members reading retained notices. Scoped tokens receive 403 `interactive_session_required`; `/api/me` token introspection remains available. It returns `{status,reason,restrictedAt,appeal}`. Appeal is null or `{id,message,status,createdAt,decisionReason,restrictionReason,restrictedAt,actionable}`. POST `/api/account/appeals` accepts `{message}` of 1–1000 characters and returns 201 `{id,status:"open"}`. Each restriction revision permits one appeal. Duplicates return 200 with the original ID and current status.

GET `/api/moderation/appeals` requires moderator or admin and returns `{appeals:[{id,memberId,message,status,createdAt,decisionReason,restrictionReason,restrictedAt,actionable}],nextOffset}`. POST `/api/moderation/appeals/:id/resolve` accepts `{decision:"uphold"|"reinstate",reason}` and returns `{resolved:true}`. Appeal statuses are `open`, `uphold`, `reinstate`, and derived `superseded`. Each appeal snapshots the restriction reason and time. `restrictionReason` and `restrictedAt` are nullable only where historical snapshot facts are unavailable. `actionable` is true only for an open appeal matching the current restriction revision while the member remains suspended. An old open appeal becomes `superseded` after a changed restriction or direct admin reinstatement. These items remain pageable history with `actionable:false`. Resolution rechecks current suspended status, revision, authority and self/admin-target guards in the mutation. A stale resolution returns 409 `authority_or_record_changed`. Reinstatement never restores revoked tokens or republishes withdrawn versions. An identical admin PUT of suspended status and the same reason preserves the restriction revision, time, pending appeal and restricted login session. A changed reason, or a new suspension after reinstatement, creates a new restriction revision.

All list endpoints above accept `?offset=0` and return up to 50 records with `nextOffset` or null. Report queues sort open first, oldest first, then ID. Appeal queues sort actionable current appeals first, oldest first, then ID. Restart at offset zero after resolving items. An exact repeat of a terminal decision and reason returns 200. A different terminal decision or reason returns 409 `already_resolved`.

## Temporary address blocks

GET `/api/admin/address-blocks` accepts `?offset=0` and returns `{blocks:[{id,addressHash,reason,expiresAt,createdAt}],nextOffset}`, up to 50 current blocks ordered newest first, then ID. POST accepts `{address,reason,expiresInSeconds}` with a valid IPv4/IPv6 address, a 1–1000 character reason and 60–86400 seconds; response 201 `{id,addressHash,expiresAt}`. Repeated addresses update the existing block. DELETE `/api/admin/address-blocks/:id` returns `{removed:true}`. Admin-only mutations recheck current authority and write audit events.

IPv4 octets are validated; IPv6 uses the platform URL parser for canonicalization. Both admin input and trusted request addresses use the same canonicalization before HMAC-SHA256 with AUTH_SECRET. No raw address persists. Blocks are explicit temporary network controls, never automatic membership bans.

Production enforcement requires request.cf metadata and uses only `CF-Connecting-IP`. Local mode ignores every address header. Arbitrary forwarded headers are never used. Blocked addresses receive 403 `address_temporarily_blocked` only for POST/PUT submission routes, evidence uploads, token creation, reporting and processor mutation routes. Login, signout, own notice/appeal, shell, existing reads and admin reversal remain accessible.

Cloudflare documents a same-zone Worker subrequest exception: another Worker can alter x-real-ip, which affects CF-Connecting-IP. Deployment must preserve trusted ingress and review same-zone Workers and Pseudo IPv4 settings. Local synthetic metadata checks do not establish production ingress configuration. Source: [Cloudflare request headers](https://developers.cloudflare.com/fundamentals/reference/http-request-headers/).

## Admission and authority loss

Application limits are 90 mail/day and 2700/month globally; ten outstanding versions/member and 100 globally; source reservations 64 MiB/member and 512 MiB globally; evidence 32 objects and 32 MiB/member and 128 MiB globally; processing output reservations 128 MiB globally; ten active tokens/member; 100 processing jobs/day globally. Day/month boundaries use UTC; report windows roll over 24 hours. Source reservations charge the whole immutable descriptor manifest before creation. Evidence and processing reservations precede object writes. Migration backfills existing source, evidence and processing bytes. Additive migration 0008 snapshots existing appeals only when their bound restriction revision still exists; unavailable older reasons/times remain null. Failed or unknown writes retain reservations. Repeating an identical reservation does not charge twice.

Mail reserves before local outbox or provider calls. Failed or unknown sends retain charges and are never blindly retried. Exceeding admission returns 429 with `mail_budget_exhausted`, `storage_budget_exhausted`, `submission_budget_exhausted`, `token_budget_exhausted`, `job_budget_exhausted` or `report_budget_exhausted`. Provider failures remain 503 `mail_provider_unavailable`. Budget accounting covers this application's calls and reservations; external provider use, egress, live settings and free-plan enforcement remain release checks.

New subjects allow at most 64 declared views, counting duplicates. Existing sealed subjects remain unchanged. Loss of a required publisher/reviewer capability, verified membership, processor configuration or processing profile withdraws dependent approved/published versions. Restoring authority never republishes them. DB admission also rejects stale unverified/restricted member writes.

Other errors use `{error}`: 400 invalid input, 403 capability/target forbidden, 404 missing record, 409 authority/restriction/record changed, 503 unavailable configuration. No remote provider resources are created by this implementation.

Catalog list, detail and vote mutation responses count only votes from current active, verified members through one shared SQL count rule. Vote rows remain for audit. Legitimate membership or verification restoration restores each retained vote once; repeated PUT does not add duplicates. Totals depend on current membership, with indexed membership/user lookups for each matching vote.

An owner may withdraw a `changes_requested` version with a bounded reason to free one outstanding submission slot before submitting replacement immutable source. Withdrawal retains bytes, descriptor history and storage reservations. Wrong owners and tokens without `submissions:write` remain denied; quota values and other transition states are unchanged.
