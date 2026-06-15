#!/bin/sh
set -e

echo "Starting tabt-rest..."

# Wait for database
MAX_RETRIES=60
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if node -e "const{PrismaClient}=require('@prisma/client');new PrismaClient().\$queryRaw\`SELECT 1\`.then(()=>process.exit(0)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
    break
  fi
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "ERROR: Database unreachable after $MAX_RETRIES attempts"
    exit 1
  fi
  sleep 2
done

# Run migrations via local prisma (no npx download)
./node_modules/.bin/prisma migrate deploy --schema /usr/src/app/prisma/schema.prisma

exec node dist/apps/tabt-rest/main
