import { Injectable } from '@nestjs/common';
import { MemberService } from '../members/member.service';
import { ClubService } from '../clubs/club.service';
import {
  MemberEntry,
  ClubEntry,
  TournamentEntry,
} from '../../entity/tabt-soap/TabTAPI_Port';
import { ApiProperty } from '@nestjs/swagger';
import { TournamentService } from '../tournaments/tournament.service';
import { CacheService, TTL_DURATION } from '../../common/cache/cache.service';
import { createHash } from 'crypto';
import { MemberEntryDTOV1 } from '../../api/member/dto/member.dto';
import { ClubDto } from '../../api/club/dto/club-model.dto';
import { TournamentEntryDTOV1 } from '../../api/tournament/dto/tournament.dto';

export enum SearchType {
  MEMBER = 'member',
  CLUB = 'club',
  TOURNAMENT = 'tournament',
}

// Internal class for scoring and sorting
class ScoredResult<T> {
  constructor(
    public readonly item: T,
    public readonly score: number,
  ) {}
}

export class SearchResultDTO {
  @ApiProperty({ type: [MemberEntryDTOV1], required: false })
  members?: MemberEntryDTOV1[];

  @ApiProperty({ type: [ClubDto], required: false })
  clubs?: ClubDto[];

  @ApiProperty({ type: [TournamentEntryDTOV1], required: false })
  tournaments?: TournamentEntryDTOV1[];
}

@Injectable()
export class SearchService {
  // Minimum similarity threshold for fuzzy matching (0 to 1)
  private readonly SIMILARITY_THRESHOLD = 0.8;

  constructor(
    private readonly memberService: MemberService,
    private readonly clubService: ClubService,
    private readonly tournamentService: TournamentService,
    private readonly cacheService: CacheService,
  ) {}

  async search(query: string, types?: SearchType[]): Promise<SearchResultDTO> {
    const searchTypes = types?.length ? types : Object.values(SearchType);
    const cacheKey = this.getCacheKey(query, searchTypes);

    return this.cacheService.getFromCacheOrGetAndCacheResult(
      cacheKey,
      async () => {
        const result: SearchResultDTO = {};
        const searchPromises: Promise<void>[] = [];

        if (searchTypes.includes(SearchType.MEMBER)) {
          searchPromises.push(
            this.searchMembers(query).then((members) => {
              result.members = members.map((m) =>
                MemberEntryDTOV1.fromTabT(m.item),
              );
            }),
          );
        }

        if (searchTypes.includes(SearchType.CLUB)) {
          searchPromises.push(
            this.searchClubs(query).then((clubs) => {
              result.clubs = clubs.map((c) => c.item);
            }),
          );
        }

        if (searchTypes.includes(SearchType.TOURNAMENT)) {
          searchPromises.push(
            this.searchTournaments(query).then((tournaments) => {
              result.tournaments = tournaments.map((t) => t.item);
            }),
          );
        }

        await Promise.all(searchPromises);
        return result;
      },
      TTL_DURATION.ONE_HOUR,
    );
  }

  private getCacheKey(query: string, types: SearchType[]): string {
    const input = {
      query: query.toLowerCase(),
      types: types.sort(),
    };
    return `search:${createHash('sha256')
      .update(JSON.stringify(input))
      .digest('hex')}`;
  }

  private async searchMembers(
    query: string,
  ): Promise<ScoredResult<MemberEntry>[]> {
    try {
      const results = await this.memberService.getMembersV1({
        nameSearch: query,
      });

      const normalizedQuery = query.toLowerCase();
      const scoredResults = results.map((member) => {
        const fullName = `${member.FirstName} ${member.LastName}`.toLowerCase();
        const scores = [
          this.calculateSimilarity(fullName, normalizedQuery),
          this.calculateSimilarity(
            member.FirstName.toLowerCase(),
            normalizedQuery,
          ),
          this.calculateSimilarity(
            member.LastName.toLowerCase(),
            normalizedQuery,
          ),
        ];

        // Use the best match score
        const score = Math.max(...scores);

        return new ScoredResult(member, score);
      });

      // Filter by threshold and sort by score
      return scoredResults
        .filter((result) => result.score >= this.SIMILARITY_THRESHOLD)
        .sort((a, b) => b.score - a.score);
    } catch (error) {
      console.error('Error searching members:', error);
      return [];
    }
  }

  private async searchClubs(query: string): Promise<ScoredResult<ClubDto>[]> {
    try {
      const clubs = await this.clubService.getClubs();
      const normalizedQuery = query.toLowerCase();

      const scoredResults = clubs.map((club) => {
        const scores = [
          this.calculateSimilarity(club.Name.toLowerCase(), normalizedQuery),
          club.LongName
            ? this.calculateSimilarity(
                club.LongName.toLowerCase(),
                normalizedQuery,
              )
            : 0,
          this.calculateSimilarity(
            club.UniqueIndex.toLowerCase(),
            normalizedQuery,
          ),
        ];

        // Use the best match score
        const score = Math.max(...scores);

        return new ScoredResult(ClubDto.fromTabT(club), score);
      });

      // Filter by threshold and sort by score
      return scoredResults
        .filter((result) => result.score >= this.SIMILARITY_THRESHOLD)
        .sort((a, b) => b.score - a.score);
    } catch (error) {
      console.error('Error searching clubs:', error);
      return [];
    }
  }

  private async searchTournaments(
    query: string,
  ): Promise<ScoredResult<TournamentEntryDTOV1>[]> {
    try {
      const tournaments = await this.tournamentService.getTournaments({});
      const normalizedQuery = query.toLowerCase();

      const scoredResults = tournaments.map((tournament) => {
        const score = this.calculateSimilarity(
          tournament.Name.toLowerCase(),
          normalizedQuery,
        );
        return new ScoredResult(
          TournamentEntryDTOV1.fromTabT(tournament),
          score,
        );
      });

      // Filter by threshold and sort by score
      return scoredResults
        .filter((result) => result.score >= this.SIMILARITY_THRESHOLD)
        .sort((a, b) => b.score - a.score);
    } catch (error) {
      console.error('Error searching tournaments:', error);
      return [];
    }
  }

  /**
   * Calculates the Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const track = Array(str2.length + 1)
      .fill(null)
      .map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) track[0][i] = i;
    for (let j = 0; j <= str2.length; j++) track[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        track[j][i] = Math.min(
          track[j][i - 1] + 1, // deletion
          track[j - 1][i] + 1, // insertion
          track[j - 1][i - 1] + indicator, // substitution
        );
      }
    }

    return track[str2.length][str1.length];
  }

  /**
   * Calculates similarity between two strings (0 to 1)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    // Exact substring match should get a perfect score
    if (str1.includes(str2) || str2.includes(str1)) {
      return 1.0;
    }

    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 1.0; // Both strings are empty

    const distance = this.levenshteinDistance(str1, str2);
    return 1 - distance / maxLength;
  }
}
