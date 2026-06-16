import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FcmService } from '../notifications/fcm.service';
import { OpenAIService } from '../common/openai.service';
import { TeamMatchEventDTO } from './dto/team-match-event-d-t.o';
import { NumericRankingEventDto } from './dto/numeric-ranking-event.dto';
import { MatchResultEventDto } from './dto/match-result-event.dto';
import { RankingEstimationChangeEventDto } from './dto/ranking-estimation-change-event.dto';
import { NotificationType } from '@app/common';
import { MessagePattern } from '@nestjs/microservices';

@Controller('events')
@UseGuards(AuthGuard('basic'))
export class EventsController {
  constructor(
    private readonly fcmService: FcmService,
    private readonly openaiService: OpenAIService,
  ) {}

  @Post('team-match')
  @HttpCode(HttpStatus.ACCEPTED)
  async handleTeamMatchEvent(@Body() event: TeamMatchEventDTO) {
    const topic = `match:${event.MatchId}`;
    const devicesByLocale =
      await this.fcmService.getDevicesByTopicGroupedByLocale(topic);

    for (const [locale, tokens] of Object.entries(devicesByLocale)) {
      let title = 'Match Update';
      let body = 'A match you are following has been updated.';

      // Try to get AI-generated content
      const aiContent = await this.openaiService.generateNotificationContent(
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
    const devicesByLocale =
      await this.fcmService.getDevicesByTopicGroupedByLocale(topic);

    for (const [locale, tokens] of Object.entries(devicesByLocale)) {
      let title = 'Ranking Update';
      let body = `Ranking updated. New ranking: ${event.newRanking}`;

      // Try to get AI-generated content
      const aiContent = await this.openaiService.generateNotificationContent(
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

  @Post('match-result')
  @HttpCode(HttpStatus.ACCEPTED)
  async handleMatchResultEvent(@Body() event: MatchResultEventDto) {
    const topic = `match:${event.matchId}`;
    const devicesByLocale =
      await this.fcmService.getDevicesByTopicGroupedByLocale(topic);

    for (const [locale, tokens] of Object.entries(devicesByLocale)) {
      let title = 'Match Result';
      let body = 'A match result is now available.';

      // Try to get AI-generated content
      const aiContent = await this.openaiService.generateNotificationContent(
        `Match Result Available: Match ID ${event.matchId}`,
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
          matchId: event.matchId,
        },
        targetDeviceTokens: tokens,
      });
    }

    return { message: 'Match result event processed' };
  }

  @MessagePattern('RANKING_ESTIMATION_CHANGE')
  async handleRankingEstimationChangeEvent(
    event: RankingEstimationChangeEventDto,
  ) {
    const topic = `player:${event.uniqueIndex}`;
    const devicesByLocale =
      await this.fcmService.getDevicesByTopicGroupedByLocale(topic);

    for (const [locale, tokens] of Object.entries(devicesByLocale)) {
      let title = 'Ranking Estimation Update';
      let body = `Your ranking estimation changed from ${event.oldRankingEstimation} to ${event.newRankingEstimation}.`;

      // Try to get AI-generated content
      const aiContent = await this.openaiService.generateNotificationContent(
        `Player Ranking Estimation Change: Old Estimation ${event.oldRankingEstimation}, New Estimation ${event.newRankingEstimation}, Category ${event.playerCategory}`,
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
          oldRankingEstimation: event.oldRankingEstimation,
          newRankingEstimation: event.newRankingEstimation,
          playerCategory: event.playerCategory,
        },
        targetDeviceTokens: tokens,
      });
    }

    return { message: 'Ranking estimation change event processed' };
  }
}
