# Parameterized rigged assets

Status: first humanoid source candidate implemented. Scoped skin deformation, generated and reloaded clip contact, and GLB validation checks pass. Actual preview interaction, visual acceptance and engine compatibility remain unverified. Animal implementation remains pending humanoid review.

## Result and order

Deliver one original faceted humanoid, then one original quadruped. Each has meaningful shape and color controls, a real skeleton and SkinnedMesh, deforming joints, contact-aware motion and playable GLB clips. Existing rigid mechanisms retain their semantic-v1 behavior.

The first humanoid is a clothed, neutral adventurer with a simple tunic, boots, shaped head and hair cap. Limb profiles taper through bend loops. Elbows and knees deform continuous limb surfaces with blended weights. Rotating separate rigid upper and lower limb primitives does not satisfy deformation. Main body regions may remain separate material-role meshes with deliberate overlap at garment boundaries.

## Humanoid inputs

Reuse Design format 1 and the current Descriptor parsing, save and load rules. Start a new family at version 1.0.0. Proposed family ID: stylized-humanoid.

| Control | Range | Meaning |
| --- | --- | --- |
| height | 1.2 to 2.2 m | Ground-to-crown rest height |
| headRatio | 0.14 to 0.22 | Head height / total height |
| shoulderRatio | 0.22 to 0.32 | Shoulder width / total height |
| hipRatio | 0.16 to 0.24 | Hip width / total height |
| legRatio | 0.43 to 0.53 | Hip joint height / total height |
| armRatio | 0.32 to 0.40 | Shoulder-to-wrist length / total height |
| limbRatio | 0.035 to 0.065 | Authored limb radius / total height |
| color.skin | RGB hex | Exposed skin role |
| color.tunic | RGB hex | Tunic role |
| color.boots | RGB hex | Boots role |
| color.hair | RGB hex | Hair role |

Proposed defaults: height 1.7 m, headRatio 0.18, shoulderRatio 0.27, hipRatio 0.20, legRatio 0.48, armRatio 0.36 and limbRatio 0.045. Default role colors are skin #c49375, tunic #657764, boots #473c36 and hair #3b302b.

These bounds are initial engineering limits, subject to tighter measured limits if shape combinations collapse or contact cannot be maintained. Inputs must reject invalid combinations explicitly. Do not silently alter requested controls to make a pose reachable. Height and proportion changes regenerate joint locations, inverse binds, vertex weights and clips together.

The first implementation uses a flat ground plane at Y=0. Arbitrary terrain adaptation, navigation, obstacle avoidance, fingers, facial rigs, retargeting, physics and cloth simulation are outside this slice.

## Rig and build output

Keep Recipe and AssetBuild required fields unchanged. A rigged build extends the existing semantic build structurally in a separate rigging module. The new wrapper calls buildRecipeAsset, then attaches and validates rig metadata after existing appearance processing. It owns rig-specific disposal. Static builders do not import the rigging wrapper.

The root remains at ground centre with metres, +Y up and +Z forward. Semantic-v1 describes material parts and rigid node membership. Skeleton bones are not declared as AssetJoint records. A separate versioned openpolyRig JSON record declares bone identities, parent identities, skinned mesh identities, clip identities, root displacement and contact intervals. Do not store Skeleton, Bone or AnimationClip objects in userData. Runtime clips have one authority: root.animations.

The humanoid skeleton uses stable portable names for 20 bones: motion root, hips, spine, chest, neck, head, two upper arms, two forearms, two hands, two thighs, two shins, two feet and two toes. Skin indices reference a stable bone order. Each vertex has four index/weight slots, nonnegative finite weights summing to one, and at most four active influences. Bend loops must include genuinely blended vertices. Materials remain single-role per mesh so existing appearance and semantic part mapping apply.

Bound the initial build to 32 bones, 8 skinned material-role meshes, 12,000 triangles, two clips and 241 keyframes per track. Reject excess work. Rest bounds and sampled animated bounds are distinct outputs. Existing static measurements remain unchanged and do not become deformation evidence.

## Clips, contacts and IK

Provide a 2.4-second idle and a 1.2-second walk cycle, with walk displacement initially 0.28 times height. Idle breathes without lifting the supporting soles. Walk has a declared duration, forward root displacement and left/right stance intervals. Generate clips from the current body proportions. A deterministic two-bone solve positions knees and ankles from explicit foot targets and pole directions. Validate reach before mutating a pose. Reject nonfinite, degenerate or unreachable targets without leaving a partial pose.

