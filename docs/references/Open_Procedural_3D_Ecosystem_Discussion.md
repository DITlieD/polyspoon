# Open Procedural 3D Ecosystem
## Complete discussion and planning record

**Conversation date:** 4 October 2026, Japan time  
**Project name:** Not selected  
**Scope:** The discussion in this conversation about an independent, open-source alternative to Polyfork: branding, legal boundaries, publishing costs, community participation, quality assurance, hosting, and website/MCP access.

> **Read this as a conversation record, not a new research report.** No new web research, legal review, price verification, or brand clearance was performed for this export. Earlier factual claims, estimates, recommendations, and qualifications are retained as discussion material. Recommendations are not decisions the user has adopted.

The first part organizes everything discussed into a usable project record. **Appendix A preserves the three substantive user–assistant exchanges**, including the original proposals, examples, source links, and later naming correction. Chat-only citation markers are translated into references to the supplied research report; formatting artifacts are identified rather than treated as evidence.

The accompanying ZIP also contains the user-supplied **`Polyfork_Technical_Research.md`**, with its contents unchanged. That report describes itself as public-source research, not an audit of Polyfork's private code or infrastructure; its engineering blueprint is explicitly an independent proposal. It is a separate source document, not a record of decisions made in this conversation. [R, opening notes and §§1, 6]

---

## Contents

