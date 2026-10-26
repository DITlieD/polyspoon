# Procedural Asset Art-Direction Guide
## A visual study of Polyfork, translated into an original style system

**Version:** 1.0 · **Research date:** 4 October 2026  
**For:** procedural-asset authors, art directors, and coding/vision agents building an independent asset library.  
**Basis:** the supplied *Polyfork: technical research and independent implementation blueprint*, fresh inspection of Polyfork's website, and **26 first-party image files viewed at their published native resolutions**.  
**Status:** an independent visual analysis and proposed production guide—not Polyfork's internal style manual.

> **The generator should not merely produce a recognizable object. It should preserve a deliberate visual design while the object changes.**
>
> A useful order is: **identity → silhouette → proportions → construction and negative space → value and color → detail → presentation.** Fix the earliest failing layer. A beautiful material does not repair a weak silhouette; more polygons do not repair an indecisive design.

---

## Start here

Use this document to establish taste and review criteria before asking an agent to implement a family. Use `AGENT_ART_DIRECTION.md` as the shorter authoring instruction, and `style_contract.yaml` as an editable starter contract. The contract contains proposed defaults, not recovered Polyfork settings. `visual_evidence.json` records the actual inspected images and their limits.

For the first kit, design **six original assets together**: one focal object, two supporting objects, two small props, and one natural or ground element. Approve their silhouettes and color blocks in one lineup before adding a large catalog. This is a proposed working method, not a claim about Polyfork's exact workflow.

**All numeric targets below are original starting points to calibrate on your own assets unless explicitly labeled DOCUMENTED.** They are not measurements extracted from the screenshots, scientific aesthetic thresholds, or guarantees of quality.

## Contents

1. Evidence, scope, and the visual conclusion
2. What the full-size images actually show
3. The proposed style: Readable Faceted Worlds
4. Shape, proportion, and negative-space rules
5. Color, value, and material rules
6. Facets, edges, and detail economy
7. Rules by asset family
8. Keeping procedural variations good-looking
9. Making a kit look like one world
10. Neutral inspection versus finished presentation
11. Original worked design examples
12. Production review and repair
13. A quality rubric that cannot hide bad design
14. Instructions for authoring and reviewing agents
15. What remains unknown—and what not to copy
16. Source register and native-image audit

---

# 1. Evidence, scope, and the visual conclusion

## 1.1 What was inspected

The fresh visual sample comprises six individual model heroes at **900×900**; three camper color variants at **600×600**; five kit scenes at **1000×553**; and twelve article images/composites, each **1000 pixels wide**. The sample includes vehicles, a character, a street prop, a food cart, spacecraft, animals, vegetation, buildings, terrain, lighting comparisons, and material/shader comparisons. Composite images contain several panels; **26 files does not mean 26 separately audited models**. [V01]–[V26]

“Full-size” here means opening the actual image file at the resolution published by the site, not enlarging a catalog thumbnail. It does **not** mean rerendering a live WebGL viewer or recovering higher-resolution source artwork. Some full-size composites still show small individual objects. Their existence does not justify close-up claims about those objects.

The live model viewer, slider behavior, meshes, topology, exported materials, and animation sequences were not exercised. The character-article cover and some selected additional asset images were unavailable and are not counted. One inspected pig sheet is explicitly reference artwork, not a final-model diagnostic render. [V09]

## 1.2 Three labels used throughout

**OBSERVED** means a visible feature in an inspected image. **DOCUMENTED** means a public Polyfork page says it; this is a vendor account, not an independent execution test. **PROPOSED** means an original rule, interpretation, recipe, or threshold for your own system.

