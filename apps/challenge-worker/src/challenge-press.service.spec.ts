import { ChallengePressService } from './challenge-press.service';
import {
  ChallengeComputation,
  ComputedRanking,
} from './challenge-worker.types';

describe('ChallengePressService', () => {
  const prisma = {
    challengeSeason: { findUniqueOrThrow: jest.fn() },
  };
  const service = new ChallengePressService(prisma as never);

  beforeEach(() => {
    jest.restoreAllMocks();
    process.env.TEST_MAILJET_KEY = 'test-key';
    process.env.TEST_MAILJET_SECRET = 'test-secret';
    process.env.TEST_PRESS_SENDER = 'sender@example.test';
    prisma.challengeSeason.findUniqueOrThrow.mockResolvedValue({
      pressRankingLimit: 1,
      challenge: {
        slug: 'provincial',
        name: 'Challenge provincial',
        shortName: 'Challenge',
        pressEmailSubject: undefined,
        pressEmailBody: undefined,
        secretReferences: [
          { key: 'MAILJET_API_KEY', envVarName: 'TEST_MAILJET_KEY' },
          { key: 'MAILJET_API_SECRET', envVarName: 'TEST_MAILJET_SECRET' },
          { key: 'PRESS_SENDER_EMAIL', envVarName: 'TEST_PRESS_SENDER' },
        ],
      },
      pressRecipients: [{ email: 'press@example.test', name: 'Presse' }],
      regions: [{ code: 'LIEGE', label: 'Liège' }],
      levels: [{ code: 'P1', label: 'Provincial 1' }],
    });
  });

  it('limits only the press files and includes an Excel workbook per region', async () => {
    const send = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        Messages: [{ To: [{ MessageID: 'mailjet-1' }] }],
      }),
    } as unknown as Response);

    await expect(
      service.send('season-27', 4, 'MONDAY_PRESS_FINAL', computation()),
    ).resolves.toEqual({ status: 'SENT', providerMessageId: 'mailjet-1' });

    const request = send.mock.calls[0][1];
    const payload = JSON.parse(String(request?.body));
    const attachments = payload.Messages[0].Attachments;
    expect(attachments).toHaveLength(2);
    expect(attachments[0].Filename).toBe('provincial-liege-s4-final.xlsx');
    expect(attachments[0].Base64Content).not.toBe('');
    const csv = Buffer.from(attachments[1].Base64Content, 'base64').toString(
      'utf8',
    );
    expect(csv).toContain('Joueur 1');
    expect(csv).not.toContain('Joueur 2');
    expect(computation().rankings).toHaveLength(2);
  });
});

function computation(): ChallengeComputation {
  return {
    rankings: [ranking(1), ranking(2)],
    points: [],
    regionSummaries: [],
    checksum: 'checksum',
  };
}

function ranking(position: number): ComputedRanking {
  return {
    playerUniqueIndex: 100 + position,
    playerName: `Joueur ${position}`,
    clubIndex: 'L001',
    clubName: 'Club test',
    regionCode: 'LIEGE',
    regionLabel: 'Liège',
    levelCode: 'P1',
    levelLabel: 'Provincial 1',
    position,
    totalParticipants: 2,
    points: 3 - position,
    count5Pts: 0,
    count3Pts: 0,
    count2Pts: 0,
    count1Pts: 1,
    count0Pts: 0,
  };
}
