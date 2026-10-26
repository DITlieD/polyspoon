# Curated collections (F9)

Hand-picked sets of reviewed models (for example "Starter props" or "Best foxes"), put together by moderators and admins.

## Rules

- Discovery only. Collections never change review, publication, capabilities, votes or points, and adding a model to a collection is not an endorsement that skips anything. `tests/cosmetics-collections.test.ts` fails if collection code writes `capability`, `asset_version`, review tables or votes.
- Login-gated like the rest of the catalog: reads need a signed-in member (`catalog:read`).
- Only currently published models are listed. If a model is withdrawn it drops out of every collection automatically, because reads join `catalog_discovery`.
- Only interactive sessions of active, verified members with the `moderator` or `admin` capability can create, edit, delete or change items. Agent tokens can never curate.

## Data model (`migrations/0012_cosmetics_collections.sql`)

| Table | Columns |
|---|---|
| `collection` | `id`, `slug` (unique, 3–40 of `a-z 0-9 -`), `title` ≤ 80, `description` ≤ 500, `created_by`, `created_at`, `updated_at` |
| `collection_item` | `collection_id`, `asset_id`, `position`, `added_by`, `added_at`; primary key `(collection_id, asset_id)`; up to 200 items |

Every write is recorded in `audit_event` (`collection_created|updated|deleted`, `collection_item_added|removed`).

## API

| Method & path | Auth |
|---|---|
| `GET /api/collections` | member; returns `canCurate` |
| `GET /api/collections/:slug` | member; published models in curator order |
| `POST /api/collections` `{slug,title,description}` | moderator/admin session |
| `PUT /api/collections/:slug` `{title,description}` | moderator/admin session |
| `DELETE /api/collections/:slug` | moderator/admin session |
| `PUT/DELETE /api/collections/:slug/items/:assetId` | moderator/admin session; the asset must be published |

## Member app

`/catalog?view=collections` lists collections and shows a create form to curators. `/catalog?view=collection&slug=…` shows the models; curators also get remove buttons, an add-by-asset-id field and title/description editing.

## Open decisions

- Should collections also be curated by high-reputation members? This is not built, and it would need a separate decision because it touches moderator-like rights.
- Should there be an "Add to collection" button on model pages, in addition to adding by asset id?
