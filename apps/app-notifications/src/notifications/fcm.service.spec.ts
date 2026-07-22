import { NotificationType, PrismaService } from '@app/common';
import { FcmService } from './fcm.service';

describe('FcmService topic lookup', () => {
  it('deduplicates devices subscribed through several matching topics', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        deviceSubscription: { deviceToken: 'token-1', locale: 'fr' },
      },
      {
        deviceSubscription: { deviceToken: 'token-1', locale: 'fr' },
      },
      {
        deviceSubscription: { deviceToken: 'token-2', locale: 'nl' },
      },
    ]);
    const prisma = {
      topicSubscription: { findMany },
    } as unknown as PrismaService;
    const service = new FcmService(prisma);

    await expect(
      service.getDevicesByTopicsGroupedByLocale(
        ['match:PANTH01/003', 'player:100671', 'match:PANTH01/003'],
        NotificationType.MATCH,
      ),
    ).resolves.toEqual({ fr: ['token-1'], nl: ['token-2'] });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          topic: {
            in: ['match:PANTH01/003', 'player:100671'],
          },
          deviceSubscription: {
            active: true,
            notificationTypes: { has: NotificationType.MATCH },
          },
        },
      }),
    );
  });
});
