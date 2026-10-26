# Procedural Asset Toolkit — Concrete Decision and Build Plan

**Date:** 4 October 2026, Japan time  
**Working project name:** Meshkind — provisional; availability has not been established  
**First original kit:** Woodland Workshop  
**First asset:** Work lantern  
**First tested engine target:** Unity

> **Build the procedural asset-generation software first, through one good-looking, meaningfully editable, reliably exportable lantern. Then expand to one coherent six-family kit, add a small website and MCP, and introduce controlled community contributions.**

## About this record

This file consolidates the concrete recommendation and the follow-up clarification from this conversation. It preserves the chosen implementation direction, its sequence, and its qualifications. It is not a new research report or a claim that any software has already been implemented.

The user confirmed the central direction: start with the procedural asset-generation software. The detailed stack, scope, review rules, and launch gates below are the implementation plan proposed in the conversation. Working names, numerical gates, and budget targets are planning choices, not independently validated results.

References `[R1]`–`[R3]` identify the three supplied documents in the source register. External documentation pointers are retained from the discussion and supplied reports; they were not reopened or freshly verified for this export.

---

## 1. The concrete decision

**Build a local-first, open-source procedural asset toolkit focused on one coherent stylized village/workshop kit, with Unity as the first tested target. Give it a small website and MCP access after the core workflow works.**

Do not start with an open-upload marketplace, a community platform, or a fully autonomous asset factory.

Use **Meshkind** as a working name only. Do not spend money on branding yet: the documents do not establish that the name, domain, or package namespaces are available. [R3, §15]

The first product promise is:

> **Get matching stylized assets, customize them through meaningful parameters, and let your coding agent use them without manually repairing the exports.**

The software is the foundation. The website, catalog, and community should grow around a creation tool that already works.

## 2. What “build the procedural software first” means

**Do not build an enormous “generate anything” engine before making assets. Build the software through one working asset.**

The first complete workflow is:

```text
Lantern generator + validated parameters
                  ↓
              3D preview
                  ↓
       Validation and visual review
                  ↓
              GLB export
                  ↓
           Actual Unity import
```

The lantern is the test case you build the software around—not something you make after the software is “finished.” Expand the reusable parts as you add the tree, cottage, and other families.

The technical report explicitly separates an asset compiler from the authoring factory above it. Validated parameters and a versioned implementation should produce usable geometry and metadata before a larger agent organization is needed. [R1, §6.1]

### Authoring a generator is different from using it

| Activity | What happens | Role of AI |
|---|---|---|
| **Authoring** | Write or repair a procedural generator, inspect its results, and approve its supported behavior. | Use your existing coding agent to write and revise code. |
| **Consumption** | Select a reviewed generator, choose supported parameters, build a variant, and export it. | An agent may choose the parameters, but ordinary procedural execution should not require another AI generation request. |

Once a generator works, moving a supported slider should execute its procedural code—not start another neural text-to-mesh generation job. Rendering still needs an appropriate graphics path; “no neural inference per variant” does not mean “no graphics hardware anywhere.” [R1, §1]

**Valid geometry alone is not success.** The default must look good, variations must preserve the design, and the appearance must survive the actual engine and camera. [R2, §15.4]

## 3. First engineering milestone: one complete lantern

Your first milestone is **one functioning lantern**, not a beautiful storefront.

Start with four meaningful controls:

| Control | Required behavior |
|---|---|
| **Width** | Adjust the enclosure and connected parts coherently, including the hood and base where relevant. |
| **Height** | Change the intended proportion while preserving the family's construction and important openings. |
| **Handle clearance** | Preserve a readable carry opening rather than allowing the handle to disappear into the hood. |
| **Curated colorway** | Change semantic color regions without changing geometry. |

Save the configuration, rebuild it under the same pinned toolchain, and verify that the result is reproducible.

### Required end-to-end outcome

The lantern must be generated from parameters, shown in a 3D preview, rendered in diagnostic views, validated, exported to GLB, and actually imported into a pinned Unity/URP project.

Changing width must adjust related parts—not merely stretch unrelated geometry. Changing colors must not change vertex positions. The exported result must retain the intended scale, materials, and hierarchy.

These requirements combine the discussion's narrower lantern scope with the reports' original lantern examples and parameter-effect rules. They are not recovered Polyfork equations or a copy of one of its assets. [R1, §§7.1–7.6; R2, §§8.2–8.3, 11.1]

**Do not build five more generators while the first one still exports incorrectly.**

Once this complete path works, make the other five blockouts, establish the kit's visual standard, and finish the collection.

## 4. First kit: Woodland Workshop

Build **six procedural asset families**:

