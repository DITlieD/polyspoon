# Community (F8): profiles, follows, votes, points and leaderboards

Polyspoon is a members-only community for editable, recipe-based 3D models. This layer rewards people for making more and better models without weakening review.

## Hard rules

1. Every model still needs independent human review. Community code never changes `asset_version` state, review records, approvals or publication.
2. Votes, points, levels and badges never grant, imply or bypass any capability (`admin`, `moderator`, `verifier`, `reviewer:*`, `publisher`). `server/community.ts` and `server/reputation.ts` never write `capability`, `asset_version`, `review_record` or `technical_attestation`; `tests/community.test.ts` enforces this.
3. Models, profiles, follower counts, feeds and leaderboards stay behind login. Suspended or unverified members disappear from profiles, counts and rankings.
4. Moderator appointment stays a manual admin action. Admins see a `moderatorEligible` hint on profiles; nobody else sees it and it unlocks nothing.

## Data model (`migrations/0011_community.sql`)

| Table | Purpose |
|---|---|
| `creator_profile` | Handle (unique, 3–24 of `a-z 0-9 _ -`, reserved words blocked), display name ≤ 60, bio ≤ 500, avatar hue 0–359 (avatar = initials on that colour, no uploads), up to 3 `https://` links. Created lazily from the account name. |
| `creator_follow` | One row per follow, `CHECK(follower_id<>creator_id)`. |
| `vote` (existing, 0002) | One vote per member per model (`PRIMARY KEY(user_id,asset_id)`). New trigger `vote_no_self` rejects votes on any asset the voter contributed to. |
| `favorite` | Private bookmarks; not used in scoring. |
| `model_comment`, `comment_report` | Comments on published versions, author delete, member reports (one per reporter), moderator hide/restore with reason. |
| `version_lineage` | A contributor declares which published asset their version remixes. Credit only flows once the remix itself passed review and was published. |
| `download_credit` | First non-image download of a published model per member; trigger blocks self-credit. |
| `notification_cursor` | Read marker for the notifications list. |

Points are derived from these tables, never written by hand. For speed, `server/score-cache.ts` materialises the result into `creator_score` (migration `0013_creator_score.sql`): database triggers bump `score_state.generation` whenever an input changes (votes, download credit, lineage, version state, report outcomes, member status or age, email verification), and reads rebuild the cache when it is stale or older than 5 minutes (time windows and decay move on their own). The rebuild runs the exact same formula; `tests/score-cache.test.ts` checks cached scores and leaderboards equal a from-scratch recompute.

## Scoring formula (`server/reputation.ts`)

```
points(creator) = 50 × first published version of each model
                + 10 × each later published version
                +  4 × w(voter) per vote received        (max 5 counted votes per voter→creator pair)
                + 20 × each published remix by someone else
                +  1 × unique member download            (capped at 100 per model)
                − 10 × each rejected submission
                − 40 × each model withdrawn after a report
```

- `w(voter) = clamp(0.5 + sqrt(baseReputation)/20, 0.5, 2.0)`, halved if the account is younger than 30 days, and 0 if younger than 3 days. `baseReputation` excludes votes received, so vote rings cannot amplify each other.
- Reputation decays with a 180-day half-life (used for vote weight); all-time, monthly and weekly totals are undecayed sums. Displayed totals are floored at 0.
- Levels: Newcomer 0, Maker 50, Craftsperson 200, Artisan 600, Master 1500, Legend 4000.
- Badges: First model, Prolific (10), Crowd favourite (50 votes), Remixed, Remixer, Followed (25 followers), `<Category> specialist` (5 in a category).
- Moderator hint (admins only): reputation ≥ 600, ≥ 5 published, no reported withdrawals, rejections ≤ 20% of published, account ≥ 90 days.

## Anti-gaming

- One vote per member per model (primary key); set/remove are idempotent.
- No self-votes: `403 self_vote_forbidden` in `castVote` and the `vote_no_self` trigger. No self-follow, self-report or self download credit.
- Accounts younger than 3 days cannot vote (`account_too_new_to_vote`) and younger than 1 day cannot comment.
- Rate limits: 60 vote changes/hour (from the audit log, so remove/re-add cycles count), 100 follows/hour, 10 comments/hour, 20 reports/day.
- Only active, email-verified members' votes, follows and downloads count anywhere.
- Agent tokens can read (`catalog:read`) and vote (`votes:write`) but cannot edit profiles, follow, favourite or comment.
- Top rated sort uses counted votes only; it changes ordering, never visibility.

## API

| Method & path | Auth |
|---|---|
| `GET/PUT /api/community/me` | member / interactive member |
| `GET /api/community/profiles/:handle` | member (`catalog:read`); admins also get `moderatorEligible` |
| `PUT/DELETE /api/community/profiles/:handle/follow` | interactive member |
| `GET /api/community/feed?offset=` | member |
| `GET /api/community/leaderboard?period=week\|month\|all&category=` | member |
| `GET /api/community/versions/:id` | member: creator, counts, own vote/favourite/follow, comments, lineage |
| `PUT/DELETE /api/community/versions/:id/vote`, `PUT/DELETE /api/catalog/:asset/vote` | `votes:write`, same `castVote` path |
| `GET /api/community/favorites`, `PUT/DELETE /api/community/favorites/:asset` | member / interactive |
| `POST /api/community/versions/:id/comments`, `DELETE /api/community/comments/:id`, `POST …/report`, `PUT …/moderation` | interactive; moderation needs moderator/admin |
| `PUT /api/community/versions/:id/lineage` | own version, `submissions:write` |
| `GET /api/community/notifications`, `POST …/read` | member |
| `GET /api/catalog?sort=top` | member |

## Privacy

- Community responses never include email addresses.
- Who voted for what is never exposed; only counts and the member's own vote.
- Profiles exist only for signed-in members; links are rendered `rel="nofollow noopener noreferrer"`.

## Member app

`/catalog?view=profile[&handle=]` (view, edit for self, badges, level, published models), `?view=following`, `?view=leaderboard`, creator line + follow + favourite on model pages, Sort by → Top rated in the catalog filters.


## Cosmetic unlocks (`server/cosmetics.ts`, migration `0012_cosmetics_collections.sql`)

Purely decorative. Cosmetics are never read by review, publication, moderation, capability, vote-weight or scoring code (`tests/cosmetics-collections.test.ts` enforces this). Two `creator_profile` columns, `accent` and `flair`, store the choice.

| Level | Accent colours unlocked | Avatar frame unlocked |
|---|---|---|
| 1 Newcomer | Polyspoon blue, Slate | No frame |
| 2 Maker | Moss, Clay | Maker ring |
| 3 Craftsperson | Plum, Ocean | Craftsperson double ring |
| 4 Artisan | Amber, Rose | Artisan laurel |
| 5 Master | Aurora gradient | Master glow + animated level pill |
| 6 Legend | Prism gradient | Legend crown + animated level pill |

- `PUT /api/community/me` accepts `accent` and `flair`. The server computes the member's current level and rejects unknown ids (`400 invalid_accent|invalid_flair`) or ones above their level (`403 accent_locked|flair_locked`).
- If a member later drops below the level a stored choice needs (for example after a penalty), profiles show the default instead. The stored value is kept, so it comes back when they level up again.
- Only the profile owner gets the full unlock table (`cosmetics`) in the profile response. The animation respects `prefers-reduced-motion`.

## Open decisions for the owner

- Point values and level thresholds are a first pass.
- The cosmetic unlock table above is a first pass.
- Collections are curated by moderators and admins only (see [collections](collections.md)); favourites stay private.
