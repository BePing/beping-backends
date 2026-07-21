import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';

function readPositiveInteger(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL,
        max: readPositiveInteger('DB_POOL_MAX', 5),
        connectionTimeoutMillis: readPositiveInteger(
          'DB_CONNECT_TIMEOUT_MS',
          5_000,
        ),
        idleTimeoutMillis: readPositiveInteger('DB_IDLE_TIMEOUT_MS', 30_000),
        maxLifetimeSeconds: readPositiveInteger('DB_MAX_LIFETIME_SECONDS', 300),
      }),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
