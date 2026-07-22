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
import { NotificationContentService } from '../notifications/notification-content.service';
import { TeamMatchEventDTO } from './dto/team-match-event-d-t.o';
import { NumericRankingEventDto } from './dto/numeric-ranking-event.dto';
import { MatchResultEventDto } from './dto/match-result-event.dto';
import { RankingEstimationChangeEventDto } from './dto/ranking-estimation-change-event.dto';
import { NotificationType } from '@app/common';
import { MessagePattern } from '@nestjs/microservices';

@Controller('events')
export class EventsController {
  constructor(
    private readonly fcmService: FcmService,
    private readonly notificationContent: NotificationContentService,
  ) {}

  @Post('team-match')
  @UseGuards(AuthGuard('basic'))
  @HttpCode(HttpStatus.ACCEPTED)
  async handleTeamMatchEvent(@Body() event: TeamMatchEventDTO) {
    const topic = `match:${event.MatchId}`;
    const devicesByLocale =
      await this.fcmService.getDevicesByTopicGroupedByLocale(
        topic,
        NotificationType.MATCH,
      );

    for (const [locale, tokens] of Object.entries(devicesByLocale)) {
      const content = this.notificationContent.results(locale, event.MatchId);

      await this.fcmService.sendNotification({
        ...content,
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
  @UseGuards(AuthGuard('basic'))
  @HttpCode(HttpStatus.ACCEPTED)
  async handleRankingEvent(@Body() event: NumericRankingEventDto) {
    const topic = `player:${event.uniqueIndex}`;
    const devicesByLocale =
      await this.fcmService.getDevicesByTopicGroupedByLocale(
        topic,
        NotificationType.RANKING,
      );

    for (const [locale, tokens] of Object.entries(devicesByLocale)) {
      const content = this.notificationContent.ranking(locale, {
        oldNumericRanking: event.oldRanking,
        newNumericRanking: event.newRanking,
      });

      await this.fcmService.sendNotification({
        ...content,
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
  @UseGuards(AuthGuard('basic'))
  @HttpCode(HttpStatus.ACCEPTED)
  async handleMatchResultEvent(@Body() event: MatchResultEventDto) {
    const topic = `match:${event.matchId}`;
    const devicesByLocale =
      await this.fcmService.getDevicesByTopicGroupedByLocale(
        topic,
        NotificationType.MATCH,
      );

    for (const [locale, tokens] of Object.entries(devicesByLocale)) {
      const content = this.notificationContent.results(locale, event.matchId);

      await this.fcmService.sendNotification({
        ...content,
        notificationType: NotificationType.MATCH,
        data: {
          matchId: event.matchId,
        },
        targetDeviceTokens: tokens,
      });
    }

    return { message: 'Event processed' };
  }

  @MessagePattern('RANKING_ESTIMATION_CHANGE')
  async handleRankingEstimationChangeEvent(
    event: RankingEstimationChangeEventDto,
  ) {
    const topic = `player:${event.uniqueIndex}`;
    const devicesByLocale =
      await this.fcmService.getDevicesByTopicGroupedByLocale(
        topic,
        NotificationType.RANKING,
      );

    for (const [locale, tokens] of Object.entries(devicesByLocale)) {
      const content = this.notificationContent.ranking(locale, {
        oldRankingEstimation: event.oldRankingEstimation,
        newRankingEstimation: event.newRankingEstimation,
      });

      await this.fcmService.sendNotification({
        ...content,
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
