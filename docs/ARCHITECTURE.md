# Cosmedia Architecture

## Decision summary

Cosmedia starts as a modular monolith. A single deployable API owns transactional
business operations, while modules keep their own boundaries. This keeps the first
release simple without coupling mobile screens directly to database details.

```text
Expo mobile app
       |
       | HTTPS / REST / JSON
       v
NestJS API (versioned modular monolith)
       |
       +---- PostgreSQL (source of truth)
       +---- Object storage (product images, later)
       +---- Redis / BullMQ (async jobs, later)

Scraper worker (separate process, later)
       |
       +---- Redis queue
       +---- moderation records in PostgreSQL
```

## Module boundaries

- `health`: runtime and database readiness.
- `products`: public product catalogue and active formula reads.
- `admin`: protected catalogue writes, evidence citations/moderation, formula versioning and product lifecycle.
- `identity`: OIDC token validation, external subject mapping and current-user data.
- `profiles`: authenticated skin profile and ingredient preferences.
- `ingredients`: canonical name normalization and reviewed alias resolution.
- `favorites`: authenticated, paginated product-variant bookmarks.
- `matching`: profile-aware variant filtering and reviewed evidence explanations.
- `scoring`: immutable rule-set versions and idempotent profile/formula score snapshots.
- `reviews`: private profile snapshots, revision-checked moderation, abuse reports and aggregate experience metrics.
- Future `moderation`: approval workflow for imported and scraped data.

Controllers handle HTTP concerns, services contain use-case logic, and Prisma is
isolated behind the database module. Modules may not import another module's
internal files; shared behavior must be exposed by the owning module.

## Data decisions

- PostgreSQL is the system of record because products, variants, formula versions,
  ingredients, evidence, profiles and reviews are relational.
- A product has variants; a variant has versioned formulas. Formula history is not
  overwritten when a brand changes its INCI list.
- Each formula entry retains the raw ingredient name even when normalization fails.
- Ingredients have a conservative unique normalization key. Reviewed aliases resolve
  source names and profile preferences to one canonical ingredient without rewriting
  the raw formula entry.
- Alias uniqueness is checked against both canonical names and other aliases at the
  application boundary. Removing an alias does not remove its canonical ingredient or
  existing formula links.
- Ingredient evidence has an explicit direction. The default `INFORMATIONAL` value
  cannot generate a profile signal; only reviewed, directed evidence participates
  in matching.
- Evidence citations remain embedded in each record (source name, HTTP(S) URL and
  optional publication date). The API stores citations without fetching them.
- Evidence starts pending. Full replacement clears approval; approve/revoke uses
  an atomic revision comparison, returning 409 for stale moderation or edits.
  This uses the existing admin key boundary; individual reviewer identity and a
  full evidence edit audit log await managed admin roles.
- Reviews store a profile snapshot so historical aggregates do not change when a
  user edits their current profile. Snapshots contain only skin type, concerns and
  schema version. Editing review text/rating preserves the original snapshot and
  returns publication to pending. One review per user/variant is enforced in SQL.
- Review moderation and editing compare an integer revision atomically. Public
  review responses omit author identifiers and profile snapshots, and declare plain
  text for clients to render without HTML interpretation.
- Experience ratings are aggregated in PostgreSQL, separately from ingredient
  scores. Similarity means the same recorded skin type and any shared concern; with
  no reader concerns, only skin type is required. A matching user's own review is
  included. For similar cohorts below three reviews, mean and distribution are
  withheld; the count remains available. This is not a statistical confidence claim.
- Reports are unique per reporter/review/revision. Resolving a report does not change
  review visibility, and repeat reports do not reopen a resolved report. Admins see
  both the reported revision and the current review; historic review text is not
  retained. Deleting reviews or accounts cascades to their reports.
- Favorites reference product variants, are unique per user/variant pair and are
  removed through database cascades with either owning record.
- Scores are snapshots tied to a formula and scoring version. Explanations and
  confidence are stored with the number shown to a user.
- Score rule conditions use a validated, allow-listed JSON DSL; stored JSON is never
  evaluated as executable code. A version is immutable after creation and activation
  switches all rules atomically.
- The profile key is a one-way SHA-256 hash of normalized scoring inputs rather than a
  user identifier. Equal formula/profile/rule/evidence inputs reuse one snapshot.
- Snapshot uniqueness includes a SHA-256 evidence key computed from the exact
  relevant approved citations read for scoring, in deterministic order. Moderation
  changes affect subsequent reads without overwriting historical explanations.
  Pre-migration snapshots keep a `legacy` key and are not reused for new reads.
- Score confidence describes input completeness only. The score is a profile/formula
  match index and explicitly does not claim medical safety or efficacy.
- Scraped data never becomes public automatically. It enters a review workflow.
- Demo seed data is idempotent and clearly separated from verified production data.

## API rules

- Public endpoints are under `/api/v1`.
- Swagger/OpenAPI is served at `/docs` outside production until access controls are
  introduced.
- Request DTOs are allow-listed; unknown properties are rejected.
- Pagination is mandatory for collections and capped at 100 records per request.
- Errors use a stable envelope with application code, safe message, HTTP status,
  optional details, path, timestamp and request ID. Internal errors are not exposed.

