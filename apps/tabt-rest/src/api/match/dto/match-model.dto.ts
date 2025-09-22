import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  DivisionCategoryDTO,
  mapDivisionCategoryToDivisionCategoryDTO,
} from '../../../common/dto/division-category.dto';
import {
  TeamMatchesEntry,
  VenueEntry,
  Players,
} from '../../../entity/tabt-soap/TabTAPI_Port';

export class VenueEntryDTO {
  @ApiPropertyOptional()
  id: number;

  @ApiPropertyOptional()
  clubVenue: number;

  @ApiPropertyOptional()
  name: string;

  @ApiPropertyOptional()
  street: string;

  @ApiPropertyOptional()
  town: string;

  @ApiPropertyOptional()
  phone: string;

  @ApiPropertyOptional()
  comment: string;

  @ApiPropertyOptional()
  lat?: string;

  @ApiPropertyOptional()
  lon?: string;

  @ApiPropertyOptional()
  boundingBox?: string[];

  static fromTabT(venue: VenueEntry): VenueEntryDTO {
    const dto = new VenueEntryDTO();
    dto.id = venue.Id;
    dto.clubVenue = venue.ClubVenue;
    dto.name = venue.Name;
    dto.street = venue.Street;
    dto.town = venue.Town;
    dto.phone = venue.Phone;
    dto.comment = venue.Comment;
    dto.lat = venue.Lat;
    dto.lon = venue.Lon;
    dto.boundingBox = venue.BoundingBox;
    return dto;
  }
}

export class PlayerDTO {
  @ApiProperty()
  position: number;

  @ApiProperty()
  uniqueIndex: number;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  ranking: string;

  @ApiPropertyOptional()
  victoryCount?: number;

  @ApiPropertyOptional()
  isForfeited?: boolean;

  static fromTabT(player: any): PlayerDTO {
    const dto = new PlayerDTO();
    dto.position = player.Position;
    dto.uniqueIndex = player.UniqueIndex;
    dto.firstName = player.FirstName;
    dto.lastName = player.LastName;
    dto.ranking = player.Ranking;
    dto.victoryCount = player.VictoryCount;
    dto.isForfeited = player.IsForfeited;
    return dto;
  }
}

export class DoubleTeamDTO {
  @ApiPropertyOptional()
  position: number;

  @ApiPropertyOptional()
  team: string;

  @ApiPropertyOptional()
  isForfeited: boolean;

  static fromTabT(team: any): DoubleTeamDTO {
    const dto = new DoubleTeamDTO();
    dto.position = team.Position;
    dto.team = team.Team;
    dto.isForfeited = team.IsForfeited;
    return dto;
  }
}

export class PlayersDTO {
  @ApiProperty()
  playerCount: number;

  @ApiProperty()
  doubleTeamCount: number;

  @ApiPropertyOptional({ type: [PlayerDTO] })
  players: PlayerDTO[];

  @ApiPropertyOptional({ type: [DoubleTeamDTO] })
  doubleTeams: DoubleTeamDTO[];

  static fromTabT(players: Players | undefined): PlayersDTO {
    const dto = new PlayersDTO();
    dto.playerCount = players?.PlayerCount ?? 0;
    dto.doubleTeamCount = players?.DoubleTeamCount ?? 0;
    dto.players = players?.Players?.map(PlayerDTO.fromTabT) ?? [];
    dto.doubleTeams = players?.DoubleTeams?.map(DoubleTeamDTO.fromTabT) ?? [];
    return dto;
  }
}

export class IndividualMatchResultDTO {
  @ApiPropertyOptional()
  position: number;

  @ApiPropertyOptional({ type: [Number] })
  homePlayerMatchIndex: number[];

  @ApiPropertyOptional({ type: [Number] })
  homePlayerUniqueIndex: number[];

  @ApiPropertyOptional({ type: [Number] })
  awayPlayerMatchIndex: number[];

  @ApiPropertyOptional({ type: [Number] })
  awayPlayerUniqueIndex: number[];

  @ApiPropertyOptional()
  homeSetCount: number;

  @ApiPropertyOptional()
  awaySetCount: number;

  @ApiPropertyOptional()
  isHomeForfeited?: boolean;

