// Try to load dotenv if available (for local development)
// In Docker containers, environment variables are usually set directly
try {
  require('dotenv/config');
} catch {
  // dotenv not available, use environment variables directly
}

import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // CLI operations and production migrations must bypass a pooler when a
    // direct URL is available. A shadow database is only used by migrate dev
    // and must never point at the production database.
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || '',
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
