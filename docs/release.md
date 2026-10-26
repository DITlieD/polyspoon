# Product release preparation

The release exporter copies an explicit list of product files into a fresh `.release/` directory. It creates independent Git metadata with no enclosing history, commits or remotes. It does not create a GitHub repository, push, publish a site or configure a domain.

Use Node.js 22.22.1 and Git. From the product checkout:

```sh
node scripts/product-release.mjs prepare --out .release/polyspoon
node scripts/product-release.mjs verify .release/polyspoon
```

The destination must not exist. `scripts/product-release-files.json` lists every permitted input. The generated `.release-manifest.json` records exact file hashes and the aggregate content identity. Export fails on symlinks, unsafe paths, changed inputs or matching privacy and credential patterns, including stored ZIP members. Pattern checks do not establish that every possible secret format has been detected; review the exact inventory before uploading.

The export excludes private research, machine-specific examples, credentials, local authentication databases, historical captures and enclosing repository metadata. Licenses, notices, original product sources and current indexed downloads remain included. Existing immutable archives, procedural modules and the agent toolkit retain their original bytes and identities.

## Clean build

Inside the standalone directory:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm --prefix server ci --ignore-scripts --no-audit --no-fund
npm run typecheck
node --import tsx --test tests/product-release.test.ts tests/agent-install.test.ts tests/individual-discovery.test.ts
node_modules/.bin/vite build
node --import tsx hosted/build.ts --out hosted/build
node scripts/product-release.mjs verify .
```

The local Vite build is a procedural studio with model bytes available locally. Do not publish it as the authenticated hosted service. The hosted builder produces separate public and protected application outputs. Production deployment must register the private release and preserve the authenticated file gateway; serving its private application directory anonymously is not equivalent.

The commands above reuse the indexed delivery artifacts. `npm run build`, `npm run recipe:package` and procedural-module generation are maintainer operations that can reject immutable artifact conflicts. They are not a repair step for a clean release build. A changed generator requires its own versioned delivery review.

The agent-bundle authoring sources are included. `scripts/agent-bundle.ts` rebuilds an inspectable candidate from those sources and the exact indexed bench toolkit; the checked-in immutable bundle is not overwritten by the release preparation commands.

## Capability limits

The local toolkit supports registered procedural models, saved designs, rendering and export. The separate hosted service implements authenticated discovery, private submission, review, moderation and verified downloads. A local operator fixture does not establish real publication or production deployment.

The fourteen-recipe local catalog includes skinned humanoid and fox models. Their edited GLBs retain skeletons and idle/walk clips. The protected editor uses a static preview and explicit download links. Local integration checks do not establish production deployment.

Historical capture diagnostics can require a local browser, Unity, processor isolation support or separate retained review inputs. The clean release checks above do not claim those environments or historical captures were reproduced. Required product regression checks remain distinct from optional historical diagnostics.

## Preflight deploy

One command builds, deploys and checks the hosted service on `https://preflight.polyspoon.com`:

```sh
npm run deploy:preflight              # full deploy
npm run deploy:preflight -- --dry-run # build and prepare only, no remote writes
```

It runs on the operator machine with a valid `wrangler login` and the private inputs in `$POLYSPOON_DEPLOY_DIR/` (`bindings.json` with mode 0600, and `storage-service-key`). Secrets are read from files or stdin and are never printed. The steps are:

1. Build a fresh hosted release into `.release/hosted-<stamp>` (`hosted/build.ts`).
2. Prepare `$POLYSPOON_DEPLOY_DIR/candidate-<stamp>/wrangler.production.json` from that release, with the route and `APP_ORIGIN` set to `preflight.polyspoon.com`. `PUBLIC_FILES` is always derived from the release's `public-files.json` (`scripts/public-allowlist.ts`). Preparation fails with `public_allowlist_missing:<paths>` if any script, stylesheet, icon or image referenced by `public/index.html`, or any `url()` in its stylesheets, is not on the allowlist. `server/deployment.ts` applies the same check.
3. If the private app release is not yet registered in D1, upload it to Supabase with read-back (`scripts/upload-private-release.ts`) and register it.
4. Record the currently deployed Worker version.
5. `wrangler deploy` with the new config.
6. Smoke test: `/` and `/docs` return 200, every public asset referenced by the HTML and CSS returns 200, and `/api/catalog` returns 401 without a session. It retries for about a minute while the deploy propagates. If any check still fails, it runs `wrangler rollback` to the recorded version and exits non-zero.

Never reuse an older candidate config with a new release: hashed asset names change on every build, and a stale `PUBLIC_FILES` serves the page without its styles. Always generate a new candidate with this command. The allowlist checks are covered by `tests/deploy-allowlist.test.ts`.
