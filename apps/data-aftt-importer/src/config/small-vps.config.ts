/**
 * Small VPS Configuration for Data Import
 * Optimized for stability and low resource usage on daily imports
 * Speed is sacrificed for reliability
 */

export const SMALL_VPS_CONFIG = {
  // Ultra-conservative batch sizes
  BATCH_SIZE: 25,                    // Very small batches to minimize memory spikes
  POINTS_BATCH_SIZE: 10,             // Even smaller for points processing
  TRANSACTION_BATCH_SIZE: 20,        // Reduce transaction size

  // Sequential processing only
  CONCURRENCY: 1,                    // No parallel processing

  // Generous timeouts but smaller transactions
  TRANSACTION_TIMEOUT: 15000,        // Shorter transactions (15s)
  HTTP_TIMEOUT: 45000,               // Longer download timeout

  // Memory management
  MAX_MEMORY_THRESHOLD: 64 * 1024 * 1024,  // 64MB threshold for warnings
  FORCE_GC_AFTER_BATCH: true,       // Force garbage collection

  // Processing delays for CPU breathing room
  BATCH_DELAY: 500,                  // 500ms delay between batches
  TRANSACTION_DELAY: 200,            // 200ms delay between transactions
  DOWNLOAD_DELAY: 1000,              // 1s delay between downloads

  // Streaming and incremental processing
  USE_STREAMING: true,               // Always use streaming for large files
  ENABLE_INCREMENTAL: true,          // Only process changed records
  STREAM_BUFFER_SIZE: 1024,          // Small stream buffer

  // Conservative retry strategy
  MAX_RETRIES: 5,                    // More retries but with delays
  RETRY_DELAY_BASE: 2000,            // 2s base delay, exponential backoff

  // Database optimizations
  USE_READ_COMMITTED: true,          // Use READ COMMITTED isolation
  ENABLE_QUERY_BATCHING: false,      // Disable complex batching
  SIMPLE_UPSERTS: true,              // Use simple upsert strategies

  // Monitoring and alerting
  LOG_PROGRESS_EVERY: 5,             // Log every 5 batches
  MEMORY_CHECK_FREQUENCY: 10,        // Check memory every 10 batches
  ENABLE_DETAILED_METRICS: true,     // Enable detailed performance tracking
};

export const ULTRA_CONSERVATIVE_CONFIG = {
  ...SMALL_VPS_CONFIG,
  BATCH_SIZE: 10,                    // Even smaller batches
  POINTS_BATCH_SIZE: 5,
  BATCH_DELAY: 1000,                 // 1s delay between batches
  TRANSACTION_DELAY: 500,            // 500ms delay between transactions
  FORCE_GC_AFTER_BATCH: true,
  MEMORY_CHECK_FREQUENCY: 5,         // More frequent memory checks
};

/**
 * Environment detection utility
 */
export function getOptimalConfig(): typeof SMALL_VPS_CONFIG {
  const totalMemory = process.memoryUsage().heapTotal;
  const cpuCount = require('os').cpus().length;

  // If very low memory or single CPU, use ultra-conservative
  if (totalMemory < 512 * 1024 * 1024 || cpuCount <= 1) {
    return ULTRA_CONSERVATIVE_CONFIG;
  }

  // If moderate resources, use small VPS config
  if (totalMemory < 1024 * 1024 * 1024 || cpuCount <= 2) {
    return SMALL_VPS_CONFIG;
  }

  // For better resources, use current configuration
  return {
    BATCH_SIZE: 100,
    POINTS_BATCH_SIZE: 50,
    CONCURRENCY: 2,
    TRANSACTION_TIMEOUT: 60000,
    // ... current settings
  } as any;
}

/**
 * Resource monitoring utilities
 */
export class ResourceMonitor {
  private startMemory: number;
  private peakMemory: number = 0;

  constructor(private config: typeof SMALL_VPS_CONFIG) {
    this.startMemory = process.memoryUsage().heapUsed;
  }

  checkMemory(): boolean {
    const current = process.memoryUsage();
    this.peakMemory = Math.max(this.peakMemory, current.heapUsed);

    if (current.heapUsed > this.config.MAX_MEMORY_THRESHOLD) {
      console.warn(`Memory usage high: ${Math.round(current.heapUsed / 1024 / 1024)}MB`);

      if (this.config.FORCE_GC_AFTER_BATCH && global.gc) {
        global.gc();
        console.log('Forced garbage collection');
      }

      return false; // Indicates high memory usage
    }

    return true;
  }

  getMemoryStats() {
    const current = process.memoryUsage();
    return {
      current: Math.round(current.heapUsed / 1024 / 1024),
      peak: Math.round(this.peakMemory / 1024 / 1024),
      delta: Math.round((current.heapUsed - this.startMemory) / 1024 / 1024)
    };
  }

  async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}