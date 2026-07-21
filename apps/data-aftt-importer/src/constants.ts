import { PlayerCategory } from '@app/common';

function readInteger(
  name: string,
  fallback: number,
  minimum: number = 1,
): number {
  const parsed = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(parsed) && parsed >= minimum ? parsed : fallback;
}

export const playerCategoryFilenameMapping: { [index: string]: string } = {
  [PlayerCategory.SENIOR_MEN]: 'liste_result_1.txt',
  [PlayerCategory.SENIOR_WOMEN]: 'liste_result_2.txt',
};

// Performance optimization constants
export const PERFORMANCE_CONFIG = {
  // Batch sizes for different operations
  MEMBER_BATCH_SIZE: readInteger('MEMBER_BATCH_SIZE', 500),
  MEMBER_POINTS_BATCH_SIZE: readInteger('MEMBER_POINTS_BATCH_SIZE', 500),
  RESULTS_BATCH_SIZE: readInteger('RESULTS_BATCH_SIZE', 500),
  RESULTS_STAGE_CHUNK_SIZE: readInteger('RESULTS_STAGE_CHUNK_SIZE', 2500),
  RESULTS_TRANSACTION_BATCH_SIZE: readInteger(
    'RESULTS_TRANSACTION_BATCH_SIZE',
    500,
  ),
  IMPORT_BATCH_COOLDOWN_MS: readInteger('IMPORT_BATCH_COOLDOWN_MS', 1000, 0),

  // Concurrency limits
  MAX_CONCURRENT_BATCHES: readInteger('MAX_CONCURRENT_BATCHES', 5),
  MAX_DATABASE_CONNECTIONS: readInteger('MAX_DATABASE_CONNECTIONS', 15),

  // Timeout and retry settings
  DOWNLOAD_TIMEOUT_MS: readInteger('DOWNLOAD_TIMEOUT_MS', 30000),
  TRANSACTION_TIMEOUT_MS: readInteger('TRANSACTION_TIMEOUT_MS', 120000),
  MAX_DOWNLOAD_RETRIES: readInteger('MAX_DOWNLOAD_RETRIES', 5),
  RETRY_DELAY_MS: readInteger('RETRY_DELAY_MS', 2000),

  // Memory optimization
  ENABLE_STREAMING_PROCESSING:
    process.env.ENABLE_STREAMING_PROCESSING === 'true',
  MAX_MEMORY_USAGE_MB: readInteger('MAX_MEMORY_USAGE_MB', 1024),

  // Monitoring
  ENABLE_PERFORMANCE_LOGGING:
    process.env.ENABLE_PERFORMANCE_LOGGING !== 'false',
  LOG_BATCH_PROGRESS: process.env.LOG_BATCH_PROGRESS !== 'false',
} as const;

// Cache invalidation patterns
export const CACHE_PATTERNS = {
  NUMERIC_RANKING: (categoryId: number) => `numeric-ranking-v4:*:${categoryId}`,
  MEMBER_DATA: (playerCategory: PlayerCategory) =>
    `member-data:${playerCategory}:*`,
  RESULTS_DATA: (playerCategory: PlayerCategory) =>
    `results-data:${playerCategory}:*`,
} as const;
