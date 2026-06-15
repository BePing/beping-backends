import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VenueEntry } from '../../../entity/tabt-soap/TabTAPI_Port';

export class VenueDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  street: string;

  @ApiProperty()
  town: string;

  @ApiPropertyOptional()
  phone?: string;

  @ApiPropertyOptional()
  comment?: string;

  static fromTabT(venue: VenueEntry): VenueDto {
    const dto = new VenueDto();
    dto.name = venue.Name;
    dto.street = venue.Street;
    dto.town = venue.Town;
    dto.phone = venue.Phone;
    dto.comment = venue.Comment;
    return dto;
  }
}

export class ClubDto {
  @ApiPropertyOptional()
  uniqueIndex?: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  longName: string;

  @ApiProperty()
  category: number;

  @ApiProperty()
  categoryName: string;

  @ApiProperty()
  venueCount: number;

  @ApiPropertyOptional({ type: [VenueDto] })
  venues?: VenueDto[];

  static fromTabT(club: any): ClubDto {
    const dto = new ClubDto();
    dto.uniqueIndex = club.UniqueIndex;
    dto.name = club.Name;
    dto.longName = club.LongName;
    dto.category = club.Category;
    dto.categoryName = club.CategoryName;
    dto.venueCount = club.VenueCount;
    if (club.VenueEntries) {
      dto.venues = club.VenueEntries.map(VenueDto.fromTabT);
    }
    return dto;
  }
}
