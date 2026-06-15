/**
 * Small VPS Configuration for Data Import
 * Optimized for stability and low resource usage on daily imports
 * Speed is sacrificed for reliability
 */

export const SMALL_VPS_CONFIG = {
  // Increased batch sizes for better performance
  BATCH_SIZE: 2500, // Increased from 1000 to 2500 records per batch
  POINTS_BATCH_SIZE: 2500, // Increased from 1000 to 2500 for points processing
  TRANSACTION_TIMEOUT: 15000, // Shorter transactions (15s)
  HTTP_TIMEOUT: 45000, // Longer download timeout

  // Memory management
  MAX_MEMORY_THRESHOLD: 128 * 1024 * 1024, // 128MB threshold for warnings (increased from 64MB)
  FORCE_GC_AFTER_BATCH: true, // Force garbage collection

  // Processing delays for CPU breathing room
  BATCH_DELAY: 100, // 100ms delay between batches (reduced from 500ms)
  TRANSACTION_DELAY: 50, // 50ms delay between transactions (reduced from 200ms)

  // Conservative retry strategy
  MAX_RETRIES: 5, // More retries but with delays
  RETRY_DELAY_BASE: 2000, // 2s base delay, exponential backoff

  // Monitoring and alerting
  LOG_PROGRESS_EVERY: 5, // Log every 5 batches
  MEMORY_CHECK_FREQUENCY: 10, // Check memory every 10 batches
};

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
      console.warn(
        `Memory usage high: ${Math.round(current.heapUsed / 1024 / 1024)}MB`,
      );

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
      delta: Math.round((current.heapUsed - this.startMemory) / 1024 / 1024),
    };
  }
}
