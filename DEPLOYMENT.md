# Deployment

BePing production uses pre-built, immutable container images from the shared
Escape Key registry. Hetzner servers are managed by Terraform, applications by
Coolify, administrative access by Tailscale, and availability checks by Uptime
Kuma.

## Runtime topology

| Resource      | Image or control plane                                   |                    Public | Deployment model                                        |
| ------------- | -------------------------------------------------------- | ------------------------: | ------------------------------------------------------- |
| API           | `registry.escapekey.app/escape-key/beping-api`           |        `api-v2.beping.be` | Individual Coolify Docker Image application             |
| Notifications | `registry.escapekey.app/escape-key/beping-notifications` | `notifications.beping.be` | Individual Coolify Docker Image application             |
| Importer      | `registry.escapekey.app/escape-key/beping-importer`      |                        No | Individual Coolify worker application                   |
| Migrations    | `registry.escapekey.app/escape-key/beping-migrate`       |                        No | Run once from the protected deployment workflow         |
| PostgreSQL    | Coolify database resource                                |                        No | Persistent; never replaced with an app deployment       |
| Redis         | Coolify database/service resource                        |                        No | Persistent; shared by cache, BullMQ and Nest transports |

Do not deploy the public applications as a Docker Compose stack. Coolify cannot
perform rolling updates for Compose applications. The root
`docker-compose-prd.yml` is a transitional recovery/rehearsal stack, not the
target production control plane.

## Image lifecycle

`.github/workflows/containers.yml` builds all four images from every relevant
commit on `main` and pushes:

- an immutable tag equal to the full git SHA;
- a mutable `main` convenience tag that must never be configured in production.

Release Please adds semantic version tags for released applications. Production
always deploys the full SHA so API, worker and migration provenance can be
reconstructed exactly.

Required GitHub repository configuration:

| Kind     | Name                        |
| -------- | --------------------------- |
| Variable | `HETZNER_REGISTRY_HOST`     |
| Secret   | `HETZNER_REGISTRY_USERNAME` |
| Secret   | `HETZNER_REGISTRY_PASSWORD` |

## Zero-downtime deployment

Production promotion is manual through `.github/workflows/deploy-production.yml`
and the protected `production` GitHub environment.

1. Validate that the requested full SHA exists for all four images.
2. Run `beping-migrate:<sha>` against PostgreSQL over private connectivity.
3. Update the API image tag through the Coolify API.
4. Wait for the new API container to pass readiness before Coolify removes the
   previous container.
5. Repeat for notifications, then restart the importer on the same SHA.
6. Verify the public readiness endpoints.

All migrations must use the expand/contract pattern. A release may add nullable
columns, tables or indexes while old containers are still serving traffic. A
later release may remove the old shape only after every previous application
revision is retired.

Required production environment configuration:

| Kind     | Name                                          |
| -------- | --------------------------------------------- |
| Variable | `COOLIFY_URL`                                 |
| Variable | `COOLIFY_BEPING_API_UUID`                     |
| Variable | `COOLIFY_BEPING_NOTIFICATIONS_UUID`           |
| Variable | `COOLIFY_BEPING_IMPORTER_UUID`                |
| Secret   | `COOLIFY_TOKEN` (read, write and deploy only) |
| Secret   | `BEPING_DATABASE_URL`                         |
| Secret   | `BEPING_DIRECT_URL`                           |

The deployment job uses the shared runner label `escape-key-ci`. The runner and
database communicate only over Tailscale or another explicitly private link.
PostgreSQL must not listen on a public interface.

## Health checks and shutdown

| Application   | Liveness          | Readiness          | Dependency diagnostics |
| ------------- | ----------------- | ------------------ | ---------------------- |
| API           | `/v1/health/live` | `/v1/health/ready` | `/v1/health`           |
| Notifications | `/health/live`    | `/health/ready`    | `/health`              |

Liveness checks only the process. Readiness checks PostgreSQL. The diagnostic
endpoint may call external AFTT/VTTL services and must not control rolling
traffic. Both HTTP applications enable Nest shutdown hooks and receive a
graceful stop window from Coolify.

Do not configure host port mappings such as `3050:3050`; they prevent the old
and new containers from coexisting during a rolling update.

## Database and Redis

Prisma pool limits are configured per process:

| Application   | Initial `DB_POOL_MAX` |
| ------------- | --------------------: |
| API           |                     5 |
| Notifications |                     2 |
| Importer      |                     2 |

Adjust these only after checking PostgreSQL connection use and query latency.
Redis authentication is mandatory in production. `REDIS_URL` is preferred;
host/port/username/password variables remain supported.

The migration `20260720190000_add_read_path_indexes` creates indexes
concurrently for the API's licence/date lookups. Run it before comparing query
plans.

`DIRECT_URL` is used by Prisma CLI and production migrations. A separate
`SHADOW_DATABASE_URL` is optional and only valid for local `prisma migrate dev`;
it must never reference production.

See `deploy/postgres/performance-baseline.sql` for the read-only baseline. Keep
`pg_stat_statements` enabled and compare normal traffic with an importer window.

## Importer resource protection

Members and results jobs are serialized. The results file is split into small,
independent PostgreSQL staging chunks instead of one large temporary workload.
Between result batches, the worker checks API readiness and pauses whenever the
API is unavailable or slower than its latency budget. Start with:

- at most 0.35 CPU and 384 MB memory, with CPU shares below the API;
- `RESULTS_BATCH_SIZE=500` and `RESULTS_STAGE_CHUNK_SIZE=2000`;
- `IMPORT_BATCH_COOLDOWN_MS=750` and `DB_POOL_MAX=1`;
- `IMPORT_API_MAX_LATENCY_MS=600` and `IMPORT_PRESSURE_PAUSE_MS=5000`;
- five-minute PostgreSQL statement timeout and two-second lock timeout;
- startup synchronization disabled.

This deliberately makes the nightly import longer. API availability takes
priority over importer completion time. If the API remains under pressure for
ten minutes, the current attempt fails and BullMQ retries it later.

During an active incident, run the manual `Control production importer`
workflow with `pause`. This stops only the importer through Coolify. Once API
readiness and PostgreSQL pressure are normal, use the same workflow with
`resume`; do not restart PostgreSQL as the first response.

The 2026-07-21 production recovery import used batches of 100 and spent about
15 of every 17 seconds per 2,000-row stage in configured cooldowns. The next
cycle therefore starts with batches of 500, still using one database connection
and the readiness guard. Revert to 100 first if API latency exceeds the 600 ms
budget.

Tune batches from observed API p95 and PostgreSQL I/O, not only from total import
duration. If imports still cause sustained I/O saturation after query/index and
cache work, move PostgreSQL to a dedicated data node rather than increasing
worker concurrency.

## Backup and rollback

Before a schema or data-bearing deployment:

1. Confirm a recent PostgreSQL backup exists in the dedicated application
   backup storage.
2. Restore it into an isolated database and validate representative row counts.
3. Record the currently deployed image tags.
4. Deploy the reviewed SHA.

The Coolify helper restores an application's previous tag when its replacement
does not become healthy. Database migrations are not automatically reversed;
they must remain compatible with the previous application image.

## Local development

```bash
pnpm install
pnpm exec prisma generate
pnpm run start:dev:tabt-rest
```

The development stack remains available with `docker compose up --build`. Never
reuse development passwords or database contents in production.
