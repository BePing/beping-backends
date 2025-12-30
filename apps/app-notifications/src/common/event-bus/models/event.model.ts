import { TeamMatchEventDTO } from '../../../controllers/dto/team-match-event-d-t.o';
import { NumericRankingEventDto } from '../../../controllers/dto/numeric-ranking-event.dto';
import { RankingEstimationChangeEventDto } from '../../../controllers/dto/ranking-estimation-change-event.dto';

export enum TabtEventType {
  MATCH_RESULT_UPDATE = 'MATCH_RESULT_UPDATE',
  MATCH_RESULT_RECEIVED = 'MATCH_RESULT_RECEIVED',
  NUMERIC_RANKING_RECEIVED = 'NUMERIC_RANKING_RECEIVED',
  RANKING_ESTIMATION_CHANGE = 'RANKING_ESTIMATION_CHANGE',
}

export interface TabtEvent<T = TabtEventPayloadTypes> {
  type: TabtEventType;
  payload: T;
  corrId: string;
}

export type TabtEventPayloadTypes = TeamMatchEventDTO | NumericRankingEventDto | RankingEstimationChangeEventDto;
