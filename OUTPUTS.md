# Polyspoon

## Current hosted application

The authenticated local application has separate public and private builds. Nothing is deployed to `polyspoon.com` yet. Local provider simulations do not establish live email, storage or free-tier execution readiness.

| Saved capability | Review and limits |
| --- | --- |
| Accounts, private catalog, votes and review controls | [Local API review](server/test-evidence/main-review.json), [browser review](hosted/verification/main-review.json). Saved API `30beeec5c`, UI `9063afebe`. |
| Authenticated recipe customization | [Editor review](hosted/verification/editor/main-review.json), [390 px review](hosted/verification/editor/mobile-390/main-review.json). Saved `29c474752` and `2f0f3242f`. Bench browser coverage; twelve trusted package identities checked. |
| Full verification uploads and resume | [Submission UI review](hosted/verification/full-submission/main-review.json), [194-file browser receipt](hosted/verification/full-submission/full-submission-receipt.json), [server receipt review](server/test-evidence/full-subject-main-review.json). UI saved `bd000611f`; local byte ingestion and submission are reviewed separately from processing and publication. |

Isolated processing is complete for the reviewed local scope. The unchanged original bench completed 19 cases and five stages, then reached awaiting review at the processing milestone. Its three processing artifacts pass authenticated GET/HEAD hash and byte checks; guests are denied. The hosted UI shows processing status, deliberate Refresh, corrected-version guidance and verified evidence downloads. See [actual processing review](server/test-evidence/processing-original-main-review.json), [hosted UI review](server/test-evidence/processing-ui/main/review.json), [mobile correction view](server/test-evidence/processing-ui/correction-mobile.png) and [source and checks](server/test-evidence/processing-source-ready.json).

F6-5 is complete for the reviewed local bench. Actual independent visual, portability and source findings led to UI approval and publication. Catalog delivery exposes three primary downloads and thirteen declared raster views; all other sealed inputs remain restricted. Download hashes, selected-preview containment, votes and width editing/reset pass. Actual UI revocation then intentionally withdrew this test version and blocked catalog delivery. See [final workflow](server/test-evidence/publication-original/published-workflow-main.json), [published delivery checks](server/test-evidence/publication-original/delivery-scope-main-after.json) and [withdrawal checks](server/test-evidence/publication-original/revocation-main.json).

F6-6 reports, appeals and enforcement pass [local endpoint and browser review](hosted/verification/community-moderation/main-review.json). F6-7 individual name, style and type discovery passes [local catalog review](hosted/verification/catalog-discovery/main-review.json). F5 catalog/package integration and F7 deployment/operational readiness remain open in the [current release gates](PLAN.md). The next repository release is private; domain setup and the private push follow readiness checks. Public repository access and Reddit posting remain pending review. Free-only constraints remain. The original catalog preview described below remains available independently of the hosted application.