| Asset family | Purpose in the first kit |
|---|---|
| **Workshop cottage** | Establish architectural scale, roof shapes, and entrances. |
| **Broadleaf tree** | Establish the organic shape language. |
| **Wooden fence** | Test modular dimensions and repeated construction. |
| **Work lantern** | Test openings, connected dimensions, and semantic colors. |
| **Crate** | Provide a straightforward, useful supporting prop. |
| **Boulder** | Establish the natural ground-detail language. |

This exact roster and the name **Woodland Workshop** are the conversation's project choices. The style guide proposes designing six original assets together; it does not prescribe this exact roster. [R2, “Start here”]

### Art direction

Use the guide's **Readable Faceted Worlds** direction:

> Simplified, solid-looking objects with unmistakable silhouettes, deliberate proportions, broad semantic colors, restrained detail, and consistent treatment within the kit.

This means more than “low-poly.” Triangle count and flat shading do not replace silhouette, proportion, construction, or color decisions. [R2, §§1.3, 3]

**Approve the six blockouts together before polishing them individually.** The first lantern proves the engineering workflow; its final kit-level appearance still belongs in that shared visual review.

Use three original anchor assets:

- **Cottage:** architectural reference.
- **Tree:** organic reference.
- **Lantern:** manufactured-object reference.

These anchors establish the kit's visual standard rather than allowing each new output to redefine it. [R2, §3.4]

Give each family **three deliberately designed presets**. Keep those as presets under six catalog entries—not eighteen supposedly different assets.

For this release, do not add characters, animals, animation, procedural terrain, or another art style. Use a simple ground plane and a hand-arranged demonstration scene.

## 5. Commit to this technical stack

| Layer | Decision |
|---|---|
| Canonical geometry implementation | **TypeScript + Three.js** |
| User interface | **Browser viewer with schema-generated controls** |
| Local tooling | **Node-based CLI for building, rendering, validating, and exporting** |
| Initial delivery | **GLB + parameter JSON + versioned generator source and manifest** |
| First engine target | **Unity, tested through glTFast in a pinned Unity/URP project** |
| AI authoring | **Existing coding agent calling the CLI—not a new agent framework** |
| Agent consumption | **Local MCP server using the same catalog and build functions** |

The technical report proposes one canonical TypeScript/Three.js implementation and a glTF-first export route, with actual Unity import testing. Three.js's GLTFExporter and Unity's glTFast documentation are the retained implementation references. [R1, §§6.2, 11.5–11.6; E1–E2]

**Do not rewrite the geometry core in Rust. Do not train a model. Do not build a new coding harness for this project.**

Avoid introducing a custom embedded JavaScript runtime inside Unity at the beginning. First prove the explicit export/import path.

### Minimal MCP surface

Implement only these initial tools once the underlying functions work:

```text
search_assets
get_asset
build_variant
export_asset
```

These are proposed project tool names, not a claim about Polyfork's exact API.

They must wrap the same catalog, validation, build, and export functions used by the viewer and CLI. Do not create a second geometry implementation for agents. [R1, §12.1]

## 6. Make quality a release requirement—not a score

Use three separate approvals:

| Approval | What it must establish |
|---|---|
| **Technical** | Geometry is valid; parameters do what they claim; dimensions and anchors are correct; repeated builds behave consistently. |
| **Visual** | Silhouette, proportions, openings, color hierarchy, and kit compatibility pass inspection in neutral views and at the intended gameplay camera. |
| **Integration** | The delivered GLB actually imports into Unity with the intended scale, materials, and hierarchy. |

Use **Khronos's glTF Validator** for format checks, but retain your own geometry, parameter, and Unity tests. A format-validation pass is not an aesthetic judgment. [R1, §14.1; E3]

### Parameter coverage

For each family, test the default, individual parameter boundaries, the three curated presets, and targeted combinations likely to break connected parts.

Record the tested configurations. Preserve failures as reproducible regression cases. Do not claim that all possible combinations are approved simply because selected samples passed. [R1, §14.3]

### Visual review

Use neutral diagnostic views as well as the intended camera and presentation. The guide proposes front, rear, left, right, top, front-oblique, and rear-oblique views; its exact render settings and numerical aids remain proposed starting points rather than recovered vendor settings. [R2, §10]

**Do not turn the style guide's proposed 80/100 score into an automatic publishing button.** The guide explicitly calls that threshold uncalibrated. Serious defects cannot be compensated for by a high overall score. [R2, §13]

Use a vision model to identify defects and suggest repairs. **Keep final visual approval human during the alpha.** Keep the authoring agent from changing its own acceptance criteria.

