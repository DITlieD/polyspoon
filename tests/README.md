# Test entrypoints

Run npm test for the current non-browser regression suite. It uses the explicit file list in scripts/test-current.ts, including production catalog/CLI/export, current geometry and appearance contracts, placement/framing, recipe registration/source packages, and frozen original-export parity. It does not launch browsers or use historical capture directories.

npm run test:recipes runs the recipe-only non-browser subset. Package, render and check commands keep their existing npm names.

Run protocol and CLI/MCP appearance integration with a fresh evidence directory:

```sh
TEST_EVIDENCE_ROOT=evidence/revision5/integration-new npm run test:integration
```

Run current website navigation, kit membership, source ZIP download and contribution-page checks against an isolated local review server:

```sh
RECIPE_SITE_URL=http://127.0.0.1:4175 TEST_EVIDENCE_ROOT=evidence/revision5/browser-new npm run test:browser
```

Replace those fresh directory names for each run. Both commands refuse an existing directory, require an output under evidence/revision5, and record the exact source hashes before and after execution. Browser runs require a local URL; set CHROME_PATH if Chrome is installed elsewhere. Source download checks need generated public/recipe-packages/index.json and matching ZIPs. Browser screenshots and downloaded files stay under the configured run directory.

The default suite intentionally has no wildcard. Previous revision tests remain in place. Some assert historical versions, defaults or mesh layouts; others write fixed historical capture paths or require a separately built production directory. They are not silently migrated or executed by npm test. Their previous failures remain recorded; this routing does not claim those failures were fixed. Before promoting an older test into the current list, verify its target version and configure non-overwriting evidence output. Do not lower its geometry thresholds to make it pass.

Directly affected catalog and MCP coverage now checks every registered family rather than assuming exactly six. The six original families are still explicitly required. Their existing material-role assertions and geometry/export checks remain intact. New families obtain controls/presets/material roles from their own descriptor and production build. MCP output containment, collision, symlink, invalid-input and byte-parity checks are retained.

Production npm run build runs typecheck, regenerates the registered default source packages from local installed dependencies, then bundles the site. It performs no installation or registry fetch. npm run dev does not regenerate packages; run npm run recipe:package explicitly after source edits when reviewing downloads in development.

Review records, bounded terminal evidence, original defect fixtures and source delivery revision checks are included in both current unit and recipe lists. Bounded review fixtures do not claim full recipe verification or publication eligibility.

The source delivery replay check installs dependencies from the network in its extracted archive. Run it explicitly with a fresh output directory. It is excluded from npm test:

```sh
SOURCE_DELIVERY_REPLAY_ROOT=evidence/revision14/packages/replay-new node --import tsx --test tests/recipe-package-delivery-portability.test.ts
```

The standalone source delivery browser check starts its own isolated server on port 4175. Keep that port free. Set the candidate to an existing directory containing a revision 2 cottage index and its archive, and use a fresh evidence directory:

```sh
SOURCE_DELIVERY_SITE_EVIDENCE_ROOT=evidence/revision14/packages/site-new SOURCE_DELIVERY_CANDIDATE=evidence/revision14/packages/candidate node --import tsx --test tests/source-delivery-site.test.ts
```
