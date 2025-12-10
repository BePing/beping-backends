#!/bin/sh
set -e

echo "Starting data-aftt-importer application..."

# Wait for database to be ready
echo "Waiting for database to be ready..."
until echo "SELECT 1;" | npx prisma db execute --stdin --schema /usr/src/app/prisma/schema.prisma >/dev/null 2>&1; do
  echo "Database is not ready yet. Waiting..."
  sleep 2
done

echo "Database is ready. Running Prisma migrations..."

# Run Prisma migrations
npx prisma migrate deploy --schema /usr/src/app/prisma/schema.prisma

echo "Migrations completed successfully. Starting the application..."

# Start the application
exec node dist/apps/data-aftt-importer/main

