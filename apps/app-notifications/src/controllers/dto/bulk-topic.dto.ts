import { IsArray, IsString } from 'class-validator';

export class BulkTopicSubscriptionDto {
  @IsArray()
  @IsString({ each: true })
  topics: string[];
}

