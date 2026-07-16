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
- `admin`: protected catalogue writes, formula versioning and product lifecycle.
- Future `identity`: external authentication identities and account lifecycle.
- Future `profiles`: skin profile and preference management.
- Future `reviews`: profile snapshots, moderation and aggregate experience metrics.
- Future `scoring`: versioned, explainable formula/profile score calculation.
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
- Reviews store a profile snapshot so historical aggregates do not change when a
  user edits their current profile.
- Scores are snapshots tied to a formula and scoring version. Explanations and
  confidence are stored with the number shown to a user.
- Scraped data never becomes public automatically. It enters a review workflow.
- Demo seed data is idempotent and clearly separated from verified production data.

## API rules

- Public endpoints are under `/api/v1`.
- Swagger/OpenAPI is served at `/docs` outside production until access controls are
  introduced.
- Request DTOs are allow-listed; unknown properties are rejected.
- Pagination is mandatory for collections and capped at 100 records per request.
- Error payloads use NestJS HTTP errors initially; a stable application error
  envelope will be added before the mobile client is released.

## Security baseline

- Helmet security headers, explicit CORS origins and API throttling are enabled.
- Secrets belong in environment variables and are never committed.
- Authentication will use a managed identity provider; the API will store only its
  external subject identifier and application profile data.
- Until managed roles are introduced, admin catalogue routes require a long
  environment-provided API key. This is a development boundary, not the final
  production authorization design.
- URLs and scraped payloads must be validated before the worker fetches or stores
  them. Private-network destinations must be rejected to prevent SSRF.
- User-generated reviews require output encoding, moderation and abuse reporting.

## Deployment units

The API and future scraper worker use separate commands and can scale separately.
PostgreSQL and object storage should be managed services in production. Redis is
not required for the current catalogue API; it is included locally to establish the
future job boundary.
