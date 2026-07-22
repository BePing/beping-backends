import { Registry } from 'prom-client';
import { NotificationMetrics } from './notification-metrics';

describe(NotificationMetrics.name, () => {
  it('records each dispatch outcome once', async () => {
    const registry = new Registry();
    const metrics = new NotificationMetrics(registry);
    const finish = metrics.startDispatch('MATCH');

    finish('success');
    finish('failed');

    const output = await registry.metrics();
    expect(output).toContain(
      'beping_notification_dispatches_total{notification_type="MATCH",outcome="success"} 1',
    );
    expect(output).not.toContain('outcome="failed"');
    expect(output).toContain(
      'beping_notification_dispatch_duration_seconds_count{notification_type="MATCH",outcome="success"} 1',
    );
  });

  it('records sent and failed per-device deliveries', async () => {
    const registry = new Registry();
    const metrics = new NotificationMetrics(registry);

    metrics.recordDeliveries('RANKING', 'sent', 12);
    metrics.recordDeliveries('RANKING', 'failed', 2);
    metrics.recordDeliveries('RANKING', 'failed', 0);

    const output = await registry.metrics();
    expect(output).toContain(
      'beping_notification_deliveries_total{notification_type="RANKING",status="sent"} 12',
    );
    expect(output).toContain(
      'beping_notification_deliveries_total{notification_type="RANKING",status="failed"} 2',
    );
  });
});