The previous report already separates technical correctness from visual quality, recommends both neutral and art-directed views, and warns against one undifferentiated “looks good” score. This document develops that visual layer rather than duplicating its infrastructure blueprint. [R01](#source-r01), §5.1

## 1.3 The main conclusion

**OBSERVED synthesis:** The useful commonality is disciplined simplification, not one universal shape or color treatment. The camper is upright and softly chamfered; the convertible is long and low; the alien craft is pointed and split into separated pods; the food cart uses a broad canopy above a compact body. [V01], [V03], [V05], [V06]

**PROPOSED interpretation:** Their appeal is better modeled as a set of decisions:

- Preserve a few strong category cues rather than reproduce every real-world part.
- Give the silhouette and the major masses priority over surface decoration.
- Assign colors to meaningful regions; keep large areas visually quiet.
- Concentrate contrast and detail around identity, function, and focal features.
- Make neighboring objects agree about scale, edge treatment, and detail density.
- Treat lighting and composition as their own authored layer.

These are a practical abstraction of the sample, not a claim that every catalog asset follows every rule equally well.

**Do not reduce the target to “low triangle count + flat shading + random colors.”** Those settings constrain rendering; they do not decide whether a car looks elegant, a tree has character, or a village feels inhabited.

---

# 2. What the full-size images actually show

Each case separates what is visible from the design lesson to adopt. The linked originals are in §16; competitor image files are not bundled.

## 2.1 Camper van: broad zones and a strong body profile

**OBSERVED:** The hero has a tall olive lower body, cream roof/window enclosure, a raised brownish roof section, dark windows, and small contrasting trim. Its sloping split windscreen, wheel placement, and roof treatment communicate a camper rather than a generic box. Handles, lights, and vents occupy relatively little visual area. [V01]

**PROPOSED lesson:** Author the side profile and three major color zones before the trim. Let small details confirm an already successful vehicle identity. Keep dark glass distinct from painted bodywork. Do not copy logos or distinctive branding.

## 2.2 Convertible: proportions do work that detail cannot

**OBSERVED:** The salmon-colored convertible has a long low body, extended hood, low windscreen, pale seats, small dark wheels, a horizontal grille, and a thin beltline. Large body panels remain comparatively calm. [V06]

**PROPOSED lesson:** A vehicle family's wheelbase, overhangs, cabin placement, and height relationships are primary style controls. Adding headlights to an arbitrary cuboid does not create these relationships. This is a different proportion family from the camper, not merely a lower setting on the same height slider.

## 2.3 Hot-dog cart: a focal mass, an air gap, and functional grouping

**OBSERVED:** A broad yellow-and-cream umbrella dominates the upper silhouette. A slender support separates it from a compact counter/body. A large readable wheel and several small counter objects explain the cart's function without competing with the canopy. [V05]

**PROPOSED lesson:** Empty space is designed geometry too. Preserve the opening beneath the umbrella. Use one dominant feature and group minor functional details into a subordinate cluster. More bottles and seams would not necessarily improve the design.

## 2.4 Motel sign: quiet area makes ornament effective

**OBSERVED:** A thick orange border surrounds a large pale inset. Repeated bulbs stay around the perimeter; a starburst forms the highest-contrast silhouette feature. Narrow supports and a simple footing sit below. The colored frame has visible depth rather than reading as one flat rectangle. [V04]

**PROPOSED lesson:** Choose where repetition belongs. A border can be busy while its center remains quiet. One characteristic ornament can establish identity more efficiently than decorative features on every face.

## 2.5 Alien spacecraft: not everything should be rounded and friendly

**OBSERVED:** Green and purple wedge-like masses, swept edges, dark glazing, separated side pods, and narrow bright strips produce a sharper language than the camper or cart. Channels of negative space help distinguish the parts. [V03]

**PROPOSED lesson:** Select a shape vocabulary by kit or faction. Angular, threatening, industrial, or aerodynamic designs remain compatible with a readable low-poly system. “Make all corners soft” would destroy part of this sample's range.

## 2.6 Astronaut: identity in the costume silhouette

**OBSERVED:** The astronaut hero shows a cream suit with teal accents, a large dark visor, chunky gloves and boots, a chest unit, a belt accessory, and a held instrument. Large costume regions carry more visual weight than tiny surface markings. The image is one selected pose. [V02]

**PROPOSED lesson:** Establish headgear, shoulder/torso outline, footwear, and the signature carried object before face detail or badges. Prove the costume still reads without the tool. A posed still does not establish that the costume deforms well.

## 2.7 Animals: shared simplification, different anatomy

**OBSERVED:** The group image distinguishes the bear, fox, pig, cow, dog, and chicken through trunk mass, head shape, legs, ears, tails, and stance. The pig comparison changes the earlier angular form into a fuller, more unified-looking body with a broader snout and stronger species cues. [V07], [V10]

**PROPOSED lesson:** A shared engine must not mean one generic animal stretched into every species. First define body-plan landmarks and characteristic mass distribution. Spots, fur, or a high automated score are not substitutes for those decisions.

**DOCUMENTED caution:** The animal article reports a cat rated 8.2/10 by its automated judge that still required four human-directed revisions. Treat a critic's score as evidence to calibrate, not authority to obey. [S04]

## 2.8 Pines: a simple primitive vocabulary can be intentional

**OBSERVED:** The pine lineup varies height, tier arrangement, spread, color, and snow treatment while preserving a tapered, tiered family identity. The woodland image uses these readable forms at scene scale. [V21], [V22]

**PROPOSED lesson:** Do not ban cones, cylinders, or boxes. Ban unexamined combinations. Tiered cones can be an approved art language when spacing, taper, and proportions are designed. A more realistic branch simulation is not automatically a better match for the kit.

## 2.9 Broadleaf trees and buildings: larger masses support finer structures

**OBSERVED:** In the medieval views, broad clustered foliage crowns contrast with narrower trunks and branches. Red roofs, pale walls, dark timber, paths, and wood props recur across a composed setting. Small fences, carts, and stalls have context rather than occupying every open patch. [V11], [V13]

**PROPOSED lesson:** Control canopy group sizes and the roof–wall–opening hierarchy before adding leaves or masonry. Give fine linear elements a purpose and a larger mass to support. Do not turn every scene surface into equally dense detail.

## 2.10 Urban and science-fiction kits: coherence is not identical colors

**OBSERVED:** The city view uses repeated windows, storefront layers, awnings, curb/road separation, and dark street furniture. The space-base view favors chamfered shells, inset dark regions, muted orange trim, and small cyan accents. The spacecraft collection uses different dominant hues for different groups. [V14], [V15], [V17]

**PROPOSED lesson:** A kit needs a grammar of corners, openings, trims, and color roles. It does not need every object painted the same color. Different factions can remain compatible through shared abstraction and detail density.

## 2.11 Color variants: preserve roles while changing the colorway

**OBSERVED:** The three camper variants change broad body paint and accent combinations while retaining a recognizable pale upper enclosure, dark windows/tires, and the same apparent design. [V18], [V19], [V20]

**PROPOSED lesson:** Make “body paint,” “trim,” “glass,” and “rubber” distinct semantic choices. Offer curated colorways or role-aware adjustments instead of random RGB values on every part. The images do not reveal the underlying recoloring implementation.

## 2.12 Rendering and terrain: attractive presentation is not a geometry guarantee

**OBSERVED:** The village lighting composite substantially changes mood and color relationships. The submarine comparison changes surface presentation without losing the recognizable object. HD animal images add fine surface information while retaining visibly faceted outlines. [V08], [V12], [V24]

**PROPOSED lesson:** Keep a portable base look separate from optional rich surfaces and screen effects. Evaluate each under its own contract.

**OBSERVED:** The terrain comparison softens a conspicuous color division. Other landscape images show strongly stepped channels and boundaries; these are useful engineering illustrations, not unquestionable standards of beautiful landform design. [V23], [V25], [V26]

**PROPOSED lesson:** A continuous surface can still be visually dull or mechanically patterned. Evaluate landform composition, water shape, and color transitions separately from seam correctness.

---

# 3. The proposed style: Readable Faceted Worlds

**Everything from this section through §14 is PROPOSED unless explicitly labeled otherwise.**

## 3.1 One sentence

**Build simplified, solid-looking objects with unmistakable silhouettes, deliberate proportions, broad semantic colors, restrained detail, and consistent treatment within each kit.**

The baseline is a portable, faceted, largely matte look. It is not photorealism, not necessarily voxel art, and not a requirement for every character to be cute or every object to be rounded. Richer surface and shader treatments are optional lanes, not repairs for an unfinished base model.

## 3.2 Five levels of direction

| Level | Decides | Example of a decision |
|---|---|---|
| Library | Shared quality and presentation rules | Readable silhouettes; no accidental noise; honest validation |
| Kit | World-specific shape, color, and scale grammar | Weathered harbor workshop, not generic “cozy” |
| Family | Relationships preserved across variants | Lantern body/handle/base relationships |
| Asset | Individual identity and focal feature | A squat inspection lantern with a sloped hood |
| Stage | Camera, lighting, environment, and screen treatment | Neutral inspection versus warm evening display |

A style is not just a prompt adjective. Each level should name decisions that can be accepted or rejected in a render. A variation may change the asset while preserving the family. A different kit may intentionally change the grammar while preserving library-level quality.

## 3.3 Twelve core rules

| ID | Rule | Practical test |
|---|---|---|
| ART-01 | Identity before decoration | Is the intended category clear in a black silhouette? |
| ART-02 | Design unequal masses | Is there a clear primary form rather than several equal competing lumps? |
| ART-03 | Preserve purposeful negative space | Do handles, gaps, limbs, openings, and separated pods remain legible? |
| ART-04 | Make construction visually credible | Do supports, joints, rims, shells, and attachments explain how parts belong together? |
| ART-05 | Use value and color by role | Do body, recess, trim, and focal accent have distinct jobs? |
| ART-06 | Spend detail where it earns attention | Does a small feature improve identity, function, or a focal region? |
| ART-07 | Make facets intentional | Do planes describe form instead of displaying arbitrary triangulation? |
| ART-08 | Match the kit, not just the object name | Does the asset belong beside the approved kit anchors? |
| ART-09 | Vary relationships coherently | Do parameters retain the family's defining ratios and connections? |
| ART-10 | Pass without flattering presentation | Does the neutral render remain convincing? |
| ART-11 | Design for the intended screen size | Do essential cues survive the actual gameplay or product-view camera? |
| ART-12 | Fix causes before adding polish | Is the next edit aimed at the earliest failing design layer? |

## 3.4 Establish three independent anchor assets

Create one approved manufactured object, one organic object, and one architectural or large-form object for the kit. They should be original assets whose rights permit your intended production use.

An anchor establishes the kit's edge language, color intensity, relative feature thickness, detail density, and rendering treatment. It is a **comparison example**, not a mesh to copy. Keep the same anchors during a batch so an agent cannot redefine the style to match its latest output.

---

# 4. Shape, proportion, and negative-space rules

## 4.1 Write the silhouette brief before creating geometry

For each asset, specify its category, three identifying cues, primary mass, secondary mass, dominant direction, and one important opening or gap. Also specify one thing the asset must **not** resemble.

Example: an original inspection lantern has a squat enclosure, a sloped protective hood, and an oversized rectangular handle opening. Its primary mass is the enclosure; the hood supports the identity; the handle creates a tall negative shape. It must not resemble a thin decorative candle cage.

This is far more useful than “make a high-quality stylized lantern.” It gives the generator something to preserve when parameters change.

## 4.2 Use three scales of form

**Primary forms** determine recognition: the trunk of an animal, a vehicle body, a building roof and wall block. **Secondary forms** establish construction and character: a muzzle, wheel arches, a porch. **Tertiary forms** confirm function: nostrils, handles, a latch.

Start with one dominant mass and a small number of supporting masses. This is a working default, not a ban on multipart objects. A bicycle and a chandelier require a different distribution than a barrel or a bear.

Do not give every component the same size, thickness, saturation, or contrast. An asset made from equally important pieces has no visual hierarchy.

## 4.3 Approve blockouts without detail

At the blockout gate, omit labels, bolts, seams, surface noise, decals, and decorative trim. Allow only forms required for recognition, support, or silhouette.

Review front, side, and an oblique view. If the category or attitude is weak, adjust the whole profile or part relationship. Do not add a “recognition sticker” to an unresolved form.

Useful questions are specific: Is the cabin too far forward? Is the roof larger than the wall mass in the intended way? Does the animal's chest dominate when it should be the haunches? Is the umbrella wide enough to read as the cart's focal shape?

## 4.4 Treat profiles as authored curves, even when the result is angular

For an organic body, define a few meaningful stations: shoulder, ribcage, waist, hip, or muzzle base/tip. For a hard-surface object, define side-profile breaks: base, shoulder, taper, lip, crown.

Connect these with an intentional transition. Avoid putting a ring at a uniform interval merely because a loop makes that easy. A useful station changes the contour, the plane direction, a connection, or the bend behavior.

A primitive can be a starting vocabulary. The finished appearance should express the asset's profile decisions, not advertise that the author had access to a sphere and four cylinders.

## 4.5 Make connections explain the object

Choose a connection language: continuous body surface, inset panel, collar, hinge, socket, overlap, foot, or bracket. At a visible connection, ask what is carrying the weight and what conceals or explains the join.

A sleeve may intentionally overlap an arm. A metal bracket may meet a box with a hard seam. A fox's neck should not look like a detached pipe unless the kit deliberately uses a mechanical creature style.

This is a visual requirement, not a universal instruction to weld all geometry. Separate meshes can look coherent; one mesh can still look like a pile of unrelated parts.

## 4.6 Give negative spaces minimum visual presence

Identify the important voids: handle opening, undercarriage, space between legs, gap below a canopy, wheel arch, wing/body channel, or doorway. Preserve them in the intended oblique and gameplay views—not only in a convenient front elevation.

As a **starting screen-space check**, aim for essential thin features at least **2 pixels** thick and identity-critical gaps at least **3 pixels** wide at the ordinary target distance. These are warning thresholds, not universal acceptance measurements. Fine jewelry, distant scenery, anti-aliased edges, and stylized UI icons require separate treatment.

For an orthographic image spanning `S` world units across `W` pixels, a face-on thickness estimate is:

```text
world_thickness ≈ desired_pixels × S / W
```

Foreshortening, occlusion, and the actual camera still need a rendered check. Do not make every branch thicker just because a distant decorative twig fails this estimate.

## 4.7 Controlled asymmetry, not arbitrary damage

Manufactured assemblies usually benefit from stable alignments and repeated dimensions. Organic forms can vary more, but their variation should have a direction and a cause.

For a tree, vary branch placement and crown masses while retaining the growth direction and canopy envelope. For a used sign, choose one small tilt and a limited wear zone—not independent rotations for every component. For an animal, retain coherent bilateral anatomy unless a deliberate pose or design requires otherwise.

“Procedural” should not be visually synonymous with “jittered.”

---

# 5. Color, value, and material rules

## 5.1 Assign roles before choosing hex values

Use semantic zones such as `body`, `secondary_panel`, `recess`, `trim`, `functional_accent`, `glass`, `rubber`, `wood`, `foliage`, and `skin`. Two roles may share a color initially but must remain distinguishable in the authoring data.

The important choice is not merely which green to use. It is whether green defines the body, the accent, or the environment—and whether adjacent regions still separate in the final camera.

**DOCUMENTED context:** Polyfork describes designing a kit around one 32-color palette, one grid module, and one style contract before modeling its parts. The exact palette values and full private rules were not recovered. A 32-color kit palette does not imply putting 32 colors on each object. [S03]

## 5.2 Establish a value hierarchy

Inspect an untextured clay render for form and an unlit color render for color organization; also inspect a grayscale conversion of the intended shaded render. These answer different questions.

A starting arrangement is a mid-value dominant body, a lighter or darker supporting region, dark recesses, and a small focal contrast. Do not turn every seam into a black line or every trim into white. The silhouette may read while the interior becomes an unreadable grid.

For an important adjacent pair, make at least one distinction clear: value, hue, plane direction, physical separation, or a purposeful boundary. High color difference alone can disappear under a different light; repeated hard boundaries can become noise.

## 5.3 Use area hierarchy, not a rigid color quota

For a simple manufactured prop, **70% dominant / 25% supporting / 5% accent** is a useful first sketch of visible color area. It is not a required pixel histogram, triangle allocation, or rule for every animal and costume.

Begin with roughly three to five visible color families on an ordinary prop, including neutrals. Expand only when function, anatomy, or the kit requires it. A multicolored market display can have more colors while still grouping them into one subordinate region.

Keep the highest saturation or sharpest value contrast near the focal feature. Do not independently maximize saturation on the body, handles, feet, bolts, and ground plane.

## 5.4 Original starter palette—not sampled from Polyfork

These sRGB hex values are **new suggested colors** for an independent baseline. They are neither an extracted competitor palette nor guaranteed to remain visually identical under different renderers.

| Role | Name | Hex | Suggested use |
|---|---|---|---|
| Deep neutral | Graphite | `#29343B` | Tires, deep recesses, restrained dark accents |
| Cool dark | Deep slate | `#425666` | Graphic glazing and cool structure |
| Mid neutral | Slate stone | `#788080` | Stone and neutral machinery |
| Light neutral | Chalk | `#ECE2C9` | Pale panels, plaster, light cloth |
| Warm light | Sand | `#C4AE83` | Ground and muted secondary surfaces |
| Dark warm | Bark | `#594739` | Timber shadows, soil, leather |
| Mid warm | Cedar | `#966344` | Timber and warm structure |
| Earth accent | Clay | `#B76950` | Roofs and warm painted regions |
| Warm accent | Ochre | `#CEA34C` | Functional accents and selected focal parts |
| Dark foliage | Forest | `#415B42` | Deep plant masses |
| Mid foliage | Leaf | `#728456` | Main foliage |
| Light foliage | Sage | `#A0AB77` | Selected lighter growth, not every face |
| Cool body | Harbor teal | `#3E777B` | Painted machinery and water-related kits |
| Cool light | Mist blue | `#89ACB9` | Supporting panels and restrained cool highlights |
| Small vivid accent | Signal coral | `#D47562` | Limited attention cues |
| Optional luminous zone | Ice cyan | `#8AC8CB` | Declared light strips or instrument faces |

Choose a subset for a kit. Do not use all sixteen colors by default. The example is not a skin-tone system: character kits need a separate, inclusive set of skin, hair, and cloth roles that fits their art direction.

**Example original subsets:** a rural workshop uses Chalk, Cedar, Clay, Bark, Leaf, and a little Ochre. A harbor-service kit uses Harbor teal, Chalk, Deep slate, Graphite, and an Ochre accent. A utility-space kit uses Slate stone, Chalk, Deep slate, Clay, and sparse Ice cyan. These are starting color relationships, not prescriptions for every theme.

## 5.5 Keep material response subordinate to shape

For the baseline, prefer matte or gently responsive surfaces. Distinguish a material by its broad response and color role before adding microtexture. Painted metal does not need to be treated as bare metallic material simply because its substrate is metal.

Where the renderer uses normalized roughness, **0.65–0.95** can be an initial matte-material exploration range—not a measured Polyfork setting. Use separate, deliberately approved responses for exposed metal, glossy enamel, water, and lenses. Do not make every surface glossy to simulate “quality.”

Graphic glass can be an opaque dark region with controlled highlights in the base lane. Transparent or refractive glass is a separate decision, especially when it reveals an unfinished interior. Likewise, a cyan stripe is not automatically an emissive light and emission does not automatically imply nearby illumination.

## 5.6 No independent face-color confetti

Do not choose random colors independently per triangle. A faceted rock should read as one rock with oriented planes, not a bag of unrelated gray patches. A canopy can have a few coherent color masses; every face does not need a new green.

When variation is desired, correlate it with meaningful regions: upper growth, underside, mineral band, wear zone, or a whole crown cluster. Use a narrow range around a chosen role. Let lighting explain plane changes unless the kit explicitly calls for painted facet colors.

---

# 6. Facets, edges, and detail economy

## 6.1 Low-poly means selective description

Place vertices where the silhouette turns, where a characteristic plane changes, where a join needs support, or where deformation requires it. Do not spend equally on hidden caps, tiny bolts, a face, and a major tire.

Triangle count is a budget, not an aesthetic objective. A heavily simplified lantern may need fewer triangles than a convincing dressed character; imposing one count on both can remove the wrong information.

Prefer one extra contour break that improves identity over many small interior polygons that are invisible at the target camera.

## 6.2 Distinguish intentional faceting from broken shading

On manufactured forms, preserve planar areas and intentional hard corners. On organic forms, choose either readable broad facets or a controlled smoother response consistent with the kit. Neither setting rescues incorrect proportions.

A triangulation diagonal on a flat panel should not become a visible stripe merely because neighboring normals or colors disagree. Check whether the visible pattern explains the intended shape. If it only reveals implementation details, repair it.

Do not force a whole kit through one normal policy. A roof plane, a cloth sleeve, a faceted boulder, and a visor may need different policies while still sharing the same level of abstraction.

## 6.3 Choose an edge language

A kit can use square-cut timber, one-step chamfers, broad softened corners, beveled armor, or deliberately sharp fins. Select a small vocabulary rather than beveling everything.

For an original manufactured baseline, experiment with bevel widths near **0.5–2% of the local short dimension**, then judge at the intended camera. This is an authoring probe, not a universal geometry formula. Skip a bevel that does not change the silhouette or useful shading. Enlarge one intentionally when it is part of the stylized design.

The right question is: “What does this edge need to communicate?” not “How many bevel segments count as high quality?”

## 6.4 Every detail must have a job

A tertiary feature should do at least one of four things: improve recognition, explain construction/function, guide the eye to a focal region, or reinforce the kit's particular identity.

A row of bolts may explain a panel joint. A second unrelated row across a quiet body panel may only add clutter. A lamp shade lip can define thickness; several concentric decorative lips can turn a simple form into visual static.

Use a **detail removal pass** before approval: temporarily remove roughly a third of tertiary features. If the object becomes clearer without losing identity, keep the simpler result. The fraction is a prompt for exploration, not an automatic deletion algorithm.

## 6.5 Simplification must survive motion and view changes

Do not hide an awkward attachment exclusively behind the hero-view angle. Check a rear oblique view and, for articulated assets, a representative bent or moving pose. An intentional opening must not turn into an accidental hole in the silhouette when an arm moves.

This is still art direction: deformation that turns a well-designed elbow into a collapsing tube changes the visual style, even if the rig is technically valid.

---

# 7. Rules by asset family

These recipes are proposed extensions from the observed sample. They are **not claims that every Polyfork asset implements these exact proportions or construction methods**.

## 7.1 Architecture

Design the roof, wall mass, openings, and base as a hierarchy. Establish the building's silhouette first: steep/tall, low/spreading, stepped, compact, or stacked. Give doors and windows a consistent relationship to the world scale.

Create depth with a small set of meaningful layers: roof overhang, wall, inset opening, frame, and threshold. Do not substitute dense painted window grids for all architectural structure. At the same time, distant background buildings may legitimately omit geometry that cannot be read.

For a modular kit, standardize wall height bands, opening families, frame thickness, roof-edge treatment, and grid connections. Allow variation in footprint, height grouping, porch placement, and roof direction. A larger building should not merely scale up its door and every plank.

**Common failure:** a box with a roof, dozens of thin decorative strips, and no clear entrance.  
**First repair:** enlarge and clarify the entrance, choose a roof/wall proportion, and remove redundant trim before adding masonry.

## 7.2 Props, furniture, and street equipment

Begin with function: what supports the object, what contains something, what is held, what opens, and what is touched? Then exaggerate the relevant silhouette cues within the kit's chosen language.

Use believable thickness families. A bench seat and its supporting frame should not look like equally thin paper. A latch can be smaller than the door, but it must either read at the intended distance or be omitted as unnecessary geometry.

A handle needs an opening. A lid needs a visible relation to its container. A freestanding sign needs a convincing support and footing. These relationships matter more than reproducing every screw.

**Common failure:** technically intersecting primitives that look glued together.  
**First repair:** select a connection treatment and align the connected forms; then simplify secondary hardware.

## 7.3 Vehicles

Separate identity parameters from secondary customization. Wheelbase, wheel radius, ground clearance, cabin location, hood length, and overhang define the family. Paint, roof accessories, mirror style, and trim modify it.

Design front, side, and rear silhouettes together. Do not add wheel arches that work only in side view or a windshield whose thickness dominates the cabin at three-quarter view. Keep the major glass region coherent instead of dividing it into many equal noisy strips.

Derive connected dimensions: changing wheel radius should reconsider arch clearance and the support plane. Lengthening a vehicle should use a family rule for wheelbase and overhang, not stretch tire circles into ellipses.

**Common failure:** a generic chassis with recognizable lights pasted on.  
**First repair:** establish the vehicle's stance and cabin/body ratio in silhouette before revisiting lights or trim.

## 7.4 Science-fiction and machinery

Choose a motif set: swept wedges, chamfered rectangles, radial pods, layered plates, or tubular assemblies. Use a limited subset consistently within a faction. “Sci-fi” is not permission for every surface to have vents, greebles, luminous lines, and random armor cuts.

Give the object a readable functional hierarchy: core body, propulsion/support system, cockpit/sensor area, and secondary equipment. Use inset dark regions sparingly to reveal layers. Preserve air channels and separations when they define the silhouette.

Choose one language for luminous accents: thin instruments, propulsion elements, or edge indicators. A glowing stripe around every part removes their ability to indicate importance.

**Common failure:** dense small modules around an indecisive central shape.  
**First repair:** isolate the central form and two supporting motifs; remove other modules until the hierarchy is obvious.

## 7.5 Vegetation

A tree requires a growth silhouette, not merely foliage on a trunk. Define trunk direction, canopy envelope, mass distribution, and branch-to-crown relationship.

For a tiered conifer, author tier widths, spacing, overlap, and top taper as a pattern. Lower tiers generally need a deliberate relationship to upper ones; do not randomize each radius without preserving the intended envelope. Distinguish narrow, broad, and irregular silhouettes with approved profiles.

For a broadleaf tree, create a small number of unequal crown masses. A main crown plus supporting lobes can be more readable than many equal spheres. Reveal enough trunk and branch structure to explain support, but do not expose every hidden branch.

Group color by crown or growth region. Vary shape and cluster arrangement before relying on hue changes. Do not decorate all trees with the same tiny fruit distribution regardless of crown size.

**Common failure:** either one featureless sphere or a cloud of identical small balls.  
**First repair:** establish one canopy envelope, unequal lobe sizes, and an intentional opening or directional lean.

## 7.6 Rocks, ground, and water

Give a rock a dominant mass, a stable-looking base, and a few meaningful planes. Vary aspect ratio, top silhouette, and plane organization. Do not generate all character from random vertex displacement.

Terrain needs large readable landforms before small roughness: ridge, basin, shelf, valley, plateau, and clearing. A flat place for gameplay should look like a considered region, not a square patch pasted into unrelated noise.

Water should read as a body or channel with a coherent edge and level treatment for the chosen style. A thin blue zigzag over rugged ground may indicate “river” semantically while looking unfinished. Judge banks, channel width, and path through the landscape at scene scale.

**Common failure:** equally noisy ground everywhere with evenly scattered rocks.  
**First repair:** reduce noise, define one major landform and one quiet area, then group supporting rocks around plausible spatial features.

## 7.7 Humanoid characters and clothing

Define the head/body proportion, shoulder/hip relationships, limb lengths, hand/foot exaggeration, and rest attitude. Choose those for the kit instead of defaulting to either realistic anatomy or universal oversized heads.

Build identity through a readable costume outline, large cloth regions, headgear/hair, and one signature accessory. Keep facial features consistent with the geometry scale. A highly detailed face on an otherwise blocky figure can look like a different art style attached to the body.

Clothing needs both clearance and intention. A coat should express fabric volume, not uniformly inflate every cross-section. Collars, cuffs, hems, belts, and lapels must remain readable and not become stacks of tiny parallel ridges.

**DOCUMENTED context:** Polyfork's character article describes body-dependent clothing fit and cases where technically intended offsets produced undesirable appearance. Its exact family equations are not reproduced here. [S05]

**Common failure:** bulky sleeves, floating collars, or accessories swallowing the torso.  
**First repair:** restore the body/costume silhouette and layer hierarchy; do not cover the problem with texture.

## 7.8 Animals and creatures

Specify species/body-plan cues before building: trunk proportions, shoulder or hip emphasis, neck, muzzle/beak, leg proportions, feet, ears, and tail. Some cues belong in silhouette; others belong in large color regions.

A bear is not a dog with a larger scale value. A fox is not a pig with a longer nose. Reuse geometry mechanisms without collapsing those different mass distributions into one appearance.

For organic creatures, make the visible body transitions coherent through the approved pose range. Separate rigid horns, beaks, claws, and shell pieces where the design calls for it. Restrict spots, scales, and fur detail until the untextured animal reads correctly.

**Common failure:** a convincing texture attached to a generic balloon-and-tubes body.  
**First repair:** adjust trunk/head/limb ratios and joint locations in neutral multiview renders, then revisit markings.

---

# 8. Keeping procedural variations good-looking

## 8.1 Separate three kinds of change

**Identity-preserving variation** stays in the family: a taller lantern, a wider canopy, a different coat length. **Style-preserving redesign** changes more while remaining in the kit: a different lantern silhouette or a different kind of tree. **Style override** deliberately leaves the approved language: a realistic glass lantern in a graphic flat-material kit.

The system should not silently treat all three as ordinary sliders. Label the scope of a control and the scope of its approval.

## 8.2 Expose artist-intent controls

Prefer names such as `body_slenderness`, `canopy_spread`, `roof_steepness`, `cabin_position`, `muzzle_length`, `frame_weight`, and `colorway` over raw vertex offsets.

An artistic parameter should adjust several dependent quantities when needed. A “heavy-duty” prop preset might increase the base width, support thickness, and guard size while keeping handle clearance. It should not independently enlarge every dimension.

Write which visual cues must remain stable. For example: “Canopy spread changes the outer width, but the stem stays centered and the opening below remains visually legible.”

## 8.3 Constrain relationships, not just numeric ranges

| Family | Preserve | Change together |
|---|---|---|
| Lantern | Handle clearance; stable-looking base; visible light enclosure | Body width, hood overhang, guard spacing |
| Vehicle | Wheel contact; cabin identity; arch clearance | Tire size, axle height, arch dimensions |
| Tree | Species envelope; support; crown hierarchy | Height, trunk taper, tier/lobe positions |
| Building | Door scale; module fit; roof support | Footprint, roof span, column placement |
| Character | Body/costume readability; layer separation | Proportions, garment fit, accessory placement |
| Animal | Body-plan identity and plausible articulation | Trunk mass, limb placement, neck/head proportions |

A parameter set can be numerically valid yet aesthetically unacceptable. Define an approved style region inside the larger technically buildable region. An experimental mode may expose more freedom, but it should not label every result as curated or approved.

## 8.4 Use correlated randomness

Choose a preset or latent design direction first, then sample a limited set of related changes. Derive dependent dimensions afterward. Examples: a narrow pine should not independently receive the widest lower tier; a compact cart should not get the longest unsupported counter; an old sign's wear should cluster rather than cover every part uniformly.

Randomly sample from the approved family, not from the entire parameter box. A seed makes variation repeatable; it does not make the variation tasteful.

## 8.5 Review family lineups, not only isolated successes

Create a board with the default, minimum/maximum major dimensions, approved presets, and several deliberately different seeds. Include difficult combinations, such as the widest body with the lowest handle or the shortest torso with the largest permitted accessory.

Use two board types: **fixed-scale framing**, which reveals real size and proportion changes, and **normalized framing**, which compares shape identity at similar image size. Label them. Normalizing every variant can conceal that a “small” variation actually doubles the object's size.

Keep an approved family median nearby. Reject a variant that technically works but looks like an accidental object from another kit. A successful default is approval of that default, not of every exposed combination.

---

# 9. Making a kit look like one world

## 9.1 Cohesion is a set-level property

Review assets together against the same ground, camera, and light. An attractive isolated prop can still be wrong for the kit because its edge radius, surface texture, color strength, or apparent scale is inconsistent.

Give the kit a one-page grammar: intended mood, shape vocabulary, palette roles, corner treatment, feature-thickness family, detail density, world scale, approved material lanes, and three anchors. Record a short “not this” list to exclude near misses.

Do not make coherence synonymous with monotony. Vary silhouettes and focal features while sharing the treatment rules.

## 9.2 Different size categories need different detail strategies

A house, a cart, and a bottle should not have equal amounts of tiny trim simply because they use the same generator helpers. Judge feature sizes at the same scene camera. A bottle may need no modeled seam; a doorframe may need visible thickness.

At a high orthographic gameplay camera, prioritize roof shapes, canopy silhouettes, clear walkable gaps, and upper-facing color regions. For close inspection, add a separate approved detail tier rather than assuming those additions will improve distant gameplay views.

## 9.3 Compose semantic groups

Arrange objects around an activity: a workshop entrance, a market stall, a repair bay, a campsite, or a water source. Give groups different scales and orientations, then reserve quiet space between them.

Place supporting props where they explain use. A crate beside a loading area is more meaningful than the same crate randomly occupying a path. A bench needs a plausible approach and view. Trees can frame a scene without surrounding every building uniformly.

**DOCUMENTED context:** Polyfork says its showcased kit compositions were authored by hand. The inspected village is therefore not evidence that an unconstrained procedural scatter automatically produces its composition. [S06]

## 9.4 Protect the hierarchy of the whole image

Choose the focal structure or activity, then control how paths, color accents, height changes, and surrounding masses lead toward it. Keep some ground areas broad and calm. Do not let background clutter compete with the playable or inspectable subject.

A scene that feels empty may need a better grouping, a stronger ground treatment, or a larger supporting mass—not more small props. Conversely, removing clutter can reveal the quality that was already present.

---

# 10. Neutral inspection versus finished presentation

## 10.1 Keep two independent approvals

**Asset approval:** geometry, silhouette, color organization, and intended material response work under the neutral inspection setup. **Presentation approval:** the same asset looks coherent in its intended engine, camera, scene, and lighting.

Neither approval replaces the other. The neutral pass should not force every finished scene to look sterile. The beauty pass should not conceal clipping, weak proportions, poor color hierarchy, or an unfinished rear side.

## 10.2 Proposed inspection packet

Use a consistent **seven-view packet**: front, rear, left, right, top, front oblique, and rear oblique. These are our proposed views, not recovered settings for Polyfork's internal seven-view harness.

Render orthographic diagnostics where shape comparison benefits, and a representative perspective or orthographic gameplay view for the actual use case. Include silhouette, neutral clay, unlit semantic color, and shaded base look. Add close-ups only where a specific detail or joint needs review.

Start with **1024×1024** full-asset renders and at least **12% framing margin**. Also review silhouette previews at **64 and 128 pixels**, a color thumbnail around **256 pixels**, and the actual target-camera size. These are authoring aids. A distant rock and a close-up character should not receive the same identifiability demand.

For articulated assets, include approved neutral and bent poses or a short sequence. Do not judge motion from a single attractive frame.

## 10.3 Proposed neutral stage

Use a plain neutral background and ground, a readable non-dramatic key, enough fill to inspect the shadow side, modest contact shadow, and fixed exposure/color settings. Disable depth of field, decorative fog, bloom, dramatic colored lights, and unrelated scene objects.

Keep key direction stable between revisions. Avoid lighting that makes every face equally bright, but do not use deep shadows to conceal connections. Record the stage beside the render.

## 10.4 Match the material's intended color pipeline

**DOCUMENTED:** Polyfork describes its base kit models as authored with no tone mapping, hemisphere illumination, a warm key, and a cool rim. Its article reports that a different default tutorial setup made them darker and muddy. That is a vendor-specific observation—not proof that ACES or any other tone mapper is universally unsuitable. [S06]

**PROPOSED:** For an independent portable base, begin with one deliberately defined no-tone-mapping/sRGB-output presentation and tune the palette there. A rich-material lane may choose a filmic pipeline instead. Do not switch color pipelines during asset comparison, and do not copy numeric light intensities between engines as though they were equivalent.

Record input color convention, working/output color handling, tone mapping, exposure, environment, light settings, shadows, and post-processing. Validate the resulting appearance in the actual target engine.

## 10.5 Keep the optional lanes separate

| Lane | Purpose | Additional review |
|---|---|---|
| Base faceted | Broad colors, readable planes, simple materials | Silhouette, values, kit cohesion |
| Rich surface | Controlled texture, normal, and material variation | Texture scale, pattern noise, lighting dependence |
| Graphic shader | Outlines, toon bands, palette/pixel treatments | Contour stability, thickness, readability at target resolution |

**DOCUMENTED:** The animal article describes HD treatment layered onto its existing animal system; the shader article distinguishes changes to asset data from renderer effects. Do not assume an arbitrary shader treatment travels unchanged with an exported mesh. [S04], [S07]

A rich lane should preserve the approved major shapes and color hierarchy. “More realistic” is not the same as “better suited to this kit.”

---

# 11. Original worked design examples

These briefs are newly authored exercises. They are not replicas or parameter reconstructions of the inspected models.

## 11.1 Harbor inspection lantern

**Brief:** A compact work lantern for a harbor-maintenance kit. Sturdy, readable, slightly top-heavy; no ornate fantasy filigree. A squat enclosure, sloped hood, and rectangular carry opening are its three identity cues. Harbor teal body, Chalk enclosure, Graphite guard, small Ochre latch.

**Blockout decisions:** Give the enclosure the main visual area. Let the hood overhang it slightly. Make the base wide enough to look stable, but not another equally dominant box. Separate the handle from the hood with a visible opening. Use two or three broad guards, not a dense cage.

**A technically correct but weak result:** a cylinder on a cylinder, thin looping handle intersecting the cap, many narrow vertical bars, equally bright colors on every part.

**Repair order:** reshape the enclosure profile; establish hood/base relationships; open the carry gap; reduce guards; organize color roles; add one latch. Do not begin by increasing radial segments or adding scratches.

**Variation rules:** width adjusts hood and base together; height preserves handle clearance; guard count has curated options rather than an arbitrary high maximum. Colorway changes retain dark structural guard and light enclosure separation.

## 11.2 Orchard tree with a leaning crown

**Brief:** A small orchard tree for an original rural workshop kit. Low, broad, slightly leaning, and visibly supported. Its cues are a short divided trunk, unequal broad crown lobes, and a few grouped fruit accents—not dense leaves.

**Blockout decisions:** Establish one large crown mass and two supporting masses at different heights. Reveal a fork that explains support. Keep one opening between crown and trunk visible from the intended oblique view. Use a stable-looking base and restrained taper.

**A weak result:** a straight stick with nine equal balls, each independently green, containing uniformly scattered red dots.

**Repair order:** choose the overall canopy envelope; change lobe size hierarchy; move the fork; reduce color variation; place fruit in a few readable groups only after the silhouette works.

**Variation rules:** canopy spread and trunk support change together. Lean has a restricted approved range. A young-tree preset changes branching and crown structure rather than scaling the finished mature tree uniformly.

## 11.3 Workshop cottage

**Brief:** A compact workshop whose silhouette is a broad low roof above a modest wall block, with one offset tall chimney. Its focal feature is a deep practical entrance, not an elaborate facade. Chalk plaster, Cedar structure, Clay roof, and Graphite recesses.

**Blockout decisions:** Decide roof dominance before adding timber. Set a human-scale doorway; preserve it when the footprint expands. Use one small side extension to break the main mass. Give the chimney a meaningful connection to the roof rather than a random cylinder position.

**A weak result:** a perfect box with a triangular cap, very thin repeated wood strips, equal-sized windows everywhere, and a door lost among the grid.

**Repair order:** establish roof overhang and entrance hierarchy; adjust the extension; simplify framing; group windows by facade function; add one local workbench/crate grouping in the scene.

**Variation rules:** building width adds or redistributes facade bays; it does not uniformly widen the door and trim. Height changes use authored wall/roof relationships. Roof color belongs to a curated kit colorway.

## 11.4 Field-survey creature

**Brief:** An original stout quadruped used as a pack creature, neither a direct real-animal replica nor a generic dog. Its cues are heavy haunches, a short downward-curving muzzle, and two small upward ear fins. Pale body, dark feet, one broad back marking; no microfur in the base lane.

**Blockout decisions:** Give the hind mass a deliberate advantage over the chest. Place legs so the stance supports that weight distribution. Use a short neck transition and a restrained tail that does not compete with the ears. Test the side and rear oblique silhouettes before adding the marking.

**A weak result:** a uniformly inflated tube with four identical thin legs and oversized decorative ears.

**Repair order:** correct body-plan masses and leg placement; refine the muzzle; moderate the ears; test bent poses; only then add the back marking and pack attachment.

**Variation rules:** body size changes foot/support scale and attachment positions. The pack remains secondary. A “young” preset requires an authored proportion change rather than a single scale multiplier.

---

# 12. Production review and repair

## 12.1 Work in gates, not one long decoration pass

| Gate | Approve | Reject or return when |
|---|---|---|
| Brief | Category cues, shape grammar, palette roles, target use | Only vague adjectives or an unspecified camera |
| Blockout | Silhouette, proportion, primary/secondary hierarchy | Category depends on markings or tiny details |
| Construction | Connections, thickness, important negative spaces | Parts look disconnected, flimsy, swallowed, or crowded |
| Color | Value grouping, role separation, focal accent | Random color assignment or equal contrast everywhere |
| Detail | Necessary supporting features | Detail hides a weak form or overwhelms broad areas |
| Family | Default, presets, difficult combinations | Variants lose identity or drift outside the kit |
| Context | Kit lineup and representative scene | Asset looks good alone but wrong beside its neighbors |
| Delivery | Neutral and target-engine appearance | Only the hero stage looks convincing |

Do not pay for all later gates when the blockout is wrong. Allow limited iteration within a gate, then return to the brief when repairs indicate that the original design is underspecified.

## 12.2 Critique visible defects, not imagined implementations

A useful finding names **view, part, symptom, consequence, priority, confidence, and next edit**.

Weak: “It needs more polish.”

Better: “In the front-oblique base render, the handle opening nearly disappears into the hood. The object reads as a solid block above the light enclosure. Enlarge or lift the opening while keeping the handle's outer width close to the enclosure. Recheck side and top views before adding trim.”

Weak: “The topology is bad.”

Better: “The left shoulder has a visible shading crease in the clay render that interrupts the intended continuous form. Inspect normals, intersecting pieces, and the local profile to identify the cause. The image alone does not establish which is responsible.”

## 12.3 Fix one dominant problem at a time

Order findings by their effect on the final read. A cabin silhouette failure outranks a missing mirror; a collapsing animal trunk outranks a fur pattern issue; a noisy kit palette outranks a tiny bolt alignment.

Change the smallest coherent set of parameters that addresses the cause. “Smallest” does not mean refuse a necessary blockout redesign. It means avoid changing unrelated color, camera, and geometry simultaneously, which makes comparison ambiguous.

Preserve a passing render and compare under the same stage. A new beauty angle is not evidence that a shape defect was repaired.

## 12.4 Use subtraction as an explicit option

The repair agent must be allowed to remove features. Candidate fixes include deleting a redundant trim row, merging color regions, reducing canopy fragments, widening an empty gap, or removing surface noise.

Avoid a workflow in which every rejection can only add geometry, textures, glow, or accessories. That creates increasingly expensive assets without necessarily improving them.

## 12.5 Maintain a short, scoped lesson book

Record a lesson only after a visible failure and a verified better result. Include its family, conditions, rule ID, example renders, and counterexample.

“Thin handles vanished at this kit's overhead camera” is a useful scoped lesson. “Always make every handle enormous” is not. “A coat collar needs more separation in this body preset” is not permission to inflate all garments.

Use original, appropriately licensed examples for the continuing production lesson book. This study's competitor links are not a ready-made asset-generation evaluation corpus.

---

# 13. A quality rubric that cannot hide bad design

## 13.1 Proposed scores

Score each dimension from 0 to 5. Use anchors: **0** missing/broken; **1** severe failure; **2** noticeably weak; **3** usable but inconsistent; **4** clearly successful; **5** unusually strong for the approved kit and use case.

| Dimension | Weight |
|---|---:|
| Identity and silhouette | 25 |
| Proportions and primary/secondary hierarchy | 20 |
| Construction and negative-space clarity | 15 |
| Value and color organization | 15 |
| Faceting and detail restraint | 10 |
| Kit/family coherence | 10 |
| Presentation in the intended stage | 5 |
| **Total** | **100** |

Compute `total = sum(weight × score / 5)`. An initial promotion target is **80/100**, with **identity and proportions each at least 4/5**, and no blocker. This is a proposed uncalibrated policy—not a scientifically validated quality score or Polyfork's threshold. Update it after comparing judgments with your own human-reviewed examples.

When a dimension genuinely does not apply, document the reason and renormalize the remaining weights. Do not mark “kit coherence” inapplicable merely because no kit anchors were provided; request the missing basis or withhold that approval.

## 13.2 Non-compensable blockers

A high beauty or palette score cannot offset a wrong category, loss of the defining silhouette, a major unintended gap/intersection, failure of an identity-critical feature at the actual use distance, unsupported critique evidence, or a tested variant that violates the declared family.

Report mechanical validation separately. A numerical geometry pass is not aesthetic approval; an aesthetic pass is not proof of export correctness, topology, collision, animation, or licensing.

## 13.3 Ask for evidence and uncertainty

Require at least one named supporting view for each major finding. Permit `not_assessable` when the packet lacks the necessary view, pose, scale, or material pass. Do not force a confident score for unseen backs, unplayed animations, or unavailable engine imports.

For promotion, prefer a blinded comparison against your own anchors and a second reviewer for uncertain cases. Keep occasional human checks. The aim is to reduce repetitive human work while preserving a meaningful standard, not to make the model its own final definition of beauty.

---

# 14. Instructions for authoring and reviewing agents

## 14.1 What every authoring request should include

Provide the kit contract, relevant family rules, three identity cues, dimensions or scale class, intended camera/screen size, palette roles, allowed material lane, necessary connections/negative spaces, allowed variation region, and explicit exclusions. Add owned or appropriately licensed visual anchors when available.

Give the author a concrete stage gate. A blockout task should not invite final textures, ornate trim, or cinematic lighting. A color task should preserve the approved shape unless a specific problem requires reopening it.

## 14.2 Compact author instruction

> Create an original asset under the supplied kit and family contract. Establish the category through silhouette and proportions before decoration. Use one clear primary form, supporting secondary forms, purposeful negative spaces, and semantic color roles. Keep large regions quiet. Add detail only when it improves identity, function, focal hierarchy, or kit character. Preserve defined relationships when parameters change. Do not alter the review criteria or use lighting to conceal geometry problems. State unresolved design choices instead of inventing evidence of approval.

## 14.3 Compact reviewer instruction

> Review only the supplied views and measurements. Separate visible observations from suspected causes. Evaluate silhouette, proportions, construction/negative space, color/value, detail/facets, and kit coherence before presentation. Name the highest-impact defect and the earliest stage that must change. Cite the view and part. Propose a concrete repair, including subtraction when useful. Mark unseen properties not assessable. Do not let a high overall score override a blocker, and do not claim that still images prove animation or topology.

## 14.4 Compact repair instruction

> Address the named defect under the unchanged approved contract and stage. Preserve existing successful properties. Change the relevant shape relationships before adding detail or material complexity. Render the same diagnostic views and any newly relevant views. Explain what changed and which evidence supports the improvement. Do not approve your own output or lower thresholds to make it pass.

The companion `AGENT_ART_DIRECTION.md` provides the operational version without the research discussion. The YAML contract supplies an original starting configuration. Neither file is an executable aesthetic validator by itself.

---

# 15. What remains unknown—and what not to copy

## 15.1 The images do not disclose the private art system

The exact internal palette, profile equations, bevel rules, per-family proportion envelopes, reference-selection process, prompt templates, review thresholds, and camera configurations remain unknown. The inspected stills do not establish geometric validity or tested coverage across all sliders.

No color in our starter palette was claimed as a measured source color. No proposed ratio was recovered from a mesh. No procedural implementation was inferred solely because two renders look alike. Selected marketing images may favor successful variants and flattering views.

## 15.2 Do not overlearn the reference sample

Do not turn “readable” into “all objects chunky,” “faceted” into “show every triangle,” “coherent” into “same RGB everywhere,” “stylized” into “always cute,” or “procedural variation” into “randomize every component.”

Do not copy a scene's imperfect terrain stepping merely because it appears on the site. Do not assume that its spacecraft display uses realistic scale relationships. Do not confuse a reference illustration with a final model or a material demonstration with a new mesh.

## 15.3 Keep the independent library genuinely independent

This pack contains original prose, proposed rules, a newly suggested palette, original exercise briefs, and links to public evidence. It does not contain Polyfork meshes, modules, textures, logos, or copied image files.

Polyfork's published licensing restricts certain uses of its assets, renders, and accompanying text for commercial competing generators, including evaluation and benchmarking; it separately discusses personal study and research. This document does not grant rights to build a scraped training or review corpus. Use your own or suitably licensed production references and clarify permissions for intended third-party uses. This is a scope warning, not legal advice. [S09]

## 15.4 The actual target

**A successful family produces many deliberate designs, not many technically valid accidents.** Its default looks good, its variations preserve identity, its assets belong together, and its appearance survives the real camera and engine. That is the visual layer the procedural implementation must serve.

---

# 16. Source register and native-image audit

Sources were accessed on **4 October 2026**. Image observations are qualitative; no mesh measurements, pixel-color palette extraction, or interactive model tests are claimed. Article claims remain vendor accounts. Reference links can change after the access date.

<a id="source-r01"></a>

**R01** is the user-supplied *Polyfork: technical research and independent implementation blueprint*, research date 4 October 2026, uploaded as `Polyfork_Technical_Research(1).md`. Relevant portions are §5/§5.1 (image audit and visual targets), §4 (family/rendering disclosures), and §13.3–13.4 (render packets and critique). The earlier report's images were not counted automatically: the images listed below were opened again or newly inspected for this guide.

## 16.1 First-party pages

**[S01] — Polyfork homepage.** Public hero images, remix images, and kit-image discovery.

**[S02] — Kit catalog.** Shared kit palette, scale, and shape-language framing.

**[S03] — WorldClaw and the asset supply problem.** Vendor statement about a 32-color kit palette, grid, and style contract; pine/woodland evidence. Discussion of WorldClaw is not evidence of Polyfork using its stack.

**[S04] — Animals v2.** Animal-family direction, limitations of an automated judgment, reference images, and optional HD presentation.

**[S05] — Characters v2.** Body-dependent clothing fit and visual fit failures. Article cover was not successfully viewed in this study.

**[S06] — A kit is a place.** Hand-authored compositions and the vendor-described base lighting/color pipeline.

**[S07] — Shader looks and portability.** Rendering treatments versus asset data; shader comparison image. The URL says six, but the article describes seven looks.

**[S08] — Terrain that joins.** Terrain continuity versus visual composition and color continuity.

**[S09] — Asset licensing.** Published use restrictions; scope warning, not a legal opinion.

## 16.2 Full-size image files

Each linked ID opens the original published image. Dimensions describe the whole file, including all panels of a composite. The companion evidence files retain individual observation and limitation records.

| ID / original image | Native size | Evidence type | Main limitation |
|---|---|---|---|
| [V01] — Camper van hero | 900×900 | individual model hero | One hero view; hidden sides and implementation untested. |
| [V02] — Astronaut Scientist hero | 900×900 | individual model hero | Selected static pose; deformation and animation untested. |
| [V03] — Alien Raider hero | 900×900 | individual model hero | Bright strips do not prove emissive material or actual lights. |
| [V04] — Motel sign hero | 900×900 | individual model hero | Appearance alone does not reveal how inset geometry was authored. |
| [V05] — Hot Dog Cart hero | 900×900 | individual model hero | Only one viewing angle; structural usability not tested. |
| [V06] — Convertible 60s hero | 900×900 | individual model hero | No dimensional measurements or drive/animation tests. |
| [V07] — Pig before and after | 1000×500 | comparison composite | More unified appearance is not proof of welded topology. |
| [V08] — HD animal presentation | 1000×625 | material demonstration composite | Cannot verify unchanged geometry or material performance from stills. |
| [V09] — Pig reference sheet | 1000×360 | reference artwork composite | Reference artwork, not a final-model diagnostic render; cameras not calibrated here. |
| [V10] — Animals v2 cover | 1000×625 | animal group render | Individual animals are smaller than the full composite; not an animation audit. |
| [V11] — Village golden-hour scene | 1000×625 | composed scene | Image does not by itself reveal the placement method or runtime cost. |
| [V12] — Village lighting comparison | 1000×625 | lighting comparison composite | Not a measurement of exposure, light count, or individual light behavior. |
| [V13] — Medieval Village approved scene | 1000×553 | kit scene | Scene-level evidence; not close-up mesh inspection for every prop. |
| [V14] — New York City approved scene | 1000×553 | kit scene | Not proof of real-world architectural dimensions or navigable placement. |
| [V15] — Space Base approved scene | 1000×553 | kit scene | Fine parts remain small in the scene; no material-value extraction. |
| [V16] — Retro Cars approved scene | 1000×553 | kit scene | Catalog composition, not a driving or scale-validation test. |
| [V17] — Spaceship Wars approved scene | 1000×553 | kit scene | Display arrangement does not establish realistic relative scale or a playable level. |
| [V18] — Camper meadow green variant | 600×600 | color variant | No proof of the recoloring implementation or parameter-space coverage. |
| [V19] — Camper ocean blue variant | 600×600 | color variant | One colorway example; not evidence of a geometry rebuild. |
| [V20] — Camper brick red variant | 600×600 | color variant | No exhaustive color-combination evaluation. |
| [V21] — Woodland diorama | 1000×625 | composed scene | Serrated boundary treatment is not automatically an aesthetic target. |
| [V22] — Seven pine variants | 1000×388 | family lineup | Lineup does not establish validity of every procedural parameter combination. |
| [V23] — Side-by-side terrain example | 1000×375 | engineering demonstration | Still image cannot prove crack-free mesh edges; not a finished-landform quality standard. |
| [V24] — Shader comparison | 1000×625 | shader comparison composite | Similar shape does not demonstrate shader portability or equal geometry buffers. |
| [V25] — Terrain landscape cover | 1000×625 | terrain scene | Distant view cannot establish exact joins, material continuity, or gameplay suitability. |
| [V26] — Terrain color seam comparison | 1000×753 | engineering comparison composite | Does not prove geometric, normal, mixed-resolution, or corner correctness. |

## 16.3 Reading and reuse note

The Markdown and HTML contain the same substantive guide. The HTML also renders the original starter palette as swatches. Reference links require an internet connection; third-party image files are deliberately not embedded or mirrored. Source URLs are evidence links, not an automated scraping manifest or a grant of production-use rights. The compact agent guide and YAML are original working aids; review and calibrate them before production.

**End of guide.**

[S01]: https://polyfork.dev/ "Polyfork homepage"
[S02]: https://polyfork.dev/kits "Kit catalog"
[S03]: https://polyfork.dev/blog/worldclaw-and-the-3d-asset-supply-problem "WorldClaw and the asset supply problem"
[S04]: https://polyfork.dev/blog/animals-v2 "Animals v2"
[S05]: https://polyfork.dev/blog/characters-v2 "Characters v2"
[S06]: https://polyfork.dev/blog/a-kit-is-a-place "A kit is a place"
[S07]: https://polyfork.dev/blog/six-shader-looks-and-which-ones-you-can-keep "Shader looks and portability"
[S08]: https://polyfork.dev/blog/terrain-that-joins "Terrain that joins"
[S09]: https://polyfork.dev/licensing "Asset licensing"
[V01]: https://polyfork.dev/files/camper-van-8d10e2/renders/hero.png?v=1785361966 "Camper van hero — 900×900"
[V02]: https://polyfork.dev/files/astronaut-scientist-47d733/renders/hero.png?v=1790961850 "Astronaut Scientist hero — 900×900"
[V03]: https://polyfork.dev/files/alien-raider-98249f/renders/hero.png?v=1787927757 "Alien Raider hero — 900×900"
[V04]: https://polyfork.dev/files/motel-sign-21033b/renders/hero.png?v=1785366467 "Motel sign hero — 900×900"
[V05]: https://polyfork.dev/files/hot-dog-cart-115192/renders/hero.png?v=1785420809 "Hot Dog Cart hero — 900×900"
[V06]: https://polyfork.dev/files/convertible-60s-b76f89/renders/hero.png?v=1787496769 "Convertible 60s hero — 900×900"
[V07]: https://polyfork.dev/img/blog/animals-v2-pig-before-after.png?v=1789990290 "Pig before and after — 1000×500"
[V08]: https://polyfork.dev/img/blog/animals-v2-hd.png?v=1789990311 "HD animal presentation — 1000×625"
[V09]: https://polyfork.dev/img/blog/animals-v2-pig-reference.png?v=1789990292 "Pig reference sheet — 1000×360"
[V10]: https://polyfork.dev/img/blog/animals-v2-cover.png?v=1789990692 "Animals v2 cover — 1000×625"
[V11]: https://polyfork.dev/img/blog/a-kit-is-a-place-cover.png?v=1790633916 "Village golden-hour scene — 1000×625"
[V12]: https://polyfork.dev/img/blog/a-kit-is-a-place-hours.png?v=1790633943 "Village lighting comparison — 1000×625"
[V13]: https://polyfork.dev/kits/medieval-village-kit-ca0b43/approved.png?v=1786404320 "Medieval Village approved scene — 1000×553"
[V14]: https://polyfork.dev/kits/nyc-city-kit-fbca88/approved.png?v=1787391431 "New York City approved scene — 1000×553"
[V15]: https://polyfork.dev/kits/space-base-kit-cf65de/approved.png?v=1787391443 "Space Base approved scene — 1000×553"
[V16]: https://polyfork.dev/kits/racing-cars-kit-660d53/approved.png?v=1786403381 "Retro Cars approved scene — 1000×553"
[V17]: https://polyfork.dev/kits/spaceship-wars-kit-234642/approved.png?v=1788039439 "Spaceship Wars approved scene — 1000×553"
[V18]: https://polyfork.dev/img/remix/camper-meadow-green.webp?v=1785706112 "Camper meadow green variant — 600×600"
[V19]: https://polyfork.dev/img/remix/camper-ocean-blue.webp?v=1785706112 "Camper ocean blue variant — 600×600"
[V20]: https://polyfork.dev/img/remix/camper-brick-red.webp?v=1785706112 "Camper brick red variant — 600×600"
[V21]: https://polyfork.dev/img/blog/worldclaw-cover.png?v=1786486348 "Woodland diorama — 1000×625"
[V22]: https://polyfork.dev/img/blog/pine-variants.png?v=1786486435 "Seven pine variants — 1000×388"
[V23]: https://polyfork.dev/img/blog/terrain-join.png?v=1786486596 "Side-by-side terrain example — 1000×375"
[V24]: https://polyfork.dev/img/blog/shaders-cover.png?v=1787811468 "Shader comparison — 1000×625"
[V25]: https://polyfork.dev/img/blog/terrain-that-joins-cover.png?v=1786489617 "Terrain landscape cover — 1000×625"
[V26]: https://polyfork.dev/img/blog/terrain-seam-blend.png?v=1786489365 "Terrain color seam comparison — 1000×753"
