import { Injectable } from '@nestjs/common';
import {
  GetMatchesInput,
  TeamMatchesEntry,
} from '../../entity/tabt-soap/TabTAPI_Port';
import { TabtClientService } from '../../common/tabt-client/tabt-client.service';
import { PlayerCategory, Level } from '../../entity/tabt-input.interface';
import { PlayerCategoryDTO } from '../../common/dto/player-category.dto';
import { LevelDTO } from '../../common/dto/levels.dto';
import { WeeklyPerformanceMetricsDTO } from '../../api/match/dto/performance-metrics.dto';
import { MemberEntryResultEntry } from '../../common/tabt-client/model/memberEntryResultEntry';

@Injectable()
export class MatchService {
  constructor(private tabtClient: TabtClientService) { }

  async getMatches(input: GetMatchesInput): Promise<TeamMatchesEntry[]> {
    const result = await this.tabtClient.GetMatchesAsync(input);
    if (result.MatchCount === 0) {
      return [];
    }
    return result.TeamMatchesEntries.map((tme) => new TeamMatchesEntry(tme));
  }

  async getWeeklyPerformanceMetrics(
    playerUniqueIndex: number,
    weekName: string,
  ): Promise<WeeklyPerformanceMetricsDTO> {
    const player = await this.tabtClient.GetMembersAsync({
      UniqueIndex: playerUniqueIndex,
      WithResults: true,
    });

    const playerResults = player.MemberEntries[0].ResultEntries;
    
    // Filter results for the specified week
    const weekResults = playerResults.filter(result => {
      const resultDate = new Date(result.Date);
      const today = new Date();
      today.setDate(today.getDate() - 14);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(today.getDate() - 7);
      return resultDate >= sevenDaysAgo && resultDate <= today;
    });
    
    if (weekResults.length === 0) {
      return {
        weeklyLoad: 0,
        fatigueResistance: 100,
        recoveryScore: 100,
        totalSetsPlayed: 0,
        totalMatchesPlayed: 0,
        averageRallyDuration: 0,
        performanceDrop: 0,
        hasRestDay: false,
        weeklyLoadMessage: 'No matches played this week.',
        fatigueResistanceMessage: 'No matches played this week.',
        recoveryMessage: 'No matches played this week.',
      };
    }

    // Calculate total sets played and performance metrics
    let totalSetsPlayed = 0;
    let totalRallyDuration = 0;
    let totalRallies = 0;

    // Sort results by date to ensure proper order
    weekResults.sort((a, b) => new Date(a.Date).getTime() - new Date(b.Date).getTime());

    weekResults.forEach((result) => {
      const totalSets = result.SetFor + result.SetAgainst;
      totalSetsPlayed += totalSets;
      totalRallies += totalSets;
      // Average set duration 5 to 8 minutes
      totalRallyDuration += totalSets * 6;
    });

    const averageRallyDuration = totalRallies > 0 ? totalRallyDuration / totalRallies : 4;

    // Calculate performance metrics using actual results
    const firstMatch = weekResults[0];
    const lastMatch = weekResults[weekResults.length - 1];
    
    const firstMatchPerformance = this.calculateResultPerformance(firstMatch);
    const lastMatchPerformance = this.calculateResultPerformance(lastMatch);
    const performanceDrop = firstMatchPerformance - lastMatchPerformance;

    // Check for rest days between matches
    const hasRestDay = this.hasRestDayBetweenResults(weekResults);

    // Calculate weekly load (scaled 0-100)
    const maxExpectedSets = 15; // Maximum expected sets per week
    const weeklyLoad = Math.min(100, (totalSetsPlayed / maxExpectedSets) * 100);

    // Calculate fatigue resistance (0-100)
    const fatigueResistance = Math.max(
      0,
      100 - (performanceDrop / weekResults.length) * 100,
    );

    // Calculate recovery score (0-100)
    const recoveryScore = Math.max(
      0,
      (lastMatchPerformance / firstMatchPerformance) * 100,
    );

    // Generate feedback messages
    const weeklyLoadMessage = this.generateWeeklyLoadMessage(totalSetsPlayed);
    const fatigueResistanceMessage = this.generateFatigueResistanceMessage(fatigueResistance);
    const recoveryMessage = this.generateRecoveryMessage(recoveryScore);

    return {
      weeklyLoad,
      fatigueResistance,
      recoveryScore,
      totalSetsPlayed,
      totalMatchesPlayed: weekResults.length,
      averageRallyDuration,
      performanceDrop,
      hasRestDay,
      weeklyLoadMessage,
      fatigueResistanceMessage,
      recoveryMessage,
    };
  }

  private calculateResultPerformance(result: MemberEntryResultEntry): number {
    return result.SetFor;
  }

  private hasRestDayBetweenResults(results: MemberEntryResultEntry[]): boolean {
    if (results.length < 2) return false;

    for (let i = 1; i < results.length; i++) {
      const prevMatch = new Date(results[i - 1].Date);
      const currentMatch = new Date(results[i].Date);
      const diffDays = Math.floor(
        (currentMatch.getTime() - prevMatch.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (diffDays > 1) {
        return true;
      }
    }

    return false;
  }

  private generateWeeklyLoadMessage(totalSets: number): string {
    if (totalSets <= 6) {
      return `You played ${totalSets} sets this week. Good effort management!`;
    } else if (totalSets <= 10) {
      return `${totalSets} sets played. Endurance tested!`;
    } else {
      return '15+ sets played. Make sure to recover well.';
    }
  }

  private generateFatigueResistanceMessage(resistance: number): string {
    if (resistance >= 80) {
      return 'You finish as strong as you start!';
    } else if (resistance >= 60) {
      return 'Slight fatigue at the end of matches.';
    } else {
      return 'Fatigue at the end of matches. Management needs improvement.';
    }
  }

  private generateRecoveryMessage(score: number): string {
    if (score >= 90) {
      return 'You\'re in great shape for next week!';
    } else if (score >= 70) {
      return 'Good endurance, but make sure to recover well.';
    } else {
      return 'Your performance drops at the end of the week. Rest recommended.';
    }
  }
}
