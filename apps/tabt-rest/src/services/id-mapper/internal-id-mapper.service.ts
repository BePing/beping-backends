import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';

import FormData from 'form-data';
import { lastValueFrom } from 'rxjs';
import { SocksProxyHttpClient } from '../../common/socks-proxy/socks-proxy-http-client';
import { ConfigService } from '@nestjs/config';
import { CacheService, TTL_DURATION } from '@app/common';
import { UserAgentsUtil } from '../../common/utils/user-agents.util';

@Injectable()
export class InternalIdMapperService {
  constructor(
    private readonly httpService: HttpService,
    private readonly socksProxyService: SocksProxyHttpClient,
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {}

  private static getIdFromPage(regex: RegExp, page: string) {
    const match = page.match(regex);

    if (match?.[1]) {
      return Number(match[1]);
    }

    throw new Error('Player Id not found');
  }

  async getInternalPlayerId(playerUniqueIndex: number): Promise<number> {
    const getter = async () => {
      const formdata = new FormData();
      formdata.append('search_box_match', playerUniqueIndex.toString(10));
      const response = await lastValueFrom(
        this.httpService.post('https://resultats.aftt.be/?menu=0', formdata, {
          responseType: 'text',
          maxRedirects: 0,
          headers: {
            ...formdata.getHeaders(),
            'user-agent': UserAgentsUtil.random,
          },
          httpsAgent:
            this.configService.get('USE_SOCKS_PROXY') === 'true'
              ? this.socksProxyService.createHttpsAgent()
              : undefined,
        }),
      );
      const data = response.data;
      return InternalIdMapperService.getIdFromPage(
        /\/\?menu=6&sel=([0-9]+)&result=1/,
        data,
      );
    };
    return this.cacheService.getFromCacheOrGetAndCacheResult(
      'internal-player-id:' + playerUniqueIndex,
      getter,
      TTL_DURATION.FIFTEEN_DAYS,
    );
  }

  async getInternalClubId(clubUniqueIndex: string): Promise<number> {
    const getter = async () => {
      const response = await lastValueFrom(
        this.httpService.get(
          'https://resultats.aftt.be/club/' + clubUniqueIndex,
          {
            responseType: 'text',
            maxRedirects: 0,
            headers: {
              'user-agent': UserAgentsUtil.random,
            },
            httpsAgent:
              this.configService.get('USE_SOCKS_PROXY') === 'true'
                ? this.socksProxyService.createHttpsAgent()
                : undefined,
          },
        ),
      );
      const data: string = response.data;
      const regId = /index\.php\?modify=1&sel=([0-9]+)/;
      return InternalIdMapperService.getIdFromPage(regId, data);
    };
    return this.cacheService.getFromCacheOrGetAndCacheResult(
      'internal-player-id:' + clubUniqueIndex,
      getter,
      TTL_DURATION.FIFTEEN_DAYS,
    );
  }
}
