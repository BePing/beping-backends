import { ApiProperty } from '@nestjs/swagger';

export class WeeklyPerformanceMetricsDTO {
  @ApiProperty({
    description: 'Weekly Load (0-100) - Measures total effort based on number of sets played and average rally duration',
    example: 75,
  })
  weeklyLoad: number;

  @ApiProperty({
    description: 'Fatigue Resistance (0-100) - Measures ability to maintain performance between first and last set',
    example: 85,
  })
  fatigueResistance: number;

  @ApiProperty({
    description: 'Recovery Score (0-100) - Measures readiness for next week based on performance trend',
    example: 90,
  })
  recoveryScore: number;

  @ApiProperty({
    description: 'Total number of sets played in the week',
    example: 12,
  })
  totalSetsPlayed: number;

  @ApiProperty({
    description: 'Total number of matches played in the week',
    example: 3,
  })
  totalMatchesPlayed: number;

  @ApiProperty({
    description: 'Estimated average rally duration in seconds',
    example: 4.5,
  })
  averageRallyDuration: number;

  @ApiProperty({
    description: 'Performance drop between first and last set (percentage)',
    example: 15,
  })
  performanceDrop: number;

  @ApiProperty({
    description: 'Indicates if there was a rest day between matches',
    example: true,
  })
  hasRestDay: boolean;

  @ApiProperty({
    description: 'Feedback message about weekly load',
    example: '10 sets played. Endurance tested!',
  })
  weeklyLoadMessage: string;

  @ApiProperty({
    description: 'Feedback message about fatigue resistance',
    example: 'You finish as strong as you start!',
  })
  fatigueResistanceMessage: string;

  @ApiProperty({
    description: 'Feedback message about recovery',
    example: 'You\'re in great shape for next week!',
  })
  recoveryMessage: string;
} 