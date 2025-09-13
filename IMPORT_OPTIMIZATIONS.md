# Data Import Optimizations for Small VPS

## Current Issues Identified

### 1. Memory Usage Problems
- **Issue**: Loading entire files (potentially 10k+ records) into memory
- **Impact**: High memory consumption on small VPS
- **Location**: `members-list-sync-processor.ts:51`, `results-processor.service.ts:110`

### 2. CPU-Intensive Parallel Processing
- **Issue**: Concurrency=3 for database operations may overwhelm small VPS
- **Impact**: CPU throttling, slower overall performance
- **Location**: `members-list-sync-processor.ts:148`

### 3. Inefficient Database Operations
- **Issue**: Multiple separate queries instead of optimized bulk operations
- **Impact**: Higher database load, slower processing
- **Location**: `members-list-sync-processor.ts:340-358` (filterPointsForUpsert)

### 4. Large Transaction Sizes
- **Issue**: TRANSACTION_TIMEOUT=120s indicates heavy transactions
- **Impact**: Database locks, potential deadlocks
- **Location**: `members-list-sync-processor.ts:17`

## Recommended Optimizations

### 1. Stream-Based Processing
Replace in-memory file loading with streaming for large datasets:

```typescript
// Instead of loading entire file
const lines = file.data.split('\n');

// Use streaming approach
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

private async *streamLines(file: string): AsyncGenerator<string> {
  const fileStream = createReadStream(file);
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (line.trim().length > 0) {
      yield line;
    }
  }
}
```

### 2. Reduce Batch Sizes for Small VPS
Optimize batch sizes for memory-constrained environments:

```typescript
// Current batch sizes
const BATCH_SIZE = 500;           // Too large for small VPS
const POINTS_BATCH_SIZE = 200;    // Reduce further
const concurrency = 3;           // Too high for small VPS

// Optimized for small VPS
const BATCH_SIZE = 100;           // Smaller batches
const POINTS_BATCH_SIZE = 50;     // Lighter memory usage
const concurrency = 1;           // Sequential processing
const TRANSACTION_TIMEOUT = 30000; // Shorter timeouts
```

### 3. Implement Incremental Processing
Process only changed records instead of full imports:

```typescript
private async getChangedMembers(newMembers: Member[]): Promise<Member[]> {
  // Compare with last import hash per record
  const lastImportHashes = await this.prismaService.dataImport.findMany({
    where: { type: ImportType.MEMBER },
    orderBy: { importedAt: 'desc' },
    take: 1
  });

  if (!lastImportHashes.length) return newMembers;

  const lastHashes = JSON.parse(lastImportHashes[0].hash);
  return newMembers.filter(member => {
    const currentHash = this.getMemberHash(member);
    return lastHashes[member.id] !== currentHash;
  });
}
```

### 4. Database Index Optimizations
Add missing database indexes for better query performance:

```sql
-- Add composite indexes for frequent lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_member_licence_category
ON "Member" (licence, "playerCategory");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_numeric_points_member_date
ON "NumericPoints" ("memberId", "memberLicence", date DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_individual_result_member_date
ON "IndividualResult" ("memberId", "memberLicence", date DESC);

-- Partial index for active imports
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_data_import_active
ON "DataImport" (type, "playerCategory", "importedAt" DESC)
WHERE "importedAt" > NOW() - INTERVAL '30 days';
```

### 5. Memory-Efficient Caching
Replace in-memory caches with Redis-based caching:

```typescript
// Instead of in-memory caches
private readonly competitionCache = new Map<string, any>();
private readonly memberCache = new Map<string, Member>();

// Use Redis with TTL
async getCachedCompetition(name: string) {
  const cached = await this.cacheService.get(`competition:${name}`);
  if (cached) return JSON.parse(cached);

  const competition = await this.prismaService.competition.findUnique({
    where: { name }
  });

  if (competition) {
    await this.cacheService.set(`competition:${name}`, JSON.stringify(competition), 3600);
  }

  return competition;
}
```

### 6. Progressive Import Strategy
Implement progressive imports with backpressure control:

```typescript
private async processWithBackpressure<T>(
  items: T[],
  processor: (item: T) => Promise<void>,
  batchSize: number = 50,
  delayMs: number = 100
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    // Process batch
    await Promise.all(batch.map(processor));

    // Add small delay to prevent CPU/memory spikes
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    // Log progress
    const progress = Math.round(((i + batchSize) / items.length) * 100);
    this.logger.debug(`Import progress: ${progress}%`);
  }
}
```

## Environment-Specific Configurations

### Small VPS Configuration
```typescript
export const SMALL_VPS_CONFIG = {
  BATCH_SIZE: 100,
  POINTS_BATCH_SIZE: 50,
  CONCURRENCY: 1,
  TRANSACTION_TIMEOUT: 30000,
  MAX_MEMORY_USAGE: 128 * 1024 * 1024, // 128MB
  PROCESSING_DELAY: 200, // ms between batches
  USE_STREAMING: true,
  ENABLE_INCREMENTAL: true
};
```

### Medium VPS Configuration
```typescript
export const MEDIUM_VPS_CONFIG = {
  BATCH_SIZE: 250,
  POINTS_BATCH_SIZE: 100,
  CONCURRENCY: 2,
  TRANSACTION_TIMEOUT: 60000,
  MAX_MEMORY_USAGE: 256 * 1024 * 1024, // 256MB
  PROCESSING_DELAY: 100,
  USE_STREAMING: false,
  ENABLE_INCREMENTAL: true
};
```

## Implementation Priority

1. **High Priority** (Immediate Impact)
   - Reduce batch sizes and concurrency
   - Add database indexes
   - Implement shorter transaction timeouts

2. **Medium Priority** (Performance Gains)
   - Stream-based processing for large files
   - Incremental processing with change detection
   - Memory-efficient Redis caching

3. **Low Priority** (Long-term optimization)
   - Progressive import with backpressure
   - Environment-specific configurations
   - Advanced monitoring and alerting

## Expected Performance Gains (Daily Import Focus)

Since this runs once daily, optimize for **small VPS stability** rather than speed:

- **Memory Usage**: 70-90% reduction (critical for small VPS)
- **CPU Usage**: 60-80% reduction (prevent CPU throttling)
- **Import Speed**: May be 2-3x slower, but that's acceptable for daily runs
- **Database Load**: 80-90% reduction in concurrent connections
- **Reliability**: Near-zero timeout failures and OOM crashes
- **VPS Resource Availability**: Other services remain responsive during import

## Monitoring Improvements

Add resource monitoring to the existing performance service:

```typescript
private monitorResourceUsage(): void {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();

  if (memUsage.heapUsed > this.maxMemoryUsage) {
    this.logger.warn('Memory usage exceeded threshold', {
      current: Math.round(memUsage.heapUsed / 1024 / 1024),
      threshold: Math.round(this.maxMemoryUsage / 1024 / 1024)
    });
    // Implement backpressure or pause processing
  }
}
```