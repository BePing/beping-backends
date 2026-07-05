# Deployment

How the BePing backends are built, released, and deployed.

## Architecture

The repo is a NestJS monorepo producing three runtime services plus a run-once
migration image, all published to GitHub Container Registry (ghcr.io).

| Service | Image | Port | Notes |
|---|---|---|---|
| `tabt-rest` | `ghcr.io/beping/tabt-rest/tabt-rest` | HTTP `PORT` (default 3050) | Public REST API |
| `app-notifications` | `ghcr.io/beping/tabt-rest/app-notifications` | HTTP 3000 | Push notifications; see `apps/app-notifications/CONFIG.md` |
| `data-aftt-importer` | `ghcr.io/beping/tabt-rest/data-aftt-importer` | none | Redis microservice (no HTTP) |
| `migrate` | `ghcr.io/beping/tabt-rest/migrate` | none | Run-once Prisma `migrate deploy` (init step) |

Supporting infrastructure (see `docker-compose-prd.yml`): PostgreSQL 16, Redis 7,
and a Tor/Privoxy SOCKS proxy.

### Why a separate migrate image

The app images do **not** contain the Prisma CLI — that keeps them ~250 MB
smaller (~440 MB each). Migrations run once, before the apps start, from the
dedicated `migrate` image (`Dockerfile.migrate`). In compose this is wired with
`depends_on: { migrate: { condition: service_completed_successfully } }`; on
Kubernetes use it as an init container / pre-deploy Job.

## Prerequisites

- A reachable PostgreSQL database (`DATABASE_URL`, `DIRECT_URL`).
- A Redis instance.
- `ghcr.io` pull access to the `beping/tabt-rest/*` packages.

## Environment variables

Copy `.env.example` and fill it in. Key variables:

| Variable | Used by | Purpose |
|---|---|---|
| `DATABASE_URL` | all + migrate | Pooled Postgres connection string |
| `DIRECT_URL` | all + migrate | Direct (non-pooled) connection, used by migrations |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | apps | Cache + microservice transport |
| `PORT` | tabt-rest | HTTP port (default 3050) |
| `API_PREFIX` / `STATIC_PREFIX` / `CURRENT_SEASON` | tabt-rest | API config |
| `AFTT_WSDL` / `VTLL_WSDL` | tabt-rest | SOAP endpoints |
| `USE_SOCKS_PROXY` / `SOCKS_PROXY_HOST` / `SOCKS_PROXY_PORT` | tabt-rest | Optional Tor proxy |
| `AFTT_DATA_*` / `*_BATCH_SIZE` / `IMPORT_BATCH_COOLDOWN_MS` | data-importer | Import source + tuning |
| `BEPING_NOTIFICATION_*` | tabt-rest | Notification service credentials |

`app-notifications` has its own Firebase / OpenAI / Gemini configuration —
see `apps/app-notifications/CONFIG.md`.

## Release & image publishing

Releases are driven by [release-please](https://github.com/googleapis/release-please)
on the `main` branch (`.github/workflows/release-please.yml`).

1. Merge work to `main` using [Conventional Commits](https://www.conventionalcommits.org/)
   (`feat:`, `fix:`, …). Versions are tracked per app in
   `.release-please-manifest.json`.
2. release-please opens/updates a **release PR** bumping the affected app(s) and
   their `CHANGELOG.md`.
3. Merging the release PR creates GitHub releases/tags and triggers the
   `build-and-push` jobs, which build and push to ghcr:
   - each released app → semver tags (`1.2.3`, `1.2`, `1`) + `latest`
   - the shared `migrate` image → `latest` and `:<git-sha>`

CI (`.github/workflows/ci.yml`) runs lint, tests, and no-push Docker builds on
every PR/push.

## Deploying

Production runs the pinned images via `docker-compose-prd.yml` (Coolify-managed).

1. Set the image tags in `docker-compose-prd.yml` to the released versions
   (the `migrate` service tracks `:latest`).
2. Provide the environment (Coolify project env, or a `.env` next to the compose
   file).
3. Deploy:
   ```sh
   docker compose -f docker-compose-prd.yml up -d
   ```
   The `migrate` service runs first and must exit successfully before the apps
   start; the apps then come up automatically.

> The `migrate:latest` image must exist in ghcr (i.e. at least one release has
> run) before deploying with this compose file.

### Manual migration (if needed)

```sh
docker run --rm \
  -e DATABASE_URL="$DATABASE_URL" -e DIRECT_URL="$DIRECT_URL" \
  ghcr.io/beping/tabt-rest/migrate:latest
```

## Local development

```sh
pnpm install                      # pnpm 10 (see packageManager); Node 22.12.x
pnpm exec prisma generate         # generate the Prisma client
pnpm run start:dev:tabt-rest      # or :app-notifications / :data-aftt-importer
```

Full stack with Docker (builds images, runs Postgres/Redis/Tor + migrate init):

```sh
docker compose up --build
```

### Building images manually

```sh
docker build -f apps/tabt-rest/Dockerfile -t tabt-rest:local .
docker build -f Dockerfile.migrate       -t migrate:local .
```

## Notes

- **Node 22.12.x** (LTS) is pinned (`engines`). pnpm is pinned to **10.x** to
  match the repo `packageManager`.
- The Prisma client is generated into `libs/common/src/generated` (gitignored)
  and re-exported via `@app/common`; it is bundled into each app's `dist`.
- Runtime DB readiness is checked with `pg` in each app's `start.sh`; schema
  changes are applied only by the `migrate` image.
