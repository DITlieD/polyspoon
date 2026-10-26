# Generator source packages

The current builder emits `public/recipe-packages/<recipe-id>-<recipe-version>-source.2.zip`. Delivery revision 2 changes the source runner without changing recipe versions or geometry.
Catalog index: `public/recipe-packages/index.json`. Format 2 entries declare `deliveryRevision: 2` and the exact relative `url`, `recipe-packages/<recipe-id>-<recipe-version>-source.2.zip`. Resolve the indexed URL against the site's configured base URL. Label this download **Generator source**. The separate Snapshot `.mjs` download embeds a static GLB; the Procedural module `.mjs` download builds from parameters.

Each ZIP contains editable TypeScript source, controls.json, config.json, manifest.json, a pinned npm lockfile, an explicit build/export command, license notices, and rebuild instructions. Only statically reached sources from approved directories are copied. Shared catalog dependencies may include other registered generators. Research, evidence, credentials and Unity fixture/template assets are excluded.

Packages contain the default design, not current browser edits. Save the current design separately and pass that JSON to rebuild. All registered recipes receive packages, including the bench example.

Current manifests declare `formatVersion: 2` and `deliveryRevision: 2`. Other fields are recipe (id, version, entry, exportName), configuration (path, kind), controls, dependencies, toolchain, licenses, provenance, and files (path, SHA-256, bytes). Current index entries contain id, version, deliveryRevision, url, sha256, bytes, configuration and scoped licenses.

Legacy format 1 implicitly means delivery revision 1 and retains `<recipe-id>-<recipe-version>.zip`. Validation accepts only the frozen legacy build/runner contract for that format. Format 2 requires explicit delivery revision 2 and the revised runner. Unsupported formats/revisions and modified runners are rejected. Browser selection accepts only the exact supported indexed path for the recipe/version/revision. Existing indexes may remain format 1 until a new delivery is generated.

Recipe uses the shared descriptor/build/load/validationCases/integrationCases/constraints/presentation/source contract. The portable runner uses catalog loadDesign, designInput and buildAsset so saved palettes, shading and per-part colors follow the production path. The revision 2 runner copies only the migration notice validated by loadDesign into the exported configuration. Fresh/default/reset inputs remain free of a notice, and forged notices are rejected. The legacy runner does not retain the validated migration notice in its rebuilt configuration. Its immutable archives remain unchanged.

Validation checks manifest, paths, imports and hashes without running recipe code. Integrity is not a signature, code review or sandbox. Review executable source and choose an isolated environment before installing dependencies or invoking rebuild.

Packaging prepares the requested artifacts and checks all existing output paths and bytes before writing. Changed bytes at an existing revision-qualified filename fail without replacing archives or the index. Identical artifacts are idempotent. New archives use exclusive creation, and the index publishes by atomic rename from an exclusively created sibling file after artifact writes succeed. Older archive files are retained. Concurrent publishers are not coordinated by this local builder. The optional programmatic family selection requires an explicit candidate output and rejects the default public package directory.

## Contributor declaration

Add a record under the recipe ID in docs/contributing/source-packages.json. No packaging code edit is required for a new ID. The top level is {formatVersion: 1, recipes: {...}}. Each recipe declaration has these fields:

- author: contributor's chosen public attribution
- statement: original-source/provenance declaration, including external exclusions
- softwareLicense: Apache-2.0
- contentLicense: Apache-2.0 or CC0-1.0
- contentDesignation: exact supplied default/preset content covered

Missing declarations or unsupported licenses fail packaging. Original starters have explicit CC0 declarations. Outside authors choose supported content terms explicitly; no blanket CC0 inference is made. The manifest records author-declaration and reviewStatus not-established-by-packaging. A declaration is not maintainer approval.

Build commands are npm run recipe:package -- [--out DIRECTORY] and npm run recipe:check -- ZIP [--extract NEW_DIRECTORY]. Validation/extraction supports this tool's bounded stored-entry ZIP format, not arbitrary third-party archive formats. It rejects malformed archives before extraction. The default CLI reads the contributor declarations above and follows the complete statically reachable registered source closure.

Portable builds install Three.js 0.186.1, TypeScript 7.0.2 and the applicable native TypeScript package. They compile through the pinned compiler, not a removed TypeScript 5 JavaScript API. Repository-side import validation uses the installed Rolldown parser supplied by the pinned Vite toolchain. It does not execute submitted source during inspection.