The [rigged adventurer preview](http://127.0.0.1:4174/rigged.html) demonstrates a parameterized humanoid with real skinning, idle/walk clips and flat-ground foot IK. [Desktop/mobile and imported-export review](evidence/rigged-humanoid/main-review/review.json) records the corrected hairline, gait and portable faceted normals. The standalone humanoid and fox previews are complete for their recorded local scope; fox is saved in `81cafd6b`. Catalog/package integration and target-engine playback remain unfinished.

The [agent setup page](http://127.0.0.1:4174/docs) now provides one toolkit archive and app-specific setup text. The local installation milestone is saved in `da7b760ba5c2b5c5965e7ccef73cf7c8769f7992`; see [actual installation and browser review](integrations/agents/verification/main-review.json). The existing frozen release remains on port 4173 while the current development preview runs on port 4174.

Twelve procedural model families now have revised construction, 36 presets and versioned source/module downloads. Built-ins use 0.6.0; contributed recipes use 1.1.0. Supported older designs keep validated parameters and named part colors, with a clear construction-change notice. Browser GLB, ZIP and snapshot exports preserve that notice.

Open the [Polyspoon landing page](http://127.0.0.1:4173/), [individual model catalog](http://127.0.0.1:4173/catalog), [guides](http://127.0.0.1:4173/docs) or [cottage editor](http://127.0.0.1:4173/asset/cottage). The original spoon identity and domain branding now span the site. Discovery has search, Type, Style, Poseable parts and sorting, with no kit grouping. Filters survive model navigation and history, including visits through home and docs.

The [grouped model editor](http://127.0.0.1:4173/asset/stone-well) keeps the preview visible beside Shape, Construction, Materials and Parts controls. Parts can be filtered by name. Inactive controls agree across sliders and numeric fields. Invalid edits block both current-design downloads and copyable snippets until corrected or cancelled. Source/module failures have a visible Retry action and verify downloaded bytes.

- [Editor code, visual and endpoint review](evidence/revision13/editor/main-review.md)
- [Released construction inspector](evidence/revision13/editor/main-browser/live-editor.png)
- [Actual migrated-design and artifact verification](evidence/revision13/editor/main-browser/final-download-review.json)
- [Editor promotion and rollback](evidence/revision13/editor/layout/promotion/verification.json)

- [Identity, documentation and actual endpoint review](evidence/revision13/identity/main-review.md)
- [Reviewed landing page](evidence/revision13/identity/main-browser/home-final.png)
- [Exact local promotion and rollback](evidence/revision13/identity/site/promotion/verification.json)

- [Catalog code and actual browser review](evidence/revision13/discovery/main-review/review.md)
- [Final catalog view](evidence/revision13/discovery/main-review/catalog-final-copy.png)
- [Actual edited well download verification](evidence/revision13/discovery/main-review/download-verification.json)

- [Construction, code and actual-download review](evidence/revision12/delivery/main-review.md)
- [Current shared-scale models](evidence/revision12/delivery/shared-scene/workshop-garden-oblique.png)
- [Edited cottage reloaded in the browser](evidence/revision12/delivery/main-browser/cottage-reloaded-fullscreen.png)
- [Original model and contact review](evidence/revision12/art/main-review.md)
- [Furniture, props, conifer and boulder review](evidence/revision12/art/propagation/main-review.md)
- [Saved-design migration](docs/construction-migration.md)
- [Procedural module usage](docs/authoring/procedural-modules.md)
- [Semantic anchors and rigid joints](docs/authoring/semantic-contract.md)

Construction-release verification includes 154 unit checks, 51 clean-consumer cases, six CLI/MCP tests and three production-browser tests. A final export-metadata correction adds actual GLB/ZIP/snapshot coverage and ten affected checks. Its code does not change geometry, rendering or package dependencies, so earlier visual and full-suite evidence retains its original provenance. Independent browser downloads and served-file checks are recorded. All 120 older versioned files remain unchanged.

Construction-release source: `34a6a829ec9c005e28abf9d668ffeb2b9ce6c4528f1ce3adaf2dadb6dd31bb1d`. Browser and CLI geometry bytes match for the edited cottage; one material color-factor difference is 5.55e-17. Review covers the recorded views, presets and boundary cases. It does not establish every possible combination or user aesthetic acceptance.

The current local release is source `cd31fbc43f0edbe22151d74c4a48a10bf53c052813ee020835189de356157fea`, with 299 verified served files. Source delivery revision 2 preserves validated migration notices. Existing module releases retain their exact runtime and documentation. The review CLI binds technical, visual, source and portability records to exact artifacts and rejects stale or unauthorized local evidence. The local authority fixture does not provide hosted authentication or publication.

- [Review-system code and actual endpoint results](evidence/revision14/main-review.md)
- [CLI eligibility checks and deliberate negative cases](evidence/revision14/main-cli/endpoint-review.json)
- [Actual browser download and source rebuild](evidence/revision14/main-browser/replay/REPORT.json)
- [Promoted cottage editor](evidence/revision14/main-browser/live-polyspoon-cottage.png)
- [Exact promotion, rollback and cleanup](evidence/revision14/delivery/promotion/REPORT.json)

The previous editor release retains its own eight-suite and focused layout/readiness evidence. Current review coverage adds a complete bench workflow, 13 inspected bench images, migrated cottage captures, actual package replays and two affected production-browser suites. F3 native Unity review remains pending resource capacity. Environment and marketplace work proceed independently in the [current plan](PLAN.md). The hosted catalog will require sign-in; public visitors get landing, documentation, auth and legal pages. `polyspoon.com` is owned, but nothing is deployed. Cloudflare, Supabase and Resend are the current free-only hosting targets; production configuration and verification remain pending.

The [research audit](evidence/revision9/research-audit/report.md) and [marketplace architecture](evidence/revision9/research-audit/marketplace-scope.md) retain the research findings and limits. Three free reference families were privately inspected. Vendor assets remain outside product distribution and benchmarks.

## Woodland Workshop catalog baseline

Twelve procedural families now offer 36 presets, construction controls, semantic colors, saved designs and editable source downloads. The planter, chest, wheelbarrow, well and conifer are integrated into the shared browser, CLI and MCP catalog.

The chest opens around its hinge; the wheelbarrow supports solid and spoked wheels; the well has roof, mechanism and bucket controls; the planter has board courses and feet; the conifer has crown tiers. These mechanisms produce static geometry. Animation belongs to a later milestone.

- [Catalog verification](evidence/revision7/catalog/report.md)
- [Visual and browser review](evidence/revision7/catalog/main-review/visual-review.md)
- [Fifteen new-family presets](evidence/revision7/catalog/main-review/preset-review.png)
- [Shared workshop scene](evidence/revision7/catalog/scene-renders/workshop-garden-oblique.png)
- [Source and evidence identities](evidence/revision7/catalog/source-receipt.json)

Steps F1 and F2 are complete for their recorded coverage. F3 Unity source and Editor evidence exist, with final review and save pending. Environments, rigged characters/animals and the submission marketplace remain. The revised R2 upgrades precede F3; hosting is held until F7.

## Earlier authoring-kit milestone

Give your agent this software and your asset request. The agent owns creation, validation, visual review and delivery; a human tester is not an acceptance prerequisite.

Open the local [catalog](http://127.0.0.1:4173/), [bench editor](http://127.0.0.1:4173/asset/bench), or [contributor page](http://127.0.0.1:4173/contribute). These links require the local preview server.

Seven original procedural recipes have editable source ZIP downloads. The six matching woodland families retain construction and appearance controls; the bench demonstrates adding a recipe through one registration shared by browser, CLI and MCP.

- [Authoring guide](docs/authoring/guide.md) and [starter](examples/recipes/starter/README.md)
- [Contribution rules](CONTRIBUTING.md)
- [Desktop editor](evidence/revision5/review/production-desktop.png) and [mobile editor](evidence/revision5/review/production-mobile.png)
- [Unity bench views](evidence/revision5/unity/contact.png)
- [Review and limitations](evidence/revision5/final/review.md)
- [Verification and build hashes](evidence/revision5/final/verification.json)
- [Independent source-package results](evidence/revision5/packages/portability.json)
- [New-recipe workflow proof](evidence/revision5/contributor-smoke/README.md)

48 unit checks, five integration checks and two production-browser checks passed. Seven ZIPs rebuilt across 14 configurations; an extracted source edit changed geometry. Four new Unity variants produced ten stable captures. The 37 existing Unity exports remain byte-identical to earlier verified inputs.

Source: 1fa2a263b3e8b4d038f6ddca70b87f3b88aad5f277b38e60186399e0ce7743b3. Source, assets, documentation and selected evidence are saved in acfb22259af0b0685c9dfe0de7f408084e2a9f66. The corrected instructions are now served from agent-first-build; all 34 HTTP files match its reviewed build, recorded in evidence/revision5/agent-first-review/delivery.json. The mandatory external-human pilot has been rejected by the user as the wrong product gate. The intended entry point is an ordinary asset request to the user's own agent. Human feedback remains optional. The planter trial demonstrates the instructed contributor workflow; a minimal-request trial is the next acceptance check.

## Independent GPT-6.1 Sol light trial

A fresh agent followed the guide and created an original planter with two presets. Eleven GLB validation cases passed; three extracted rebuilds match production bytes. Browser save/load succeeded. Unity import was not tested.

- [Trial report](evidence/revision5/agent-pilot/sol-planter-20261006/report.md)
- [Main verification and qualifications](evidence/revision5/agent-pilot/sol-planter-20261006/main-review.md)
- [Patio box](evidence/revision5/agent-pilot/sol-planter-20261006/renders/preset-patio-box-oblique.png)

The trial identified documentation gaps around the retained test fixture, contributor-test invocation and matching CLI/package configurations. Findings are recorded for a follow-up; production source was not changed.

## Previous six-family milestone

# Woodland Workshop

Open the local [catalog](http://127.0.0.1:4173/) or [cottage editor](http://127.0.0.1:4173/asset/cottage).

Six original procedural families each have three presets, construction controls, semantic and individual-part colors, saved designs, and GLB export. The large viewer includes palette, shading, outline, crease/Ghost, pixelation, dither, underwater and vertex-snapping tools.

- [Current website and construction controls](evidence/revision4/live-delivery/ui-correction/desktop-customization.png)
- [Current build and source hashes](evidence/revision4/ui-visibility-freeze/manifest.json)
- [All 37 Unity import cases](evidence/revision4/unity/contact-sheet.jpg)
- [Unity measurements and capture hashes](evidence/revision4/unity/verification.json)
- [Browser-to-Unity export equivalence](evidence/revision4/ui-visibility-freeze/unity-equivalence.json)
- [Run instructions and API](README.md)

The Unity run imported 37 models, saved and reopened 37 scenes and prefabs, and produced 78 stable captures. Four lighting comparisons confirmed Flat and Toon exports remain unlit. The final visibility correction changed two viewer files; all 37 exported GLBs remain byte-identical to the imported files.

Palette, shading and part colors travel with saved designs and GLBs. Other display effects and hidden preview parts do not alter the complete export. Download ZIP includes the GLB, design JSON, a static .mjs snapshot and an HTML preview. The HTML preview loads its pinned Three.js dependency from the internet. The lantern enclosure is opaque and emits no scene lighting.

The local preview is not a hosted deployment. Migration preserves supported parameter values and adds current defaults; it does not reproduce older geometry exactly. Visual and construction checks cover the recorded defaults, presets and edge cases, rather than every possible parameter combination.

Current source: `538e23c4db59d61941d93fb7fabbb3992d840df4275ccd30a7dbb791a9cf4dd4`. The selected regression checks and visual review are complete. Source and selected evidence are saved locally; user aesthetic acceptance remains pending. Earlier Revision 3 evidence is historical.


## Minimal asset request verified

A fresh GPT-6.1 Sol low agent received the software location and “I want a low-poly wooden treasure chest for a game.” It delivered a static chest, editable generator and saved design. Main reviewed the render and verified delivery hashes. Fourteen GLBs validated; Three.js import passed. Unity import and opening animation remain unverified.

- [Chest GLB](evidence/revision5/minimal-request/result/treasure-chest.glb)
- [Editable source](evidence/revision5/minimal-request/result/treasure-chest-1.0.0.zip)
- [Report](evidence/revision5/minimal-request/result/report.md)
- [Preview](evidence/revision5/minimal-request/result/renders/selected-oblique.png)

## Agent verification workflow, first slice

Use npm run recipe:verify with a registered family, the asset request, its behavior test and a fresh evidence directory. It records technical checks, neutral renders, exports, source packages and actionable failures. Visual review and independent source rebuilding are explicitly separate. Linux is currently required for process cleanup.

[Review](evidence/revision6/workflow/main-review/review.md) · [Default receipt](evidence/revision6/workflow/bench-default-04/report.json) · [Changed receipt](evidence/revision6/workflow/bench-changed-02/report.json) · [Independent rebuilds](evidence/revision6/workflow/main-review/portable-rebuild.json)

Step 1 is verified through the harder asset requests below. Steps 2–7 remain. Hosting/public release waits for the user at step 7.

The local4173 preview now serves the workflow instructions from evidence/revision6/workflow-build. Both production-browser checks passed and all35 HTTP files matched their saved bytes. Delivery receipt: evidence/revision6/workflow-delivery/receipt.json.

## Harder asset requests verified

[Wheelbarrow](evidence/revision6/trials/wheelbarrow-result/REPORT.md) and [stone well](evidence/revision6/trials/stone-well-result/REPORT.md) are delivered trial assets, with [review and qualifications](evidence/revision6/trials/main-review/review.md) and [four independent rebuilds](evidence/revision6/trials/main-review/portable-rebuilds.json). Both full verification workflows passed after restoring a file omitted from the test copies.

The [refined conifer](evidence/revision6/trials/conifer-refined-result/REPORT.md) completes the third harder request. Its [visual review](evidence/revision6/trials/main-review/conifer-visual.md) and [fresh source rebuild/import checks](evidence/revision6/trials/main-review/conifer/REVIEW.md) pass for the recorded coverage. The two rebuilt GLBs match the delivered bytes. Earlier rejected foliage and intermediate repairs remain available.

These trial families are ready for catalog integration in step 2. They are not yet in the live catalog. Unity imports and extreme-aspect visual approval remain unverified.

## Current Unity authoring verification

The technical implementation and verification pass; actual interactive native menu/button/viewport review remains pending. F3 is not complete.

- [Unity installation and usage](integrations/unity/ImportFixture/Packages/com.openpoly.workshop/README.md)
- [Current review and limits](evidence/revision15/unity-bridge/main-review.md)
- [Editor workflow](evidence/revision15/unity-bridge/workflow.json) and [fresh reopen](evidence/revision15/unity-bridge/reopen.json)
- [Current C# gate coverage](evidence/revision15/unity-bridge/current-csharp-gate-coverage.json)
- [Saved scene/GLB identities](evidence/revision15/unity-bridge/main-saved-scene-review.json)
- [Individual visual observations](evidence/revision15/unity-bridge/main-visual-review.json), [cottage](evidence/revision15/unity-bridge/cottage-unity.png), [chest](evidence/revision15/unity-bridge/treasure-chest-unity.png)