  @ApiPropertyOptional()
  isAwayForfeited?: boolean;

  @ApiPropertyOptional()
  scores?: string;

  static fromTabT(result: any): IndividualMatchResultDTO {
    const dto = new IndividualMatchResultDTO();
    dto.position = result.Position;
    dto.homePlayerMatchIndex = result.HomePlayerMatchIndex;
    dto.homePlayerUniqueIndex = result.HomePlayerUniqueIndex;
    dto.awayPlayerMatchIndex = result.AwayPlayerMatchIndex;
    dto.awayPlayerUniqueIndex = result.AwayPlayerUniqueIndex;
    dto.homeSetCount = result.HomeSetCount;
    dto.awaySetCount = result.AwaySetCount;
    dto.isHomeForfeited = result.IsHomeForfeited;
    dto.isAwayForfeited = result.IsAwayForfeited;
    dto.scores = result.Scores;
    return dto;
  }
}

export class CommentAuthorDTO {
  @ApiPropertyOptional()
  position?: number;

  @ApiPropertyOptional()
  uniqueIndex?: number;

  @ApiPropertyOptional()
  rankingIndex?: number;

  @ApiPropertyOptional()
  firstName?: string;

  @ApiPropertyOptional()
  lastName?: string;

  @ApiPropertyOptional()
  ranking?: string;

  @ApiPropertyOptional()
  status?: string;

  @ApiPropertyOptional()
  club?: string;

  @ApiPropertyOptional({ enum: ['M', 'F'] })
  gender?: 'M' | 'F';

  static fromTabT(author: any): CommentAuthorDTO {
    const dto = new CommentAuthorDTO();
    dto.position = author.Position;
    dto.uniqueIndex = author.UniqueIndex;
    dto.rankingIndex = author.RankingIndex;
    dto.firstName = author.FirstName;
    dto.lastName = author.LastName;
    dto.ranking = author.Ranking;
    dto.status = author.Status;
    dto.club = author.Club;
    dto.gender = author.Gender;
    return dto;
  }
}

export class CommentEntryDTO {
  @ApiPropertyOptional()
  timestamp?: string;

  @ApiPropertyOptional()
  author?: CommentAuthorDTO;

  @ApiPropertyOptional()
  comment?: string;

  @ApiPropertyOptional()
  code?: string;

  static fromTabT(entry: any): CommentEntryDTO {
    const dto = new CommentEntryDTO();
    dto.timestamp = entry.Timestamp;
    dto.author = entry.Author
      ? CommentAuthorDTO.fromTabT(entry.Author)
      : undefined;
    dto.comment = entry.Comment;
    dto.code = entry.Code;
    return dto;
  }
}

export class MatchDetailsDTO {
  @ApiProperty()
  detailsCreated: boolean;

  @ApiPropertyOptional()
  startTime?: string;

  @ApiPropertyOptional()
  endTime?: string;

  @ApiPropertyOptional()
  homeCaptain?: number;

  @ApiPropertyOptional()
  awayCaptain?: number;

  @ApiPropertyOptional()
  referee?: number;

  @ApiPropertyOptional()
  hallCommissioner?: number;

  @ApiPropertyOptional({ type: PlayersDTO })
  homePlayers?: PlayersDTO;

  @ApiPropertyOptional({ type: PlayersDTO })
  awayPlayers?: PlayersDTO;

  @ApiPropertyOptional({ type: [IndividualMatchResultDTO] })
  individualMatchResults?: IndividualMatchResultDTO[];

  @ApiProperty()
  matchSystem: number;

  @ApiProperty()
  homeScore: number;

  @ApiProperty()
  awayScore: number;

  @ApiProperty()
  commentCount: number;

  @ApiPropertyOptional({ type: [CommentEntryDTO] })
  commentEntries?: CommentEntryDTO[];