## Security baseline

- Helmet security headers, explicit CORS origins and API throttling are enabled.
- Secrets belong in environment variables and are never committed.
- Authentication uses provider-neutral OIDC access tokens. The API verifies the
  signature through an administrator-configured JWKS URL and validates issuer,
  audience, expiry and an explicit asymmetric algorithm allow-list.
- The API stores only the verified external subject and application profile data.
  Email is synchronized only when the identity provider marks it verified.
- Production refuses to start without the complete OIDC configuration and requires
  HTTPS for the configured JWKS endpoint. Remote keys are cached and rotated by the
  JOSE verifier; token-provided key URLs are never trusted.
- Until managed roles are introduced, admin catalogue routes require a long
  environment-provided API key. This is a development boundary, not the final
  production authorization design.
- URLs and scraped payloads must be validated before the worker fetches or stores
  them. Private-network destinations must be rejected to prevent SSRF.
- User-generated reviews use JSON plain-text responses, explicit moderation and
  authenticated abuse reports. UI clients must render title/body as text, never HTML.
- Profile matching treats explicit `avoidInci` entries as hard user preferences.
  Reviewed aliases canonicalize those preferences. Free-text allergies are not
  inferred as INCI names without an explicit user choice.
- Matching never infers concentration from INCI order and returns evidence sources,
  matched profile fields and a non-medical-advice disclaimer with every page.
- Scoring clamps results to `0–100`, deduplicates evidence by ingredient/effect and
  carries the rule contribution and source evidence in its persisted explanation.
- CSV catalogue imports are limited to 1 MB/1,000 rows, fully validated before
  writes, and applied in one transaction. Re-imports update stable product and
  variant keys without duplicating unchanged formula versions.

## Deployment units

The API and future scraper worker use separate commands and can scale separately.
PostgreSQL and object storage should be managed services in production. Redis is
not required for the current catalogue API; it is included locally to establish the
future job boundary.

## Verification strategy

- Unit tests validate isolated guards, ingredient/alias normalization, score-rule
  validation/calculation, profile normalization, catalogue services, CSV parsing and
  the shared HTTP error contract.
- E2E tests boot the NestJS application with the same production bootstrap
  configuration and send real HTTP requests through Supertest.
- E2E tests use PostgreSQL, apply committed migrations, verify catalogue import
  idempotency, alias resolution/removal and authenticated user/profile/favorite/matching/
  scoring flows, then remove only namespaced fixture records afterward.
- Evidence E2E tests cover protected routes, citation validation, approval reset,
  concurrent/stale revisions and moderation effects on scores and matches, including
  historical snapshot preservation.
- Review E2E tests cover ownership, validation, concurrent submissions/edits,
  publication filtering, immutable snapshots, similar-profile cohorts, pagination,
  idempotent reports, report resolution and cascade deletion.
- GitHub Actions provisions a clean PostgreSQL 17 service for every pull request
  and `main` push before running unit tests, E2E tests and the production build.

## Mobile catalog client

`apps/mobile` is an Expo SDK 57 / React Native 0.86 application using Expo Router.
The root npm workspace and lockfile own installation. Expo's standard Metro config
handles the monorepo without custom resolver aliases.

- Screens: public catalog/search, product detail with variant and formula selection,
  published reviews and rating distribution, explanatory guide and not-found page.
- `EXPO_PUBLIC_API_URL` points to the versioned API root. The client never embeds
  admin credentials or database configuration; production requires an explicit URL.
- Zod validates the fields used by the UI. Unknown API fields are discarded. Errors
  use localized safe messages and retain request IDs without exposing server bodies.
- Each request has a timeout and an abort signal. Resource keys isolate products,
  searches, pages and variants so late responses cannot replace newer screen data.
- The catalog uses bounded server pagination and debounced search. Review statistics
  and review text load independently, so one endpoint failure does not hide the other.
- Review title/body and ingredient text are rendered with React Native Text, never
  injected as HTML. Remote image/source links accept HTTP(S) only.
- No authentication or profile data is stored yet. Login/onboarding, favorites,
  personalized scores and writing/reporting reviews remain a subsequent mobile phase.
- CI checks types, client transport contracts and Android/iOS/web exports. Export
  validates bundles, not a signed native binary or physical-device behavior.

Mobile dependency verification (2026-09-30): Expo Doctor passes all 21 checks.
Root overrides align React and native peers with the SDK template to prevent
Prisma Studio's React peer resolution from producing duplicate native dependencies.
The existing fast-uri and Swagger js-yaml pins were advanced to patched releases.
`npm audit` still reports 13 moderate dependency-chain findings (zero high/critical):
Expo Router's CommonJS query-string decoder uses decode-uri-component, and Expo's
Xcode tooling uses uuid 7. The fixed decoder is ESM-only, so an unverified major
module-format override was not introduced. Track upstream compatible fixes before
public release; the UUID finding concerns v3/v5/v6 buffer calls, whereas xcode's
observed use is v4 ID generation. Native binary/device validation remains pending.
