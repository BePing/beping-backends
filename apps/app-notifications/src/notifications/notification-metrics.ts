import { getServiceMetrics } from '@app/common';
import { Counter, Histogram, type Registry } from 'prom-client';

export type NotificationDispatchOutcome = 'success' | 'failed' | 'skipped';
export type NotificationDeliveryStatus = 'sent' | 'failed';

export class NotificationMetrics {
  private readonly dispatches: Counter<'notification_type' | 'outcome'>;
  private readonly deliveries: Counter<'notification_type' | 'status'>;
  private readonly duration: Histogram<'notification_type' | 'outcome'>;

  constructor(
    registry: Registry = getServiceMetrics('beping-notifications').registry,
  ) {
    this.dispatches = new Counter({
      name: 'beping_notification_dispatches_total',
      help: 'Total number of notification dispatch attempts.',
      labelNames: ['notification_type', 'outcome'],
      registers: [registry],
    });
    this.deliveries = new Counter({
      name: 'beping_notification_deliveries_total',
      help: 'Total number of per-device notification delivery results.',
      labelNames: ['notification_type', 'status'],
      registers: [registry],
    });
    this.duration = new Histogram({
      name: 'beping_notification_dispatch_duration_seconds',
      help: 'Notification dispatch duration in seconds.',
      labelNames: ['notification_type', 'outcome'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
      registers: [registry],
    });
  }

  startDispatch(
    notificationType: string,
  ): (outcome: NotificationDispatchOutcome) => void {
    const stopTimer = this.duration.startTimer({
      notification_type: notificationType,
    });
    let finished = false;

    return (outcome) => {
      if (finished) return;
      finished = true;
      this.dispatches.inc({ notification_type: notificationType, outcome });
      stopTimer({ outcome });
    };
  }

  recordDeliveries(
    notificationType: string,
    status: NotificationDeliveryStatus,
    count: number,
  ): void {
    if (count <= 0) return;
    this.deliveries.inc({ notification_type: notificationType, status }, count);
  }
}

export const notificationMetrics = new NotificationMetrics();
