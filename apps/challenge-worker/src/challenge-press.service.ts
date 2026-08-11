import { Injectable } from '@nestjs/common';
import {
  ChallengePressDeliveryStatus,
  ChallengeRunType,
  PrismaService,
} from '@app/common';
import { Workbook } from 'exceljs';
import { ChallengeComputation } from './challenge-worker.types';

export interface PressDeliveryResult {
  status: ChallengePressDeliveryStatus;
  providerMessageId?: string;
  error?: string;
}

@Injectable()
export class ChallengePressService {
  constructor(private readonly prisma: PrismaService) {}

  async send(
    seasonId: string,
    week: number,
    runType: ChallengeRunType,
    computation: ChallengeComputation,
  ): Promise<PressDeliveryResult> {
    const season = await this.prisma.challengeSeason.findUniqueOrThrow({
      where: { id: seasonId },
      include: {
        challenge: { include: { secretReferences: true } },
        pressRecipients: { where: { active: true } },
        regions: { orderBy: { displayOrder: 'asc' } },
        levels: { orderBy: { displayOrder: 'asc' } },
      },
    });
    if (season.pressRecipients.length === 0) {
      return { status: 'FAILED', error: 'No active press recipient' };
    }
    const secrets = Object.fromEntries(
      season.challenge.secretReferences.map((reference) => [
        reference.key,
        process.env[reference.envVarName],
      ]),
    );
    const apiKey = secrets.MAILJET_API_KEY;
    const apiSecret = secrets.MAILJET_API_SECRET;
    const senderEmail = secrets.PRESS_SENDER_EMAIL;
    if (!apiKey || !apiSecret || !senderEmail) {
      return {
        status: 'FAILED',
        error: 'Required press secret reference is unavailable',
      };
    }

    const provisional = runType === 'SUNDAY_PRESS_DRAFT';
    const label = provisional ? 'provisoire' : 'final';
    const rankingLimit = season.pressRankingLimit ?? Number.MAX_SAFE_INTEGER;
    const rows = computation.rankings.filter(
      (ranking) => ranking.position <= rankingLimit,
    );
    const csv = [
      'region;niveau;position;licence;joueur;club;points',
      ...rows.map((ranking) =>
        [
          ranking.regionLabel,
          ranking.levelLabel,
          ranking.position,
          ranking.playerUniqueIndex,
          ranking.playerName,
          ranking.clubName,
          ranking.points,
        ]
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(';'),
      ),
    ].join('\n');
    const regionWorkbooks = await Promise.all(
      season.regions.map(async (region) => {
        const workbook = new Workbook();
        workbook.creator = 'Beping challenge-worker';
        workbook.title = `${season.challenge.name} — ${region.label}`;
        for (const level of season.levels) {
          const worksheet = workbook.addWorksheet(
            this.worksheetName(level.label),
          );
          worksheet.columns = [
            { header: 'Place', key: 'position', width: 10 },
            { header: 'Nom', key: 'playerName', width: 32 },
            { header: 'Club', key: 'clubName', width: 32 },
            { header: 'Points', key: 'points', width: 12 },
            { header: 'Indice club', key: 'clubIndex', width: 15 },
            { header: 'Indice joueur', key: 'playerUniqueIndex', width: 16 },
          ];
          worksheet.getRow(1).font = { bold: true };
          for (const ranking of rows.filter(
            (entry) =>
              entry.regionCode === region.code &&
              entry.levelCode === level.code,
          )) {
            worksheet.addRow(ranking);
          }
          worksheet.autoFilter = `A1:F${Math.max(1, worksheet.rowCount)}`;
          worksheet.views = [{ state: 'frozen', ySplit: 1 }];
        }
        const content = await workbook.xlsx.writeBuffer();
        return {
          ContentType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          Filename: `${season.challenge.slug}-${region.code.toLowerCase()}-s${week}-${label}.xlsx`,
          Base64Content: Buffer.from(content).toString('base64'),
        };
      }),
    );
    const subject =
      season.challenge.pressEmailSubject
        ?.replaceAll('{week}', String(week))
        .replaceAll('{status}', label) ??
      `${season.challenge.name} — classement ${label}, semaine ${week}`;
    const body =
      season.challenge.pressEmailBody
        ?.replaceAll('{week}', String(week))
        .replaceAll('{status}', label) ??
      `Veuillez trouver en pièce jointe le classement ${label} de la semaine ${week}. Ce classement est communautaire et non officiel.`;

    try {
      const response = await fetch('https://api.mailjet.com/v3.1/send', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          Messages: [
            {
              From: {
                Email: senderEmail,
                Name: season.challenge.shortName ?? season.challenge.name,
              },
              To: season.pressRecipients.map((recipient) => ({
                Email: recipient.email,
                Name: recipient.name ?? recipient.email,
              })),
              Subject: subject,
              TextPart: body,
              Attachments: [
                ...regionWorkbooks,
                {
                  ContentType: 'text/csv; charset=utf-8',
                  Filename: `${season.challenge.slug}-s${week}-${label}.csv`,
                  Base64Content: Buffer.from(csv, 'utf8').toString('base64'),
                },
              ],
            },
          ],
        }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok) {
        return {
          status: 'FAILED',
          error: `Mail provider rejected delivery (${response.status})`,
        };
      }
      const payload = (await response.json()) as {
        Messages?: Array<{ To?: Array<{ MessageID?: string }> }>;
      };
      return {
        status: 'SENT',
        providerMessageId: payload.Messages?.[0]?.To?.[0]?.MessageID,
      };
    } catch {
      // A timeout or network interruption can happen after the provider has
      // accepted the request. Never retry or publish automatically in that case.
      return {
        status: 'UNKNOWN',
        error: 'Press delivery outcome is unknown',
      };
    }
  }

  private worksheetName(label: string): string {
    const sanitized = label.replaceAll(/[\\/*?:[\]]/g, '-').trim();
    return (sanitized || 'Classement').slice(0, 31);
  }
}