The preview exposes an explicit foot-target pose test with apply and reset actions. Unreachable requests report an error and retain the last valid pose. This pose test demonstrates the same solver used by clip generation. It does not rewrite canonical clip data. Export rebuilds from the canonical design rather than serializing a transient scrubbed or manually posed preview.

Bake procedural IK to ordinary bone translation/quaternion tracks. GLB playback must not depend on a custom IK evaluator. Begin at 60 samples per second, then verify interpolated phases between keys. Any higher sample rate must remain within the declared keyframe limit. Contact error is measured on actual deformed sole vertices, with a 0.005 m ground-height and planted-foot drift limit during declared stance intervals. If those bounds fail, correct motion or narrow unsupported proportions; do not relabel sliding as contact.

The walk root moves forward within one cycle. Its final displacement is metadata. The preview accumulates this displacement in a parent placement wrapper on repeated cycles. Generic viewers can play the exported root-motion cycle; a generic loop that resets its root will visibly reset position. Report that behavior explicitly. Idle loops in place. Do not describe all generic viewers as supporting accumulated root motion.

## Export and playback

Keep src/catalog/export.ts byte-for-byte unchanged. Current immutable source archives contain that file. A dedicated rigging export wrapper reuses readSemantics, validates openpolyRig and skin bindings, then calls the installed GLTFExporter with explicit animations from root.animations. Preserve existing semantic visibility behavior. The installed exporter switches animated nodes to TRS when clips are present. This separate animated entry avoids modifying archived static source closures.

The animated exporter clones the skeleton and exports its meshes and motion root as scene-root nodes. Root metadata lives in scene extras. This avoids parent-transform ambiguity for skinned meshes. It does not mutate or dispose the preview geometry and materials.

GLB output contains real skins, inverse bind matrices, JOINTS_0, WEIGHTS_0 and animation channels. Rig metadata is portable JSON. Load the GLB through GLTFLoader and play imported clips through a new AnimationMixer. Check imported deformed positions, contact intervals, clip duration, root displacement and deterministic rebuilding. Structural validator success alone does not establish motion or contact.

Keep existing static exporter calls, semantic-v1 joints and immutable release files unchanged. Do not regenerate historical source packages or procedural modules. Preserve the existing generated-payload conflict checks. Registering the new family, exposing animation capabilities in discovery and extending package declarations are separate integration work after the first working humanoid.

## Failure and verification

Reject unknown fields, invalid numeric/color controls, duplicate or missing bone/node names, invalid parents or cycles, missing skin attributes, attribute count mismatch, invalid indices/weights, nonfinite transforms, singular binds, unresolved tracks and invalid contact intervals. Rig export must reject undeclared clips and missing required clips. Use ownership-aware, idempotent cleanup for shared skeletons, geometry and materials.

Tests precede behavior changes. Include combined proportion limits and invalid inputs; bind-pose reconstruction; weight sums and indices; actual knee/elbow vertex deformation; unreachable IK without mutation; interpolation and loop seam samples; planted sole contact; and imported GLB skin/clip playback. Compare unaffected static GLB bytes and frozen release digests. Test appearance transformations preserve skin attributes.

Show the complete character and close views of knees, elbows, feet and garment transitions through representative motion phases. Verify the actual preview and exported/reloaded playback. Engine verification is a separate required check before claiming the intended engine works. No static pose, metadata-only skeleton or source test establishes visual or engine acceptance.

## Animal continuation

After the humanoid path is demonstrated, author a bounded original quadruped with its own proportions, bone graph, weight profiles and contact schedule. Reuse proven skin validation, export and two-bone mathematics where anatomy permits. Do not stretch the humanoid skeleton into a quadruped or claim animal motion from humanoid clips. Choose the exact animal and controls before implementing that family.

The current visual correction first separates the head and hair shell at one shared planar contour, without overlapping forehead faces. The walk stance must retain a mild knee bend, measured from actual hip, knee and ankle positions, while preserving existing sole contact limits. Facial, hand, clothing and cuff refinement follows review of this correction.

The restrained detail pass adds two small dark geometric eyes, a supported faceted nose, tapered closed mitten hands with a seated thumb volume, an open tunic neckline, supported belt and hem bands, and hollow boot cuff bands. Detail sizes derive from existing body proportions and reuse existing material roles. Hairline, gait, bone identities and sole-contact limits stay authoritative. This pass requires a fresh visual review.

Animated export must bake portable face normals for meshes whose material uses flatShading. Clone and split indexed geometry per triangle, recompute face normals, and retain every skin/color attribute. Do not mutate or dispose preview geometry. GLB has no flatShading material flag. Verify imported per-corner normals, positions, skin influences, inverse binds and clip tracks, then compare actual generated and imported motion views.
