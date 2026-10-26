# Polyfork: technical research and independent implementation blueprint

**Research date:** 4 October 2026 (Japan time)  
**Purpose:** Understand the publicly observable system well enough to design an independent, open-source implementation.  
**Status:** Public-source research, not an audit of Polyfork's private code, infrastructure, or generation pipeline.  
**Included:** Evidence register, image audit, contracts, uncertainties, proposed architecture, original schemas, acceptance tests, and a small independently written numerical reference.

## How to use this report

Read Sections 1–4 for what the evidence actually establishes. Section 5 translates the images into visual evaluation targets. Sections 6–15 are an **independent engineering proposal**, not a recovered Polyfork implementation. Section 16 records unresolved questions and safe ways to close them. The appendices contain the source register and machine-readable companion files.

The useful distinction is not simply “known” versus “unknown.” A feature can be documented, illustrated, partially implemented in a public connector, and still not have been tested by this research.

| Label | Meaning |
|---|---|
| **DOCUMENTED** | A primary page describes the interface or behavior. This verifies the documentation exists, not that all implementations satisfy it. |
| **REPORTED** | A creator or official announcement supplies a measurement, outcome, history, or operational claim. |
| **VISUAL** | An actual published image was inspected. Only visible properties are established. |
| **INFERRED** | A plausible explanation consistent with the evidence, not a disclosed internal implementation. |
| **PROPOSED** | An original design or acceptance criterion for an independent system. |
| **UNKNOWN / NOT TESTED** | Public evidence was insufficient, access failed, or an execution test was not performed. |

