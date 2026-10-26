# Architectural and manufactured anchor candidate

## Cottage

The roof is the primary mass above a quieter plaster wall block. Its cues are a practical recessed doorway, protective eaves and one offset chimney. The entrance is the focal opening. The work bay is a subordinate extension with readable supports and a usable surface. The roof should read as an assembled cover, not three oversized continuous shelves.

Keep the current footprint, doorway scale, roof-cover choices and facade controls. Use local geometry to divide thatch into overlapping sections with restrained variation. Shingle courses retain overlap and show a deliberate eave termination. Use a clear ridge and enough edge depth to explain the cover without outlining every section. Major timbers carry the walls and roof; smaller trim frames openings. Hardware remains subordinate.

The first candidate addresses roof segmentation and entrance/work-bay joins. It does not add decorative masonry, new controls, renderer changes or a new material system.

Eave fascia must meet the physical deck underside across its width and length. Its upper face follows the local roof pitch with restrained overlap into the deck. The deck depth is shared by deck construction and trim placement. Cover thickness changes the cover above this support; it must not detach the trim below it. Check both eaves through narrow/deep and wide/shallow roofs, sag, cover and overhang limits.

Ridge caps must follow the piecewise deck stations and the actual covering surface. Preserve a thin fitted cap across its width rather than spanning sag with a raised chord. Gable rakes follow the deck's wall/eave pitch break and contact its underside. Cover changes must retain these connections with the same sag and footprint. A detached cap or rake must fail a direct surface-contact check.

## Inspection lantern

The utility lantern's enclosure is the primary mass. A sloped overhanging hood and a rectangular carry opening establish its identity. The base provides a stable stance with less visual weight than the enclosure. A few broad guards protect the light area while leaving broad enclosure faces visible. The opening above the hood stays clear through handle settings. Vent and mounting details explain construction rather than forming another dense cage.

The utility carry mounts must contact the actual hood surface across their lower footprint. Their undersides follow the same chamfered hood profile with a small embedded overlap. Handle clearance and the upper mounting relation stay fixed when hood flare changes. Contact checks must sample the hood and mount surfaces directly; overlapping whole-object bounds do not establish this support.

Use the Harbor utility preset as the manufactured anchor. Preserve body-width/body-height relationships, requested handle clearance, material roles, square/arched handle choices, guard count/layout, profile and detail controls. Reshape connected utility components before adding hardware.

The current default and two presets route to `src/lantern/rustic.ts` and also receive a first-candidate pass. Keep their classic oil-lantern identity: a broad reservoir, tapered faceted vessel, separate ventilated crown and clear oval carry hoop. Replace shallow stacked rims with a readable sloped cover and keep guards seated on the vessel frames. Preserve the distinct rustic and utility paths and all existing controls.

## Inputs, outputs and failure behavior

Inputs remain the existing validated family controls. Outputs remain the existing generated root, bounds, configuration, material roles and semantic attachments. Out-of-range or incompatible inputs continue to fail through the existing parsers. This candidate introduces no new parameter keys or silent clamping.

The cottage must retain a grounded foundation, supported roof deck, open doorway recess and a seated work-bay roof across valid dimensions. Both lantern constructions must retain grounded support, connected hood and handle seats, exact clear handle height and an unobstructed carrying opening. Scene detail must retain the primary forms when inspection detail is absent.

## Affected production callers

`cottage.ts` is called by `src/families/index.ts:buildFamily`, through `src/recipes/builtins.ts:cottageRecipe`. `generator.ts:generateLantern` is called by `src/recipes/builtins.ts:lanternRecipe` and direct geometry consumers. Both reach `src/catalog/build.ts:buildRecipeAsset`, semantic attachment, appearance processing and `src/catalog/index.ts:buildAsset`. The studio, CLI, module packaging and GLB export consume this shared path.

Part names and material roles feed `src/catalog/semantics.ts`. Preserve named structural parts and prefix conventions where possible. Additional roof sections need stable distinct names. Existing anchors remain in their current coordinate contracts. Renderer, semantic core and delivery mappings are outside this candidate.

## Focused verification after source release

Write relationship tests before geometry changes in `tests/r2-art-architecture.test.ts`. Cover roof overlap and deck contact for both cover types, entrance recess depth, work-bay attachment for both sides and narrow/deep boundaries. For the utility lantern, cover carry-gap rays, handle-seat/hood contact, guard support at both ends, envelope changes and independent color changes. Include invalid body/handle relationships as negative cases and narrow/tall plus wide/short valid edges.

Historical tests and expected hashes stay unchanged. Record any historical expectation that conflicts with intentional candidate geometry for separate version/migration review. Geometry checks cannot approve appearance. The first candidate stops for full-size individual multi-view review before further tuning, packaging or publication.
