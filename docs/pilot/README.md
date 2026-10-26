# Agent request-to-usable-asset trial

The human points their own agent at this checkout and the [coding-agent brief](../authoring/coding-agent.md), then says “I want X asset.” The agent creates and delivers it. Acceptance follows that request through to a usable asset for the stated target. Human feedback is optional and never a required gate. No tester count, unaided human scene use or outside preset contribution is required.

The original simple planter agent trial passed. This establishes that bounded request only; broad arbitrary assets are not proven. This workflow does not record a new trial or alter prior evidence.

## Reproducible agent task

Record the request, pinned source revision, toolchain, configuration and package checksum when applicable. The agent owns every implementation and verification step:

1. Identify dimensions, silhouette, materials, controls, constraints and requested export target. Record assumptions or a genuinely missing outcome choice.
2. Set up the checkout, scaffold and implement an original recipe, register it through the shared catalog, and preserve unrelated work.
3. Write and run behavior tests, including invalid input and boundaries. Run typecheck, test:recipes and the new recipe’s own test explicitly because suite files are explicit. Retain tracked evidence/revision5/recipes/legacy-baseline.json for test:recipes.
4. Build, validate and export. Review neutral renders, scale, orientation, bounds, materials and visible appearance. Verify import/use in the requested target and save any scene used as evidence.
5. Verify saved-design round trips and package rebuilds when included in delivery. Compare CLI and package output with the same config. CLI without --config or --preset selects the first preset; packages contain defaults.
6. Deliver the usable asset, editable source, usage instructions, provenance, exact commands/results and limitations. Record blockers and repairs, and retain failed outcomes alongside retests.

Use fresh output directories and preserve existing evidence. Source packages require review before execution. Install pinned dependencies with lifecycle scripts disabled. Never execute unreviewed content in a credential-bearing environment. Preserve author declarations, license scope and the documented contribution review process; passing a trial does not grant redistribution or publication permission.

## Decision and reporting

Use result-template.md per request and aggregate-template.json to index results. Mark a request passed only when the recorded evidence supports delivery and use for its stated target. A smoke test alone does not prove visual quality or target use. Agent repairs are part of the workflow; record them rather than requiring unaided human operation.

Optional human feedback may refine the asset or reveal failures. Obtain permission before sharing identities or screenshots publicly and keep private contact details outside the repository. Outside contributions remain optional and require provenance, explicit content-license permission and review through docs/contributing/review.md. Neither feedback nor contributions are acceptance prerequisites. No outreach is sent by these materials.
