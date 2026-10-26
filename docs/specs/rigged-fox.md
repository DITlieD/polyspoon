# Original rigged fox

Status: first bounded source candidate. Skinning, motion, paw-contact and export checks pass. Actual preview, visual and engine acceptance remain open.

The fox has a narrow muzzle, upright triangular ears, a compact chest, digitigrade hind hocks, small paws and a bushy cream-tipped tail. Its geometry, skeleton and gait are authored for a quadruped. Humanoid defaults, exported output and public interfaces remain unchanged.

## Inputs

Design format 1, family stylized-fox, version 1.1.0 uses existing strict Descriptor parsing and canonical load checks.

| Control | Range | Default | Meaning |
| --- | --- | --- | --- |
| bodyLength | 0.35 to 0.75 m | 0.44 | Shoulder-to-rump torso length |
| heightRatio | 0.60 to 0.80 | 0.80 | Shoulder height / torso length |
| chestRatio | 0.25 to 0.38 | 0.34 | Chest width / shoulder height |
| headRatio | 0.26 to 0.38 | 0.36 | Head length / torso length |
| earRatio | 0.35 to 0.60 | 0.48 | Ear height / head length |
| muzzleRatio | 0.35 to 0.55 | 0.45 | Muzzle length / head length |
| tailRatio | 0.80 to 1.20 | 1.05 | Tail length / torso length |
| tailFullness | 0.10 to 0.18 | 0.16 | Maximum tail radius / torso length |
| color.fur | RGB hex | #b95b32 | Russet coat |
| color.cream | RGB hex | #eadbc4 | Underside, inner ears and tail tip |
| color.dark | RGB hex | #332c2a | Paws, nose and eyes |

Reject invalid, nonfinite and unknown fields. Do not silently clamp unreachable poses or alter body controls.

## Skeleton and surfaces

Use 28 stable bones. The body has motion_root, pelvis, spine, chest, neck and head. Two ears and four tail bones complete the axial rig. Each front limb has scapula, upper limb, lower limb and paw bones. Each hind limb has thigh, shin, elevated hock and paw bones. Front elbows and hind stifles/hocks have distinct rest geometry and bend directions.

Continuous limb profiles carry blended weights around joints. Tail profiles blend across their own four-bone chain. Fur and cream surfaces partition actual triangles at shared boundaries rather than overlap. Reuse three material roles and portable faceted normals. No textures, fur cards or external model dependencies.

Rig kind fox has four explicit paw effectors. Each maps a contact bone to its IK chain and a fixed authored end-target offset. A hind paw target determines an elevated hock target through the authored pastern offset. The existing two-bone solve then controls the stifle and hock chain; paw orientation remains grounded. Humanoid metadata remains byte-for-byte unchanged and retains its two-foot contract.

## Motion and delivery

Idle has breathing and tail motion with four planted paws. Walk has its own four-beat phase offsets, 70% stance duty, explicit contact windows and forward root displacement. Centre stance travel around the body instead of imposing a crouching pelvis drop. Bake bone tracks at 60 Hz, then test actual sole vertices between keys. Generated and reloaded GLB stance height and drift must stay within 0.005 m. Root loops accumulate declared displacement in the preview.

Reuse the dedicated animated exporter with per-corner face normals, real skins, inverse binds and clips. Preserve static exporters and immutable archives. Save/load canonical designs and export/reload clips through a live browser preview and a small CLI. Keep current humanoid commands and defaults compatible.

First-candidate checks cover combined shape limits, meaningful control response, bone order/hierarchy, weights and actual deformation, unreachable IK without partial pose changes, paw contacts between keys, loop continuity, imported clips, faceted normals and exact unchanged humanoid default GLB bytes. Review individual full-size views and motion phases before further decoration. Catalog registration, package delivery and declared engine playback remain separate integration work.

The first visual revision shortens the default torso while retaining shoulder height, defines chest, tucked belly and haunch volumes, seats substantial upper limbs into the coat, thickens ear bases and gives the final third of the tail a broad cream region. Stable radial frames prevent joint-profile twists. Existing eight controls retain their meanings. Changed default proportions require explicit versioned loading of prior designs so their applied dimensions remain deliberate. Paw contacts, weighted deformation and portable faceted playback remain required.

Version 1.0.0 designs load through the existing construction migration path. Prior applied control values become explicit requests, preserving dimensions while recording that revised geometry is not the prior mesh. Migration notices persist through canonical reload and preview export. No immutable package is rewritten.
