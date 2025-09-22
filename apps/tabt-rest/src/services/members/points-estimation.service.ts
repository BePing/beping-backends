import { Injectable } from '@nestjs/common';
import { PlayerCategoryDTO } from '../../common/dto/player-category.dto';
import {
  MEN_POINTS_DIFFERENCE_TABLE,
  WOMEN_POINTS_DIFFERENCE_TABLE,
  MEN_INTERCLUB_COEFFICIENTS,
  WOMEN_INTERCLUB_COEFFICIENTS,
} from '../../common/consts/ranking-equivalence';

interface PointsEstimation {
  expectedWinPoints: number;
  unexpectedWinPoints: number;
  coefficient: number;
}

@Injectable()
export class PointsEstimationService {
  /**
   * Estimates the points a player can win against an opponent
   * @param playerPoints Current points of the player
   * @param opponentPoints Points of the opponent
   * @param divisionName Name of the division (e.g. "SuperDivision", "N1", etc.)
   * @param category Player category (men or women)
   * @returns Points estimation object with expected and unexpected win points
   */
  estimatePoints(
    playerPoints: number,
    opponentPoints: number,
    divisionName: string,
    category: PlayerCategoryDTO = PlayerCategoryDTO.SENIOR_MEN,
  ): PointsEstimation {
    // Get the appropriate points difference table and coefficients based on category
    const pointsDifferenceTable =
      category === PlayerCategoryDTO.SENIOR_MEN
        ? MEN_POINTS_DIFFERENCE_TABLE.difference_of_points_table
        : WOMEN_POINTS_DIFFERENCE_TABLE.difference_of_points_table;

    const coefficients =
      category === PlayerCategoryDTO.SENIOR_MEN
        ? MEN_INTERCLUB_COEFFICIENTS
        : WOMEN_INTERCLUB_COEFFICIENTS;

    // Calculate points difference (positive if player is stronger, negative if opponent is stronger)
    const pointsDifference = playerPoints - opponentPoints;

    // Find the appropriate row in the points difference table based on absolute difference
    const pointsRow = pointsDifferenceTable.find((row) => {
      const [min, max] = row.point_difference.split('-');
      if (max === '+') {
        return Math.abs(pointsDifference) >= parseInt(min);
      }
      return (
        Math.abs(pointsDifference) >= parseInt(min) &&
        Math.abs(pointsDifference) <= parseInt(max)
      );
    });

    // Find the coefficient for the division
    const coefficientEntry = { value: 1 };

    // Default to lowest coefficient if no match found
    const coefficient = coefficientEntry?.value || 0.85;

    if (!pointsRow) {
      // If no row found, use the last row (401+)
      const lastRow = pointsDifferenceTable[pointsDifferenceTable.length - 1];
      return {
        // If player has more points (positive difference), they're expected to win
        expectedWinPoints: Math.round(
          lastRow.expected_result_points * coefficient,
        ),
        unexpectedWinPoints: Math.round(
          lastRow.unexpected_result_points * coefficient,
        ),
        coefficient,
      };
    }

    return {
      // If player has more points (positive difference), they're expected to win
      expectedWinPoints: Math.round(
        pointsRow.expected_result_points * coefficient,
      ),
      unexpectedWinPoints: Math.round(
        pointsRow.unexpected_result_points * coefficient,
      ),
      coefficient,
    };
  }

  /**
   * Matches a division name against a competition pattern
   */
  private matchDivisionName(pattern: string, divisionName: string): boolean {
    // Handle special patterns
    if (pattern === 'Other Provincial Competitions') {
      return (
        divisionName.toLowerCase().includes('p') &&
        !divisionName.toLowerCase().includes('p1')
      );
    }

    // Handle patterns with multiple options (e.g. "N1 & N2")
    if (pattern.includes('&')) {
      const options = pattern.split('&').map((p) => p.trim().toLowerCase());
      return options.some((opt) => divisionName.toLowerCase().includes(opt));
    }

    // Handle patterns with multiple options separated by comma
    if (pattern.includes(',')) {
      const options = pattern.split(',').map((p) => p.trim().toLowerCase());
      return options.some((opt) => divisionName.toLowerCase().includes(opt));
    }

    // Direct match (case insensitive)
    return divisionName.toLowerCase().includes(pattern.toLowerCase());
  }
}
