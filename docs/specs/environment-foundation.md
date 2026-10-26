# Environment foundation

The first environment format stores a bounded deterministic terrain, explicit tile coordinates, and placements of existing canonical catalog designs. Recipe versions stay unchanged. Unknown fields, unsupported versions, nonfinite numbers, duplicate tile/placement identities, off-terrain anchors and excessive slopes fail before export. Save/load preserves canonical design migration and appearance.

Terrain uses a seeded global lattice and one fixed diagonal per cell. Heights are rounded once to float32, then both mesh vertices and height/slope queries use those samples. Cell sizes are binary-exact values0.25,0.5,1,2,4meters. Adjacent tiles share exact world coordinates/heights and normals computed from global neighbors. Queries return the actual piecewise planar mesh surface and upward face normal/slope, including negative coordinates. Smooth vertex normals are a separate shading result. The finite tile edge has no wall/skirt or invented zero-height boundary.

Bounds: unsigned32 seed,4..128cells/tile, amplitude0..12m, wavelength4..128m, base height-20..20m, tile indices-1024..1024, at most16tiles and64placements. Three continuous noise octaves produce original terrain without external assets. Flat amplitude0 and maximum parameter cases remain valid.

Placement uses an upright yawed wrapper with a catalog bounding-box bottom-center anchor. Sample the rotated footprint on a grid no coarser than half a terrain cell, including corners and center. Reject off-terrain footprints or sampled height variation above maxSupportVariation (default0.25m, allowed0..1m). Position the anchor at the highest sampled support, preventing sampled-point penetration. A20000-point footprint limit bounds work. This does not prove full-footprint clearance, collision avoidance or terrain-conforming foundations. Slope limits reject inappropriate anchors. Roads and water must later use this same sampler; their generators and scene UI are outside this first milestone.

The GLB exporter reuses the production catalog/exporter, preserves scene configuration and provenance on the environment root and canonical configuration on catalog children, and disposes owned geometry/materials. CLI export accepts a saved manifest and writes a validated GLB, canonical manifest and report with source/config/geometry/GLB hashes. Report/output paths cannot replace the input. Invalid input emits no successful export.

Tests precede implementation: deterministic seeds, negative/extreme/unknown inputs, exact adjacent boundary positions/normals, triangle-query ray agreement, slope, canonical scene round trip, migration/appearance, grounding anchors, rejected off-terrain/slope placements, actual GLB validation and CLI round trip. Rendering, road/water continuity, scene UI and target-engine acceptance remain review gaps. Main owns individual full-size render and eventual real scene endpoint review.

## Runnable entrypoints

`node --import tsx scripts/environment-cli.ts example --out scene.json` creates the canonical starter scene. `node --import tsx scripts/environment-cli.ts export --config scene.json --out scene.glb` writes the GLB plus `.environment.json` and `.report.json` sidecars. Existing outputs and input collisions are rejected. The CLI captures repository source/lock provenance before export and rejects source drift before writing.

The standalone Vite route `/environment.html` imports `src/environment/preview.ts`. It supports scene-file load, seed/amplitude edits, OrbitControls, framing, scene save and actual GLB export. Invalid updates retain the previous view and disable save/export. Exports lock mutations; stale file loads cannot replace newer state. Browser provenance binds surface version and canonical configuration hash; repository source/lock provenance is supplied by the CLI.

At a grid line or diagonal, multiple triangles can have different face normals. Query ties choose the positive global cell and its fixed diagonal rule. Heights remain exact on shared edges; face-normal comparisons apply to the chosen triangle away from ambiguous shared vertices/edges. Smooth global-neighbor shading normals remain identical between tiles.

## Roads, water and placement editing

Format 1 accepts absent roads and water as empty arrays. Existing terrain and placement meanings remain unchanged. Each feature has a stable identity. Roads contain two to eight distinct path points and a width from 0.25 to 8 metres. Joined ribbons follow the exact terrain triangles with a 0.015 metre surface offset. Invalid folds, intersecting ribbons, missing tiles and partly unsupported extents fail explicitly. Each scene supports at most eight roads and eight water patches, with bounded clipping work.

Water patches have rectangular extents from 0.25 to 64 metres and a fixed elevation from -20 to 32 metres. Their entire extent must lie on supplied terrain. The visible surface is clipped where terrain rises above that elevation. Fully dry patches fail. Water does not excavate terrain or simulate flow.

The standalone editor exposes road paths and width, water position, extent and elevation, and catalog placement selection, creation, removal, position, yaw and support limits. Invalid edits retain the prior display and prevent saving and export until corrected. Canonical saves and GLB metadata retain all features. Scoped geometry and export checks precede endpoint review. Target engine and aesthetic acceptance remain separate.

Selected placements have an explicit Frame selected asset action using the last valid placement bounds. Selection and parameter edits leave the camera unchanged. Frame scene remains available. Water is labeled as boundary-limited: wet terrain can reach the rectangular patch edge and produce a straight cutoff.

Scene and selected-asset framing fit all eight world-bounds corners within 85% of horizontal and vertical perspective bounds, accounting for aspect and effective field of view. Resize refits the active framed view while retaining its viewing direction. Manual orbit or pan clears automatic resize framing. Parameter edits do not trigger framing.
