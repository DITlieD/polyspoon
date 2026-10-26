# Start a procedural recipe

Run from the repository root after npm ci:

```sh
node examples/recipes/starter/scaffold.mjs garden-seat "Garden seat"
```

This creates examples/recipes/garden-seat/index.ts with a unique family identity, version, named export and portable source entry. It refuses to overwrite an existing file. The initial geometry is an editable copy of the original bench example, not a new visual design.

Edit that file. Replace the geometry and title/description, retain named mesh parts and materialRole user data, and update controls, defaults, presets, bounds, anchors and validation cases together. Use meters, +Y up, +Z forward and ground-center origin. build returns fresh disposable Three.js objects; load rejects unsupported versions and altered applied values. Use explicit migration functions when changing a released format.

Register it by adding this import in src/recipes/index.ts:

```ts
import { gardenSeatRecipe } from '../../examples/recipes/garden-seat/index.ts';
```

Append gardenSeatRecipe to the existing registration list in that file. No catalog, CLI, MCP or viewer dispatch edits are needed.

Run:

```sh
npm run typecheck
npm run validate -- --family garden-seat --out evidence/garden-seat
npm run export -- --family garden-seat --out evidence/garden-seat.glb
node --import tsx scripts/recipe-render.ts --family garden-seat --out evidence/garden-seat-review
npm run dev
```

The render command creates seven neutral canvas views, obliques for every preset, matching thumbnail PNGs and a manifest with exact configuration, source and image hashes. It requires installed Chrome (CHROME_PATH overrides /usr/bin/google-chrome), creates its own local server, and refuses an existing output directory. Optional --preset ID or --config saved.design.json chooses the seven-view subject. It never changes historical render outputs.

Open /asset/garden-seat on the local development server. Check every control, presets, invalid inputs, save/load and GLB download. Add tests for your actual construction, parameter extremes and likely combinations. Test a saved version before changing its loader. Use tests/recipe-contract.test.ts and tests/recipe-registration.test.ts as shared-path examples; add family-specific tests without changing their acceptance limits.

presentation.kitIds starts empty. Keep it empty unless kit membership is reviewed. To add an image, place a PNG under src/site/previews and map its preset ID to that filename in presentation.thumbnails. A missing thumbnail gives a labelled editor-preview placeholder. Do not claim visual approval from metadata or automated format checks.

Source packages contain executable code. Review code and dependencies before running a contributed generator in a suitable isolated environment. Keep runtime recipe imports browser-compatible. The scaffold itself is local Node tooling and is never imported by the viewer. Generator distribution and license/provenance instructions are in the contributor guide.

Before packaging, add your recipe ID and explicit author/license declaration to docs/contributing/source-packages.json using the shape in docs/authoring/source-package-contract.md. Then run npm run recipe:package and npm run recipe:check -- public/recipe-packages/garden-seat-1.0.0.zip --extract NEW_DIRECTORY. In the extracted directory, run npm ci --ignore-scripts --no-audit --no-fund and npm run rebuild -- --config config.json --out default.glb. A missing declaration is rejected. The scaffold remains derived bench source until you design and review its replacement geometry; registration and packaging do not establish independent authorship or approval.
