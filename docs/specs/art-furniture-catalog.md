# Furniture construction candidate

Inputs remain the existing bench, planter and fence controls and valid ranges. Catalog builds, saved configurations, material roles and anchors keep their current contracts. No new controls or version changes are included in this candidate.

Bench: retain outside seat width/depth, requested seat top, slat count, 12 mm gaps and optional two-board back. Shape the four legs from narrower grounded feet into supported seat frames. Ease board edges with small bevels. Incline the back gently rearward, with posts and both boards sharing the same rake and physical overlap. Back top remains seat height plus back height. Existing part IDs remain.

Planter: keep declared outside dimensions, 6 mm course gaps, empty opening and optional 100 mm feet. Fit four new rim members within the outside envelope. Size their height from available course height so the shortest five-course box retains every course. Taper the body slightly inward toward its base. Join wall ends into corner posts. Extend the floor beneath the walls. Feet meet the floor and post structure. Existing part IDs remain; rim-front, rim-rear, rim-left and rim-right are added.

Fence: retain existing massing and post-center start/end anchors. Change geometry only if boundary checks reveal an unsupported connection or edge defect.

Verification uses the production catalog build path. Surface rays must establish seat/support, back/post, rim/wall, floor/wall, post/foot and fence rail/post/infill/brace contact. Deliberately detached parts must fail the same contact assertions. Exercise presets and combined minimum/maximum dimensions, topology toggles and colors. Reject invalid controls and fence bay spans through the existing parser. Check finite valid geometry, ground contact and empty gaps. No historical geometry hashes are refreshed. Visual review and versioned delivery follow separately.
