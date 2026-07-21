# Coolify production resource specification

Create these resources in the `BePing / production` environment on the adopted
BePing server. Record the resulting non-secret UUIDs in the Escape Key
infrastructure inventory and as GitHub repository variables.

## Persistent resources

### PostgreSQL

- Use a native Coolify PostgreSQL resource on persistent storage.
- Keep every published port private. If the deployment runner needs direct
  migration access, bind PostgreSQL only to the server's Tailscale address and
  allow it only from the Escape Key platform node.
- Configure scheduled S3 backups with credentials dedicated to application
  backups.
- Enable `pg_stat_statements` during a reviewed maintenance window.
- Validate an isolated restore before the first restructured deployment.

### Redis

- Use persistent AOF storage because BullMQ queues share this instance.
- Require authentication and provide applications either `REDIS_URL` or the
  `REDIS_HOST`, `REDIS_PORT`, `REDIS_USERNAME`, `REDIS_PASSWORD` tuple.
- Do not publish Redis outside Coolify/private networking.

## Docker Image applications

All application image tags must be full 40-character git SHAs.

| Setting       | API                     | Notifications                     | Importer                     |
| ------------- | ----------------------- | --------------------------------- | ---------------------------- |
| Image         | `escape-key/beping-api` | `escape-key/beping-notifications` | `escape-key/beping-importer` |
| Port          | 3050                    | 3000                              | none                         |
| Domain        | `api-v2.beping.be`      | `notifications.beping.be`         | none                         |
| Health path   | `/v1/health/live`       | `/health/live`                    | Docker process healthcheck   |
| Memory limit  | 768 MB                  | 384 MB                            | 768 MB                       |
| CPU limit     | 1.0                     | 0.35                              | 0.35                         |
| Graceful stop | 30 seconds              | 30 seconds                        | 60 seconds                   |

For API and notifications:

- enable health checks;
- enable rolling updates;
- leave container names at their defaults;
- configure only `Ports Exposes`, never a host port mapping;
- use registry pull credentials scoped to the Escape Key namespace.

For the importer, disable auto-deploy. Production promotion updates it only
after the schema and public applications are healthy.

The importer deliberately trades duration for API availability:

- set its CPU shares below the API and cap it at `0.35` CPU;
- use a 768 MB container limit and a 640 MB Node heap; the 1.1-million-row
  results download exceeded the original 384 MB estimate before batching;
- use `DB_POOL_MAX=1`, `RESULTS_BATCH_SIZE=500` and
  `RESULTS_STAGE_CHUNK_SIZE=2000`;
- set `IMPORT_BATCH_COOLDOWN_MS=750`;
- set `IMPORT_API_READINESS_URL=https://api-v2.beping.be/v1/health/ready`;
- set `IMPORT_TIME_ZONE=Europe/Brussels`, `MEMBERS_IMPORT_CRON=0 15 1 * * *`
  and `RESULTS_IMPORT_CRON=0 0 2 * * *` so imports run once per night instead
  of once per hour;
- use a 600 ms readiness latency ceiling and a five-second pressure pause;
- give it a positive OOM score so it is stopped before the API under memory
  pressure.

The production recovery import on 2026-07-21 showed that batches of 100 spent
about 15 of every 17 seconds in the 750 ms cooldown. Batches of 500 preserve
the single database connection and API readiness gate while reducing the
fixed cooldown overhead from 20 checks to four per 2,000-row stage. Keep the
smaller value available as the first rollback if API latency exceeds its
budget during the next observed cycle.

If readiness fails repeatedly, the importer aborts the current BullMQ attempt.
Its upserts are idempotent, so the retry can safely resume by reprocessing the
same source file.

## Completed cutover

The native PostgreSQL and authenticated Redis resources, plus the three
individual applications, are the only BePing production topology. The previous
Compose service, its containers, network and volumes were deleted on
2026-07-21 after fresh PostgreSQL and Redis backups passed isolated restore
checks. Do not recreate that stack as a rollback mechanism; restore the native
resources from their verified backups and redeploy an immutable application SHA
instead.

## Deployment runner connectivity

The protected production workflow runs on the Escape Key platform runner. Set
`BEPING_DOCKER_HOST=ssh://root@100.79.25.78` as a repository variable and keep
`BEPING_DATABASE_URL` plus `BEPING_DIRECT_URL` as repository or Production
environment secrets.

The migration container runs on the BePing Docker daemon through Tailscale SSH
and joins the private `coolify` network. PostgreSQL must not be published merely
to make migrations reachable from the central runner.