1. [User goals and constraints](#1-user-goals-and-constraints)
2. [Where the discussion ended](#2-where-the-discussion-ended)
3. [Independent implementation, branding, and licensing](#3-independent-implementation-branding-and-licensing)
4. [Hosting economics and the assumptions behind them](#4-hosting-economics-and-the-assumptions-behind-them)
5. [Open-source product and ecosystem structure](#5-open-source-product-and-ecosystem-structure)
6. [Publication, approval, and popularity](#6-publication-approval-and-popularity)
7. [Two contribution paths](#7-two-contribution-paths)
8. [The quality standard and review evidence](#8-the-quality-standard-and-review-evidence)
9. [AI-assisted review](#9-ai-assisted-review)
10. [Community reviewing and governance](#10-community-reviewing-and-governance)
11. [Participation, workload, and growth](#11-participation-workload-and-growth)
12. [Quality-aware website and MCP](#12-quality-aware-website-and-mcp)
13. [Hosting and validation architecture](#13-hosting-and-validation-architecture)
14. [Coherent kits and portability](#14-coherent-kits-and-portability)
15. [Complete naming history and shortlist](#15-complete-naming-history-and-shortlist)
16. [Suggested launch scope](#16-suggested-launch-scope)
17. [Unresolved choices and evidence gaps](#17-unresolved-choices-and-evidence-gaps)
18. [References retained from the discussion](#18-references-retained-from-the-discussion)
19. [Appendix A — Full discussion](#appendix-a--full-discussion)

---

## 1. User goals and constraints

The user wants to create an independent, free/open-source system in the same product category as Polyfork and build a community ecosystem around it. The intended platform includes a website where people publish and discover procedural 3D models, plus an MCP interface through which agents can find and use those models.

In this discussion, **“models” means 3D assets and their procedural generators/configurations**, not hosted neural-network weights.

The user identified a central difficulty: opening the creation code does not guarantee the quality of what contributors upload. The public catalogue must not accept arbitrary submissions as equally trustworthy. The user wants quality assurance to be sustainable and community-operated, rather than becoming the sole permanent human reviewer.

The user's initial idea was to let anyone upload, then promote assets into an approved area after they achieve a weekly vote threshold. The user also asked for inexpensive hosting techniques and a distinct project name, noting that Polymarket is taken and OpenPolyfork had been described as risky.

**None of the proposed names, review thresholds, licenses, or hosting services was explicitly adopted by the user in the conversation.**

## 2. Where the discussion ended

The central recommendation was:

> **Open submissions, automated tests, qualified community review, and a reviewed-by-default catalogue. Use votes for visibility and featured collections—not as the primary proof of quality.**

The suggested implementation direction was local-first creation and generation, inexpensive hosted discovery/storage, bounded isolated validation, immutable asset versions, and a website/MCP that share the same approval records.

The suggested initial contribution policy was to prioritize configurations made with reviewed generators. New or modified executable generator code would face a stronger review and isolation requirement.

The latest naming preference expressed by the assistant was **Meshkind** for the whole ecosystem and **Polyburrow** for a name retaining “Poly.” **Polykiln** was the more workshop-like alternative. These were preferences, not availability guarantees or user selections.

An earlier favorite, **Formgrove**, was later withdrawn after the assistant reported an existing FormGrove service. This correction is preserved in the naming section and transcript.

## 3. Independent implementation, branding, and licensing

### 3.1 Functionality versus implementation and content

The legal discussion distinguished independently reproducing a product's capabilities from copying protected code, artwork, documentation, branding, or asset files. The earlier answer referred to US Copyright Office guidance that copyright protects expression rather than underlying ideas, systems, or methods. It also noted that patents and binding contracts can be separate issues. [S01]

The recommended development boundary was to write original code, build original examples and test fixtures, document provenance, and accept community contributions with appropriate permissions. The suggestion was to reproduce the capabilities, not to rehost Polyfork's catalogue.

This was general information, not a determination that every proposed implementation is lawful in every jurisdiction.

### 3.2 Why OpenPolyfork was discouraged

The earlier assessment was that **OpenPolyfork** incorporates the entire existing product name and would be used for a competing or closely related service. Users might interpret it as an official or authorized open-source edition.

The answer referred to trademark similarity in sound, appearance, meaning, and commercial impression, together with the relationship between the goods/services. Adding “Open,” “Free,” or “Community” was not treated as enough to establish a distinct brand. [S02]

Open-source software permissions and trademark permissions were discussed as separate matters. Apache 2.0 was cited as an example of a software license that does not provide general permission to use the licensor's product names or marks. [S03]

The absence of a located registration was not considered proof of availability; the discussion noted US rights arising through use and recommended relevant jurisdictional checks. No trademark-clearance search or legal opinion was completed. [S04, S05]

The lower-risk branding direction proposed was a distinct project name, described factually as an **“independent open-source alternative to Polyfork”**, with non-affiliation made clear. That was not offered as a universal legal exemption.

### 3.3 Polyfork material and the reported license restrictions

The conversation recorded that Polyfork's published terms restricted redistribution of original and modified asset files, including free libraries, and restricted using its material to build/train/evaluate certain competing generators. “Free” or “open source” was not assumed to override those conditions. Enforceability was identified as a separate legal issue. [S06; R, §2.3]

The practical recommendation was to use independently authored source, assets, references, and tests, with development history and contributor provenance. Do not treat a public connector's license as a license for the entire catalogue or authoring factory. [R, §2.3]

### 3.4 Licenses for the new ecosystem

A possible arrangement discussed—not a final decision—was:

| Layer | Example discussed | Qualification retained |
|---|---|---|
| SDK/runtime | Apache 2.0 | Follow the license and notices; software and trademark permissions remain separate. |
| Registry application | AGPL | The discussion described a source-offer obligation for qualifying modified network-served versions; it does not prohibit competing commercial hosting. |
| Contributor geometry/artwork | CC0 where appropriate | Contributors must have the necessary rights. |
| Procedural asset source | Explicit code licensing | An asset's source code needs its own clear permissions. |

Using an open-source tool was not treated as automatically granting the hub redistribution rights over everything produced with it. [S03, S07, S08]

## 4. Hosting economics and the assumptions behind them

### 4.1 Keep serving separate from creating

The proposed low-cost setup separates three activities:

1. **Creation:** Users run the open-source generator locally, supplying their own model/API access where needed.
2. **Publishing:** The hub stores source, parameters, previews, exports, licenses, and versions.
3. **Consumption:** People and agents discover/download assets and customize them locally or in the browser.

The earlier answer described Polyfork's models as small parameterized programs and referred to ES modules, conventional 3D exports, and browser rebuilding. The supplied report distinguishes occasional authoring from repeated deterministic consumption. This is an architectural basis for a low-cost hub, not a recovered account of Polyfork's actual hosting bill. [R, §§1, 3.1]

The discussion said a GPU server is not necessary merely to store and distribute assets. Hosted generation and rendering were treated as separately budgeted work. Three.js's GLTFExporter was mentioned for browser-side GLB export. [S09]

### 4.2 Storage example from the initial answer

**Assumptions recorded in the discussion:** 10 MB for each published asset package, including source/previews/exports; one complete backup copy; R2 Standard storage at $0.015 per GB-month; 10 GB-month free. These were planning figures recorded during the conversation, not freshly verified prices for this export. [S10]

| Published assets | Storage including one backup | Monthly storage estimate |
|---:|---:|---:|
| 1,000 | 20 GB | $0.15 |
| 10,000 | 200 GB | $2.85 |
| 100,000 | 2,000 GB | $29.85 |
| 1,000,000 | 20,000 GB | $299.85 |

The calculation was `max(total_GB - 10, 0) × $0.015`. Large textures, videos, and retained revisions would increase the totals. The 10 MB assumption was not a measured Polyfork average.

### 4.3 The 10,000-asset serving example

| Component | Example monthly amount recorded |
|---|---:|
| Workers paid plan within included usage | $5.00 |
| D1 metadata database within included usage | $0 additional |
| R2: 200 GB including backup | $2.85 |
| **Core serving subtotal** | **$7.85** |

The recorded Workers allowances were 10 million requests/month and 30 million CPU milliseconds; the recorded D1 database allowance was 5 GB, with separate query allowances. The initial answer illustrated two million API requests at seven milliseconds CPU each as 14 million CPU milliseconds, within that example Workers allowance. [S11, S12]

The recorded R2 allowances were one million Class A operations and ten million Class B operations monthly. Operation counts and any other metered services still mattered. [S10]

The bandwidth example was one million downloads of 10 MB packages, approximately 10 TB transferred. R2's lack of internet-egress charges was the reason that transfer volume did not dominate the estimate; it did not imply that all requests, compute, and associated services were unlimited or free. [S10]

### 4.4 Budget envelopes discussed

| Scope | Suggested envelope | What it was intended to cover |
|---|---:|---|
| Small delivery-oriented hub | $20–$50/month | Basic hosting with room above the core subtotal for domain/email/monitoring and modest operational extras. |
| Initial hub recommendation | Around $50/month | A practical starting target for a local-generation, restrained-processing service. |
| Alpha including bounded validation | $50–$150/month | Hosting plus strictly limited validation work, admitted according to the spending cap. |

The later validation budget did not mean unlimited rendering or AI criticism was included in the earlier delivery estimate. The conversation explicitly separated catalogue delivery from testing, build jobs, visual model calls, and human review.

**Excluded:** development labor, human moderation/review, legal work, taxes, and subsidized AI generation. No benchmark established validation throughput at these budgets, and no worker-provider quote was provided.

### 4.5 Generation subsidy example

The conversation used a deliberately hypothetical example: if generation and retries cost an average of $0.50 per accepted asset, subsidizing 10,000 assets would cost $5,000. This was arithmetic illustrating the difference between hosting and generation, **not a measured Polyfork cost or a model-provider quote**.

The proposed initial policy was free publishing/downloads, user-funded generation, upload-size caps, and no unlimited cloud rendering.

## 5. Open-source product and ecosystem structure

The suggested ecosystem was an **open package format, open generator, and open registry**, rather than only a gallery.

Every published package would contain generator source or a pinned reference to it, parameter definitions, dependency versions, preview/export material, licensing, and revision history. Users would be able to obtain a complete package and change registry endpoints.

The objective was reproducibility and portability: an asset should remain usable without perpetual dependence on the original website. This was a proposed design, not an implemented capability.

The initial catalogue emphasis was a small, coherent collection that imports reliably and offers meaningful controls. The conversation prioritized this over thousands of inconsistent uploads.

## 6. Publication, approval, and popularity

### 6.1 The three catalogue channels

| Channel | Entry requirement proposed | Default exposure proposed |
|---|---|---|
| **Workshop** | Baseline submission, technical, and policy checks pass; quality review remains pending. | Clearly marked experimental area. |
| **Reviewed** | Published test profile passes and independent qualified community review is complete. | Default website and MCP search. |
| **Featured** | Already reviewed, then selected for utility, presentation, community interest, or a theme. | Homepage, weekly highlights, and collections. |

Before these public channels, uploads would enter a **private processing queue**. Malicious, prohibited, obviously broken, or otherwise baseline-failing submissions would not automatically appear in the Workshop.

### 6.2 Why the weekly voting threshold was not recommended for approval

The assistant considered voting useful, but suggested separating technical/quality approval from attention. The hypothetical example contrasted a useful, excellent pipe connector with a visually exciting but mediocre dragon. More votes for the dragon would not establish a better or more reliable asset.

A weekly threshold also risks leaving a good new contributor unapproved because too few people saw the work. The recommendation was to approve when a standard is met and use weekly voting to feature already-reviewed work.

An approved asset should not lose approval because it stops being fashionable. Votes can also help identify requested assets and gaps in existing kits.

Godot's Asset Library submission/review process was cited as a broad precedent for open submission with review and advertised-compatibility requirements, not as a ready-made complete policy for this project. [S13]

## 7. Two contribution paths

### 7.1 Configuration or preset within a reviewed generator

A contributor could use an approved tree generator to make a willow by changing supported parameters and submitting a named preset. The platform would already know the generator version and dependency set.

Review would focus on the submitted configuration, appearance, metadata, usefulness, and supported variations. A reviewed generator was explicitly **not** treated as proof that every possible parameter combination looks good.

### 7.2 New or modified executable generator

A new creature-body system, a building family, or changed branch-construction logic would need code review, stronger isolation, new parameter-space tests, and appropriate maintainer approval.

The supplied report calls these **configuration mode** and **new-family mode**. It recommends reusable family engines without forcing every object into one universal generator. [R, §6.3]

### 7.3 Avoid catalogue inflation

Twenty recolors should generally be twenty presets within an asset family, not twenty independent search results. Separate asset entries should represent meaningful differences in objects or capabilities.

The community therefore has two participation routes: create with trusted building blocks, or help develop new building blocks. The second has the higher technical bar.

## 8. The quality standard and review evidence

### 8.1 Multiple dimensions instead of one global score

The proposed review system avoids making an unexplained “8.7/10” quality rating the main gate.

| Dimension | Checks discussed | Primary authority proposed |
|---|---|---|
| Technical validity | Geometry/index validity, finite coordinates, declared budgets, package completeness. | Automated checks. |
| Procedural reliability | Honest parameter effects, supported combinations, reproducibility under a pinned toolchain. | Automated checks plus targeted review. |
| Visual quality | Recognizable silhouette, intentional proportions, absence of obvious accidental clipping, multiple views. | Qualified community reviewers; AI assistance optional. |
| Integration | Scale, anchors, materials, hierarchy, and advertised animation in a specified engine/version. | Import tests and engine reviewers. |
| Style compatibility | Palette, proportions, detail level, and materials appropriate to a named kit. | Kit curators. |
| Provenance and security | Licenses, dependencies, provenance, code/resource restrictions, suspicious behavior. | Screening and maintainers, not public popularity. |

Khronos's glTF Validator and glTF Transform were identified as useful technical foundations. The former checks interchange validity; the latter supports inspection and processing. Neither was presented as an artistic judge. [S14, S15]

Checks should be asset-class aware: leaves or open clothing need not be watertight, static rocks need not have skeletons, and deliberate angular styling should not fail for lacking smooth shading.

### 8.2 A consistent review packet

The proposal was to generate a review page from the **exact submitted version**, containing neutral-lighting turntables, fixed views, important parameter extremes, and animation where relevant. A beauty render can supplement that evidence, not replace it.

Reviewers should not rely solely on an uploader's screenshot. The rendering setup and submitted content need to agree.

### 8.3 Parameter-space coverage

Start with defaults, individual bounds, meaningful interactions, and seeded random samples. Preserve failing configurations as reproducible cases. The supplied research explicitly warns that testing hundreds of combinations does not establish correctness for all possible inputs. [R, §14.3]

A proposed badge was:

> Reviewed for the Low-Poly Props profile. Tested with the listed generator and engine versions. Coverage and known limitations available.

That is a scoped, evidence-based promise rather than “guaranteed perfect.”

## 9. AI-assisted review

The proposed visual AI critic would identify suspicious intersections, proportion problems, and changes between revisions. Its output should specify the defect, view, parameter configuration, and confidence—not merely a numeric score.

The initial recommendation was not to let AI grant final approval. The uploaded report records a vendor example of a cat scored 8.2/10 that still needed four human-directed revisions. The report treats this as a vendor example, not a universal measurement of all judges. [R, §4.2]

More low-risk decisions could be automated only after measuring false acceptance and false rejection against the platform's own standards and fixtures. The discussion did not choose a specific vision model or establish its hardware requirements.

## 10. Community reviewing and governance

### 10.1 Trust and roles

The recommendation was to distinguish contributor reputation from review permissions. Artistic, engine-integration, generator-code, security, and kit-curation expertise are not interchangeable.

A Discourse-style progression from limited new-user privileges to trusted community responsibilities was suggested as a general pattern. Approval authority would depend on demonstrated review quality, rather than copying forum activity thresholds or counting likes. [S16]

### 10.2 Starting approval rule

For ordinary assets built with reviewed generators:

> **All mandatory checks pass + two independent qualified approvals + no unresolved substantiated blocking issue.**

For new executable code, add a relevant maintainer's code approval.

These were proposed starting rules to calibrate, not researched optimal thresholds. Reviewers would use **Approve**, **Changes requested**, or **Outside my expertise**, with concrete checklist-based reasons.

A blocker such as “handle detaches at maximum width” is actionable. A vague “looks bad” is not. Disputes would escalate to another qualified reviewer or curator so one person cannot indefinitely obstruct a contribution.

### 10.3 Anti-gaming controls

The discussion proposed no self-approval, conflict-of-interest disclosure, distributed assignments within reviewers' specialties, and periodic audits of accepted assets.

Existing vote totals and other reviewers' decisions would be hidden until someone submits an assessment. Queue capacity would be reserved for older submissions and first-time contributors, not only popular uploads.

Useful reviewing should be rewarded: finding a reproducible defect, helping repair it, or correctly validating work. Simply accumulating positive approvals, followers, or uploads should not automatically confer authority.

## 11. Participation, workload, and growth

The suggested community contribution loop included requested assets and kit gaps, repair contributions with preserved author and repair credit, and volunteer kit stewardship.

Review decisions and reproducible issues should live with the asset on the website or repository, not disappear into chat. Chat may organize people, while durable records preserve what was reviewed and why.

A founding reviewer group is still necessary. The conversation did not promise that opening the platform would immediately produce enough qualified volunteers.

### Workload example

```text
100 submissions/week × 2 reviews × 5 minutes
= 1,000 reviewer-minutes/week
≈ 16.7 reviewer-hours/week
```

With 20 active reviewers, that averages about 50 minutes each per week. This was planning arithmetic for simple reviews, not measured throughput; new generator or rigging code can need substantially more time.

Suggested metrics were review effort per accepted contribution, escaped defects, queue age, and reviewer retention. More uploads are not automatically progress when review capacity is overwhelmed.

## 12. Quality-aware website and MCP

### 12.1 One catalogue and approval system

The website and MCP should share versioned asset metadata and approval records. The proposed application-level search example was:

```text
search_assets(
    query="wooden village buildings",
    channel="reviewed",
    style_profile="cozy-lowpoly",
    target_engine="unity"
)
```

These fields are proposed for this project, not built-in MCP protocol features.

Results would include exact asset version, generator version/hash, review profile, tested export and engine targets, license, known limitations, and a validation-report reference.

The reviewed-only default should be enforced in server code, not merely by telling an LLM to be careful. The earlier answer cited MCP server input validation, access controls, rate limits, and output sanitization. [S17]

### 12.2 Version and variant rules

**Approval is version-specific.** Version 1.2 does not inherit approval automatically from version 1.1. The previously reviewed version remains available while a changed version is evaluated.

**Variant coverage stays honest.** Review of the default or selected presets does not make every arbitrary slider combination visually reviewed. Cheap structural checks can be run on generated variants; the result should distinguish reviewed presets from other builds in the supported range.

**No silent downgrade.** When no reviewed result matches, report that. Workshop search should require a deliberate channel change rather than an invisible fallback.

**Defects remain actionable.** Users and agents can submit the exact asset version, parameter set, engine version, and reproducer. Confirmed serious issues can suspend approval or trigger quarantine, with appeal and repair routes.

**Permissions stay separate.** Searching and downloading do not grant publication or approval rights.

## 13. Hosting and validation architecture

### 13.1 Proposed service separation

```text
Website + API + MCP
        │
        ├── Metadata and review database
        ├── Published packages and previews
        └── Submission queue
                  │
             Isolated workers
                  │
          Test reports and review packets
```

The recommended serving path was a lightweight website/API, object storage, and a database. Cloudflare Workers, D1, and R2 were a possible implementation, not a committed provider choice or a claim about Polyfork's deployment.

Build/render validation would run behind a queue on separate workers with a bounded budget. No specific worker hardware or provider was selected.

### 13.2 Cost controls

**Local preflight, authoritative recheck:** Publish the validator so contributors can catch failures before uploading, but run the required checks again in the platform-controlled environment. An uploader's “passed” report is not authoritative evidence.

**One review packet per revision:** Render the standard evidence once and reuse it across reviewers rather than rendering whenever someone opens the page.

**Immutable packages and selective variant caching:** Cache by generator, version, parameters, export settings, and relevant pinned inputs. Retain common presets and useful variants, not every theoretical combination.

**Cheap delivery:** The discussion referred to R2 custom-domain CDN access and noted that `r2.dev` is a development endpoint rather than the intended production delivery path. [S18]

**Admission limits:** Limit outstanding submissions, package sizes, job duration, memory, retry count, and total daily validation work. Group near-duplicate presets to discourage catalogue spam.

### 13.3 Untrusted code and previews

Do not execute community generator code in the API process or in a production-credential-bearing worker. A normal JavaScript context was not treated as a security boundary; Node's `node:vm` documentation was cited for that limitation. gVisor was mentioned as an isolation option that still requires correct configuration and testing. [S19; R, §12.5]

The proposed controls were network restrictions, no production secrets, restricted dependencies, resource limits, disposable execution environments, and controlled publication.

Unreviewed contributions would initially be presented through processed mesh previews rather than automatically running their original scripts in visitors' browsers. Browser sandboxing and separate origins were mentioned, but a simple iframe was explicitly not considered a complete security design. [S20]

The safest and cheapest initial contribution route proposed was configurations for already-reviewed generators. Broader executable-code submission could expand as isolation and review systems mature.

## 14. Coherent kits and portability

The recommended differentiator was coherent collections rather than only a large raw catalogue. Example kit profiles were **Cozy Village**, **Low-Poly Space Station**, and **Stylized Forest**.

Curators would document scale, palette, detail, material, and performance conventions. An asset can pass general technical review without fitting every kit. A kit curator's approval concerns collection compatibility, not permission to override security or mandatory technical failures.

An agent could then ask for reviewed furniture compatible with a village kit rather than furniture with the highest like count.

Longer-term proposals included open package formats, validation profiles, review records, and support for independently curated registries. Consumers would deliberately choose trusted curators. The conversation recommended starting with one well-run official catalogue instead of making federation necessary for launch.

## 15. Complete naming history and shortlist

### 15.1 Names and status at the end of the discussion

| Name | Rationale or reason discussed | Status in this conversation |
|---|---|---|
| **Meshkind** | “Meshes + humankind”; friendly and broad enough for generator, library, and MCP. | Latest assistant favorite for the ecosystem; not selected or cleared. |
| **Polyburrow** | A home for models and creators; playful community identity and possible mascot. | Latest favorite retaining “Poly”; not selected or cleared. |
| **Polykiln** | Workshop turning raw material into finished assets; creation and quality emphasis. | Strong alternative; “kiln” may be less familiar internationally; an existing GitHub username was reported. |
| **MeshOrchard** | A collection people grow and maintain; reusable procedural seeds/families. | Appeared in both rounds; longer name; no clearance. |
| **ShapeGuild** | Contributors, craftsmanship, qualified reviewers. | Earlier community-focused candidate; no clearance. |
| **Kitbloom** | Coherent kits and expanding collections. | Earlier candidate; no clearance. |
| **Polywarren** | Interconnected assets, kits, and contributors. | Later candidate; possible spelling friction. |
| **Polysprig** | Small reusable pieces growing into larger worlds. | Later candidate; could sound vegetation-focused. |
| **Polynary** | Technical, abstract sound for a programmable asset system. | Later candidate; meaning/pronunciation less obvious. |
| **Formgrove** | Growing collection of procedural forms. | Initial favorite, later withdrawn after a reported existing FormGrove service. |
| **Polygrove** | Related naming direction. | Advised against after reported existing low-poly asset use. |
| **Polynook** | Related naming direction. | Advised against after reported existing 3D software/tool use. |
| **OpenPolyfork** | Directly signals an open alternative. | Discouraged for possible brand confusion; no legal clearance was completed. |
| **Polymarket** | User-raised candidate. | The user said it was taken; not advanced as a candidate. |

The discussion's name-use findings are **earlier reported screening results**, not new verification in this export. The evidence linked for a username or an existing service is not a trademark-clearance report. Domain availability, package namespaces, and legal availability were not established.

### 15.2 Product-family naming and taglines

Earlier example, subsequently displaced by the Formgrove correction:

```text
Formgrove Studio
Formgrove Library
Formgrove MCP
```

Latest example:

```text
Meshkind Studio  — creation tool
Meshkind Library — reviewed community assets
Meshkind MCP     — agent access
```

Taglines proposed:

> **Programmable 3D. Built together.**

> **Create, remix, and share procedural 3D assets.**

The assistant recommended naming the full ecosystem rather than only a model shop, and putting “open-source” in the description instead of forcing “Open” into the brand.

## 16. Suggested launch scope

The concrete launch recommendation from the discussion was:

- One coherent, original kit and a handful of reviewed generators.
- Configuration-based community submissions first.
- Automated baseline and asset-class checks with reproducible review packets.
- Two qualified reviewers for ordinary asset approval, plus code-maintainer review for new generator code.
- Reviewed-only website/MCP defaults, version-specific approval, and explicit coverage/limitations.
- Weekly community picks for exposure, plus a request board for useful missing assets.
- A small founding reviewer group and bounded validation spending.

Broader generator-code contributions, federation, expanded automation, and a larger catalogue were later-stage possibilities—not prerequisites or completed work.

## 17. Unresolved choices and evidence gaps

The conversation did not settle the project name, purchase a domain, choose package namespaces, or clear trademarks. It did not make final code/content license decisions or provide a jurisdiction-specific legal opinion.

The proposed “two approvals” rule, trusted-reviewer progression, style profiles, and review workload were not tested with a real community. No complete appeal policy, moderation staffing plan, or calibrated trust algorithm was finalized.

No validator implementation, isolated-worker benchmark, concrete render-worker provider, or AI judge was selected or evaluated here. The hosting numbers remain illustrative assumptions and spending envelopes, not an end-to-end operational quote.

No claims were established about guaranteeing all procedural combinations or achieving complete automated aesthetic judgment. The proposed answer to the quality barrier was explicit standards, honest coverage, human/community expertise, and reproducible defects—not an absolute guarantee.

**No repository, website, MCP server, domain registration, deployment, or community account was created during this discussion.** This export packages the discussion and the supplied research document only.

## 18. References retained from the discussion

These are source pointers already present in the conversation or the supplied report. They were not reopened or newly verified for this export. Retaining a pointer does not make every prior assertion a fresh finding. Dates and prices should be read as recorded on the conversation date.

- **[R] User-supplied report:** [Polyfork: technical research and independent implementation blueprint](Polyfork_Technical_Research.md), dated 4 October 2026. Included in the ZIP, unchanged in content. Its original companion schemas, code, CSVs, and HTML were not supplied in this conversation and are not included here.
- **[S01] US Copyright Office — What copyright protects:** https://www.copyright.gov/help/faq/faq-protect.html
- **[S02] USPTO — Likelihood of confusion:** https://www.uspto.gov/trademarks/search/likelihood-confusion
- **[S03] Apache License 2.0:** https://www.apache.org/licenses/LICENSE-2.0
- **[S04] USPTO — Why register a trademark:** https://www.uspto.gov/trademarks/basics/why-register-your-trademark
- **[S05] WIPO — Global Brand Database:** https://www.wipo.int/en/web/global-brand-database
- **[S06] Polyfork licensing:** https://polyfork.dev/licensing
- **[S07] AGPL:** The license was discussed, but the original answer linked its AGPL sentence to Apache's license page, not an AGPL-specific source. The wording and original link remain in the transcript; the recommendation is preserved as a proposal, not independently verified legal analysis.
- **[S08] Creative Commons CC0:** https://creativecommons.org/publicdomain/zero/1.0/
- **[S09] Three.js GLTFExporter:** https://threejs.org/docs/pages/GLTFExporter.html
- **[S10] Cloudflare R2 pricing:** https://developers.cloudflare.com/r2/pricing/
- **[S11] Cloudflare Workers pricing:** https://developers.cloudflare.com/workers/platform/pricing/
- **[S12] D1 allowances:** The original answers retained a Workers pricing link, not a separate D1-specific source. The D1 figures above are preserved as prior discussion claims, without a newly supplied or independently verified source.
- **[S13] Godot Asset Library submissions:** https://docs.godotengine.org/en/stable/community/asset_library/submitting_to_assetlib.html
- **[S14] Khronos glTF Validator:** https://github.com/KhronosGroup/glTF-Validator
- **[S15] glTF Transform:** https://gltf-transform.dev/ — Retained from supplied report reference T06.
- **[S16] Discourse trust levels:** https://blog.discourse.org/2018/06/understanding-discourse-trust-levels/
- **[S17] MCP tools specification, as linked in the conversation:** https://modelcontextprotocol.io/specification/latest/server/tools
- **[S18] R2 public buckets and custom domains:** https://developers.cloudflare.com/r2/buckets/public-buckets/
- **[S19] Node.js vm documentation:** https://nodejs.org/api/vm.html
- **[S20] MDN iframe documentation:** https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe
- **[S21] Earlier name-screening link — FormGrove service:** https://ubtadmin.upstatebeertourist.com/
- **[S22] Earlier name-screening link — reported Polykiln username context:** https://github.com/brozeph/node-craigslist
- **[S23] Polyfork homepage:** https://polyfork.dev/
- **[S24] User-provided Devpost project/updates:** https://devpost.com/software/polyfork#updates

---

# Appendix A — Full discussion

This appendix preserves the three substantive exchanges leading to the export request. The user's wording is retained, with chat link wrappers and HTML spacing entities normalized. Assistant wording and source links are retained; chat-only file citations are represented by references to report [R]. A corrupted visual separator in the first answer is identified below. These are historical responses, **not newly checked advice**.

## Exchange 1 — Naming legality and hosting economics

### User

https://polyfork.dev/  
https://devpost.com/software/polyfork#updates

if i create a open source polyfork, like copying what i do but free/open source, can i name it openpolyfork or smt similar ? or is it illegal ?

and how much would cost to host a place where pleople can pulbish their own models made with the open source system ? i want to create a eco system to repalce that business

### Assistant

**You can build an independently implemented, open-source competitor. But I would avoid naming it “OpenPolyfork” without permission, and build a new asset catalogue rather than rehosting theirs.** Recreating functionality and copying someone’s branding or copyrighted material are different legal questions. ([copyright.gov](https://www.copyright.gov/help/faq/faq-protect.html))

For the community website, **roughly $20–$50/month is a plausible starting infrastructure budget** under the architecture below: users generate assets locally, browsers render previews, and your service handles publishing, discovery and downloads. That is my estimate—not a quote for operating the entire business.

#### 1. Can you call it OpenPolyfork?

**Not automatically illegal, but an unnecessary trademark risk.**

“OpenPolyfork” contains the entire existing product name and would serve essentially the same audience. My assessment is that people could interpret it as Polyfork’s official open-source edition or an authorized project. Adding “Open,” “Free,” or “Community” does not necessarily create enough distinction: the USPTO evaluates similarity in sound, appearance, meaning and overall commercial impression, alongside whether the products compete. ([uspto.gov](https://www.uspto.gov/trademarks/search/likelihood-confusion))

Being free or open source does not itself give you permission to use another project’s brand. Software permissions and trademark permissions are separate—even Apache 2.0 expressly withholds general permission to use the licensor’s product names and trademarks. ([apache.org](https://www.apache.org/licenses/LICENSE-2.0))

Also, **“I couldn’t find a registered trademark” would not establish that the name is safe.** In the US, certain rights arise through use without federal registration. I have not established Polyfork’s registration status or completed a trademark-clearance search. ([uspto.gov](https://www.uspto.gov/trademarks/basics/why-register-your-trademark))

My recommendation: choose a distinct name, then describe it factually as an **“independent open-source alternative to Polyfork”**, with clear non-affiliation, rather than incorporating Polyfork into your brand. That is a lower-risk direction, not a universal legal exemption. Before launch, have the name checked for Japan and the markets you intend to serve; WIPO recommends checking relevant national/regional registers as well as its global database. ([wipo.int](https://www.wipo.int/en/web/global-brand-database))

##### What can you recreate?

The important distinction is **functionality versus protected implementation and content**. Copyright generally protects the expression—such as code, artwork and documentation—not the underlying idea, system or method. Independently implementing a parametric 3D generator, browser editor, asset registry and agent integration is therefore a different proposition from copying their source or catalogue. Patents and binding contractual obligations would still need separate consideration. ([copyright.gov](https://www.copyright.gov/help/faq/faq-protect.html))

**Polyfork’s actual license matters here.** Its published terms currently prohibit redistributing its original **or modified** asset files, including through free libraries. They also restrict using its files, renders and accompanying text to build or train competing commercial generators, expressly including evaluation and benchmarking. The wording extends to generators offered to others, so I would not assume “mine is free” resolves that issue. Whether every provision is enforceable is a separate legal question. ([polyfork.dev](https://polyfork.dev/licensing))

For your project, I would use independently written code, your own test assets and community contributions with documented permissions. Keep development history and provenance. **Reproduce the capabilities—not their catalogue.**

*This is general information, not a legal clearance opinion.*

#### 2. How much would the publishing website cost?

##### Separate the generator from the hub

Polyfork describes its assets as small programs with editable parameters, available as ES modules and conventional 3D files. Its site also demonstrates rebuilding models in the browser. That makes a lightweight community distribution service a reasonable architecture to pursue.

*[Export note: the original response contained a run of tilde characters at this point, not a usable source citation. It is omitted as a formatting artifact; no new citation has been substituted into the transcript.]*

I would divide your version into three parts:

- **Creation:** users run your open-source generator on their machines, using their own model/API access where needed.
- **Publishing:** your hub stores source, parameters, previews, exports, licensing and version information.
- **Consumption:** users browse, download and customize locally. Browser-based GLB export is supported by tools such as Three.js’s `GLTFExporter`. ([threejs.org](https://threejs.org/docs/pages/GLTFExporter.html))

Under that design, **you do not need a GPU server merely to host and distribute the library.** Hosted AI generation and automated rendering would be optional, separately budgeted services.

##### Storage is inexpensive

Cloudflare R2 Standard currently lists **$0.015 per GB-month**, with the first **10 GB-month free**, and no internet-egress charge. Requests and any additional metered services remain separate. ([developers.cloudflare.com](https://developers.cloudflare.com/r2/pricing/))

For illustration, assume **10 MB per published asset package**, including source, previews and exports, plus **one full backup copy**. This is a planning assumption, not a measured average for Polyfork.

| Published assets | Storage including one backup | Monthly R2 storage cost |
|---:|---:|---:|
| 1,000 | 20 GB | **$0.15** |
| 10,000 | 200 GB | **$2.85** |
| 100,000 | 2,000 GB | **$29.85** |
| 1,000,000 | 20,000 GB | **$299.85** |

Calculated using the published rate and free allowance. Keeping many historical versions, large textures or videos increases these totals. ([developers.cloudflare.com](https://developers.cloudflare.com/r2/pricing/))

##### A concrete 10,000-asset launch example

A minimal stack could be **Cloudflare Workers for the website/API, D1 for metadata, and R2 for files**.

| Component | Example monthly cost |
|---|---:|
| Workers paid plan, within included usage | **$5.00** |
| D1 metadata database, within included usage | **$0 additional** |
| R2: 200 GB including backup | **$2.85** |
| **Core hosting subtotal** | **$7.85** |

Workers includes 10 million monthly requests and 30 million CPU milliseconds on its standard paid allowance. D1 includes 5 GB of database storage and substantial query allowances; usage beyond those is billed separately. ([developers.cloudflare.com](https://developers.cloudflare.com/workers/platform/pricing/))

For a concrete workload, two million API calls averaging 7 milliseconds of CPU each would remain within those Workers allowances. Asset requests would also need to remain within R2’s allowances: one million Class A operations and ten million Class B operations monthly. ([developers.cloudflare.com](https://developers.cloudflare.com/workers/platform/pricing/))

I would therefore **budget $20–$50/month initially**, leaving room above core hosting for a domain, email, monitoring and small operational extras. This assumes restrained processing and usage within the allowances—not unlimited traffic or unlimited validation jobs.

For perspective, **one million downloads of 10 MB packages is approximately 10 TB transferred**. R2’s egress pricing makes that much less alarming than it would be on a per-GB-bandwidth service, although requests still count. ([developers.cloudflare.com](https://developers.cloudflare.com/r2/pricing/))

These estimates exclude your development time, human moderation, legal work, taxes and AI generation.

##### What makes it expensive?

**Paying for everyone’s generation is a different business from hosting their finished work.** As a hypothetical—not a measured Polyfork cost—if generation and retries average $0.50 per accepted asset, subsidizing 10,000 new assets costs $5,000, regardless of how cheap their storage is.

My initial policy would be: **free publishing and downloads, user-funded generation, capped upload sizes, and no unlimited cloud rendering.**

#### 3. How I would build the ecosystem

I would make the project more than a download gallery: **an open package format, an open generator and an open registry.**

**Make every published asset reproducible.** Require generator source, parameter definitions, dependency versions, a preview export, license information and revision history. Support downloading complete packages and changing the registry endpoint, so users are not dependent on your website.

**Treat uploaded programs as untrusted code.** Do not execute arbitrary community JavaScript in your main server process or logged-in website context. Start with validated mesh previews; isolate procedural execution separately. Browser sandboxing and separate origins are relevant controls, but a simple iframe is not a complete security design. ([developer.mozilla.org](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe))

**Choose licenses for each layer deliberately.** One possible arrangement is Apache 2.0 for the SDK/runtime and AGPL for the registry application. AGPL requires qualifying modified network-served versions to offer corresponding source to their users; it does **not** prohibit competing commercial hosting. ([apache.org](https://www.apache.org/licenses/LICENSE-2.0))

For contributed geometry and artwork, CC0 is an option when contributors own the necessary rights; it permits modification, redistribution and commercial use. Asset source code should also have explicit licensing. Merely producing a model with your open-source tool does not automatically give your hub redistribution rights to that model. ([creativecommons.org](https://creativecommons.org/publicdomain/zero/1.0/))

My priority would be a small, coherent collection that imports reliably, has useful parameters and is easy for agents to search—not thousands of inconsistent uploads. Add upload quotas, provenance requirements and a reporting/removal process from the beginning.

**My recommendation: launch under a distinct brand, keep creation local, make publishing portable, and budget around $50/month for the first hub.** The architecture makes low hosting costs plausible; building a trustworthy, useful catalogue is the part I would spend most of the effort on.

---

## Attachment used in Exchange 2

The user supplied **`Polyfork_Technical_Research(2).md`**. Its contents are included unchanged in the accompanying ZIP under the normalized name **`Polyfork_Technical_Research.md`**. It is reference [R] in this export.

---

## Exchange 2 — Quality barriers, community governance, hosting, and initial names

### User

the issue is that i need a way to like, guarantee model quality.. bcs we will open source the code to create those models, but we cant le anyone upload anuything as well, so how could that work ? i make a vote system ? anyone uploads anything but the only ones that goes tot he approved space are the ones which  achieved x votes on aweekly baiss ? or that is stupid ? just my human review ? but i wanted to make this smt the commuinity handle and grows.. any ideas for names, hosthign techniques etc ?

i will have a website with the models + a  mcp too just likep olyfork, but bcs mine is open source, we need to solve the qualty barrier and the community aspect of it, ideas ?

### Assistant

**Your voting idea is useful—but I would use votes to decide what gets featured, not what qualifies as usable.**

For your project, I’d build **open submissions + automated testing + trusted community reviewers + a reviewed-by-default catalogue**. That lets the community grow the library without turning you into its permanent gatekeeper.

The distinction is: **anyone can contribute, but publication, approval, and popularity are three different things.** Godot’s Asset Library already follows the broad principle of open submissions entering a review queue, with requirements such as working in the advertised engine version. ([docs.godotengine.org](https://docs.godotengine.org/en/stable/community/asset_library/submitting_to_assetlib.html))

Here is the system I would propose for yours.

#### 1. Three catalogue sections—not one giant voting feed

| Section | How an asset gets there | Where it appears |
|---|---|---|
| **Workshop** | Passes baseline submission, technical, and policy checks; still awaiting quality review | A clearly marked experimental section |
| **Reviewed** | Passes its published test profile and independent community review | Default website search and default MCP results |
| **Featured** | Already reviewed, then selected for usefulness, presentation, or community interest | Homepage, weekly highlights, themed collections |

Uploads would initially enter a **private processing queue**, not immediately become public. Malicious, prohibited, or obviously broken submissions should not reach the Workshop.

Your weekly voting idea fits **Featured** well. But I would not make approval depend on getting, say, 30 votes that week.

Consider a hypothetical excellent pipe connector and a mediocre dragon. The dragon could receive more attention simply because it makes an exciting thumbnail. That would tell you little about whether the connector is useful or the dragon’s legs deform correctly.

A weekly threshold also creates an exposure problem: a new contributor’s asset can fail to receive enough votes without anyone actually reviewing it.

**Approval should happen whenever an asset meets the standard. Featuring can happen weekly.** An approved asset should not lose approval merely because it stops being popular.

#### 2. Your biggest scaling advantage: review generators differently from their configurations

Your report already distinguishes **configuration-only authoring** from **new procedural implementation code**. I would make that distinction fundamental to the contribution system. [Original file citation: R, §6.3, lines 376–382 in the chat extraction.]

##### Existing generator, new configuration

Someone uses an approved tree generator to make a willow, adjusts its supported parameters, and submits a named preset.

Your system already knows the generator version and dependency set. The review can concentrate on the submitted configuration, appearance, metadata, usefulness, and supported variations.

It still needs testing: an approved generator is not proof that every possible configuration looks good.

##### New generator or changed code

Someone creates a new creature body system, a building generator, or changes how a tree constructs branches.

That contribution needs additional code review, stronger isolation, parameter-space tests, and maintainer approval before its code becomes part of the trusted library.

**Do not make every contributor’s next chair equivalent to reviewing an entirely new software package.**

Also, avoid catalogue inflation: **twenty recolors should usually be twenty presets under one asset family—not twenty separate search results.** Reserve new asset entries for meaningfully different objects or capabilities.

That gives you two community contribution routes:

> **Create an asset using trusted building blocks**, or **help develop a new building block**.

The second route has a higher bar, without preventing the first from growing quickly.

#### 3. Define “quality” as a checklist, not a single score

I would avoid an undifferentiated “quality: 8.7/10” badge.

Instead, define what an asset promises and test those promises separately.

| Dimension | What I would check | Who decides |
|---|---|---|
| **Technical validity** | Valid geometry, valid indices, finite coordinates, declared budgets, complete package | Automated checks |
| **Procedural reliability** | Parameters have their advertised effects; supported combinations build; reproducibility under a pinned toolchain | Automated checks plus targeted review |
| **Visual quality** | Recognizable silhouette, intentional proportions, no obvious accidental clipping, adequate appearance from multiple angles | Community reviewers, assisted by AI |
| **Integration** | Correct scale, anchors, materials, hierarchy, and advertised animation in a specific target engine | Automated import tests and engine reviewers |
| **Style compatibility** | Fits a particular kit’s palette, proportions, detail level, and material conventions | That kit’s curators |
| **Provenance and security** | Declared licenses and dependencies, contributor provenance, code/resource restrictions, suspicious behavior | Screening and maintainers; not a popularity vote |

For the technical foundation, **Khronos’s glTF Validator** already checks format correctness, references, buffer values, and animation data. **glTF Transform** provides inspection tools for geometry, textures, and draw-call-related structure. Neither is an artistic-quality judge; you would add your own asset-specific tests around them. ([github.com](https://github.com/KhronosGroup/glTF-Validator))

Don’t apply inappropriate rules globally. A leaf or open garment does not necessarily need to be watertight. A static rock does not need a skeleton. A deliberately angular style should not fail because it lacks smooth shading.

##### Give every reviewer the same evidence

I would generate a review page containing a neutral-lighting turntable, several fixed views, important parameter extremes, and a short animation preview where relevant. Include a beauty render too, but don’t let that be the only evidence.

Reviewers should inspect renders produced from the **exact submitted version**, not merely trust an uploader’s screenshot.

For procedural reliability, start with defaults, individual parameter boundaries, important interactions, and seeded random samples. Publish the actual coverage. Your report makes the important qualification that testing hundreds of combinations does not establish correctness for all possible inputs. [Original file citation: R, §14.3, lines 934–940 in the chat extraction.]

The badge should therefore mean something like:

> **Reviewed for the Low-Poly Props profile. Tested with the listed generator and engine versions. Coverage and known limitations available.**

That is a much more defensible promise than “guaranteed perfect.”

##### Use AI as an assistant to reviewers

I would let a visual model flag suspicious intersections, inconsistent proportions, and differences between revisions. Its output should identify **the defect, view, parameter set, and confidence**, not just award a number.

But I would not initially give it final approval authority. Your report records a vendor example where a cat receiving an automated **8.2/10** still needed four human-directed revisions—a useful warning against treating the score as sufficient evidence. [Original file citation: R, §4.2, lines 207–209 in the chat extraction.]

Later, you could automate more low-risk decisions after measuring how often your system accepts defective assets and rejects good ones.

#### 4. Make reviewing a community role—not something every voter automatically controls

**You do not have to personally review everything. You do need a way to establish who is qualified to review what.**

I would separate contributor reputation from reviewer permissions. A prolific artist need not be a security reviewer, and a strong programmer need not decide whether clothing fits a particular art style.

Discourse offers a useful broad pattern: new participants have limited permissions, while established contributors receive powers to help maintain the community. I would adapt that pattern to demonstrated reviewing ability rather than simply copying forum activity thresholds. ([blog.discourse.org](https://blog.discourse.org/2018/06/understanding-discourse-trust-levels/))

##### A practical starting approval rule

For ordinary assets using an already-reviewed generator, I would start with:

> **All mandatory checks pass + two independent qualified approvals + no unresolved substantiated blocking issue.**

For new executable generator code, add approval from a relevant code maintainer.

These are starting rules to calibrate—not proven magic numbers.

Reviewers should select **Approve**, **Changes requested**, or **Outside my expertise**, with checklist-based reasons. “Looks bad” is not actionable; “the handle detaches at maximum width” is.

A disputed blocker should go to another qualified reviewer or curator. Otherwise, one person could indefinitely obstruct a contribution.

##### Prevent an approval-trading club

I would use several controls together: no self-approval, conflict-of-interest disclosure, assignments distributed within reviewers’ specialties, and periodic audits of accepted work.

Hide existing vote totals and other reviewers’ decisions until someone submits their own assessment. Reserve review capacity for older submissions and first-time contributors, rather than allocating everything by popularity.

Most importantly, **reward useful reviewing, not positive reviewing**. Credit a reviewer for discovering a reproducible defect, helping someone fix it, or accurately validating an asset—not for pressing Approve fifty times.

I would not grant approval powers merely because someone has many followers, uploads, or likes.

##### Make participation rewarding

The contribution loop should include more than uploading models:

- **Requested assets and kit gaps:** people vote for what they need, then contributors build toward real demand.
- **Repair contributions:** anyone can fix another asset, with original authorship and repair credit preserved.
- **Kit stewardship:** volunteers maintain coherent collections, review incoming additions, and document their style rules.

Keep review decisions and reproducible issues on the website or repository, rather than only in chat. Chat can organize people; the asset needs a durable history.

##### Be realistic about the initial workload

You will need a small founding reviewer group. Community governance does not supply experienced volunteers automatically on launch day.

For illustration:

**100 submissions/week × 2 reviews × 5 minutes = about 16.7 reviewer-hours/week.**

With 20 active reviewers, that averages roughly 50 minutes each. That is planning arithmetic for simple reviews, not a measured throughput estimate; a new rigging system could take much longer.

The metric I would watch is **review effort per accepted contribution**, alongside escaped defects, queue age, and reviewer retention. More uploads are not necessarily progress when the review queue cannot keep up.

#### 5. Make the MCP enforce quality—not merely mention it

This matters particularly for your project: **an agent should receive structured evidence about an asset, not have to infer trust from its thumbnail and star count.**

I would have the website and MCP use the same catalogue and approval records. A proposed search could look like:

```text
search_assets(
    query="wooden village buildings",
    channel="reviewed",
    style_profile="cozy-lowpoly",
    target_engine="unity"
)
```

Those would be your application’s fields, not built-in MCP features.

Each result should include the exact asset version, generator version/hash, review profile, tested export/engine targets, license, known limitations, and a reference to its validation report.

**Enforce the reviewed-only default in server code.** Do not rely on a sentence telling the agent to avoid unreviewed assets. The MCP specification itself requires servers to validate inputs, implement access controls, rate-limit calls, and sanitize outputs. ([modelcontextprotocol.io](https://modelcontextprotocol.io/specification/latest/server/tools))

I would also enforce these policies:

**Versions retain separate approval states.** Version 1.2 does not inherit approval because version 1.1 passed. Keep the earlier reviewed version available while the update is examined.

**Variants carry honest coverage information.** A reviewed base asset does not make every arbitrary slider combination visually reviewed. Run cheap structural checks on newly built variants and distinguish reviewed presets from other builds within the supported parameter range.

**No silent downgrade.** When nothing reviewed matches a request, return that result explicitly. Searching the Workshop should require an intentional change of channel.

**Reported defects remain actionable.** Let users and agents submit the exact asset version, parameters, engine version, and reproduction. Confirmed serious problems should suspend the relevant approval or trigger quarantine, with an appeal and repair path.

Finally, keep publishing permissions separate from browsing and downloading. An agent allowed to find a tree should not automatically be allowed to approve a new generator.

#### 6. Hosting: keep distribution cheap and validation bounded

My earlier low hosting estimate applied primarily to **catalogue delivery and storage**, not unlimited build jobs, rendering, AI criticism, or human review.

For this version, I would separate the infrastructure into:

```text
Website + API + MCP
        │
        ├── Metadata and review database
        ├── Published packages and previews
        └── Submission queue
                  │
             Isolated workers
                  │
          Test reports and review packets
```

##### Recommended starting arrangement

Use a lightweight website/API, object storage for packages and renders, and a database for search metadata, reviews, permissions, and version status.

A Cloudflare implementation remains plausible: Workers’ paid plan has a **$5 monthly subscription**, D1 includes **5 GB of database storage** within its allowances, and R2 Standard costs **$0.015 per GB-month**, with the first 10 GB-month free and no internet-egress fee. Request and compute overages still matter. ([developers.cloudflare.com](https://developers.cloudflare.com/workers/platform/pricing/))

Thus, **200 GB of R2 storage is $2.85/month**, or approximately **$7.85 with the Workers subscription**, provided the other usage stays within included allowances. That is the serving foundation—not the full operating bill. ([developers.cloudflare.com](https://developers.cloudflare.com/r2/pricing/))

Put builds and render jobs behind a queue on separate workers. For an alpha, I would set a **$50–$150/month operating budget for hosting and bounded validation**, then limit admitted work to fit it. That is a proposed spending envelope, not a promise of any particular throughput; paid reviewers and subsidized AI generation would need their own budgets.

##### The cost controls I would prioritize

**Local preflight, authoritative recheck.** Let contributors run the same open-source validator locally before uploading. But do not accept an uploader’s “passed” report as authoritative: your controlled worker should reproduce the required checks on the submitted content.

**One review packet per revision.** Generate the fixed views once, store them, and reuse them for every reviewer. Do not render again whenever someone opens the review page.

**Immutable packages, limited variant caching.** Cache by generator/version/parameters/export settings. Keep useful presets and popular variants, rather than trying to precompute every possible combination. Publish approved files through a custom-domain CDN path; Cloudflare documents its `r2.dev` endpoint as development-only and requires a custom domain for its R2 caching features. ([developers.cloudflare.com](https://developers.cloudflare.com/r2/buckets/public-buckets/))

Limit outstanding submissions, package sizes, job duration, memory, retries, and daily validation work. Group near-identical presets instead of permitting bulk catalogue spam.

##### Executable uploads need real isolation

Do not run community generator code inside your API process or a normal worker with production credentials.

Node explicitly warns that `node:vm` is **not** a security mechanism for untrusted code. An isolation technology such as gVisor can add a stronger boundary, but still requires appropriate configuration and workload testing. ([nodejs.org](https://nodejs.org/api/vm.html))

My design would deny unnecessary network access, expose no production secrets, restrict dependencies, enforce resource limits, and destroy the execution environment after the job. I would initially show unreviewed contributions through processed mesh previews—not automatically execute their original scripts in visitors’ browsers.

**The cheapest safe initial contribution path is configurations for reviewed generators.** Broader arbitrary-code submissions can expand as your review and isolation systems mature.

#### 7. Make coherent kits a first-class part of the ecosystem

This is where I would differentiate the project beyond “a free model website.”

An individually good asset can still be unsuitable for a particular scene. I would let community curators maintain profiles such as **Cozy Village**, **Low-Poly Space Station**, or **Stylized Forest**, each with documented scale, palette, detail, material, and performance conventions.

An asset could be technically reviewed without belonging to every kit. A kit curator would approve compatibility with that collection—not override security or technical failures.

Then an agent could request:

> “Find reviewed furniture compatible with this village kit.”

That is a more useful target than simply “find furniture with the most likes.”

Longer term, publish the package format, validation profiles, and review records openly. Allow other communities to maintain their own curated collections, while requiring users to deliberately choose which curators they trust. Start with one well-run official catalogue; don’t make federation a prerequisite for launching.

#### 8. Name ideas

I would choose a distinct name that can cover the creation tool, library, and community.

| Candidate | Direction |
|---|---|
| **Formgrove** | A growing collection of procedural forms |
| **MeshOrchard** | Asset families, reusable seeds, community cultivation |
| **ShapeGuild** | Emphasizes contributors and skilled reviewers |
| **Kitbloom** | Emphasizes coherent kits and expanding collections |

**Formgrove is my favorite for the overall project:** *Formgrove Studio*, *Formgrove Library*, and *Formgrove MCP*. **ShapeGuild** is stronger when community identity is the main emphasis.

These are brainstorming candidates, not domain or trademark clearance.

---

**What I would actually launch:** one coherent original kit, a handful of reviewed generators, configuration-based community submissions, automated checks, two-reviewer approval, and reviewed-only MCP search. Add weekly community picks for visibility and a request board for directing contributions.

That preserves your idea’s openness without equating openness with accepting everything. **The community creates and reviews; the software enforces the rules; the default catalogue contains evidence-backed assets—not merely popular uploads.**

---

## Exchange 3 — Project-name shortlist

### User

what about the project name ? polymarket is taken, openpolyfork is risky, ideas ?

### Assistant

**My strongest picks are Meshkind, Polyburrow, and Polykiln.** I’d name the whole ecosystem—not just the model shop—and keep “open-source” in the description rather than forcing “Open” into the name.

#### Names I’d seriously consider

| Name | Why I like it for your project | Main trade-off |
|---|---|---|
| **Meshkind** | Suggests *meshes + humankind*: people building a shared collection. Short, friendly, and broad enough for the generator, website, and MCP. | Does not immediately communicate procedural generation. |
| **Polyburrow** | A home for models and their creators. Friendly community identity, with room for a memorable mascot. | More playful than technical. |
| **Polykiln** | A workshop that turns raw material into finished assets. Fits your emphasis on **creation and quality**, not just uploads. | “Kiln” may be less familiar internationally; an existing GitHub username also uses it. ([github.com](https://github.com/brozeph/node-craigslist?utm_source=chatgpt.com)) |
| **MeshOrchard** | A collection people grow, maintain, and share. Particularly good for reusable generators producing many variations. | Longer than the others. |
| **Polywarren** | Suggests an interconnected world of assets, kits, and contributors. | People may need help spelling “warren.” |
| **Polysprig** | Small reusable pieces growing into bigger worlds. Good for a lightweight, approachable creation tool. | Could sound too focused on vegetation. |
| **Polynary** | More technical and abstract; I like its sound for a programmable asset system. | Less obvious meaning and pronunciation. |

**These are naming candidates, not confirmed available brands.** I screened for obvious existing uses, but have not verified domain availability, package namespaces, or trademark clearance.

#### My actual preference: **Meshkind**

For your particular idea, I think it covers the **community and software equally well**:

**Meshkind Studio** — creation tool  
**Meshkind Library** — reviewed community assets  
**Meshkind MCP** — agent access

Possible tagline:

> **Programmable 3D. Built together.**

Or something more direct:

> **Create, remix, and share procedural 3D assets.**

For a name that keeps **“Poly,” I’d choose Polyburrow**. It feels like a project with its own identity rather than a variation of Polyfork. **Polykiln** would be my choice for a more workshop-like, creation-focused identity.

#### A correction to my earlier suggestions

I’d drop **Formgrove** from my earlier shortlist: a FormGrove signup/payment service already exists. I also found **Polygrove** used for low-poly assets and **Polynook** for 3D software and tools, so I would avoid those directions. These are existing-use findings, not legal determinations. ([ubtadmin.upstatebeertourist.com](https://ubtadmin.upstatebeertourist.com/?utm_source=chatgpt.com))

**My vote: Meshkind for the ecosystem; Polyburrow for the strongest “Poly…” identity.**

---

## Export request

### User

write all we talked about to a file i can download

---

**End of discussion record.** The separate original technical report is included in the accompanying ZIP. No final project name or implementation policy was selected in the exchanges above.
