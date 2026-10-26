# Twelve-family catalog

Promote planter, treasure chest, wheelbarrow, stone well and the refined conifer alongside the seven existing recipes. Preserve the reviewed default geometry, meter scale, ground origins and semantic colors. Trial sources remain unchanged.

## Callers and compatibility

`src/recipes/index.ts` registers recipes. `src/catalog/index.ts` dispatches build, load and export. Studio selectors, site cards and MCP discovery consume this registry. CLI export and validation use the same catalog. Source packaging follows each recipe's source entry and the declaration ledger. Extend the existing kit review stage to consume this registry while retaining its `lantern` alias and six-family capture inputs. Existing kit membership and placement stay intact.

The seven existing recipes retain their versions, parameters, saved designs, measurements and exported bytes. New production recipes use version 1.0.0 and strict format-version-1 designs. Trial design files are historical inputs, not production compatibility promises. The planter's production ID is `planter`.

## Construction contract

| Family | Preserved identity | Construction controls and relationships |
|---|---|---|
| Planter | Open board box, corner posts and floor | Two to five wall courses; optional feet consume 0.10 m of total height. Fixed board gaps and wall thickness preserve the opening. Three presets include an ordinary raised box, ground trough and tall patio box. |
| Treasure chest | Four-course body, curved six-segment lid, iron bands and brass latch | Two to six body courses; lid opening 0–110 degrees around the rear hinge; latch belongs to the lid. Lid is a closed static solid with an underside. Open body remains hollow. Bands and latch move with the lid. |
| Wheelbarrow | Open tray, iron-tread wooden wheel and supported handles | Two to five tray courses; solid or spoked wooden wheel. Axle, leg contact, floor elevation and risers follow wheel radius and tray dimensions. |
| Stone well | Open masonry, timber shelter, windlass and suspended bucket | Optional roof, optional bucket and windlass; bucket drop 0–0.6 m from its default height. Roof removal retains posts and mechanism. Bucket requires windlass; the interface disables bucket drop when unused. Rope length follows bucket height. |
| Conifer | Irregular connected branches, clustered foliage and narrow leader | Five to ten tiers; tier heights share the original crown envelope and taper by normalized tier position. Default eight tiers reproduce attempt 05. Height and spread remain measured bounds. Seed controls repeatable organic variation. |

Presets change construction and proportions intentionally. Color controls affect only semantic materials. Unsupported types, unknown keys, nonfinite numbers, out-of-range values and contradictory mechanism choices fail before construction. Saved applied values must match recomputed requested values. Each default and supported validation case must have finite nondegenerate geometry, unique named parts and a ground minimum within 0.1 mm of zero.

Palettes without a `colorway` control declare a nonempty `parameters` patch of semantic color keys. Registration rejects missing mappings, unknown keys, non-color controls and invalid colors. The editor applies and compares the patch independently of control order and preview swatches. Existing colorway behavior stays compatible.

## Ordered delivery and evidence

1. F2.1: Add regression and construction tests before changing behavior. Retain the seven-family export baseline and failing inputs.
2. F2.2: Register the five production recipes, construction controls, three presets per family, thumbnail declarations and package provenance.
3. F2.3: Verify current unit and recipe suites, type checking, CLI/MCP/catalog integration and independently rebuilt source downloads. Limit integration checks to affected paths.
4. F2.4: Capture neutral views, preset thumbnails, a fixed-scale twelve-family lineup and a shared water-source scene through existing headless scripts. Save explicit inputs and renderer/source manifests under `evidence/revision7/catalog/`.

Neutral captures support technical inspection and subsequent visual review. They do not establish aesthetic acceptance. Unity editor integration belongs to F3.
