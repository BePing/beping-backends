import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsString,
  Matches,
} from 'class-validator';

export class BulkTopicSubscriptionDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(/^(match|player|club|division):[A-Za-z0-9_./-]{1,128}$/, {
    each: true,
  })
  topics: string[];
}
