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
| Memory limit  | 768 MB                  | 384 MB                            | 384 MB                       |
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
- use `DB_POOL_MAX=1`, `RESULTS_BATCH_SIZE=100` and
  `RESULTS_STAGE_CHUNK_SIZE=2000`;
- set `IMPORT_BATCH_COOLDOWN_MS=750`;
- set `IMPORT_API_READINESS_URL=https://api-v2.beping.be/v1/health/ready`;
- use a 600 ms readiness latency ceiling and a five-second pressure pause;
- give it a positive OOM score so it is stopped before the API under memory
  pressure.

If readiness fails repeatedly, the importer aborts the current BullMQ attempt.
Its upserts are idempotent, so the retry can safely resume by reprocessing the
same source file.

## Initial cutover

1. Leave the existing stack serving production.
2. Create the new resources with temporary domains.
3. Restore a production backup into an isolated database and run the target
   migration image.
4. Validate API, notifications and one controlled importer cycle.
5. Point the production domains to the individual Coolify applications.
6. Observe at least one importer cycle before removing the old application
   containers.
7. Keep the old database volume until the restore and rollback window closes.

Do not delete or reuse the old volumes as part of the cutover operation.
