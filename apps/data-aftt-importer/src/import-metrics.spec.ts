import { Registry } from 'prom-client';
import { ImportMetrics } from './import-metrics';

describe(ImportMetrics.name, () => {
  it('tracks active and completed imports without double-finishing', async () => {
    const registry = new Registry();
    const metrics = new ImportMetrics(registry);
    const run = metrics.startRun('results', 'SENIOR_MEN');

    expect(await registry.metrics()).toContain(
      'beping_import_active{import_type="results",player_category="SENIOR_MEN"} 1',
    );

    run.finish('success');
    run.finish('failed');

    const output = await registry.metrics();
    expect(output).toContain(
      'beping_import_active{import_type="results",player_category="SENIOR_MEN"} 0',
    );
    expect(output).toContain(
      'beping_import_runs_total{import_type="results",player_category="SENIOR_MEN",outcome="success"} 1',
    );
    expect(output).not.toContain('outcome="failed"');
  });

  it('counts import record outcomes', async () => {
    const registry = new Registry();
    const metrics = new ImportMetrics(registry);
    const run = metrics.startRun('members', 'SENIOR_WOMEN');

    run.record('processed', 500);
    run.record('affected', 12);
    run.record('dropped', 0);
    run.finish('success');

    const output = await registry.metrics();
    expect(output).toContain(
      'beping_import_records_total{import_type="members",player_category="SENIOR_WOMEN",result="processed"} 500',
    );
    expect(output).toContain('result="affected"} 12');
    expect(output).not.toContain('result="dropped"');
  });
});
