// Try to load dotenv if available (for local development)
// In Docker containers, environment variables are usually set directly
try {
  require('dotenv/config');
} catch {
  // dotenv not available, use environment variables directly
}

import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL || '',
    shadowDatabaseUrl: process.env.DIRECT_URL,
  },
});
