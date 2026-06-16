#!/bin/sh
set -e

echo "Starting tabt-rest..."

# Wait for database
MAX_RETRIES=60
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if node -e "const{Client}=require('pg');const c=new Client({connectionString:process.env.DATABASE_URL});c.connect().then(()=>c.query('SELECT 1')).then(()=>c.end()).then(()=>process.exit(0)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
    break
  fi
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "ERROR: Database unreachable after $MAX_RETRIES attempts"
    exit 1
  fi
  sleep 2
done

# Migrations run in a separate init step (see Dockerfile.migrate), not here.

exec node dist/apps/tabt-rest/main