The goal is not a generator that produces many technically valid accidents. It is a family whose default and supported variations remain deliberate, coherent, and useful. [R2, §15.4]

## 7. Bootstrap community contributions through the repository

**Start with pull requests, not a custom upload system.**

Initially, accept community contributions consisting of **configurations and presets for reviewed generators**. New generator code must go through a separate code-review process before execution and distribution.

Reviewing a preset must not be treated as equivalent to reviewing an entirely new executable package. At the same time, a reviewed generator is not proof that every configuration looks good. [R3, §7]

### Initial collection

Use the honest label:

> **Maintainer-curated alpha**

You establish the first reference examples. Do not describe your own initial curation as independent community certification.

### Broader community review

Before opening a broader submission queue, recruit **two qualified non-author reviewers** and have them complete real reviews against the established examples.

Then use this proposed starting approval rule:

> **Mandatory tests pass + two independent qualified approvals + no unresolved substantiated blocker.**

New executable generator code also needs relevant maintainer code review. These are starting policies to calibrate, not proven optimal thresholds. [R3, §10.2]

Approval belongs to the exact version and reviewed presets. A newly generated slider combination must not inherit a claim that humans inspected it. [R3, §12.2]

**Do not build votes, reputation levels, weekly promotion algorithms, or federation yet.** Keep Workshop and Featured sections in the later backlog. The community should help maintain a demonstrated standard—not be asked to discover that standard through popularity.

## 8. Keep the first website and operating model small

Build a **curated catalog with previews, parameter controls, downloads, and a link to contribute**.

Keep catalog metadata in versioned JSON initially. Skip accounts, a database-backed social platform, and billing.

### Hosting direction

Use **Cloudflare Workers Static Assets** for the viewer/catalog and **R2** for packages and previews. Generation remains on the user's machine. Publication validation stays outside the public serving process.

Set a **$50/month initial serving budget**, with model usage and validation work tracked separately.

This is a spending target—not a promise about an unlimited service. The earlier answer recorded a $5/month minimum for Workers Paid and described R2 as charging for storage and operations, with allowances and no internet-egress charge. Those vendor details are retained as prior discussion context, not a newly verified quote. Recheck the linked pricing before deployment. [E4–E5]

**Do not subsidize everyone's AI calls or buy GPU infrastructure.**

Keep the distinction between authoring, review, and serving costs visible. Cheap file delivery does not establish cheap unlimited asset creation or review. [R1, §15.3; R3, §4]

## 9. Licensing, provenance, and executable-code boundaries

The proposed licensing direction is:

| Material | Initial choice |
|---|---|
| Your software | **Apache-2.0** |
| Separately designated original starter-asset content | **CC0** |
| Third-party components or material | Preserve applicable permissions and notices; do not relicense material you do not control. |

Require explicit contributor permission for published content. Using the tool must not automatically publish or relicense someone's private work. Code and content permissions must remain clear. [R3, §3.4; E6–E7]

Implement original functionality, examples, fixtures, and assets. Do not treat a public connector's license as permission to redistribute a proprietary catalog. The supplied documents' licensing discussion is a development-boundary warning, not legal clearance. [R1, §2.3; R2, §15.3]

### Execution boundary

Do not execute submitted generator code in your API or a credential-bearing development environment.

A JavaScript context alone is not a security boundary. The report and the prior answer specifically reference Node's warning about treating `node:vm` as isolation for untrusted code. Code review and appropriate isolated execution are separate requirements. [R1, §12.5; E8]

Configuration-only contributions for reviewed generators keep the initial contribution surface narrower. They do not justify ignoring validation or provenance.

## 10. Earn the right to expand

Use this proposed expansion gate:

> **Get five external Unity developers to try the kit. Require at least three to customize assets and use them in their own scenes without you manually repairing their exports. Get one outside contributor's preset accepted through the contribution process.**

These are practical project gates chosen in the conversation—not statistically validated market thresholds.

Until those outcomes happen, improve the existing six families and their workflow. **Do not respond to weak adoption by adding fifty more assets.**

The files support an engineering direction. They do **not** establish demand for the future service or prove a subscription business. Treat the alpha as a test of usefulness and contribution—not an income forecast.

## 11. Build order and scope boundaries

| Stage | Deliverable | Gate before advancing |
|---|---|---|
| **1. Lantern vertical slice** | Generator, controls, preview, diagnostics, saved configuration, validation, GLB, and real Unity import. | One good-looking, meaningfully editable, reproducible, reliably exported asset. |
| **2. Shared kit blockout** | Cottage, tree, fence, lantern, crate, and boulder shown together. | Silhouettes and color blocks belong to one visual system. |
| **3. Six-family kit** | Finished families, three curated presets each, and a hand-arranged demonstration scene. | Technical, visual, parameter-boundary, and integration checks pass for the declared coverage. |
| **4. Small catalog and MCP** | Curated website and four thin MCP tools over the shared functions. | Humans and agents can find, customize, and export the same versioned assets. |
| **5. Controlled contributions and pilot** | Repository-based preset contributions, scoped review, and external Unity testing. | The five-developer, three-successful-use, one-contributor gate is met before broad expansion. |

