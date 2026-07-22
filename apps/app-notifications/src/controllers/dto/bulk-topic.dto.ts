import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class BulkTopicSubscriptionDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(900, { each: true })
  @Matches(/^[a-zA-Z0-9-_.~%]+$/, { each: true })
  topics: string[];
}
