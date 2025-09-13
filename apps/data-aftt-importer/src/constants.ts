import { PlayerCategory } from '@prisma/client';

export const playerCategoryFilenameMapping: { [index: string]: string } = {
  [PlayerCategory.SENIOR_MEN]: 'liste_result_1.txt',
  [PlayerCategory.SENIOR_WOMEN]: 'liste_result_2.txt',
};

// Performance optimization constants
export const PERFORMANCE_CONFIG = {
  // Batch sizes for different operations
  MEMBER_BATCH_SIZE: parseInt(process.env.MEMBER_BATCH_SIZE || '500'),
  MEMBER_POINTS_BATCH_SIZE: parseInt(process.env.MEMBER_POINTS_BATCH_SIZE || '200'),
  RESULTS_BATCH_SIZE: parseInt(process.env.RESULTS_BATCH_SIZE || '200'),
  RESULTS_TRANSACTION_BATCH_SIZE: parseInt(process.env.RESULTS_TRANSACTION_BATCH_SIZE || '150'),
  
  // Concurrency limits
  MAX_CONCURRENT_BATCHES: parseInt(process.env.MAX_CONCURRENT_BATCHES || '3'),
  MAX_DATABASE_CONNECTIONS: parseInt(process.env.MAX_DATABASE_CONNECTIONS || '10'),
  
  // Timeout and retry settings
  DOWNLOAD_TIMEOUT_MS: parseInt(process.env.DOWNLOAD_TIMEOUT_MS || '30000'),
  TRANSACTION_TIMEOUT_MS: parseInt(process.env.TRANSACTION_TIMEOUT_MS || '120000'),
  MAX_DOWNLOAD_RETRIES: parseInt(process.env.MAX_DOWNLOAD_RETRIES || '3'),
  RETRY_DELAY_MS: parseInt(process.env.RETRY_DELAY_MS || '2000'),
  
  // Memory optimization
  ENABLE_STREAMING_PROCESSING: process.env.ENABLE_STREAMING_PROCESSING === 'true',
  MAX_MEMORY_USAGE_MB: parseInt(process.env.MAX_MEMORY_USAGE_MB || '1024'),
  
  // Monitoring
  ENABLE_PERFORMANCE_LOGGING: process.env.ENABLE_PERFORMANCE_LOGGING !== 'false',
  LOG_BATCH_PROGRESS: process.env.LOG_BATCH_PROGRESS !== 'false',
} as const;

// Cache invalidation patterns
export const CACHE_PATTERNS = {
  NUMERIC_RANKING: (categoryId: number) => `numeric-ranking-v4:*:${categoryId}`,
  MEMBER_DATA: (playerCategory: PlayerCategory) => `member-data:${playerCategory}:*`,
  RESULTS_DATA: (playerCategory: PlayerCategory) => `results-data:${playerCategory}:*`,
} as const;
