#!/bin/sh
set -e

echo "Starting tabt-rest application..."

# Wait for database to be ready
echo "Waiting for database to be ready..."
MAX_RETRIES=60
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  # Try to execute a simple query using Prisma
  if node -e "
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      prisma.\$queryRaw\`SELECT 1 as test\`
        .then(() => {
          process.exit(0);
        })
        .catch((err) => {
          process.exit(1);
        })
        .finally(() => {
          prisma.\$disconnect().catch(() => {});
        });
    } catch (err) {
      process.exit(1);
    }
  " >/dev/null 2>&1; then
    echo "Database is ready!"
    break
  else
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
      echo "ERROR: Database connection failed after $MAX_RETRIES attempts (2 minutes). Exiting."
      echo "Please check your DATABASE_URL environment variable and ensure the database is accessible."
      exit 1
    fi
    echo "Database is not ready yet. Waiting... (attempt $RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
  fi
done

echo "Database is ready. Running Prisma migrations..."

# Run Prisma migrations
npx prisma migrate deploy --schema /usr/src/app/prisma/schema.prisma

echo "Migrations completed successfully. Starting the application..."

# Start the application
exec node dist/apps/tabt-rest/main
