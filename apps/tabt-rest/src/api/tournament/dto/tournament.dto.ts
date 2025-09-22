import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Level } from '../../../entity/tabt-input.interface';
import {
  TournamentEntry,
  TournamentSerieEntry,
} from '../../../entity/tabt-soap/TabTAPI_Port';
import { LevelDTO, mapLevelToLevelDTO } from '../../../common/dto/levels.dto';

export class TournamentVenueDTOV1 {
  @ApiProperty()
  name: string;

  @ApiProperty()
  street: string;

  @ApiProperty()
  town: string;

  @ApiPropertyOptional()
  lat?: string;

  @ApiPropertyOptional()
  lon?: string;

  @ApiPropertyOptional()
  boundingBox?: string[];

  static fromTabT(venue: TournamentEntry['Venue']): TournamentVenueDTOV1 {
    const dto = new TournamentVenueDTOV1();
    dto.name = venue.Name;
    dto.street = venue.Street;
    dto.town = venue.Town;
    dto.lat = venue.Lat;
    dto.lon = venue.Lon;
    dto.boundingBox = venue.BoundingBox;
    return dto;
  }
}

export class TournamentSerieEntryDTOV1 {
  @ApiProperty()
  uniqueIndex: number;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  resultCount?: number;

  @ApiPropertyOptional()
  registrationCount?: number;

  static fromTabT(serie: TournamentSerieEntry): TournamentSerieEntryDTOV1 {
    const dto = new TournamentSerieEntryDTOV1();
    dto.uniqueIndex = serie.UniqueIndex;
    dto.name = serie.Name;
    dto.resultCount = serie.ResultCount;
    dto.registrationCount = serie.RegistrationCount;
    return dto;
  }
}

export class TournamentEntryDTOV1 {
  @ApiProperty()
  uniqueIndex: number;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: LevelDTO })
  @Transform((l) => mapLevelToLevelDTO(l.value), { toPlainOnly: true })
  level: LevelDTO;

  @ApiProperty()
  externalIndex: string;

  @ApiPropertyOptional()
  dateFrom?: string;

  @ApiPropertyOptional()
  dateTo?: string;

  @ApiPropertyOptional()
  registrationDate?: string;

  @ApiPropertyOptional({ type: TournamentVenueDTOV1 })
  venue?: TournamentVenueDTOV1;

  @ApiPropertyOptional()
  serieCount?: number;

  @ApiPropertyOptional({ type: [TournamentSerieEntryDTOV1] })
  serieEntries?: TournamentSerieEntryDTOV1[];

  static fromTabT(tournament: TournamentEntry): TournamentEntryDTOV1 {
    const dto = new TournamentEntryDTOV1();
    dto.uniqueIndex = tournament.UniqueIndex;
    dto.name = tournament.Name;
    dto.level = mapLevelToLevelDTO(tournament.Level);
    dto.externalIndex = tournament.ExternalIndex;
    dto.dateFrom = tournament.DateFrom;
    dto.dateTo = tournament.DateTo;
    dto.registrationDate = tournament.RegistrationDate;
    dto.venue = tournament.Venue
      ? TournamentVenueDTOV1.fromTabT(tournament.Venue)
      : undefined;
    dto.serieCount = tournament.SerieCount;
    dto.serieEntries = tournament.SerieEntries?.map(
      TournamentSerieEntryDTOV1.fromTabT,
    );
    return dto;
  }
}
