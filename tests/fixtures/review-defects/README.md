# Original review defect fixtures

These test-only adapters use the current production bench. They never change recipe source.

The baseline and fresh repaired case build the same default bench independently. The broken-support adapter shortens only leg-1-1 while keeping its foot grounded. Opposing surface rays measure the resulting gap to seat-support-1. The ineffective-width adapter receives width 2.2 m but deliberately builds 1.6 m. Its measured seat width must fail the same requested-width check that the real changed-width build passes. Invalid export bytes must fail the actual glTF validator.

Every finding names the case, part or control, measured defect, expected relation and proposed correction. Passing fixture tests mean deliberate failures were detected, not that the defective assets passed review. Valid GLB structure does not prove connected construction.

The capture harness uses the production Stage on an ephemeral local server. Baseline, broken support, repaired, changed width and ignored width use identical bounds, camera, palette and lighting per view. It retains raw exports, designs, measurements, validator output and image hashes. Full source may change during parallel work; before/after source records and relevant construction hashes distinguish diagnostic evidence from final frozen delivery.