Source references such as [S15](#s15) link to the source register. Machine-readable records also identify partial access and blocked sources. No private credentials, paid downloads, purchase operations, or account actions were used.

---

# 1. The central finding

**The most defensible reconstruction is a code-based content factory feeding a deterministic asset platform—not a new neural text-to-mesh model executing every time someone moves a slider.** The historical submission describes the authoring loop; the expanded architecture below combines public contracts with a proposed engineering decomposition. [S01](#s01) [S15](#s15) [S16](#s16) [S21](#s21) [S31](#s31) [S34](#s34)

Separate two systems when building an alternative:

```text
AUTHORING SYSTEM — occasional, expensive, iterative
Original brief + style contract + licensed references
            ↓
Asset-family selection or new procedural implementation
            ↓
Parameters/configuration + generated geometry
            ↓
Structural tests → renders → criticism → repairs → approval
            ↓
Versioned asset package and catalog metadata

CONSUMPTION SYSTEM — frequent, predictable, comparatively cheap
Human or agent → search → inspect schema → choose parameters
            ↓
Local procedural execution OR cached/server-side export
            ↓
Meshes, materials, named parts, skeletons, animation data
            ↓
Scene composition, grounding, staging, engine integration
```

**INFERRED:** The first system is where much of the authoring difficulty and possible model expenditure lives. The second should not need an LLM simply to evaluate a valid parameter combination. Rendering still needs a graphics implementation; “no neural inference per variant” is not “no GPU anywhere.”

**PROPOSED:** Recreate the observable contracts and quality gates before trying to reproduce an unspecified agent organization. A small library whose variants are coherent, editable, correctly grounded, and exportable is a better first milestone than a large library of superficially similar pictures.

## 1.1 What was—and was not—accessed

This research inspected primary product documentation, all seven articles surfaced in the blog index, an API description, the public Unity repository's README/license/changelog, catalog examples, official award reporting, public social/event material, and **17 published images**. The source register has **74 records**, including images and foundational technical documentation. [S14](#s14)

Important limits:

- The requested **Devpost page returned a JavaScript anti-bot response when opened directly**, but a later search recovered extensive indexed project text, captions, and a visible update entry. Section 3.0 uses that material with historical/indexed-content qualifications; the complete current update history and embedded media were not audited. [S34](#s34)
- Executable asset modules, actual GLB files, a live catalog JSON response, and the complete Unity C# source tree were **not** downloaded, executed, or audited. API-index access succeeded; several deeper fetches did not. Browser-tool and runtime-network limits are not evidence that Polyfork's endpoints are broken.
- Website images were genuinely viewed, but the WebGL creator, slider interactions, videos, and end-to-end imports were not exercised. Screenshots cannot establish frame rate, topology, exact contacts, or absence of clipping.
- No primary source established the complete private factory's source, exact prompts, current model roster, per-asset cost, or production deployment topology. Absence from this search is not proof that no further public material exists.

The included numerical code passed 14 local unit tests of **our own proposed mathematics on original fixtures**. It does not test Polyfork.

---

# 2. Product scope, commercial context, and provenance

## 2.1 Current public snapshot

**DOCUMENTED, observed 4 October 2026:** The homepage showed **1,922 assets**, **806 free**, and **232 additions over seven days**. It advertises editable procedural modules plus GLB, FBX, USDZ, and OBJ exports, themed kits, agent access, and character customization. Free eligibility is described as fewer than 600 triangles. These are site counters and product claims, not a separately downloaded inventory. The stated “about a third” free conflicts with the displayed fraction: 806/1,922 is approximately **41.9%**. [S01](#s01)

**REPORTED historical context:** XPRIZE identifies Polyfork as the **$500,000 Build with Gemini XPRIZE winner**. Its announcement attributes the project to Lucas Martinic and reports an earlier snapshot of **583 models, $4,428 revenue, 54 paying customers in the first month, and 175+ assets per week**. These are historical figures, not present-day revenue, audited recurring revenue, or proof of the factory's margins. Prize money is separate from customer revenue. Participation in a Gemini competition does not establish that every production component uses Gemini. [S33](#s33)

## 2.2 Pricing and distribution economics

**DOCUMENTED snapshot:** Personal pricing lists **$15/month**, **$149/year**, and a **$100 Lifetime** offer with **64 of 200 seats remaining** when read. The FAQ distinguishes an earlier Founders cohort from newer Lifetime places. Downloaded-file rights and continuing hosted services are different: cancellation affects ongoing service access, while previously downloaded assets retain the stated usage rights; a grace period is described. Reduced pricing is advertised at **$50 for two years** subject to approval. These offers and remaining-seat counts are volatile. [S08](#s08)

**DOCUMENTED platform terms:** The platform page lists **400 assets / $299 monthly**, **1,000 / $699**, **2,000 / $1,499**, and a full-catalog arrangement **from $2,900 monthly**. Associated monthly user limits are 5,000 / 25,000 / 50,000 / 100,000; slot swaps and support vary. This is licensed distribution inside products, not permission to redistribute the raw library or turn it into a competing generator's training/evaluation corpus. A separate arrangement may be required for a materially different use. [S09](#s09)

**PROPOSED economic lesson:** Keep an open-source core usable offline. Optional hosting can charge for managed builds, catalog delivery, collaboration, storage, or compute—not for an unavoidable model call on every adjustment. The public evidence does not supply Polyfork's actual hosting bill or margin.

## 2.3 Source availability and license boundary

**DOCUMENTED:** The Unity connector has a public **MIT license**. That license is evidence about the connector code, not the ownership or openness of the asset catalog, authoring engines, images, or production prompts. Required notices and third-party dependency terms still matter when reusing it. [S32](#s32)

**DOCUMENTED terms, not legal advice:** Polyfork permits commercial use of its assets in projects but restricts redistribution of assets or modules, including modified versions. Its catalog license also restricts using modules, meshes, renders, or accompanying text for training, fine-tuning, evaluation, or benchmarking of a commercial asset generator. Personal study, research, and experiments are described separately. The wording covers more than merely training a neural model. An open-source label alone should not be assumed to override those conditions. [S07](#s07)

**PROPOSED clean implementation boundary:** Use public descriptions to identify capabilities and study interfaces. Write your own geometry engines, parameters, examples, prompts, tests, and artwork. Do not package Polyfork's catalog or a scraped render corpus with the project. Keep independent reference assets and contributor provenance. Obtain explicit permission or qualified legal review before using their material in a public/commercial generator's evaluation or development dataset.

The downloadable pack contains original writing and original design examples, **not a mirror of Polyfork's pages, images, or assets**.

## 2.4 What the historical implementation reveals

**REPORTED in the public changelog:** An August 2026 incident identifies **PHP-FPM** behind the service: a five-worker pool was saturated by concurrent catalog/thumbnail requests and was raised to sixteen. The same history records a badly trimmed embedded JavaScript runtime: only **43 of 578** modules initially built. Missing geometry utilities and classes caused most failures; a later fix tested the real import bridge and reported **579 of 579** building. This establishes historical PHP involvement and real integration failure modes—not today's full backend architecture or an independent reproduction of those test results. The newest visible changelog heading was version 0.19.0, dated August 18. [S31](#s31)

**DOCUMENTED privacy surface:** The privacy page identifies Stripe for payments and Google profile/email data for Google sign-in, alongside server logging and measurement disclosures. Its advertising/tracking qualification should not be flattened into an absolute “no third-party tracking” claim. It does not establish a database engine, hosting provider, queue technology, or current worker fleet. [S10](#s10)

---

# 3. Public technical contracts: evidence inventory

These capsules concentrate source-derived facts. Later implementation sections are proposals and should not be read as additional private facts about Polyfork.

## 3.0 Factory workflow disclosed in the indexed submission

**REPORTED, historical indexed submission:** Gemini produces briefs/reference art; another agent writes procedural code; a harness renders seven canonical views and measurements; a separate fresh-session agent judges against kit rules. Roughly two-thirds of over 1,000 attempts were returned. Finished models receive human review; the creator reports 633 send-backs across 349 assets.

Build lessons are distilled into a shared file loaded before subsequent work; 40% reportedly originate from human-unseen builds. Retained sessions include briefs, module attempts, renders, judgments, owner feedback, and lessons. An external API-user agent files replayable problems; proposed changes receive human approval. Training on this corpus is a future plan, not an established deployed model.

The snapshot reports 14,524 API/MCP calls across 29 keys and an August 1 launch/first sale. The visible August 17 Devpost entry is a platform record, not necessarily the business start. [S34](#s34)

## 3.1 Asset and helper module surface

**DOCUMENTED:** The reference describes a synchronous `createAsset(params?)` returning a `THREE.Group`, with parameter declarations and presets. Optional exports include named pivot rigs, detachable parts, night-light zones, and decal metadata. A pivot rig is distinct from a skinned skeleton. The published example import map pins Three.js 0.180; this is not proof every later build uses that version.

Kit bundles describe layout/parts metadata and helper modules for assembly, staging, clips, merging, and cities. The assembled interface exposes queries such as `blocked`, `spots`, `surfaceAt`, `groundAt`, and scene helpers. Some materials are exceptions to the dominant flat vertex-color convention. Decal support includes defined attachment rectangles and a limited flat-art/SDF path; it does not establish arbitrary shader portability. Paid links and private CDN tokens have different lifetimes and purposes from API authorization. [S03](#s03)

**UNKNOWN:** Exact family source, metadata evolution rules, shader implementations, and whether every published asset implements every advertised optional export consistently.

## 3.2 REST discovery, search, terrain, and quotas

**DOCUMENTED:** The API index lists `/api/assets`, individual assets, `/matching`, `/variant?want=`, `/api/kits`, `/api/terrain`, and `/api/me`, plus demand/checkout operations. Asset filters include text, class, free status, kit, IK category, triangle bounds, sorting, pagination, and compact fields; maximum page size is 100. Text search is described in terms of word matches and coverage, not verified vector embeddings.

The coordinate contract is meters, Y-up, +Z forward. Origins require interpretation: ordinary ground assets differ from installed-height fixtures and terrain. Terrain endpoints describe sampling, edge information, scatter, and profiles. Advertised novel-bake limits are **anonymous 40/hour and 100/month**, **free account 100/hour and 300/week**, **paid 900/hour without a weekly cap**; cached responses do not consume the same allowance. Paid previews may preserve triangle fidelity while flattening structure or removing normals, so a preview is not necessarily an equivalent downloadable rig. [S02](#s02)

**NOT TESTED:** Actual returned catalog records, authentication, cache accounting, generated variants, and error behavior on the live service.

## 3.3 Agent-facing interpretation and animation contracts

**DOCUMENTED:** The working instructions distinguish matching a requested appearance to real schema values from simply passing arbitrary adjectives. A variant response's notes matter: a color-only suggestion can include a baseline GLB while the procedural call carries the requested change. Parameters are grouped into color, choice, toggle, and range types.

The instructions describe humanoids with **22 Mixamo-style bones**, a T-pose contract, and normalization of hip translation for differing body proportions. They also describe animation helpers and an index containing **17 clips**, with locomotion-speed and update calls. This is newer, richer behavior than treating every asset as an unanimated mesh. R3F integration and optional ticking are discussed. Older wording about kit sales and Founders-specific exports coexists with newer subscriptions and Lifetime wording; entitlements should be verified against the actual account/API rather than inferred from one instruction file. [S04](#s04)

**UNKNOWN:** Exact clip licenses, complete motion corpus, every asset's supported animation subset, and the accuracy of retargeting across all parameter combinations.

## 3.4 MCP surface

**DOCUMENTED:** The agent page names twelve tools: `search_assets`, `get_asset`, `find_matching`, `get_variant`, `preview_scene`, `list_kits`, `get_kit`, `get_terrain`, `who_am_i`, `buy_plan`, `get_help`, and `report_need`. The advertised endpoint uses JSON-RPC over HTTP POST, with no SSE or session setup in that implementation. Public browsing differs from entitled downloads. The documentation describes short-lived paid download links.

A tool returning a checkout URL is not evidence that a purchase completes without user approval. Nor does an MCP interface imply an autonomous, private multi-agent authoring factory: it can expose an ordinary deterministic catalog service. [S05](#s05)

**NOT TESTED:** Tool execution, payload schemas for all tools, protocol negotiation, image transport, rate-limit handling, or client compatibility.

## 3.5 Browser performance measurements

**REPORTED vendor benchmark:** The July 28, 2026 performance page specifies Node 22.22.1, Three.js 185, eight warm-ups, and medians over 25 runs. CPU hardware is not identified. Representative default builds:

| Asset | Triangles | Build median | Module / gzip | GLB / gzip |
|---|---:|---:|---:|---:|
| Street lamp | 422 | 0.85 ms | 13.0 / 4.9 KB | 45.7 / 6.3 KB |
| Rocket | 618 | 2.61 ms | 13.4 / 4.9 KB | 66.3 / 7.9 KB |
| Windmill | 1,811 | 4.95 ms | 27.3 / 9.2 KB | 194.2 / 26.6 KB |
| Convertible | 4,784 | 9.95 ms | 26.7 / 8.6 KB | 365.4 / 32.5 KB |

The page also reports twenty rebuilt copies at 206.40 ms versus clones at 3.60 ms, and one small static merge at 0.70 ms. These measure selected CPU/build operations—not universal application frame rates or total end-to-end latency. Material reuse, resource cleanup, and idle behavior are part of its performance advice. [S06](#s06)

**NOT TESTED:** Independent reproduction, mobile performance, tails under load, current asset-version equivalence, or the advertised memory multiplier.

## 3.6 Kit design and procedural asset coverage

**REPORTED:** The WorldClaw comparison describes Polyfork kits planned around a shared **32-color palette**, grid, and style contract. The page reports **1,899 program-based assets** and **23,152 declared knobs** in a 1,922-asset catalog. It says knobs must visibly change rendered output without breaking the model before publication. A pine example uses one parameterized module for variations rather than separately generated meshes. A sample wooded scene is reported at **178 instances, seven asset types plus terrain, and 51,741 triangles**.

This article analyzes Tencent's separate WorldClaw pipeline. Names of models, agents, or image-to-3D systems used in that discussion must **not** be relabeled as Polyfork's private stack. Page counters may be live-updated: the numbers cannot safely be dated to the original article publication simply because the heading says August 11. [S21](#s21)

**UNKNOWN:** Why the program count is 23 lower than the displayed asset count, and the exact implementation and completeness of the knob-validation gate.

## 3.7 Catalog granularity and representative complexity

**DOCUMENTED:** The kit index includes published, filling/in-production, and commissioned/steered collections. Themes span natural environments, buildings, city sets, vehicles, characters, and specialized props. A kit's planned part count is not always its published count; status and dates must accompany comparisons. [S22](#s22)

The Cozy Farm page describes a **60-part**, **1-meter-grid** set with shared season handling. Listed triangle counts illustrate actual scope: rock 140, fence 248, crate 308, beehive 420, hay 582, barn 652, farmhouse 908, pig 1,005, tractor 1,720, farmer 3,807. Low-poly therefore does not mean every useful asset fits the free threshold. These values are catalog declarations rather than counts independently computed from files. [S23](#s23)

The Tall Pine page supplies a concrete free-asset entry and import/embed routes; terrain pages expose separate paid catalog parts. These confirm discoverable product surfaces, not executed module behavior. [S24](#s24) [S25](#s25) [S26](#s26)

## 3.8 Human-facing commission workflows

**DOCUMENTED offer:** The kit-commission page presents a brief/reference → palette/grid/parts plan → three visual directions → selection/revision → approval/publication workflow. It advertises roughly sixty planned parts, a **24–48 hour** review/publishing window, and **$85 public / $200 private** options. Some older wording uses a different part count. These are offered workflow and turnaround claims, not measured service-level guarantees or a disclosed orchestration graph. Its factory hero is an illustration, not evidence of the internal system. [S11](#s11) [V17](#v17)

The custom-character page asks for **one to three outfit references**, a description, and **$9**, with roughly an hour advertised. It describes fitting a shared stylized humanoid system rather than reconstructing a person's exact head or body. Default outputs are public/non-exclusive, delivered as GLB and module/configurable content; feedback can cause a rerun. This is not evidence of arbitrary realistic character reconstruction or a custom-animal service. [S12](#s12)

The creator page's textual shell was readable, but the interactive garment/character workflow was not tested. [S13](#s13)

---

# 4. The most revealing engineering disclosures

## 4.1 Characters: family configuration, clothing fit, and deformation

**REPORTED:** The character article describes a shared engine rather than unrelated per-character meshes: body controls, expressions, palettes, and fourteen wear slots. Its publication snapshot says 79 of 163 characters had migrated. Build time is reported around 14 ms.

A fitting service returns body cross-sections at anatomical stations. Clothing uses layer-dependent clearance; listed offsets include **0, 13, 23, 36, and 50 mm**. The article identifies an important failure: approximate head-fit geometry disagreed with the actual box-like head. Bone names/hierarchy remain compatible while lengths change, so “fixed skeleton” should not be interpreted as identical joint positions. Ring-based weighting is used for bending.

Disclosed checks include clothing fit rays, visibility/culling comparisons, walking poses, open seams, disconnected or swallowed parts, silhouette comparison, and triangle limits. The example configuration space reaches **30,336 combinations before colors**. Some clothing failures were explicitly still present at publication; that is not proof they remain today. [S15](#s15)

**UNKNOWN:** Exact station formulas, garment meshes, slot coverage rules, skinning coefficients, automated repair policy, and pass thresholds across the entire parameter space.

## 4.2 Animals: body families, multiview fitting, and human override

**REPORTED:** Animals v2 describes 47 animals built around shared body-family engines. Soft regions use joint-aware rings/weights; rigid features are attached separately. Land and water families receive different locomotion sets, with baked clips in exported GLBs.

The disclosed fitting process uses front/side/rear references, silhouette masks, camera alignment, and intersection-over-union (IoU). Example side-view scores improve **warhorse .79→.84, cat .63→.75, koi .62→.64, tarantula .64→.67**; pigeon remains .88. These are vendor examples, not a general quality benchmark. A cat receiving an automated **8.2/10** still needed four human-directed revisions, showing that its judge was not treated as reliable by itself.

The HD presentation is described as added material/normal/environment treatment while keeping the underlying geometry and animation system—not a proven higher-resolution mesh reconstruction. [S16](#s16)

**UNKNOWN:** Reference provenance, segmentation model, optimizer, loss weights, camera-calibration accuracy, skeleton generation formulas, and the distribution of successful versus failed animal jobs.

## 4.3 Kits as executable places

**REPORTED:** The scene article explicitly says its compositions are **hand-authored**. It describes packaged layouts, spatial queries, staging, static batching, and cities assembled from lot-like structures. Examples include **617 placements / 60 parts** for a farm and **524 / 46** for Tokyo. A reported merge reduces roughly **880 draws to 12**, while dynamic pieces stay separate.

Collision is approximated by geometry relevant to a walking character rather than every overhead branch or wire. Lighting presets, day/night treatment, and batched light-pool effects contribute substantially to the presentation.

A small agent comparison uses two briefs and three blinded judges. The farm example reports **$1.63 and 11 minutes versus $3.08 and 26 minutes**; another task does not improve overall cost or time. These vendor experiments are suggestive, not broad proof of agent productivity. [S17](#s17)

**UNKNOWN:** Layout authoring tools, lot extraction code, full navigation semantics, instance/merge partitioning, and generalization beyond the selected tasks. Do not assume the private factory autonomously designed every showcased composition.

## 4.4 Inverse kinematics and ground contact

**REPORTED:** The IK article describes analytical two-link solving, travel-distance-based motion, terrain sampling at touchdown, planted-foot anchors, body support adjustment, and angle limits. Its publication snapshot counts 57 solvable assets. Tests examine actual resulting foot motion, not merely requested target positions.

Examples include flat ground, a **12% slope**, and a **1.5-meter ripple**. Reported drift examples are cargo robot **0 mm**, companion **4 mm**, rabbit **12 mm**, and tiller **70 mm**. A nearly fully extended leg illustrates why tiny reach margins matter; a restricted arm illustrates unreachable targets and nonzero residual. The exported flat walking clip is distinct from the runtime terrain-adaptive solver. [S18](#s18)

**UNKNOWN:** Exact gait curves, support-state transitions, stability heuristics, foot-contact definitions, solver damping, and tests for arbitrary steep terrain, turning, or moving platforms.

## 4.5 Terrain: geometry continuity versus visual continuity

**REPORTED:** Terrain uses **64-meter chunks**, selectable **0.5/1/2/4-meter** sampling, and a **4-meter edge region** where local features fade toward shared world-space terrain. Neighbor independence relies on agreeing at common coordinates, not stitching unrelated arbitrary meshes after generation.

The seam test reports matching 129 boundary samples at 0.5-meter pitch. Color continuity was addressed separately with a **14-meter blending region**; a reported seam metric improves from .575 to .0097 through iterations. That metric is not established as perceptual quality. Rivers/channels, flatter pooled water, and downstream changes are discussed separately from the main ground surface. Larger spans and flattening controls are described while preserving the boundary contract. [S19](#s19)

**UNKNOWN:** Exact noise/hash functions, color ownership rule, normal continuity, corner handling, mixed-resolution stitching, river-network continuity across chunks, and the complete implementation of sampling/scatter queries.

## 4.6 Shader treatments and export boundaries

**REPORTED:** The shader article discusses seven looks despite “six” in its URL. Its portable palette path rewrites vertex colors, with unlit treatment where appropriate. Other looks rely on rendering behavior: toon bands, inverted-hull outlines, ordered dithering, reduced-resolution pixel rendering, projection-space snapping, and underwater absorption/caustics.

The article distinguishes changing asset data from changing the renderer. It also identifies color-space mistakes and shader-hook composition as practical problems. A GLB should not be assumed to carry arbitrary Three.js shader modifications into another engine. Some appearances can be baked or translated; others need engine-specific implementations. [S20](#s20)

The separate shader product page exposes a useful discovery surface for previewing available looks, but no cross-engine rendering equivalence was tested here. [S28](#s28)

**UNKNOWN:** Complete shader source, exact device compatibility, material extension combinations, and which export paths bake, approximate, omit, or preserve each effect.

## 4.7 Unity: the most concrete public implementation foothold

**DOCUMENTED / REPORTED:** The integration page targets Unity 6000+, with glTFast and Newtonsoft dependencies. The GitHub distribution embeds a QuickJS/PuerTS-based JavaScript path for editor-side procedural execution; a store-oriented build and player/runtime paths differ. Described editing paths include local geometry builds, direct color changes, topology-preserving interpolation, and server-baked results.

Vendor timings include approximately **20–140 ms** local rebuilds, **0.05 ms** interpolation after setup, and around **120 ms** server work/latency in the described case. These are not transferable guarantees. Prefab-oriented integration is intended to retain parameters and surrounding user edits. Skinned and pivot-animated cases require different handling. [S29](#s29)

**DOCUMENTED README:** Useful navigation names include `PolyforkGalleryWindow`, `PolyforkAssetImporter`, `PolyforkClient`, `PolyforkParams`, `PolyforkColorSlots`, and `PolyforkRemixable`. The README discusses classification by what a knob affects, not simply its UI type; string/number distinctions; parameter snapping; cache behavior; and fallback results. In particular, color-only server variants can remain baseline while local remapping applies the color intent. An `x-remix` distinction between exact and fallback results is documented. These are contracts and implementation notes, not a full source audit. [S30](#s30)

**PROPOSED lesson:** Reuse or study the MIT connector only within its license, but do not equate that with permission to copy the proprietary catalog. Test the full execution-to-engine path, including parameter typing, transforms, materials, disposal, animations, and error reporting.

## 4.8 Social posts, demonstrations, and missing disclosures

The readable creator launch post frames the product around web/XR development and programmable assets; it does not disclose a complete build-agent architecture. A question in a comment is not the creator's answer. [S36](#s36)

Additional searches surfaced a hand-demo post, promotional launch material, an X post, and a YouTube short. Access varied from readable promotional text to search snippets; their videos were not watched or transcribed. No factual claim about their unseen demonstrations is used as a verified capability. [S37](#s37) [S38](#s38) [S39](#s39) [S40](#s40)

A creator-profile search snippet claims approximately $504.5k for Polyfork within September receipts. Because the full post and accounting breakdown were not inspected—and the separately verified prize is $500,000—this must not be presented as subscription sales, recurring revenue, or operating profit. [S44](#s44)

An event listing advertises a talk about building Polyfork and winning the prize, with historical production-scale claims. It is not a recovered recording or transcript. A counterpart search result listed **October 28, 2026**, which is **after** this report's date; it cannot be evidence of a presentation already reviewed. [S41](#s41) [S42](#s42)

## 4.9 Documentation tensions that matter to an implementer

| Apparent claim | More careful interpretation | Engineering consequence |
|---|---|---|
| Every asset is a program | Program and asset counters differ | Model capability flags individually; do not assume uniform support. |
| A fixed skeleton | Naming/hierarchy compatibility does not imply fixed joint coordinates | Version the skeleton contract and test proportion-dependent retargeting. |
| Flat vertex-color materials | Some assets and HD treatments use richer materials | Design material exceptions before exporting everything through one shader. |
| A full-fidelity preview | Geometry count can be retained while useful structure changes | Separate preview capability from entitled runtime capability. |
| Instant editing | Different changes take different local/server/interpolation paths | Report the actual path and end-to-end latency. |
| A requested variant | A response can contain fallback or baseline data | Return requested parameters, applied parameters, and exactness separately. |
| Seamless terrain | Height, normals, colors, water, and mixed LOD are different problems | Test each boundary property independently. |
| An AI-built scene | Some published compositions are authored by hand | Start from a scene compiler, not a presumed autonomous layout agent. |
| A rendered appearance exports | Renderer effects and standard asset data are different | Publish a per-format feature matrix and explicit losses. |

These are interpretations of the evidence capsules above, **not findings from executing the live product**.

---

# 5. Image audit: what the results actually look like

The 17 image records below link to original first-party files in the source register. The images are not redistributed in this pack. The important discipline is to translate visible results into tests without treating an attractive still as a measurement.

| Image | Visible evidence | Not established by the image |
|---|---|---|
| [V01](#v01), pig comparison | Fuller silhouette and spotted treatment versus the earlier angular pig | Watertightness, skin weights, or animation quality |
| [V02](#v02), pig references | Front/side/rear presentation on a neutral background | Calibrated cameras or exact orthographic projection |
| [V03](#v03), HD animals | Added surface detail while silhouettes remain visibly faceted | Byte-identical geometry or universally improved appearance |
| [V04](#v04), village | Dense red-roof composition with coherent terrain, palette, and prop scale | Autonomous placement, navigation, or runtime performance |
| [V05](#v05), time of day | Similar arrangement under substantially different lighting | Dynamic light count or the cost of those looks |
| [V06](#v06), landscape | Coast/shelf beside wooded low-poly terrain | Exact shared boundary coordinates |
| [V07](#v07), seam comparison | Sharp color division becomes a more gradual transition | Crack-free corners, normal continuity, or mixed-resolution support |
| [V08](#v08), arm | Two articulated poses with target labels | End-effector residual or robust joint-limit enforcement |
| [V09](#v09), walker | Feet appear supported on flat and rolling surfaces | Temporal foot locking or stability while turning |
| [V10](#v10), shaders | The same recognizable form receives distinct rendering treatments | Portable shader behavior in another engine |
| [V11](#v11), Unity gallery | Search/filter/catalog UI, selected asset, preview, controls | Present inventory size or real interaction latency |
| [V12](#v12), Unity remix | Colors, proportions, counts, toggle-like controls, undo | Correct execution of all parameter combinations |
| [V13](#v13), Unity scene | A galleon in a scene with prefab parameters in the Inspector | Collider, animation, or user-edit preservation after rebuild |
| [V14](#v14), green camper | Distinct body, roof, and trim zones | How the recoloring is implemented |
| [V15](#v15), blue camper | Comparable proportions with changed body color | A geometry rebuild |
| [V16](#v16), red camper | Another body/accent combination | Exhaustive combination validation |
| [V17](#v17), factory artwork | An illustrative conveyor/robot-arm metaphor | The actual factory UI, agents, prompts, or infrastructure |

A character-article cover image could not be fetched; it is deliberately not counted as visually inspected.

## 5.1 Proposed visual targets—not copied artwork

Use original fixtures to build your own evaluation board. The board should demonstrate: a prop family with clearly meaningful parameters; an internally coherent small kit; a character at multiple body shapes and poses; an animal from all sides; two different neighboring terrain styles; a moving foot-contact sequence; and one asset rendered in each export target.

Judge geometry under a neutral setup **and** the intended art direction. A warm key light, ambient fill, shadows, framing, and background can make an ordinary mesh look much more polished. Conversely, neutral lighting can reveal intersection errors hidden in a promotional scene. Require both views rather than optimizing only the beauty render.

Do not use one global “looks good” score. Keep separate scores for silhouette readability, proportion, fit, composition, palette consistency, articulation, and render quality. A useful asset can be visually simple and mechanically excellent; a convincing still can conceal an unusable asset.

---

# 6. Independent architecture: a practical recreation target

**Everything from this point through Section 15 is PROPOSED unless explicitly labeled otherwise.** It is an original engineering blueprint consistent with the observed product category—not a claim to have recovered Polyfork's hidden implementation. Thresholds are initial targets to calibrate on your own content.

## 6.1 Build a procedural asset compiler, then an authoring factory

The core product should have three independently testable contracts:

1. **Asset compiler:** validated parameters plus a versioned implementation produce a scene-graph result and measured metadata.
2. **Package compiler:** that result becomes exported formats, thumbnails, diagnostics, and a stable manifest.
3. **Scene compiler:** asset references and placements become an optimized, queryable scene without destroying editable or animated semantics.

The factory sits above those contracts. It creates or revises code/configurations, but cannot override hard geometry, security, or export failures by awarding a high visual score.

```text
apps/
  studio/                 Schema-driven asset viewer and kit composer
  api/                    Catalog, build jobs, exports, entitlements if needed
  mcp/                    Adapter around the same catalog/build services
packages/
  contracts/              JSON Schemas, versions, typed errors
  geometry/               Original primitives, lofts, triangulation helpers
  materials/              Palette and semantic color-zone handling
  families/               Props, vegetation, humanoid, animal, terrain engines
  rigging/                Pivot contracts, skeletons, animation helpers
  scene/                  Layout compiler, spatial queries, staging
  exporters/              glTF first; additional formats behind adapters
  validation/             Geometry, parameter, deformation, export tests
  rendering/              Deterministic multiview jobs and diagnostic passes
workers/
  author/                 Model adapters and constrained repair loops
  build/                  Isolated generation and packaging
  review/                 Numeric/visual scoring and human approval queue
integrations/
  unity/                  Import and optional editable-parameter bridge
examples/
  original-kit/           Original, openly licensed test fixtures
```

This is a proposed repository layout, not a map of the Polyfork repository.

## 6.2 Language and tool choices

A TypeScript/Three.js geometry core is the shortest path to browser editing and Node-based export. Three.js directly represents vertex buffers, scene nodes, skeletons, and standard glTF export; the official interfaces provide the relevant primitives. [T01](#t01) [T02](#t02) [T03](#t03)

A Rust supervisor can be added for job scheduling, isolation control, native tooling, or a desktop application, but rewriting all geometry into Rust at the start creates another compatibility boundary. Prefer one canonical asset implementation until profiling or deployment constraints justify more.

For a first local deployment, use a filesystem-backed artifact store and a small relational catalog. Add object storage, a durable queue, and horizontally scaled workers when needed. These are choices for your implementation; they are not claims about Polyfork's database or hosting provider.

Use glTF validation for interchange correctness and a manipulation toolkit when optimization or conversion needs exceed the exporter. Neither tool judges whether an asset looks good. [T05](#t05) [T06](#t06)

## 6.3 Two authoring modes

**Configuration mode:** The model selects an existing family and writes only a validated configuration. This is the safest and cheapest route for additional chairs, lamps, trees, clothing combinations, or animals within supported body plans.

**New-family mode:** The model writes or edits procedural implementation code in a restricted workspace. This should require stronger review, isolated execution, new family tests, and explicit publication approval. A newly authored family becomes reusable only after its parameter space is characterized.

Do not make every new asset a bespoke thousand-line program. Conversely, do not force every object into one universal engine. Use shared mechanisms where they really repeat; preserve the option of a small, well-tested custom generator for an unusual asset.

## 6.4 Proposed capability manifest

The companion `schemas/asset_manifest.schema.json` defines an independent format, not Polyfork's unpublished schema. Important fields include identity/version, family/engine version, coordinate convention, origin mode, parameter declarations, named color zones, capabilities, budgets, outputs, and provenance.

Separate these properties:

```text
UI kind:        range | integer | boolean | choice | color
Affected data:  geometry | topology | material | transform | skeleton | animation
Change path:    rebuild | attribute-update | transform-update | verified-interpolation
Capability:     static | pivots | skin | clips | terrain-query | sockets
```

A slider is not automatically continuously morphable. Two endpoints with the same vertex count are not sufficient evidence: vertex ordering may differ, topology may change in the middle, and motion may be nonlinear. Interpolation should be an explicitly tested approximation with an error bound, not an inferred truth based on UI type.

---

# 7. Procedural geometry and parameter engineering

## 7.1 Start with measurable contracts

For every asset, define a rest-state bounding box, an origin policy, a forward direction, named movable parts, and an intended triangle budget. A grounded object's minimum height is a useful constraint; a wall-mounted sign should instead declare an installation anchor. Never silently normalize every object to minimum Y=0 after generation: that would destroy intentional mounting offsets and invalidate sockets.

A minimal original fixture could be a lantern with `height`, `bodyWidth`, `paneCount`, `handleAngle`, and semantic color zones. Height changes should preserve plausible base/handle thicknesses. Pane count should rebuild divisions rather than stretch an unchanged mesh. Handle angle should change a pivot transform without rebuilding unrelated body geometry. Color should not change vertex positions.

This fixture is intentionally generic and independently specified; it is not copied from a Polyfork asset.

## 7.2 Canonicalize before building or caching

A robust parameter pipeline is:

```text
Parse → reject unknown keys → validate types → fill defaults
      → apply documented quantization → validate relationships
      → serialize canonically → compute build key → execute
```

Keep `"12"`, `12`, and `true` distinct. Reject non-finite numbers, invalid choices, contradictory inputs, and references to missing presets. Do not infer an integer count merely because range endpoints happen to be whole numbers. The independent schema has a separate integer type and explicit step.

A proposed content key is:

```text
H(
  asset_version,
  engine_source_hash,
  dependency_lock_hash,
  schema_version,
  canonical_parameters,
  exporter_version,
  export_options
)
```

Store both requested and applied parameters. When quantization changes a request, make that visible. A cached fallback is not an exact result and must not occupy an exact-result cache key.

Byte identity and geometric identity are separate. Random object identifiers, timestamps, metadata ordering, and exporter revisions may change file bytes without changing geometry. Use a **semantic geometry hash** over normalized attributes, topology, material assignments, hierarchy, and relevant metadata, alongside the raw artifact hash.

## 7.3 Deterministic variation

Inject a seeded random source through the build context. Avoid global random state, clock-based branches, hidden network data, and iteration over unordered inputs. Derive stable sub-seeds from semantic part IDs so adding a new chimney does not unexpectedly change every tree's shape.

Define the determinism promise precisely: identical content on the same pinned engine/toolchain is easier to guarantee than bitwise-identical floating-point output across unrelated JavaScript engines and hardware. Test the platforms you advertise. For cross-engine fingerprints, quantize measurements to a declared tolerance rather than pretending floating-point implementation differences cannot exist.

## 7.4 Geometry vocabulary

Implement a small set of composable builders: boxes and bevel-like forms; radial profiles; swept/lofted rings; extruded footprints; tapered branches; simple panel subdivisions; low-sided tubes; and explicit caps. Each builder should return predictable indexing, named regions, and optional sockets.

A generalized ring loft can describe a trunk, limb, column, or pipe without asserting that all such objects share one artistic style. At station `i`, specify a center `c_i`, an orthonormal local frame `(u_i, v_i)`, and radii `(a_i, b_i)`. For segment angle `θ_j`:

```text
p(i,j) = c_i + a_i cos(θ_j) u_i + b_i sin(θ_j) v_i
```

Connect adjacent rings with a documented winding order. Use stable station/segment indices where deformation or interpolation depends on correspondence. Cap only where required. Open garments and leaves are not necessarily intended to be watertight, so manifold checks must be asset-class aware.

A tilted branch needs a stable moving frame; a naive world-up cross product becomes unstable near parallel directions. Handle that degeneracy explicitly. A family's “style” should control profile simplification, taper, curvature, palette, and detail hierarchy—not merely the number of polygon sides.

## 7.5 Semantic colors and materials

Use a separate color-zone identifier rather than inferring zones from existing RGB values. Two unrelated zones can initially have the same color and later need independent edits. Recoloring by “find every vertex matching this hex” loses that distinction.

Maintain an internal mapping from zone ID to linear/material color data, and an explicit export conversion. A vertex-color attribute, a named material, and a shader-specific zone buffer are not interchangeable. An exporter may need material splits or a supported vertex-color path. Choose the representation per target and report the resulting draw-call implications. Three.js supports geometry groups and attributes; group partitioning influences rendering work. [T01](#t01)

## 7.6 Knob honesty: test what a parameter actually changes

For each parameter, build default, minimum, midpoint, maximum, and relevant discrete options while holding the remaining configuration fixed. Measure changes in geometry hash, bounds, topology, material zones, and diagnostic renders.

Use an expected-effect declaration. A roof-color control should alter the intended color zone and leave shape unchanged. A fence-density control should change count while preserving its specified span. A height control should not sink the object below ground. A toggle should not leave invisible triangles consuming the same budget unless that is an intentional documented implementation.

Rendered differences alone are insufficient: lighting noise can produce image changes even when the parameter does nothing. Conversely, a parameter affecting a rear socket may be meaningful but invisible to a front camera. Pair attribute-level checks with selected views.

Track interactions. Two knobs can individually pass and jointly create an impossible shape. Use pairwise coverage first, then targeted high-risk combinations and randomized configurations. Save every failing parameter set as a regression fixture.

---

# 8. Characters and animals: recreate capability, not a screenshot

## 8.1 Humanoid engine decomposition

Keep a humanoid family divided into body shape, skeleton placement, garment fitting, skin weights, surface styling, and animation adaptation. A configuration is not sufficient unless those components remain compatible throughout the supported range.

A body service should expose both a coarse semantic profile and actual geometry queries. Examples include chest, waist, hip, neck, shoulder, wrist, and ankle cross-sections. Garment authors can use those stations, but validation should still test against the resulting mesh, not only the approximation that generated it.

For a radial garment profile, a first construction can use:

```text
r_garment(station, angle)
  = r_body(station, angle)
  + clearance(layer, location)
  + style_offset(station, angle)
```

This is an original starting formula, not a recovered fitting equation. It will not solve every coat, collar, or carried object. Non-radial regions, concavities, and large rigid accessories need separate support geometry or collision tests.

## 8.2 Clothing layering and occlusion

Define coverage by semantic regions: torso front/back, upper arm, forearm, thigh, lower leg, and so on. Decide which underlying surfaces may be hidden when covered, then verify that removing them does not create visible holes during motion.

Do not let a broad coverage flag delete an entire limb merely because a sleeve overlaps one region. Keep render comparisons between the full and culled body over a pose set. If culling changes the visible silhouette outside an expected tolerance, retain the geometry or refine the coverage boundary.

Test sleeve/collar gaps in motion, not only the rest pose. Sitting, crouching, arm raising, and walking produce different failure modes. Include extreme permitted proportions; otherwise a shirt that fits the default adult may fail on the shortest supported body.

## 8.3 Skeleton and animation contracts

Version skeleton topology, bone naming, rest pose, axes, units, and root-motion policy. Changing bone lengths is not the same as changing hierarchy, but both affect animation interpretation. A retargeting system should explicitly separate rotational motion from root/hip translation and define how each is adapted.

Do not assume that keeping bone names makes arbitrary clips fit every body. Validate feet at ground, hands near intended contacts, and limb extension under proportion changes. Normalize skin weights and check that referenced bones exist; Three.js's skinned representation depends on those data and bind relationships. Posed bounds may need recomputation for correct culling. [T03](#t03)

Use originally authored or appropriately licensed clips in an open repository. A skeleton advertised as compatible with a commercial animation service does not itself grant redistribution rights to that service's motion assets.

## 8.4 Simple analytic skin weighting

For a two-bone region with blend interval `[a,b]`, one independent initial weighting scheme is:

```text
t = clamp((s-a)/(b-a), 0, 1)
w_child = t*t*(3-2*t)
w_parent = 1-w_child
```

This gives nonnegative weights summing to one for that pair. It does not guarantee good volume preservation; test bent poses for collapsing elbows, pinching hips, and twist artifacts. Rigid accessories should bind to a rigid transform or intentional weight set rather than inherit a soft blend accidentally.

## 8.5 Animal body-plan families

Start with a small number of explicit families: quadruped, bird, fish, and an articulated multi-leg family. Shared machinery can handle ring geometry, weighted joints, sockets, and locomotion state; separate family definitions should control body proportions, appendage topology, and pose constraints.

A quadruped configuration should specify trunk profile, neck/head proportions, limb segment lengths, joint placement, foot support points, tail structure, and symmetry policy. “Add legs” is not enough: the leg's reachable workspace and the body's height must be compatible.

Do not grow a single configuration schema until every field becomes optional and meaningless. Separate family schemas allow more useful validation and more constrained model outputs.

## 8.6 Reference fitting without pretending a single image defines 3D

Use your own licensed/reference material. Record view direction, approximate projection, visible landmarks, cropping, and confidence. Start fitting global dimensions before details: trunk length/height, head-to-body ratio, appendage positions, then secondary shape.

A possible optimization objective is:

```text
L = Σ_views [ α * (1 - silhouette_IoU)
            + β * normalized_landmark_error
            + γ * visible_contour_distance ]
    + δ * parameter_regularization
    + ε * structural_penalties
```

This is a proposed objective. The weights, renderer, optimization method, and segmentation approach must be chosen and calibrated independently. A model can cheat silhouette IoU by changing camera or crop; freeze those after calibration or regularize them strongly. Keep at least one held-out oblique view and a small motion sequence to catch flat, view-specific solutions.

Discrete parameters, such as segment counts, should not be optimized with the same assumptions as smooth body proportions. Use a discrete outer search or family-level selection, then optimize continuous variables within a fixed topology.

## 8.7 HD surface treatment as a separate layer

Keep base geometry and optional rich appearance independently measurable. A surface upgrade may add roughness variation, normal detail, texture maps, better normals, lighting, and shadows. Compare silhouettes, geometry hashes, material count, texture bytes, and runtime cost before calling it a geometry improvement.

An open-source release should have a base path that works with simple materials. Rich materials can be optional adapters, with explicit texture provenance and portable fallbacks. This avoids making every asset dependent on a complicated renderer merely to appear correctly colored.

---

# 9. Terrain: an independent continuity construction

## 9.1 A clear mathematical contract

Consider square chunks of side length `L`, with world-space coordinates `(x,z)` and chunk-local coordinates `(u,v)`. Define a shared base function `B(x,z,worldSeed)` and a local stylistic feature `F(u,v,chunkStyle)`.

An independent construction is:

```text
d = min(u, L-u, v, L-v)
t = clamp(d / borderWidth, 0, 1)
w = t*t*(3-2*t)
H(x,z) = B(x,z,worldSeed) + w * F(u,v,chunkStyle)
```

At a boundary, `w=0`; therefore both chunks agree on `H=B` provided they share coordinates, base function, seed, and numerical conventions. Because the smoothstep derivative is zero at zero, bounded smooth local features can also avoid introducing a first-derivative jump exactly at that edge. This is a mathematical property of this proposed construction, not a proof of Polyfork's implementation.

The included `reference_math/terrain.py` implements an original, deliberately simple example. It uses analytic waves rather than claiming to reproduce a proprietary noise function.

## 9.2 What that equation does not solve

It does not automatically solve different resolutions, independently computed vertex normals, color seams, material boundaries, water levels, road continuity, or collision-query agreement. It also trades away local feature freedom near the boundary. A dramatic cliff cannot cross a boundary unless its structure is represented in shared world-space data rather than only a private chunk feature.

For negative coordinates, use mathematical floor when deriving chunk indices. Truncation toward zero puts negative-world samples in the wrong chunk. Define ownership of exact edge/corner coordinates, even when the generated positions themselves agree.

## 9.3 Height queries must match the rendered mesh

An analytic `H(x,z)` and the triangulated mesh built from sampled heights are not generally identical between vertices. A character standing on the analytic surface may visibly float over or intersect the rendered triangle.

For collision-quality grounding, locate the sampled grid cell, choose the same triangle diagonal as the mesh builder, and interpolate that triangle's plane/barycentric height. The analytic function remains useful for generation and broad placement, but the exact mesh query should be available when contact matters.

Store which query a caller is using: `analytic`, `rendered-triangle`, or `physics-collider`. Their tolerances and latency can differ. Tests should quantify disagreement rather than silently treating them as equivalent.

## 9.4 Mixed levels of detail

Two chunks can agree at coarse vertices while a fine edge adds vertices that do not lie on the coarse edge's straight segments. That is a T-junction and may create a visible discontinuity.

Choose one policy: force equal boundary resolution, constrain fine-edge heights to the coarse interpolation, generate stitching triangles, or use a documented skirt as a visual workaround. Skirts conceal cracks but do not create a physically continuous collision surface. Test all four edges and corners for every allowed LOD pairing.

The reference tests intentionally include a case showing that equal underlying height functions do **not** by themselves prove mixed-resolution edge agreement.

## 9.5 Normals and colors

For normals, either derive a consistent gradient from shared world-space samples or build a seam-aware mesh-normal strategy. Computing normals independently from only each chunk's interior triangles can produce a lighting seam even when boundary positions match.

For biome colors, use a shared world-space classification/blending function or explicit boundary negotiation. A useful rule is symmetric ownership: swapping the identities/order of two neighbors must not change the boundary's result. Four-way corners need their own test; pairwise edge success does not prove corner success.

Avoid assigning color purely from each triangle center without checking the resulting edge. The geometric field may be continuous while face colors still jump. Palette coherence and smooth blending are separate choices: a stylized game may prefer deliberate hard biome boundaries, but they should be intentional rather than accidental.

## 9.6 Water, roads, and scatter

Represent river topology in shared world space before cutting it into chunks. Carve a channel from that representation, then construct water surfaces with a separately consistent level and flow direction. Independent chunk-local rivers can meet at different heights or point uphill.

Give placement queries more than a height: surface normal, slope, material/biome, water depth, clearance, and occupancy. Scatter should respect object footprint, slope limits, exclusions, and deterministic seed. Keep the generated placement list as explicit output so a failed scene can be replayed exactly.

Roads and paths need shared endpoints, widths, surface heights, and intersection rules. A visual stripe painted over terrain is not necessarily a traversable road.

---

# 10. IK, locomotion, and actual contact validation

## 10.1 Two-link geometry

For root `R`, target `T`, segment lengths `a,b`, and distance `d=|T-R|`, clamp reach to the feasible interval `|a-b| ≤ d ≤ a+b`. The angle between the first link and root-to-target direction satisfies:

```text
cos(θ) = (a² + d² - b²) / (2*a*d)
```

Clamp the cosine numerically to `[-1,1]`. Choose the bending plane with a pole direction; handle parallel/degenerate pole cases deterministically. A root-coincident target with equal segment lengths needs a special folded solution rather than division by zero.

This elementary construction gives a geometric solution, not automatic anatomical plausibility. Joint limits, minimum bend, self-collision, and preferred pose may make the target unreachable even inside the unconstrained distance interval. Always return the achieved endpoint and residual, not merely a success flag.

The included `reference_math/ik.py` implements a planar example with explicit residuals. A production 3D solver needs pole handling, joint frames, limits, and transform conversion beyond that example.

## 10.2 Distance-based gait phase

Use accumulated travel distance for locomotion phase when the desired behavior is a stride tied to movement:

```text
phase = (distanceTravelled / strideLength + legPhaseOffset) mod 1
```

This avoids foot cycling continuing at walking speed while the body barely moves. Turning, reversing, stopping, and changing stride length still need defined behavior; do not assume distance accumulation alone solves transitions.

For each foot, maintain `stance` or `swing` state, its world-space support anchor, desired touchdown point, and support identity. On touchdown, sample the actual supported surface. During stance, keep the anchor fixed in that support's frame. A moving platform requires a local anchor transformed by the platform, not a world-fixed point.

## 10.3 Body adjustment and stability

Adjust body height and orientation using current support points while respecting each leg's remaining reach. A simple average support height is a starting heuristic, not a stability proof. Include damping based on elapsed time rather than a fixed fraction per frame.

Support changes can create discontinuities. Ease into a new support plane, clamp accelerations, and define what happens when there are too few reliable contact points. For extreme terrain, a clear “cannot maintain gait” state is preferable to stretching limbs indefinitely.

## 10.4 Measure achieved contact

For stance interval `I`, let `p_actual(t)` be the transformed foot point after forward kinematics, and `a_support(t)` its intended support anchor. Measure:

```text
contact_error(t) = |p_actual(t) - a_support(t)|
stance_drift = max(t in I) |p_actual(t) - p_actual(t_start)|
```

For moving supports, measure drift in the support's local frame. Also measure penetration depth, vertical separation, reach clamp frequency, and joint-limit violations. A solver can keep its requested target perfectly still while the actual animated foot misses it; that is why forward-kinematics output must be checked.

Test at different frame rates and update step sizes. Runtime IK and a baked flat-ground clip are different deliverables; a generic exported clip cannot respond to unknown future terrain without runtime logic.

---

# 11. Scene assembly, rendering, and engine export

## 11.1 A scene package is more than a bag of models

Define placements as explicit records: asset/version, parameters, position, rotation with an explicit unit, scale, semantic role, grouping, and optional parent/socket attachment. Define terrain and staging separately. The companion kit schema illustrates this separation.

A scene compiler should produce both renderable objects and queryable semantic data. Useful outputs include obstacles, walkable areas, surfaces, attachment sockets, spawn candidates, interaction targets, and ownership/grouping. Store the original placements even after rendering optimization so the editor can reconstruct editable objects.

Begin with hand-authored original layouts or constrained templates. Add agent-generated layouts only after the compiler validates clearances, ground contact, bounds, and essential routes. An agent should propose a scene description; it should not have to rewrite renderer internals to place a bench.

## 11.2 Static merging, instancing, and animation boundaries

Partition geometry by material compatibility, spatial cell, shadow policy, and whether it must move independently. Merge appropriate static pieces. Use instancing for genuinely identical geometry/material combinations with differing transforms. The Three.js instancing interface explicitly serves that use case. [T04](#t04)

Do not merge an opening door into its building, wheels into an animated chassis, or a character into static scenery. Preserve semantic IDs or a mapping from merged ranges to original objects where selection and diagnostics require it.

Aggressive whole-world merging can harm culling and editing. Measure draw reduction alongside visible triangles, vertex upload cost, memory, culling granularity, and rebuild latency. The best partition for a fixed diorama may be poor for a city that streams cell by cell.

## 11.3 Collision and walkability

A projected footprint is a useful approximation, but it is not automatically a navigation mesh. Include character radius, height, slope, step height, headroom, and connectivity when classifying walkable positions. A point inside an open courtyard can still be unreachable if all entrances are blocked.

For an MVP, build a sampled walkability grid from ground and obstacle queries, inflate obstacles by the character radius, and flood-fill from valid entry points. Return both a candidate point and its reachability status. Later, replace or supplement this with a more capable navigation representation.

Keep interaction surfaces distinct from walkable ground: the top of a table may be useful for placing a cup but unsuitable as a character spawn. A `surfaceAt` result should identify type, normal, height, owner, and allowed uses.

## 11.4 Presentation is a separate subsystem

Create reproducible stage presets for neutral inspection and intended presentation. Each stage should specify camera, background, lights, exposure/tone mapping, environment, shadow settings, and post-processing. Store those parameters beside screenshots so comparisons can be replayed.

Treat night-window emission, ground light-pools, and actual dynamic lights as different features. A decorative glow need not illuminate nearby objects. Publish that distinction instead of relying on a screenshot to imply physically interactive lighting.

For pixelated or retro looks, define whether the effect lives in geometry, material data, a shader, or the final screen pass. This becomes important at export time.

## 11.5 Proposed export capability matrix

This table describes an independent implementation target, **not verified Polyfork export results**. Standard glTF can encode scene graphs, mesh attributes, skinning, morph targets, and animation, but arbitrary application code is not a portable standard glTF asset feature. Exporters require explicit options and animation inputs. [T02](#t02) [T07](#t07)

| Capability | Procedural source package | GLB target | FBX / USDZ target | OBJ target |
|---|---|---|---|---|
| Editable named parameters | Native | Metadata may describe them; rebuilding needs external code | External metadata/tooling required | External metadata required |
| Chosen geometry variant | Native | Bake geometry | Convert and validate | Static geometry |
| Named movable hierarchy | Native | Nodes/transforms | Verify converter behavior | Do not promise equivalent hierarchy |
| Skin and clips | Engine/family capability | Supported data path; test importer | Converter-dependent; test explicitly | Not an animated delivery target |
| Material/vertex colors | Native | Supported representation and importer dependent | Translate and inspect | Material conversion limitations |
| Arbitrary runtime shader | Native renderer adapter | Translate, bake, extend, or omit with warning | Engine/format-specific translation | Not preserved as runtime behavior |
| Terrain generation / IK logic | Native code | Baked result, not the live generator/solver | Baked result unless separately integrated | Static result |

Use glTF first because it gives one manageable canonical export path. Implement the remaining formats only when round-trip tests demonstrate acceptable fidelity. Do not advertise every exporter as feature-equivalent.

## 11.6 Unity bridge requirements

For a Unity-oriented alternative, begin with a GLB import workflow using a tested glTFast package/version. The official package documentation is the primary reference for its import behavior. [T12](#t12)

Store the original asset ID/version, canonical parameters, source hash, and rebuild metadata in a dedicated component or sidecar. Rebuilding should preserve the user's scene transform, intentional parent hierarchy, and supported custom additions. Unsupported changes should be reported rather than silently dropped.

For live parameter editing, choose among embedded JavaScript, an external local worker, or remote export. An external local worker is less integrated but keeps the Unity editor from hosting all procedural execution. An embedded engine reduces process overhead but requires a careful Three.js/module bridge and dependency management. QuickJS is an available embeddable JavaScript implementation; choosing it does not itself provide a complete isolation boundary. [T13](#t13)

Test through the **actual bridge and actual importer**, not just the geometry function in Node. Include colors, negative transforms, mirrored geometry, pivots, skinned bounds, clip names, materials, cancellation, undo, resource disposal, and repeated edits.

## 11.7 Browser lifecycle and memory

Separate immutable shared materials/geometries from instance-owned resources. A clone that shares geometry must not dispose it when one instance is removed. A rebuild should release superseded resources when they are no longer referenced.

A framework component's memoization is not a lifetime policy. R3F integration requires ownership and cleanup decisions beyond simply returning a primitive; the product's integration page supplies a starting surface, not proof that all embedding patterns are leak-free. [S27](#s27)

Track memory over repeated edit cycles and repeated mount/unmount cycles. Measure the stable plateau after cleanup, not only whether the first load works.

---

# 12. API, MCP, caching, and security

## 12.1 One canonical service behind every client

The browser, CLI, MCP adapter, and engine connector should all call the same validation and build services. Otherwise they develop divergent parameter snapping, error handling, and cache keys.

A proposed minimal API is:

```text
GET  /v1/assets                   Search catalog and filter capabilities
GET  /v1/assets/{id}              Manifest and supported outputs
POST /v1/builds                    Validate, build, or return a cached artifact
GET  /v1/builds/{id}               Status, diagnostics, applied parameters
GET  /v1/kits/{id}                 Kit rules and explicit placements
POST /v1/scenes/validate           Spatial and budget diagnostics
POST /v1/previews                  Render a submitted original scene/package
```

These are **new API names**, not claims about undocumented Polyfork endpoints. Writes must be idempotent or use explicit idempotency keys where duplicate work is costly.

## 12.2 Make variants honest

A result should contain at least:

```json
{
  "status": "ready",
  "requestedParameters": {"height": 1.237},
  "appliedParameters": {"height": 1.24},
  "exact": false,
  "method": "quantized-build",
  "reason": "height uses an authored 0.01-meter step",
  "artifactHash": "example-not-a-real-artifact-hash",
  "warnings": []
}
```

This is an illustrative response, not a live API result. In production, replace the placeholder with a real validated hash. Distinguish quantized-but-valid output from an emergency baseline fallback; they are different user experiences and should not share one ambiguous “success” state.

Unknown keys and invalid values should usually return a structured validation error. A best-effort mode can be explicit, but the caller must see every dropped or changed value.

## 12.3 Search and agent planning

Start with exact filters and reliable text matching over titles, tags, descriptions, roles, and capability fields. Add semantic retrieval only when evaluation shows that it improves relevant discovery. No model is required to answer “all free tree assets under this triangle count.”

For natural-language variants, ask the model to map intent into existing schema values, then validate. Return uncertainty when the requested concept is not representable. “Make it ancient” is not meaningful unless supported parameters or a new authoring request define what that means.

MCP should be an adapter around those services. Use a pinned protocol version and test the intended clients; Streamable HTTP transport choices are described by the versioned MCP specification. Tool availability, authentication, and purchase permission should remain separate. [T08](#t08)

## 12.4 Cache design and quotas

Cache immutable source packages and successful canonical exports by content hash. Avoid combinatorial prewarming: ten parameters with ten choices each create ten billion combinations. Prewarm popular presets and independently measured common variants, then build the rest on demand.

Track novel-build cost separately from cached delivery. Apply queue admission, per-user concurrency limits, and bounded retries. Make browser thumbnail fan-out cheap through caching, request deduplication, and cancellation rather than allowing it to exhaust expensive build workers.

Return cache provenance: cold build, exact cache hit, stale approved artifact, or degraded fallback. Do not label an old artifact as newly regenerated.

## 12.5 Generated code is untrusted code

Do not run generated asset code in the API server process with production credentials. Restrict imports, network access, filesystem access, execution time, memory, output size, and process creation. Use a disposable execution environment and an allowlisted dependency set.

Node's own documentation explicitly warns that `node:vm` is not a security mechanism for untrusted code. A separate operating-system/container/VM boundary with appropriate hardening is required for the threat model; merely moving code into a JavaScript context is insufficient. [T10](#t10)

A render worker must also defend against hostile files, oversized textures, infinite shader work, and resource exhaustion. Validate dimensions and budgets before loading. The model should never receive secrets merely because it is writing a geometry module.

## 12.6 Credentials and supply-chain integrity

Treat browser and shipped-game credentials as extractable. Use narrowly scoped, revocable download tokens or signed URLs rather than bundling account-level API keys. A private CDN token is still a credential even when it is read-only.

Version and hash dependencies. Separate reviewed family code from experimental code. Preserve third-party notices. Sign or hash published packages so a consumer can distinguish the approved asset version from a mutable URL that changed unexpectedly.

External briefs, reference-image text, and tool outputs are data, not authority. The factory should not follow instructions embedded in them to disable tests, expose credentials, or publish unapproved work.

---

# 13. Authoring, criticism, repair, and self-improvement

## 13.1 A bounded job state machine

The proposed factory-job schema uses explicit states:

```text
queued → planning → authoring → building → testing → reviewing
       → approved → publishing → published
                    ↘ repair → authoring
                    ↘ rejected / failed / cancelled
```

Every transition must carry a job/attempt ID, input hashes, selected versions, diagnostics, and the actor responsible. Do not infer approval from a paragraph containing the word “good.” A worker should not be able to publish merely because it wrote a file into a public directory.

Set maximum attempts and resource budgets. Stop and surface the failure category when repeated attempts do not improve the objective. A bounded repair loop is easier to trust and price than an indefinite conversation.

## 13.2 Proposed end-to-end loop

**Plan.** Convert the user's brief into a machine-readable asset/kit specification: semantic purpose, dimensions, original reference provenance, style, allowed family, named controls, and measurable acceptance criteria.

**Author.** Prefer configuration changes within a reviewed family. If new code is required, restrict edits to a candidate workspace and approved interfaces. Keep dependency installation out of the ordinary asset job.

**Build.** Compile/type-check where relevant, execute in isolation, and measure actual returned geometry. Reject an empty group, runaway triangle count, invalid arrays, non-finite coordinates, or unsupported capability claims before spending on visual review.

**Render.** Produce consistent views plus diagnostic masks. Use the same scene/camera specifications for each attempt. Store original resolution and image hashes.

**Review.** Combine hard numeric tests with an independent visual critic. The visual critic should receive the brief, original references, renders, and measured metadata—not the author's self-assessment as ground truth.

**Repair.** Convert the failure into a targeted task. “The handle intersects the body in side view at maximum angle” is better than “make it better.” Prefer the smallest change that addresses the issue while preserving passing properties.

**Approve and publish.** Run the complete regression set, export/re-import checks, and human review appropriate to the project's risk. Publish immutable versions with provenance and test summaries.

This is a proposed implementation of a broadly evidenced workflow, not the exact internal prompts, model assignments, or orchestration code used by Polyfork.

## 13.3 Render packet and critique protocol

An original baseline render packet can include front, rear, left, right, top, front-oblique, and rear-oblique views, followed by selected articulation/pose frames. That camera selection is a proposal; the exact seven canonical views in the historical submission were not recovered from executable configuration.

Render beauty, silhouette, normals, part IDs, material/color-zone IDs, depth, and wireframe where useful. A single beauty image cannot answer every structural question. Use camera fitting derived from bounds with a documented margin and stable perspective/orthographic policy.

Playwright can capture page screenshots; do not confuse that path with reading pixels through `canvas.toDataURL()`. They have different operational constraints, so a universal requirement to enable `preserveDrawingBuffer` should not be assumed. [T09](#t09)

A proposed critic response should name the view, affected part, observed defect, severity, confidence, and a measurable repair goal. Require the critic to separate visible evidence from guesses about hidden geometry.

## 13.4 Avoid self-congratulating judges

Calibrate against deliberately bad original fixtures: wrong scale, subtly floating feet, missing rear faces, no-op parameters, a hidden clipping sleeve, inconsistent palette zones, and a pleasingly lit but structurally broken object. If the critic accepts these, its score is not a publication gate.

Measure false acceptance and false rejection, not just mean score. Use blinded comparisons when evaluating critic versions. Keep a held-out set that authoring agents and prompt optimizers do not repeatedly inspect.

A fresh session reduces direct conversational contamination but does not make a judge independent in the statistical sense or eliminate shared-model blind spots. Hard geometric checks should remain authoritative for properties they can measure reliably.

## 13.5 Controlled lesson extraction

Store a structured lesson only after linking it to a reproducible failure and a passing correction. Useful fields are family, triggering conditions, root cause, patch reference, regression test, confidence, and superseded lessons.

Distinguish universal engineering lessons from local art preferences. “A grounded wheel should retain its support point when ride height changes” can be a family constraint. “This van should be lower” may be one brief's preference. Blindly generalizing the second into every vehicle could reduce quality.

Do not append every observation forever to one enormous system prompt. Maintain a reviewed rule base, retrieve relevant lessons by family/task, and periodically consolidate duplicates and contradictions. Version changes to that rule base and evaluate them on held-out original tasks before promoting them.

The same approval boundary should apply to factory code changes. Agents may propose improvements and tests; they should not independently weaken tests, expand privileges, or modify the acceptance criteria to make their own outputs pass.

## 13.6 Trace what the system really did

For each attempt, store the brief/config hash, implementation snapshot, parameter set, toolchain, measured geometry, render packet, diagnostics, critic response, human decision, repair diff, elapsed times, and model/compute usage. Logs should distinguish authored claims from measured outputs.

Report both cost per attempt and cost per **accepted** asset. A very cheap generator with a high rejection rate or large human review burden can be expensive overall. Track review minutes and defect escape rates as first-class metrics.

## 13.7 Original prompt outlines

These are new starting templates, **not recovered Polyfork prompts**.

**Planner:** “Produce a constrained specification for an original asset. Use the provided family schemas and style contract. Define dimensions, allowed controls, parameter relationships, reference provenance, and acceptance tests. Mark any unsupported capability instead of inventing it.”

**Author:** “Implement this specification in the permitted workspace. Do not modify validators, dependencies, or budgets. Return code/configuration and a list of intended effects. A separate harness will measure the actual result.”

**Critic:** “Compare the provided renders and measurements against the specification. Name concrete defects and the views supporting them. Do not infer hidden topology from a beauty image. Return structured severity, confidence, and repair goals; do not approve hard-test failures.”

**Repair:** “Address the named defect with a minimal change. Preserve existing passing tests and supported parameters. Add a regression case reproducing the defect. Report what was changed, not an unsupported declaration of quality.”

**Lesson extractor:** “Generalize only from the linked failure and verified correction. State applicability and counterexamples. Propose a rule and regression test for review; do not directly edit the production rule base.”

---

# 14. Acceptance testing and reproducible benchmarks

The companion `acceptance_tests.csv` contains 67 proposed acceptance tests. Its statuses are **NOT RUN AGAINST POLYFORK**. Passing the small numerical examples in this pack is not equivalent to passing the full asset system.

## 14.1 Initial acceptance priorities

| Area | Proposed gate | Why it matters |
|---|---|---|
| Contracts | Valid manifest, supported version, unique parameter/part IDs | Prevents ambiguous assets before rendering |
| Geometry | Finite coordinates, valid indices, nonempty expected output, budget compliance | Catches invisible or corrupt builds cheaply |
| Grounding | Origin/anchor behavior matches the asset's declared policy | Prevents plausible-looking but misplaced objects |
| Parameters | Every declared control has its intended effect and valid extremes | Prevents decorative or misleading knobs |
| Determinism | Same pinned inputs yield matching semantic output | Enables replay, caching, and diagnosis |
| Materials | Color edits preserve unrelated zones and geometry | Protects editability and predictable exports |
| Pivots | Hinges/axles remain attached over the supported motion range | Prevents objects rotating around the wrong point |
| Skinning | Weights/bones valid; representative poses do not catastrophically collapse | Establishes actual animation readiness |
| Terrain | Same-pitch boundaries match; corners, normals, queries, and LOD tested separately | Avoids an overbroad “seamless” claim |
| IK | Forward-kinematics contact error and reach residual are measured | Prevents target-only tests from passing broken motion |
| Exports | Validator plus target-engine re-import and visual/semantic checks | Tests the deliverable users receive |
| API | Typed validation, exactness reporting, canonical cache keys, bounded retries | Avoids silent wrong variants and expensive duplicate work |
| Security | Untrusted jobs cannot access secrets, escape limits, or publish themselves | Protects the host and users |
| Quality | Calibrated critic plus appropriately scoped human review | Avoids optimizing only for the model's own score |

## 14.2 Proposed tolerance policy

Keep tolerances in the test specification rather than burying them in code. For meter-based ordinary props, a starting geometry comparison tolerance might be `1e-5 m` under one pinned runtime; visible contact tolerances may be millimeters. Large terrain, tiny jewelry, and animated cloth should not blindly share one absolute threshold.

Use relative and absolute terms together when appropriate:

```text
allowed_error = max(absolute_tolerance,
                    relative_tolerance * characteristic_length)
```

Define `characteristic_length` consistently—such as the rest-state bounding-box diagonal—and guard degenerate zero-size outputs. These are proposed starting policies, not Polyfork's disclosed thresholds.

## 14.3 Parameter-space coverage

For a family with `k` numeric controls and several choices/toggles, exhaustive combinations usually grow too quickly. Start with default, single-control boundary cases, all discrete alternatives where practical, pairwise interactions, and targeted high-risk combinations. Add randomized coverage with deterministic seeds.

A failed configuration should become a small named regression fixture, not a screenshot lost in a chat. Store the minimal reproducer and shrink it when possible: if ten changed parameters fail but two are sufficient, the smaller case is easier to diagnose and preserve.

Publish coverage honestly. “Tested 500 sampled combinations” does not mean “all possible inputs pass.” A family can expose a restricted supported region until further testing justifies expansion.

## 14.4 Benchmark protocol

Record hardware, operating system, JavaScript engine, graphics API, driver, dependency versions, asset versions, parameters, export options, and scene content. Measure cold initialization, warm build, upload/import, first visible frame, interactive edit, export, and cleanup separately.

Report medians and high percentiles, not a best run. Include failed builds and fallback paths in the results. Measure cache-hit and cache-miss performance separately. An “installed local engine” is not proof that a request actually executed locally.

For scenes, measure draw calls, visible triangles, memory, CPU frame time, GPU frame time where available, and responsiveness while editing. Do not convert a reduction in geometry-generation time directly into an FPS claim.

A proposed baseline suite can include a tiny prop, a medium vehicle-like fixture, a skinned body, a parameterized terrain chunk, twenty repeated objects, and a populated kit scene. All fixtures should be original or appropriately licensed for the evaluation purpose.

## 14.5 Failure-oriented tests worth adding early

Include a no-op parameter, a quantization collision, a string-valued choice that looks numeric, a module with a missing helper import, a result with an unexpected export shape, a destroyed/shared resource case, and a stale asynchronous rebuild arriving after a newer one.

Also test a rich material in a simple-material export path, a skinned mesh omitted from cleanup traversal, a part whose parent transform changes, a terrain sample on a negative coordinate boundary, a mixed-LOD edge, and an IK target that is mathematically close but invalid under joint limits.

These tests are valuable precisely because a happy-path beauty render is unlikely to expose them.

---

# 15. Implementation roadmap and resource model

## 15.1 Stage the project by capability, not catalog count

| Stage | Deliverable | Exit condition |
|---|---|---|
| A — Contracts and viewer | One original asset, schema-driven controls, measured bounds, neutral renderer, GLB export | Rebuild, serialize, reload, and export consistently |
| B — One coherent kit | Approximately twelve original props with a shared style contract and explicit layout | Parameters work at boundaries; the scene is grounded and coherent |
| C — Factory loop | Configuration authoring, isolated builds, render packets, critique, targeted repair, review queue | Accepted jobs are replayable and failures are diagnosable |
| D — Engine consumption | Unity import and metadata-preserving rebuild workflow | Correct color, scale, pivots, undo, and resource lifetime |
| E — Terrain and scenes | Two original terrain styles, spatial queries, batching/instancing, walkability | Edge/corner/query/LOD policies are tested and documented |
| F — Animation families | One humanoid family and one or two animal body plans | Deformation, proportion changes, clips, and contact tests pass |
| G — Broader platform | API/MCP, optional managed builds, collaboration, catalog growth | Security, quotas, versioning, provenance, and operational tests pass |

These are dependency-based milestones, not time estimates or a promise that autonomous agents will complete them without supervision. Some engine integration may proceed in parallel, but every new bridge multiplies the validation work.

## 15.2 What not to build first

Do not start with your own neural 3D foundation model, thousands of catalog entries, every export format, unlimited user-submitted code execution, fully autonomous city design, or a universal humanoid/animal topology. None is necessary to validate whether the procedural asset approach solves your problem.

The first hard product test is whether an agent can select an original asset, inspect its schema, make an intentional valid change, place it correctly, and export/import it without manual repair. That exercise traverses the actual value chain.

## 15.3 Compute model

Separate three costs:

```text
Authoring cost = model calls + reference creation + build/render attempts
Review cost    = automated checks + human attention + rejected attempts
Serving cost   = cached delivery + novel exports + storage + support
```

A useful unit-cost equation is:

```text
cost_per_accepted_asset =
  (all authoring + rendering + review + retry costs in a batch)
  / number_of_accepted_assets
```

And a rough throughput bound is:

```text
accepted_output <= minimum(
  authoring capacity,
  build/render capacity,
  human-review capacity,
  publication/QA capacity
)
```

These are accounting identities and planning tools, not inferred Polyfork financials. Catalog growth rates do not reveal costs without knowing rejected work, review effort, cache behavior, and model usage.

## 15.4 Hardware implications

Procedural mesh construction and many numeric tests can be CPU work. Rendering and interactive viewing need an appropriate graphics path, and local multimodal/neural models have their own hardware requirements. Using hosted models does not require their inference hardware on your development machine.

For a local-first prototype, benchmark one build worker and one render worker before buying infrastructure. A GPU useful for preview rendering is not necessarily large enough for a preferred local model, but a local model is not mandatory for the architecture.

No source reviewed here establishes the exact hardware required to reproduce Polyfork's authoring throughput. Avoid purchasing a large GPU fleet on the assumption that its runtime knobs imply GPU-heavy generation.

## 15.5 Open-source governance and provenance

Choose licenses separately for code, sample assets, documentation, and contributed reference material. Record who created each asset, which references were used, what permissions apply, and whether generated outputs require additional review. Do not label third-party assets as yours simply because you rebuilt or reformatted them.

Review contributions that alter core family engines more carefully than configuration-only additions. Maintain a stable public contract and a compatibility test suite. Use a distinct project identity rather than branding the independent implementation as an official Polyfork release.

Reuse permitted connector code with notices where useful, but preserve a clear line between licensed code reuse and original content authoring. Resolve uncertain catalog-use permissions before creating a public benchmark or training collection.

---

# 16. Unknowns register: what still needs evidence

This table is intentionally actionable. “Unknown” does not mean “impossible”; it means the report does not possess enough evidence to state the answer as fact. Any testing involving Polyfork material must respect applicable access and license terms; independent fixtures are the default for your implementation.

| Question | Current knowledge boundary | Best evidence or independent target |
|---|---|---|
| Which exact model/version performs each factory role? | Role separation is described; exact current roster is not established | Creator disclosure or an authorized trace; keep model adapters swappable |
| What are the production prompts? | No complete prompt set recovered | Design original prompts around explicit contracts and measured failures |
| How are jobs orchestrated and retried? | A loop is described, not its full state machine | Use durable job states, bounded retries, and replayable attempts |
| What is in the shared lesson file? | Its existence/process is reported; contents and versioning unknown | Build a reviewed, scoped lesson system with regression links |
| Has the stored corpus trained a deployed model? | Submission describes a future training direction | Require a release/model card or direct evidence before claiming training occurred |
| What renderer and camera settings drive the factory? | Canonical views are reported; executable setup not recovered | Specify and publish your own fixed camera/render packet |
| Which segmentation/reference-fitting tools are used? | Mask fitting and reference views are described | Evaluate independent segmentation and camera-fitting choices on licensed data |
| What are the critic thresholds and error rates? | Selected scores/rejections are reported | Calibrate on blinded good/bad original fixtures |
| What is the true cost per accepted asset? | Throughput and historical revenue exist; costs do not | Instrument accepted-output economics and human review time |
| What is the complete current backend? | Historical PHP-FPM evidence exists | Avoid claiming database/cloud/queue details without disclosure |
| How much of the catalog shares engines? | Family migrations and program counts are described | Per-asset capability/version metadata and a full authorized inventory |
| Which assets lack programmatic variants? | Asset/program counters differ | Query current records and classify exceptions without guessing |
| Does every declared knob work across combinations? | Vendor validation claims; no exhaustive test here | Property-based and interaction coverage on your own families |
| Are results deterministic across browsers/versions? | Deterministic behavior is advertised | Define a supported toolchain matrix and compare semantic hashes |
| How exactly are semantic colors preserved? | Vertex/material approaches and connector remapping are described | Explicit zone IDs and target-engine round-trip tests |
| Which server responses silently fall back today? | Historical/documented fallback behavior exists | Observe exactness metadata under authorized controlled requests |
| What is truly preserved in paid previews? | Structural reductions are documented | Do not infer rig/export capability from preview appearance |
| Are all advertised formats feature-equivalent? | Multiple formats advertised; no full round-trip audit | Publish per-feature export results and deliberate losses |
| What are the full character fit formulas? | Stations, layers, and failure classes disclosed | Independently derive fitting functions and test actual meshes |
| How robust is skeleton retargeting? | Compatibility mechanisms described | Extreme-proportion, root-motion, and contact regression suite |
| How are animal rigs and gait curves authored? | Body families and clips described | Start with explicit body plans and publish your own motion contracts |
| Are terrain normals/corners/mixed LOD continuous? | Height/color examples do not establish every property | Separate boundary tests for position, normal, material, water, and LOD |
| Do terrain queries equal rendered/collision heights? | Query surfaces exist; exact implementation not recovered | Barycentric rendered-mesh queries and measured discrepancies |
| How are city lots and obstacle surfaces derived? | High-level descriptions and examples exist | Explicit scene ownership, footprints, navigation and lot rules |
| How many human interventions remain necessary? | Historical review counts exist, not a present workload audit | Track review minutes, rejection categories, and escape rate |
| What is in all Devpost updates and embedded media? | Extensive indexed story recovered; current full history/media not audited | Read the live page in a normal browser and inspect authorized media |
| Is the core factory open source somewhere not found? | A public connector was verified; no complete core repository was established | Creator confirmation or a specific licensed repository, not an inference from “built in the open” |

## 16.1 Highest-value next evidence to collect

For an independent implementation, the most useful next evidence is not another marketing screenshot. It is a permitted, reproducible trace containing an original brief, exact code/config version, parameter set, measured geometry, diagnostic views, critic findings, repair diff, and final engine import.

One complete trace often answers more engineering questions than dozens of isolated renders. Start producing those traces in your own project immediately, even while the initial family library is tiny.

---

# 17. Companion files and research reproducibility

## 17.1 Files in this pack

| File | Purpose | Important limitation |
|---|---|---|
| `Polyfork_Technical_Research.md` | Editable full report | References link to external sources |
| `Polyfork_Technical_Research.html` | Navigable, offline-readable presentation of the report | External source pages/images still require internet |
| `sources.json`, `sources.csv` | Source IDs, URLs, types, access status, caveats | Not a preserved website archive |
| `image_audit.csv` | Seventeen viewed images, visible findings, limits | No image files redistributed |
| `acceptance_tests.csv` | Proposed implementation QA backlog | Not test results from Polyfork |
| `schemas/asset_manifest.schema.json` | Original asset contract | Semantic geometry rules still need code |
| `schemas/kit.schema.json` | Original style/layout contract | Not a scene generator |
| `schemas/factory_job.schema.json` | Original job/attempt contract | Not a running orchestrator |
| `examples/` | Original valid examples for the schemas | Illustrative, not a shipped asset library |
| `reference_math/` | Original terrain/IK mathematics and tests | No renderer, neural model, or Polyfork implementation |
| `validation_summary.json` | Checks performed on the generated pack | Local artifact checks, not independent vendor benchmarking |

The schemas use JSON Schema draft 2020-12. Structural schema validation cannot enforce every cross-field or geometric condition; code must check parameter/default relationships, min/max ordering, unique IDs, version availability, artifact integrity, and the actual mesh. [T11](#t11)

## 17.2 Research approach and exclusions

Searches covered the official site and machine-facing documents, blog posts, public GitHub, the requested Devpost entry, official prize reporting, creator/social posts, and talk/video discovery. Product terms were checked separately from the connector license. Actual image files were opened through the web research tool rather than inferred only from captions.

Repeated targeted searches eventually recovered the indexed Devpost story even though direct opening stayed blocked. That distinction is retained in the source register. Search results unrelated to the specific product—including similarly named projects and unrelated revenue posts—were excluded.

Runtime network access was not available for a complete local site/module scrape or executable asset audit. The research therefore does not claim to have run the proprietary generator, imported its binaries, profiled its live viewer, or reproduced its published metrics. No attempt was made to bypass authentication or obtain paid content.

The report deliberately links sources rather than reproducing complete articles. Public technical descriptions are summarized; the proposed implementation is independently written. A live site can change after the access date, and indexed snapshots can lag it.

---

# 18. Bottom line

The useful recreation target is an **open, testable procedural asset system with a disciplined authoring factory**, not a visual clone of a storefront.

The strongest starting point is a small original kit whose controls are truthful, whose code is deterministic, whose geometry survives export, and whose quality can be measured. Then add family engines, terrain, animation, scene compilation, and agent authoring behind the same contracts.

Public information is unusually helpful about the product interfaces, selected numerical checks, and practical failures. It does not remove the need to design the private details independently. Treat every missing implementation as a specification problem: state the required behavior, choose an original method, build a reproducible fixture, and measure whether it reaches the target.

**Success is not “it resembles one Polyfork render.” Success is “an agent can request a meaningful change, the asset rebuilds predictably, the result remains coherent and usable, and the exported scene works in the target engine.”**

---

# Appendix A. Source register

All records were researched on **4 October 2026**. “Read” means source content was available to research; it does not mean software was executed. “Visually inspected” means the image itself was viewed. Vendor claims remain vendor claims. Original URLs are provided for verification.


## Product, implementation, commercial and public-post sources

<a id="s01"></a>

### S01 — Polyfork homepage

**Type:** Primary documentation. **Access:** Read.  
**Source:** [https://polyfork.dev/](https://polyfork.dev/)

<a id="s02"></a>

### S02 — Self-describing API index

**Type:** Primary API description. **Access:** Read.  
**Source:** [https://polyfork.dev/api](https://polyfork.dev/api)

<a id="s03"></a>

### S03 — LLM reference

**Type:** Primary documentation. **Access:** Read.  
**Source:** [https://polyfork.dev/llms.txt](https://polyfork.dev/llms.txt)

<a id="s04"></a>

### S04 — Agent working instructions

**Type:** Primary documentation. **Access:** Read.  
**Source:** [https://polyfork.dev/prompt.txt](https://polyfork.dev/prompt.txt)

<a id="s05"></a>

### S05 — Agent and MCP setup

**Type:** Primary documentation. **Access:** Read.  
**Source:** [https://polyfork.dev/agents](https://polyfork.dev/agents)

<a id="s06"></a>

### S06 — Performance measurements

**Type:** Vendor benchmark. **Access:** Read.  
**Source:** [https://polyfork.dev/performance](https://polyfork.dev/performance)

<a id="s07"></a>

### S07 — Asset licensing

**Type:** Primary terms. **Access:** Read.  
**Source:** [https://polyfork.dev/licensing](https://polyfork.dev/licensing)

<a id="s08"></a>

### S08 — Personal pricing

**Type:** Current commercial terms. **Access:** Read.  
**Source:** [https://polyfork.dev/pricing](https://polyfork.dev/pricing)

<a id="s09"></a>

### S09 — Platform licensing and pricing

**Type:** Current commercial terms. **Access:** Read.  
**Source:** [https://polyfork.dev/platform](https://polyfork.dev/platform)

<a id="s10"></a>

### S10 — Privacy and payment disclosures

**Type:** Primary terms. **Access:** Read.  
**Source:** [https://polyfork.dev/privacy](https://polyfork.dev/privacy)

<a id="s11"></a>

### S11 — Kit commission workflow

**Type:** Primary documentation. **Access:** Read.  
**Source:** [https://polyfork.dev/steer](https://polyfork.dev/steer)

<a id="s12"></a>

### S12 — Custom character workflow

**Type:** Primary documentation. **Access:** Read.  
**Source:** [https://polyfork.dev/skin](https://polyfork.dev/skin)

<a id="s13"></a>

### S13 — Character creator

**Type:** Product interface. **Access:** Partial.  
**Source:** [https://polyfork.dev/create](https://polyfork.dev/create)

Text shell read; WebGL editor not exercised.

<a id="s14"></a>

### S14 — Blog index

**Type:** Primary documentation. **Access:** Read.  
**Source:** [https://polyfork.dev/blog](https://polyfork.dev/blog)

<a id="s15"></a>

### S15 — Characters v2

**Type:** Creator technical article. **Access:** Read.  
**Source:** [https://polyfork.dev/blog/characters-v2](https://polyfork.dev/blog/characters-v2)

<a id="s16"></a>

### S16 — Animals v2

**Type:** Creator technical article. **Access:** Read.  
**Source:** [https://polyfork.dev/blog/animals-v2](https://polyfork.dev/blog/animals-v2)

<a id="s17"></a>

### S17 — A kit is a place

**Type:** Creator technical article. **Access:** Read.  
**Source:** [https://polyfork.dev/blog/a-kit-is-a-place](https://polyfork.dev/blog/a-kit-is-a-place)

<a id="s18"></a>

### S18 — Inverse kinematics in three.js

**Type:** Creator technical article. **Access:** Read.  
**Source:** [https://polyfork.dev/blog/inverse-kinematics-three-js](https://polyfork.dev/blog/inverse-kinematics-three-js)

<a id="s19"></a>

### S19 — Terrain that joins

**Type:** Creator technical article. **Access:** Read.  
**Source:** [https://polyfork.dev/blog/terrain-that-joins](https://polyfork.dev/blog/terrain-that-joins)

<a id="s20"></a>

### S20 — Shader looks and portability

**Type:** Creator technical article. **Access:** Read.  
**Source:** [https://polyfork.dev/blog/six-shader-looks-and-which-ones-you-can-keep](https://polyfork.dev/blog/six-shader-looks-and-which-ones-you-can-keep)

<a id="s21"></a>

### S21 — WorldClaw and the asset supply problem

**Type:** Creator analysis. **Access:** Read.  
**Source:** [https://polyfork.dev/blog/worldclaw-and-the-3d-asset-supply-problem](https://polyfork.dev/blog/worldclaw-and-the-3d-asset-supply-problem)

An analysis of another system, not evidence that Polyfork uses WorldClaw.

<a id="s22"></a>

### S22 — Kit catalog

**Type:** Catalog page. **Access:** Read.  
**Source:** [https://polyfork.dev/kits](https://polyfork.dev/kits)

<a id="s23"></a>

### S23 — Cozy Farm kit

**Type:** Catalog page. **Access:** Read.  
**Source:** [https://polyfork.dev/kit/cozy-farm-cc979f](https://polyfork.dev/kit/cozy-farm-cc979f)

<a id="s24"></a>

### S24 — Tall Pine Tree

**Type:** Asset page. **Access:** Read.  
**Source:** [https://polyfork.dev/asset/tall-pine-tree-ab4108](https://polyfork.dev/asset/tall-pine-tree-ab4108)

Asset page only; executable module and actual mesh were not retrieved or executed.

<a id="s25"></a>

### S25 — Coral Reef Terrain

**Type:** Asset page. **Access:** Read.  
**Source:** [https://polyfork.dev/asset/coral-reef-terrain-282969](https://polyfork.dev/asset/coral-reef-terrain-282969)

<a id="s26"></a>

### S26 — Nature Forest Terrain

**Type:** Asset page. **Access:** Read.  
**Source:** [https://polyfork.dev/asset/nature-forest-terrain-0e61f0](https://polyfork.dev/asset/nature-forest-terrain-0e61f0)

<a id="s27"></a>

### S27 — React Three Fiber integration

**Type:** Primary documentation. **Access:** Read.  
**Source:** [https://polyfork.dev/react-three-fiber](https://polyfork.dev/react-three-fiber)

<a id="s28"></a>

### S28 — Shader product page

**Type:** Primary documentation. **Access:** Read.  
**Source:** [https://polyfork.dev/threejs-shaders](https://polyfork.dev/threejs-shaders)

<a id="s29"></a>

### S29 — Unity integration guide

**Type:** Primary documentation. **Access:** Read.  
**Source:** [https://polyfork.dev/unity-integration](https://polyfork.dev/unity-integration)

<a id="s30"></a>

### S30 — Unity connector repository and README

**Type:** Public source repository. **Access:** Read.  
**Source:** [https://github.com/lucas-martinic/polyfork-unity-connector](https://github.com/lucas-martinic/polyfork-unity-connector)

Repository and README inspected; complete C# source tree not audited or built.

<a id="s31"></a>

### S31 — Unity connector changelog

**Type:** Public development history. **Access:** Read.  
**Source:** [https://github.com/lucas-martinic/polyfork-unity-connector/blob/main/CHANGELOG.md](https://github.com/lucas-martinic/polyfork-unity-connector/blob/main/CHANGELOG.md)

Historical implementation evidence; not a guarantee of current deployed backend configuration.

<a id="s32"></a>

### S32 — Unity connector MIT license

**Type:** Primary license. **Access:** Read.  
**Source:** [https://github.com/lucas-martinic/polyfork-unity-connector/blob/main/LICENSE.md](https://github.com/lucas-martinic/polyfork-unity-connector/blob/main/LICENSE.md)

<a id="s33"></a>

### S33 — XPRIZE winner announcement

**Type:** Official award announcement. **Access:** Read.  
**Source:** [https://www.xprize.org/news/polyfork-wins-the-build-with-gemini-xprize](https://www.xprize.org/news/polyfork-wins-the-build-with-gemini-xprize)

<a id="s34"></a>

### S34 — Requested Devpost project and updates

**Type:** Project submission. **Access:** Indexed project text read; live page blocked.  
**Source:** [https://devpost.com/software/polyfork#updates](https://devpost.com/software/polyfork#updates)

Search recovered extensive project story, image captions, and a visible Updates entry. Direct opening still returned a JavaScript anti-bot page. Historical indexed content is not a complete current update-history audit.

<a id="s35"></a>

### S35 — Devpost competition updates

**Type:** Competition updates. **Access:** Indexed updates text read; live page blocked.  
**Source:** [https://xprize.devpost.com/updates](https://xprize.devpost.com/updates)

Indexed content included winner and finalist livestream updates; no event video was viewed.

<a id="s36"></a>

### S36 — Creator launch post

**Type:** Creator social post. **Access:** Read.  
**Source:** [https://www.linkedin.com/posts/lucas-martinic_ive-been-working-on-web-projects-with-threejs-activity-7490317770111328257-q2bV](https://www.linkedin.com/posts/lucas-martinic_ive-been-working-on-web-projects-with-threejs-activity-7490317770111328257-q2bV)

Public post text inspected; embedded media not played.

<a id="s37"></a>

### S37 — Creator lightweight hand-demo post

**Type:** Creator social post. **Access:** Public post text read in search result.  
**Source:** [https://www.linkedin.com/posts/lucas-martinic_polyfork-assets-are-so-lightweight-that-they-activity-7496889203314761728-OFmM](https://www.linkedin.com/posts/lucas-martinic_polyfork-assets-are-so-lightweight-that-they-activity-7496889203314761728-OFmM)

Text is promotional; embedded video not played and no technical measurements taken.

<a id="s38"></a>

### S38 — Launch promotion by Ferhan Ozkan

**Type:** Promotional social post. **Access:** Search snippet only.  
**Source:** [https://www.linkedin.com/posts/ferhanozkan_introducing-polyfork-where-assets-are-fully-activity-7491177200423976960-DAK0](https://www.linkedin.com/posts/ferhanozkan_introducing-polyfork-where-assets-are-fully-activity-7491177200423976960-DAK0)

<a id="s39"></a>

### S39 — Creator X post

**Type:** Creator social post. **Access:** Search snippet only.  
**Source:** [https://x.com/lucas_martinic/status/2105285060425400608](https://x.com/lucas_martinic/status/2105285060425400608)

Thread not fully inspected; unrelated revenue figures in search surroundings excluded.

<a id="s40"></a>

### S40 — Polyfork short-form video

**Type:** Video discovery. **Access:** Search snippet only.  
**Source:** [https://www.youtube.com/shorts/Rdgm2ZvopHg](https://www.youtube.com/shorts/Rdgm2ZvopHg)

Title discovered, video not watched or transcribed.

<a id="s41"></a>

### S41 — Creator talk listing

**Type:** Event listing. **Access:** Read.  
**Source:** [https://luma.com/oikzvr6a](https://luma.com/oikzvr6a)

Listing is not a talk recording; advertised claims not independently verified.

<a id="s42"></a>

### S42 — Eventbrite counterpart for creator talk

**Type:** Event listing. **Access:** Search snippet only.  
**Source:** [https://www.eventbrite.com/e/how-i-vibe-coded-polyfork-and-won-500000-xprize-gemini-tickets-2002193731348](https://www.eventbrite.com/e/how-i-vibe-coded-polyfork-and-won-500000-xprize-gemini-tickets-2002193731348)

Search surfaced October 28, 2026, after this research date. Do not treat it as an already-viewed presentation.

<a id="s43"></a>

### S43 — Creator GitHub profile

**Type:** Creator profile. **Access:** Read.  
**Source:** [https://github.com/lucas-martinic](https://github.com/lucas-martinic)

Not an exhaustive search of private or unlisted repositories.

<a id="s44"></a>

### S44 — Creator X profile, September revenue snippet

**Type:** Creator social post. **Access:** Search snippet only.  
**Source:** [https://x.com/lucas_martinic?lang=en](https://x.com/lucas_martinic?lang=en)

Search surfaced a September 30 claim of $504,571 total September receipts across projects and approximately $504.5k for Polyfork. Full post/accounting not inspected; do not interpret as subscription revenue.


## Foundational technical references used for the independent design

<a id="t01"></a>

### T01 — Three.js BufferGeometry

**Type:** Official technical documentation. **Access:** Read.  
**Source:** [https://threejs.org/docs/pages/BufferGeometry.html](https://threejs.org/docs/pages/BufferGeometry.html)

<a id="t02"></a>

### T02 — Three.js GLTFExporter

**Type:** Official technical documentation. **Access:** Read.  
**Source:** [https://threejs.org/docs/pages/GLTFExporter.html](https://threejs.org/docs/pages/GLTFExporter.html)

<a id="t03"></a>

### T03 — Three.js SkinnedMesh

**Type:** Official technical documentation. **Access:** Read.  
**Source:** [https://threejs.org/docs/pages/SkinnedMesh.html](https://threejs.org/docs/pages/SkinnedMesh.html)

<a id="t04"></a>

### T04 — Three.js InstancedMesh

**Type:** Official technical documentation. **Access:** Read.  
**Source:** [https://threejs.org/docs/pages/InstancedMesh.html](https://threejs.org/docs/pages/InstancedMesh.html)

<a id="t05"></a>

### T05 — Khronos glTF Validator

**Type:** Primary implementation. **Access:** Read.  
**Source:** [https://github.com/KhronosGroup/glTF-Validator](https://github.com/KhronosGroup/glTF-Validator)

<a id="t06"></a>

### T06 — glTF Transform

**Type:** Primary implementation documentation. **Access:** Read.  
**Source:** [https://gltf-transform.dev/](https://gltf-transform.dev/)

<a id="t07"></a>

### T07 — glTF 2.0 specification

**Type:** Normative standard. **Access:** Read.  
**Source:** [https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)

<a id="t08"></a>

### T08 — MCP transports, version 2025-06-18

**Type:** Versioned technical standard. **Access:** Read.  
**Source:** [https://modelcontextprotocol.io/specification/2025-06-18/basic/transports](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)

Cited version, not a claim that this is the newest MCP specification.

<a id="t09"></a>

### T09 — Playwright screenshots

**Type:** Official technical documentation. **Access:** Read.  
**Source:** [https://playwright.dev/docs/screenshots](https://playwright.dev/docs/screenshots)

<a id="t10"></a>

### T10 — Node.js vm security limitation

**Type:** Official technical documentation. **Access:** Read.  
**Source:** [https://nodejs.org/api/vm.html](https://nodejs.org/api/vm.html)

<a id="t11"></a>

### T11 — JSON Schema draft 2020-12

**Type:** Technical standard. **Access:** Read.  
**Source:** [https://json-schema.org/draft/2020-12](https://json-schema.org/draft/2020-12)

<a id="t12"></a>

### T12 — Unity glTFast 6.19 documentation

**Type:** Official technical documentation. **Access:** Read.  
**Source:** [https://docs.unity3d.com/Packages/com.unity.cloud.gltfast@6.19/manual/index.html](https://docs.unity3d.com/Packages/com.unity.cloud.gltfast@6.19/manual/index.html)

A documented version, not a recommendation to assume newest package compatibility.

<a id="t13"></a>

### T13 — QuickJS project

**Type:** Primary implementation documentation. **Access:** Read.  
**Source:** [https://bellard.org/quickjs/](https://bellard.org/quickjs/)


## First-party images actually inspected

<a id="v01"></a>

### V01 — Pig before and after

**Type:** First-party image. **Access:** Visually inspected.  
**Source:** [https://polyfork.dev/img/blog/animals-v2-pig-before-after.png?v=1789990290](https://polyfork.dev/img/blog/animals-v2-pig-before-after.png?v=1789990290)

1000×500. Old angular pig versus fuller spotted pig; altered silhouette and surface treatment. Limitation: Does not establish topology, weights, watertightness, or animation quality.

<a id="v02"></a>

### V02 — Pig reference views

**Type:** First-party image. **Access:** Visually inspected.  
**Source:** [https://polyfork.dev/img/blog/animals-v2-pig-reference.png?v=1789990292](https://polyfork.dev/img/blog/animals-v2-pig-reference.png?v=1789990292)

1000×360. Front, side, and rear presentation on a neutral background. Limitation: No proof of camera calibration or exact orthographic projection.

<a id="v03"></a>

### V03 — Animal HD presentation

**Type:** First-party image. **Access:** Visually inspected.  
**Source:** [https://polyfork.dev/img/blog/animals-v2-hd.png?v=1789990311](https://polyfork.dev/img/blog/animals-v2-hd.png?v=1789990311)

1000×625. Surface detail on pig, fox, turtle, and fish; silhouettes remain visibly faceted. Limitation: Cannot verify identical geometry buffers between base and HD versions.

<a id="v04"></a>

### V04 — Composed village

**Type:** First-party image. **Access:** Visually inspected.  
**Source:** [https://polyfork.dev/img/blog/a-kit-is-a-place-cover.png?v=1790633916](https://polyfork.dev/img/blog/a-kit-is-a-place-cover.png?v=1790633916)

1000×625. Dense red-roof village with coherent palette, hills, and many small props. Limitation: Does not identify whether placement was manual, procedural, or agent-authored.

<a id="v05"></a>

### V05 — Time-of-day comparison

**Type:** First-party image. **Access:** Visually inspected.  
**Source:** [https://polyfork.dev/img/blog/a-kit-is-a-place-hours.png?v=1790633943](https://polyfork.dev/img/blog/a-kit-is-a-place-hours.png?v=1790633943)

1000×625. Four similar scene views with distinct illumination and lit-window states. Limitation: No isolated measurement of light count, draw calls, or frame time.

<a id="v06"></a>

### V06 — Terrain landscape

**Type:** First-party image. **Access:** Visually inspected.  
**Source:** [https://polyfork.dev/img/blog/terrain-that-joins-cover.png?v=1786489617](https://polyfork.dev/img/blog/terrain-that-joins-cover.png?v=1786489617)

1000×625. Coastal shelf beside green wooded terrain, with a low-poly surface. Limitation: A distant image cannot prove matching boundary vertex positions.

<a id="v07"></a>

### V07 — Terrain color seam comparison

**Type:** First-party image. **Access:** Visually inspected.  
**Source:** [https://polyfork.dev/img/blog/terrain-seam-blend.png?v=1786489365](https://polyfork.dev/img/blog/terrain-seam-blend.png?v=1786489365)

1000×753. Upper comparison has a sharp biome color division; lower has a softer transition. Limitation: Image alone cannot prove zero cracks, normal continuity, or all-neighbor cases.

<a id="v08"></a>

### V08 — Arm IK target comparison

**Type:** First-party image. **Access:** Visually inspected.  
**Source:** [https://polyfork.dev/img/blog/inverse-kinematics-three-js-cover.png?v=1786550130](https://polyfork.dev/img/blog/inverse-kinematics-three-js-cover.png?v=1786550130)

1000×501. Two poses of a yellow-green articulated arm with target labels. Limitation: Static poses do not measure end-effector residual or joint-limit robustness.

<a id="v09"></a>

### V09 — Walking on flat and uneven ground

**Type:** First-party image. **Access:** Visually inspected.  
**Source:** [https://polyfork.dev/img/blog/inverse-kinematics-three-js-ground.png?v=1786550250](https://polyfork.dev/img/blog/inverse-kinematics-three-js-ground.png?v=1786550250)

1000×501. A multi-leg robot appears supported on a plane and a rolling surface. Limitation: Cannot measure foot sliding or temporal contact stability from stills.

<a id="v10"></a>

### V10 — Shader comparison

**Type:** First-party image. **Access:** Visually inspected.  
**Source:** [https://polyfork.dev/img/blog/shaders-cover.png?v=1787811468](https://polyfork.dev/img/blog/shaders-cover.png?v=1787811468)

1000×625. Repeated submarine-like form under ordinary, underwater, outline, and pixel treatments. Limitation: Visual equivalence does not imply shader portability in exported formats.

<a id="v11"></a>

### V11 — Unity gallery

**Type:** First-party image. **Access:** Visually inspected.  
**Source:** [https://polyfork.dev/img/unity/editor-gallery.webp?v=1786841716](https://polyfork.dev/img/unity/editor-gallery.webp?v=1786841716)

1000×615. Catalog grid and filters with selected bed, preview, and controls. Limitation: Old screenshot inventory count is not the current live catalog size.

<a id="v12"></a>

### V12 — Unity remix panel

**Type:** First-party image. **Access:** Visually inspected.  
**Source:** [https://polyfork.dev/img/unity/editor-remix.webp?v=1786841716](https://polyfork.dev/img/unity/editor-remix.webp?v=1786841716)

1000×614. Blue fighter asset with color, toggle, count, proportion, and undo controls. Limitation: Does not prove the latency shown by a static interface.

<a id="v13"></a>

### V13 — Unity scene and prefab inspector

**Type:** First-party image. **Access:** Visually inspected.  
**Source:** [https://polyfork.dev/img/unity/editor-scene.webp?v=1786874351](https://polyfork.dev/img/unity/editor-scene.webp?v=1786874351)

1000×566. Galleon placed in a Unity scene, with editable prefab parameters in the Inspector. Limitation: Transform, collider, and animation preservation were not interactively tested.

<a id="v14"></a>

### V14 — Camper meadow green

**Type:** First-party image. **Access:** Visually inspected.  
**Source:** [https://polyfork.dev/img/remix/camper-meadow-green.webp?v=1785706112](https://polyfork.dev/img/remix/camper-meadow-green.webp?v=1785706112)

600×600. Green-body camper with cream roof and distinct trim. Limitation: Cannot distinguish a shader recolor from rebuilt color attributes.

<a id="v15"></a>

### V15 — Camper ocean blue

**Type:** First-party image. **Access:** Visually inspected.  
**Source:** [https://polyfork.dev/img/remix/camper-ocean-blue.webp?v=1785706112](https://polyfork.dev/img/remix/camper-ocean-blue.webp?v=1785706112)

600×600. Blue-body version in a comparable composition and proportions. Limitation: Not evidence of a geometry change.

<a id="v16"></a>

### V16 — Camper brick red

**Type:** First-party image. **Access:** Visually inspected.  
**Source:** [https://polyfork.dev/img/remix/camper-brick-red.webp?v=1785706112](https://polyfork.dev/img/remix/camper-brick-red.webp?v=1785706112)

600×600. Red-body version with a different accent treatment. Limitation: Not evidence that every possible combination was tested.

<a id="v17"></a>

### V17 — Commission factory illustration

**Type:** First-party image. **Access:** Visually inspected.  
**Source:** [https://polyfork.dev/img/steer/hero.png?v=1](https://polyfork.dev/img/steer/hero.png?v=1)

1000×476. Stylized conveyor, robot arms, and props illustrate an asset factory. Limitation: Illustrative artwork, not a screenshot of the actual agent orchestration system.


---

# Appendix B. Dated technical reading order

The blog index dates the shader, terrain, and WorldClaw articles to **August 11, 2026**; IK to **August 12**; Characters v2 to **August 27**, with an August 28 update indicated in the article; and Animals v2 / A kit is a place to **September 28**. Read those as a development sequence, not seven independent descriptions of an unchanging system. Catalog counters embedded in old pages can reflect newer data. [S14](#s14)

For implementation work, read the factory disclosure first, then the module/API contracts, then the family and terrain articles, and finally the Unity failure history. A newer product guide may describe capabilities absent from an older README or screenshot.

**End of report.**
