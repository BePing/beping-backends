import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PlayerCategory } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MembersListSyncCron {
  private readonly logger = new Logger(MembersListSyncCron.name);

  constructor(
    @InjectQueue('members') private readonly queue: Queue,
    private readonly configService: ConfigService,
  ) {
    const syncOnStart = this.configService.get('SYNC_MEMBERS_ON_START', false);
    if (syncOnStart === true || syncOnStart === 'true') {
      this.syncMembers();
    } else {
      this.logger.log('SYNC_MEMBERS_ON_START is not enabled. ');
    }
  }

  // Run every hour at 45 minutes past the hour
  @Cron('0 45 * * * *')
  async syncMembers() {
    this.logger.log('Members sync starting (every hour at 45 minutes)...');
    await this.queue.add({ playerCategory: PlayerCategory.SENIOR_MEN });
    await this.queue.add({ playerCategory: PlayerCategory.SENIOR_WOMEN });
  }

  /*
    https://data.aftt.be/export/liste_joueurs_1.txt
    https://data.aftt.be/export/liste_joueurs_2.txt
    https://data.aftt.be/export/liste_result_1.txt
    https://data.aftt.be/export/liste_result_2.txt
     */
}
