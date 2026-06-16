import { Injectable, Logger } from '@nestjs/common';
import { PlayerCategory } from '@app/common';

export interface ImportMetrics {
  playerCategory: PlayerCategory;
  importType: 'MEMBER' | 'RESULT';
  startTime: number;
  endTime?: number;
  downloadTime: number;
  processingTime: number;
  totalRecords: number;
  validRecords: number;
  recordsPerSecond: number;
  memoryUsage: number;
  errorCount: number;
  batchCount: number;
}

@Injectable()
export class PerformanceMonitorService {
  private readonly logger = new Logger(PerformanceMonitorService.name);
  private metrics: Map<string, ImportMetrics> = new Map();

  startImport(
    playerCategory: PlayerCategory,
    importType: 'MEMBER' | 'RESULT',
  ): string {
    const sessionId = `${importType}_${playerCategory}_${Date.now()}`;
    const metrics: ImportMetrics = {
      playerCategory,
      importType,
      startTime: Date.now(),
      downloadTime: 0,
      processingTime: 0,
      totalRecords: 0,
      validRecords: 0,
      recordsPerSecond: 0,
      memoryUsage: 0,
      errorCount: 0,
      batchCount: 0,
    };

    this.metrics.set(sessionId, metrics);
    this.logger.log(`Started monitoring import session: ${sessionId}`);
    return sessionId;
  }

  updateMetrics(sessionId: string, updates: Partial<ImportMetrics>): void {
    const metrics = this.metrics.get(sessionId);
    if (metrics) {
      Object.assign(metrics, updates);
    }
  }

  finishImport(sessionId: string): ImportMetrics | null {
    const metrics = this.metrics.get(sessionId);
    if (!metrics) return null;

    metrics.endTime = Date.now();
    const totalTime = metrics.endTime - metrics.startTime;
    metrics.recordsPerSecond = Math.round(
      metrics.totalRecords / (totalTime / 1000),
    );

    this.logger.log(`Import session ${sessionId} completed:`, {
      playerCategory: metrics.playerCategory,
      importType: metrics.importType,
      totalTime: `${totalTime}ms`,
      downloadTime: `${metrics.downloadTime}ms`,
      processingTime: `${metrics.processingTime}ms`,
      totalRecords: metrics.totalRecords,
      validRecords: metrics.validRecords,
      recordsPerSecond: metrics.recordsPerSecond,
      memoryUsage: `${Math.round(metrics.memoryUsage / 1024 / 1024)}MB`,
      errorCount: metrics.errorCount,
      batchCount: metrics.batchCount,
    });

    // Clean up after logging
    this.metrics.delete(sessionId);
    return metrics;
  }

  getMetrics(sessionId: string): ImportMetrics | null {
    return this.metrics.get(sessionId) || null;
  }

  getAllActiveMetrics(): ImportMetrics[] {
    return Array.from(this.metrics.values());
  }
}
