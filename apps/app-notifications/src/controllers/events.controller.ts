import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FcmService } from '../notifications/fcm.service';
import { GeminiService } from '../common/gemini.service';
import { TeamMatchEventDTO } from './dto/team-match-event-d-t.o';
import { NumericRankingEventDto } from './dto/numeric-ranking-event.dto';
import { NotificationType } from '@prisma/client';

@Controller('events')
@UseGuards(AuthGuard('basic'))
export class EventsController {
    constructor(
        private readonly fcmService: FcmService,
        private readonly geminiService: GeminiService,
    ) { }

    @Post('team-match')
    @HttpCode(HttpStatus.ACCEPTED)
    async handleTeamMatchEvent(@Body() event: TeamMatchEventDTO) {
        const topic = `match:${event.MatchId}`;
        const devicesByLocale = await this.fcmService.getDevicesByTopicGroupedByLocale(topic);

        for (const [locale, tokens] of Object.entries(devicesByLocale)) {
            let title = 'Match Update';
            let body = 'A match you are following has been updated.';

            // Try to get AI-generated content
            const aiContent = await this.geminiService.generateNotificationContent(
                `Team Match Update: Match ID ${event.MatchId}, Week ${event.WeekName}`,
                locale,
            );

            if (aiContent) {
                title = aiContent.title;
                body = aiContent.body;
            }

            await this.fcmService.sendNotification({
                title,
                body,
                notificationType: NotificationType.MATCH,
                data: {
                    matchId: event.MatchId,
                    weekName: event.WeekName.toString(),
                },
                targetDeviceTokens: tokens,
            });
        }

        return { message: 'Event processed' };
    }

    @Post('ranking')
    @HttpCode(HttpStatus.ACCEPTED)
    async handleRankingEvent(@Body() event: NumericRankingEventDto) {
        const topic = `player:${event.uniqueIndex}`;
        const devicesByLocale = await this.fcmService.getDevicesByTopicGroupedByLocale(topic);

        for (const [locale, tokens] of Object.entries(devicesByLocale)) {
            let title = 'Ranking Update';
            let body = `Ranking updated. New ranking: ${event.newRanking}`;

            // Try to get AI-generated content
            const aiContent = await this.geminiService.generateNotificationContent(
                `Player Ranking Update: Old Ranking ${event.oldRanking}, New Ranking ${event.newRanking}`,
                locale,
            );

            if (aiContent) {
                title = aiContent.title;
                body = aiContent.body;
            }

            await this.fcmService.sendNotification({
                title,
                body,
                notificationType: NotificationType.RANKING,
                data: {
                    uniqueIndex: event.uniqueIndex.toString(),
                    oldRanking: event.oldRanking.toString(),
                    newRanking: event.newRanking.toString(),
                },
                targetDeviceTokens: tokens,
            });
        }

        return { message: 'Event processed' };
    }
}