  static fromTabT(details: any): MatchDetailsDTO {
    const dto = new MatchDetailsDTO();
    dto.detailsCreated = details.DetailsCreated;
    dto.startTime = details.StartTime;
    dto.endTime = details.EndTime;
    dto.homeCaptain = details.HomeCaptain;
    dto.awayCaptain = details.AwayCaptain;
    dto.referee = details.Referee;
    dto.hallCommissioner = details.HallCommissioner;
    dto.homePlayers = details.HomePlayers
      ? PlayersDTO.fromTabT(details.HomePlayers)
      : undefined;
    dto.awayPlayers = details.AwayPlayers
      ? PlayersDTO.fromTabT(details.AwayPlayers)
      : undefined;
    dto.individualMatchResults =
      details.IndividualMatchResults?.map(IndividualMatchResultDTO.fromTabT) ??
      [];
    dto.matchSystem = details.MatchSystem;
    dto.homeScore = details.HomeScore;
    dto.awayScore = details.AwayScore;
    dto.commentCount = details.CommentCount;
    dto.commentEntries = details.CommentEntries?.map(CommentEntryDTO.fromTabT);
    return dto;
  }
}

export class TeamMatchesEntryDTO {
  @ApiPropertyOptional()
  divisionName?: string;

  @ApiProperty()
  matchId: string;

  @ApiProperty()
  weekName: string;

  @ApiPropertyOptional()
  date: string;

  @ApiPropertyOptional()
  time: string;

  @ApiPropertyOptional()
  venue: number;

  @ApiPropertyOptional()
  venueClub: string;

  @ApiPropertyOptional({ type: VenueEntryDTO })
  venueEntry: VenueEntryDTO;

  @ApiProperty()
  homeClub: string;

  @ApiProperty()
  homeTeam: string;

  @ApiProperty()
  awayClub: string;

  @ApiProperty()
  awayTeam: string;

  @ApiPropertyOptional()
  score: string;

  @ApiPropertyOptional()
  matchUniqueId: number;

  @ApiPropertyOptional()
  nextWeekName?: string;

  @ApiPropertyOptional()
  previousWeekName?: string;

  @ApiProperty()
  isHomeForfeited: boolean;

  @ApiProperty()
  isAwayForfeited: boolean;

  @ApiProperty()
  divisionId: number;

  @ApiPropertyOptional({ enum: DivisionCategoryDTO })
  @Transform((cat) => mapDivisionCategoryToDivisionCategoryDTO(cat.value), {
    toPlainOnly: true,
  })
  divisionCategory: DivisionCategoryDTO;

  @ApiProperty()
  isHomeWithdrawn: boolean;

  @ApiProperty()
  isAwayWithdrawn: boolean;

  @ApiProperty()
  isValidated: boolean;

  @ApiProperty()
  isLocked: boolean;

  @ApiPropertyOptional({ type: MatchDetailsDTO })
  matchDetails?: MatchDetailsDTO;

  static fromTabT(match: TeamMatchesEntry): TeamMatchesEntryDTO {
    const dto = new TeamMatchesEntryDTO();
    dto.divisionName = match.DivisionName;
    dto.matchId = match.MatchId;
    dto.weekName = match.WeekName;
    dto.date = match.Date;
    dto.time = match.Time;
    dto.venue = match.Venue;
    dto.venueClub = match.VenueClub;
    dto.venueEntry = match.VenueEntry
      ? VenueEntryDTO.fromTabT(match.VenueEntry as VenueEntry)
      : null;
    dto.homeClub = match.HomeClub;
    dto.homeTeam = match.HomeTeam;
    dto.awayClub = match.AwayClub;
    dto.awayTeam = match.AwayTeam;
    dto.score = match.Score;
    dto.matchUniqueId = match.MatchUniqueId;
    dto.nextWeekName = match.NextWeekName;
    dto.previousWeekName = match.PreviousWeekName;
    dto.isHomeForfeited = match.IsHomeForfeited;
    dto.isAwayForfeited = match.IsAwayForfeited;
    dto.divisionId = match.DivisionId;
    dto.divisionCategory = mapDivisionCategoryToDivisionCategoryDTO(
      match.DivisionCategory,
    );
    dto.isHomeWithdrawn = match.IsHomeWithdrawn;
    dto.isAwayWithdrawn = match.IsAwayWithdrawn;
    dto.isValidated = match.IsValidated;
    dto.isLocked = match.IsLocked;
    dto.matchDetails = match.MatchDetails
      ? MatchDetailsDTO.fromTabT(match.MatchDetails)
      : undefined;
    return dto;
  }
}
