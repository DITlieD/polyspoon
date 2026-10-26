# Loading designs after the construction update

The six built-in recipes now save as 0.6.0. Bench, planter, treasure-chest, wheelbarrow, stone-well and conifer now save as 1.1.0. Fence keeps its geometry; its revision advances because it shares the built-in source package.

Loading a supported older design validates its requested and applied values against its original rules, then builds the revised construction with the validated values. Earlier built-in formats remain supported through their existing loaders. Invalid or unknown versions, changed applied values, unsupported parameter values and malformed migration notices fail. Old geometry is not replayed. The versioned public modules and source packages remain the original artifacts.

A migrated design includes a notice describing the construction and indexed-part changes. Saving that design and reloading it preserves the notice. Session edits, appearance changes, undo/redo and returning to a family preserve it. Reset starts a fresh design. CLI export resolution returns the same migration notice as browser loading. MCP build_variant and export_asset accept the saved record as design and return the validated migration notice. Omit family or supply the matching family. Do not combine design with parameters or appearance. Existing family-only requests continue to build family defaults.

Per-part colors keep their exact semantic names. Added parts use their authored colors. Colors for absent parts remain in the design and appear as inactive colors. An index identifies the named component in its revised layout, so a retained index can occupy a new position. No automatic one-to-many color aliases are introduced.

The comparison below uses the actual prior public procedural modules and revised default builds. Cottage was also checked at width 7.2. Full part lists, material-role changes and original configurations are retained in [the comparison data](../evidence/revision12/migration/prior-parts.json).

| Recipe | Prior/current default parts | Changes relevant to part colors |
| --- | --- | --- |
| Work lantern | 26 / 22 | Four upper vent-divider indices disappear; their colors remain inactive. |
| Cottage | 186 / 246 | Six old roof-band IDs disappear. New course/segment IDs, threshold and work-bay covering start with authored colors. Ridge caps increase from four to six, including at width 7.2. |
| Tree | 12 / 12 | Trunk, branches and crown names persist with revised geometry. |
| Fence | 18 / 18 | Names, layout and geometry persist. |
| Crate | 40 / 40 | Names persist; peg seating is corrected. |
| Boulder | 2 / 2 | Stone-mass and moss-region names persist; moss becomes continuous upper growth. |
| Bench | 16 / 16 | Board and frame component names persist with revised profiles. |
| Planter | 21 / 25 | Four new rim parts start with authored wood colors. |
| Treasure chest | 42 / 55 | New rims, cover cheeks/rails, hinge journals/collars and latch receiver start with authored colors. |
| Wheelbarrow | 50 / 51 | Existing components persist; new wheel-hub starts with authored color. |
| Stone well | 136 / 129 | Course/segment counts redistribute. Removed stone/coping indices remain inactive. Two roof-board indices and ridge cover are added. |
| Conifer | 109 / 109 | Tier/branch/spray names remain foliage components. Authored needle/shade/tip roles change on some retained parts; explicit part tints still take priority. |

For example, an old cottage color on ridge-cap-0 continues on that named cap. New ridge-cap-4 and ridge-cap-5 keep authored colors. A color on roof-left-band-0 remains inactive because that broad roof band was replaced by multiple course/segment parts. Reassign it explicitly to the desired new parts when editing the design.

Boulder width and depth are shape scales, not exact bounding-box dimensions. Height is measured before burial. Burial reduces exposed height. The default scales 1.6 and 1.2, height 0.95 and burial 0.12 produce approximately 1.76 × 0.84 × 1.38 m. Moss coverage expands continuous growth over the top and shoulders.
