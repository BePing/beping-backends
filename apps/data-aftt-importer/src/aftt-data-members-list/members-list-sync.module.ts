import { Module } from '@nestjs/common';
import { MembersListSyncCron } from './members-list-sync-cron.service';
import { MembersListProcessingService } from './members-list-sync-processor';

export const MEMBERS_LIST_SYNC_QUEUE = 'members';

@Module({
  providers: [MembersListSyncCron, MembersListProcessingService],
})
export class MembersListSyncModule {}
