import { validate } from 'class-validator';
import { NotificationType } from '@app/common';
import { SendNotificationDto } from './device-registration.dto';

describe('SendNotificationDto', () => {
  it('rejects oversized notification payloads and token lists', async () => {
    const dto = Object.assign(new SendNotificationDto(), {
      title: 'x'.repeat(201),
      body: 'Body',
      notificationType: NotificationType.CUSTOM,
      data: { value: 'x'.repeat(5000) },
      targetDeviceTokens: Array.from(
        { length: 5001 },
        (_, index) => `token-${index.toString().padStart(20, '0')}`,
      ),
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['title', 'data', 'targetDeviceTokens']),
    );
  });

  it('rejects non-string FCM data values at runtime', async () => {
    const dto = Object.assign(new SendNotificationDto(), {
      title: 'Title',
      body: 'Body',
      notificationType: NotificationType.CUSTOM,
      data: { valid: 'value', invalid: 42 },
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('data');
  });
});
