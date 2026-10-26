# Semantic asset contract v1

Canonical builds attach plain JSON at root `userData.openpoly` and expose the same typed semantic field. Inputs are the registered identity, authored root-relative anchors, named meshes/material roles, declared revolute groups and canonical control metadata. Output describes meters, +Y up, +Z front, existing ground-center origin, stable part/material-role IDs, anchors, joints and an explicit part-to-delivery-node/material/group mapping.

Numeric input units differ from display units. A central mapping treats existing `cm` controls as meter inputs, ratio as dimensionless, count/seed as integers and angle controls as degrees. Modules and MCP use the same mapping. Existing control keys, bounds, appearances and geometry remain unchanged.

Wheelbarrow wheel components rotate around the authored X axle center. Chest lid/bands/latch rotate around its authored rear X hinge, preserving the existing negative-X degree convention and 0–110 degree control. Well windlass/crank/flanges rotate around its authored X axle while posts/bearings/rope/bucket stay fixed. Full-turn wheel and windlass poses support -180–180 degrees. These runtime poses are separate from saved procedural parameters and do not simulate rope, physics, clips or IK.

Reject nonfinite anchors/axes/poses, malformed identifiers, duplicate part/group references, missing nodes/material roles and out-of-range joint angles. Static families declare an empty joint list. Grouping is additive; existing mesh names and world geometry remain unchanged. Old saved designs keep their current recipe versions and loaders because default and parameter geometry remains compatible.

Callers: canonical build adapter, procedural packaging, GLB export, MCP descriptions/variant results and the three authored builders. Root metadata survives GLB extras and reimport. Editable groups are authoritative. Delivery mapping prohibits merging moving groups or dropping source part identity; no batching implementation is added.

Before changing construction, retain original geometry/dimension/config hashes for every existing validation case. Tests compare those baselines, canonical/module/export contracts, units, rejected metadata, anchor round trips and articulated groups with fixed centers/supports. Produce individual neutral default and posed renders for wheelbarrow, chest and well; retain raw counts and geometry/metadata hashes. Visual acceptance is recorded separately.
