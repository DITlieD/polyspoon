# Contribution review

## Private/local creation

A human requests an asset from their own agent. The agent owns creation, validation, visual review, repair and delivery. Human testers, outside-human reviewer counts, external-pilot participation and human aesthetic approval are not required. Source/dependency review and appropriate execution isolation still apply; external executable submissions retain the review boundary below.

Record the exact source revision, recipe version, presets/cases, technical results, visual findings and unresolved blockers. A passing technical check does not establish visual quality. Claims cover the cases actually checked; do not approve arbitrary slider combinations or invent reviews.

## Bound evidence to the attempt

Bind the exact request, selected design, source and dependency lock, recipe/toolchain and delivery versions, control cases, terminal verification report, artifacts and rendered views. A repair creates a fresh subject and evidence. Retain failed attempts; never turn a failed terminal result into a successful technical report. Changed source or artifact bytes invalidate the earlier binding.

Keep technical, visual, portability and executable-source/provenance decisions separate. Visual findings name the part, view, observation and evidence path. Failed or uncertain findings also state the defect and proposed correction. Record tested cases and unresolved limits. An inconclusive view cannot prove the defect is absent.

## Public contribution scope

The submission sections below describe provenance, licensing and review requirements for public contributions. They do not describe implemented marketplace submission processing. Local authoring is supported. Public submission processing and hosting are not configured yet. Publication needs separately trusted application-held verification and review records. The local evidence workflow is not an authenticated submission service or a security sandbox.

## Preset-only submission

Record recipe ID/version, parameter JSON, submitter's authorship/provenance declaration, intended content license, neutral views and the source revision. Confirm the diff changes only configuration/content. Load it through the existing reviewed generator, validate supported bounds and saved-design round trip, export GLB, inspect appearance and test the declared Unity import workflow. Record any aid or export repair required.

## Executable submission

Before execution, review all added source, dependency changes, import paths, file/network/process access, license notices and provenance. Never run submissions automatically in a website/API or a credential-bearing development environment. A JavaScript VM is not a security boundary. Choose an isolated execution environment after review. Check all source-package members and pinned dependencies, then run behavior tests and export/integration checks.

A hash proves the inspected bytes match a manifest; it does not establish trusted authorship. Reject secrets, path traversal, symlinks, unknown imports, unapproved dependencies and unexplained external assets. Do not assign third-party licenses on a contributor's behalf.

## Approval record

Record contribution link/revision, author, recipe version, reviewed presets/cases, provenance/license permission, technical results, visual notes, reviewer identities and unresolved blockers. Approval covers those exact versions/cases. New versions and arbitrary parameter combinations require new evidence.

Maintainer-curated alpha is the current claim. Record the reviews actually performed and who or what performed them. Agent visual review is valid evidence for local delivery; it does not establish public moderation approval or permission to redistribute. Executable submissions still need maintainer code review. Publication requires independent authorized review and the required capabilities. The author cannot self-review for publication. One qualified independent reviewer can cover multiple categories; no fixed human or model count applies to local creation. Contributor-supplied, forged, stale, mismatched or uncertain reports cannot establish eligibility. Separately held trusted records remain an application responsibility. Keep unresolved substantiated blockers visible. Do not claim broader community approval, fabricate reviewer identities or present votes as evidence of checks that were not performed.

Passing executable-source and portability records must cite the selected source ZIP bound to the subject. Passing portability also needs `selected.glb` and a hashed independent replay attachment with actual rebuild/comparison evidence. Attachment presence alone does not prove replay. A passing source inspection covers dependencies, imports, licenses, provenance and redistribution. Failed or uncertain source records may report partial inspection truthfully, with explicit redistribution scope.

## Local eligibility check

After real technical verification and review, the application or maintainer selects a separate trusted store. Its `authority.json` uses format 1 with `principals`, `assignments`, `technical`, `reviews`, `revoked` and `replaced`. Principals have `id`, `active` and category `capabilities`. Technical/review entries bind each store-relative record path, `recordId`, `sha256` and `bytes`. Assignments select technical and review record IDs for the exact subject. See [authority types](../../src/review/types.ts) and [store loading](../../src/review/publication.ts).

```sh
npm run recipe:review -- eligibility --subject evidence/authoring/bench-review-01/subject.json --trusted-store evidence/review-authority --contributor contributor-id --out evidence/authoring/bench-review-01/eligibility.json
```

The store must be outside the contributor's sealed run. The caller chooses it separately; uploaded contributor JSON cannot supply its own authority. A store fixture is not authenticated trust. The evaluator checks exact subject/evidence bindings, separately held technical records, category capabilities, complete exercised coverage and independent reviewer identity. Missing, uncertain, conflicting, revoked, replaced, forged or mismatched records cannot establish eligibility. A qualified independent reviewer can cover multiple categories.

Exit 2 means valid but ineligible; exit 1 means invalid inputs or an evidence error. A passing local result is eligibility evidence only. It neither publishes an asset nor authenticates a reviewer. Authenticated identities, protected storage, isolated jobs and server-owned publication transitions remain future services. See [record creation and validation](../authoring/guide.md#bind-review-evidence) before using this command.

## Quality checklist

Evaluate silhouette/readability, coherent proportions, supported construction, deliberate palette/material roles, useful parameter effects and restrained detail in neutral views. Check topological/export failures separately. Record default, boundaries, presets and interacting cases explicitly. Document unsupported animation, rigging, terrain or renderer features rather than implying broad compatibility.