These are dependency-based milestones, not delivery-time estimates.

### Explicitly deferred

Do not start with a universal generator, a new neural model, a new coding harness, a Rust geometry rewrite, or a fully autonomous authoring factory.

Do not add characters, animals, animation, procedural terrain, multiple art styles, or every export format to the first release.

Do not build open uploads, account systems, billing, voting-based approval, reputation algorithms, federation, or unlimited cloud generation before the small product works.

The existing coding agent is enough to help author and repair the first generator. Larger automation can come later, above tested contracts rather than in place of them.

## 12. First task to give your coding agent

> Build the first vertical slice of a local-first procedural asset toolkit using TypeScript and Three.js. Implement one original work-lantern generator with width, height, handle-clearance, and curated-colorway controls. Add a schema-driven viewer, saved parameter configuration, repeatable builds, fixed diagnostic views, geometry validation, and GLB export. Verify the exported result in a pinned Unity/URP project using glTFast. Keep geometry generation shared between the viewer and local tooling. Do not implement accounts, billing, community uploads, terrain, animation, or agent orchestration.

## 13. Final clarification

**Yes: the procedural asset-generation software comes first.**

But the immediate job is not “finish the complete creation platform and then make some models.” It is:

> **Build the smallest tool that produces one good-looking, meaningfully editable, reliably exportable lantern. Then expand it.**

The lantern is both a real asset and the first end-to-end test of the software. Technical reliability and appearance belong in that first milestone together.

**One working lantern → one excellent six-family kit → a small website/MCP → controlled community contributions.**

Build the ecosystem around something people already find useful—not before it exists.

---

## Source register

### Supplied documents

**[R1] Polyfork: technical research and independent implementation blueprint**  
Uploaded as `Polyfork_Technical_Research(3).md`; research date 4 October 2026. Relevant sections: §1, authoring versus consumption; §6, proposed architecture and language choices; §7, parameters and reproducibility; §11, export and Unity; §12, shared services and security; §14, acceptance tests; §15, roadmap and costs. Its architecture is an independent proposal, not an audited recovery of Polyfork's private implementation.

**[R2] Procedural Asset Art-Direction Guide — A visual study of Polyfork, translated into an original style system**  
Uploaded as `Procedural_Asset_Style_Guide(1).md`; version 1.0, 4 October 2026. Relevant sections: “Start here,” six-asset exercise; §3, Readable Faceted Worlds and anchor assets; §8, meaningful variations; §10, inspection; §11, original worked examples; §13, uncalibrated rubric and blockers; §15.4, the actual visual target. Proposed visual rules are not recovered private Polyfork settings.

**[R3] Open Procedural 3D Ecosystem — Complete discussion and planning record**  
Uploaded as `Open_Procedural_3D_Ecosystem_Discussion(1).md`; conversation date 4 October 2026. Relevant sections: §3, licensing boundaries; §4, hosting assumptions; §7, contribution paths; §10, reviewers and starting approval policy; §12, version-specific quality records; §15, provisional names. This records earlier proposals; the narrower build-first sequence in the present file is the later conversation recommendation.

The source reports are not reproduced or bundled in this single-file export.

### Retained external documentation pointers

These are references already present in the conversation or supplied reports. No fresh source verification was performed for this export. Package versions, pricing, and permissions should be checked when implementing or deploying.

- **[E1] Three.js GLTFExporter:** https://threejs.org/docs/pages/GLTFExporter.html
- **[E2] Unity glTFast documentation, version cited in the report:** https://docs.unity3d.com/Packages/com.unity.cloud.gltfast@6.19/manual/index.html
- **[E3] Khronos glTF Validator:** https://github.com/KhronosGroup/glTF-Validator
- **[E4] Cloudflare Workers pricing:** https://developers.cloudflare.com/workers/platform/pricing/
- **[E5] Cloudflare R2 pricing:** https://developers.cloudflare.com/r2/pricing/
- **[E6] Apache License 2.0:** https://www.apache.org/licenses/LICENSE-2.0
- **[E7] Creative Commons CC0:** https://creativecommons.org/publicdomain/zero/1.0/
- **[E8] Node.js vm documentation:** https://nodejs.org/api/vm.html

**End of decision record.**
