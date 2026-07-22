import { getServiceMetrics } from '@app/common';
import { Counter, Gauge, Histogram, type Registry } from 'prom-client';

export type ImportKind = 'members' | 'results';
export type ImportOutcome = 'success' | 'failed' | 'skipped';
export type ImportRecordResult =
  | 'processed'
  | 'inserted'
  | 'updated'
  | 'dropped'
  | 'affected'
  | 'points_stored'
  | 'points_skipped';

export interface ImportRun {
  finish(outcome: ImportOutcome): void;
  record(result: ImportRecordResult, count: number): void;
}

export class ImportMetrics {
  private readonly runs: Counter<'import_type' | 'player_category' | 'outcome'>;
  private readonly records: Counter<
    'import_type' | 'player_category' | 'result'
  >;
  private readonly active: Gauge<'import_type' | 'player_category'>;
  private readonly duration: Histogram<
    'import_type' | 'player_category' | 'outcome'
  >;

  constructor(
    registry: Registry = getServiceMetrics('beping-importer').registry,
  ) {
    this.runs = new Counter({
      name: 'beping_import_runs_total',
      help: 'Total number of completed import runs.',
      labelNames: ['import_type', 'player_category', 'outcome'],
      registers: [registry],
    });
    this.records = new Counter({
      name: 'beping_import_records_total',
      help: 'Total number of records handled by imports.',
      labelNames: ['import_type', 'player_category', 'result'],
      registers: [registry],
    });
    this.active = new Gauge({
      name: 'beping_import_active',
      help: 'Number of imports currently executing.',
      labelNames: ['import_type', 'player_category'],
      registers: [registry],
    });
    this.duration = new Histogram({
      name: 'beping_import_duration_seconds',
      help: 'Import execution duration in seconds.',
      labelNames: ['import_type', 'player_category', 'outcome'],
      buckets: [1, 5, 15, 30, 60, 120, 300, 600, 1200, 3600],
      registers: [registry],
    });
  }

  startRun(importType: ImportKind, playerCategory: string): ImportRun {
    const baseLabels = {
      import_type: importType,
      player_category: playerCategory,
    };
    const stopTimer = this.duration.startTimer(baseLabels);
    let finished = false;
    this.active.inc(baseLabels);

    return {
      finish: (outcome) => {
        if (finished) return;
        finished = true;
        this.active.dec(baseLabels);
        this.runs.inc({ ...baseLabels, outcome });
        stopTimer({ outcome });
      },
      record: (result, count) => {
        if (count <= 0) return;
        this.records.inc({ ...baseLabels, result }, count);
      },
    };
  }
}

export const importMetrics = new ImportMetrics();
