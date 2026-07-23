import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@app/common';
import { TabTAPISoap } from '../../entity/tabt-soap/TabTAPI_Port';
import { CaptainTokenService } from './captain-token.service';
import { CaptainLoginDto, CaptainSessionDto } from '../dto/captain-auth.dto';

/**
 * Captain authentication. Verifies AFTT credentials against the TabT SOAP API
 * (TestAsync → IsValidAccount), resolves the claimed member (GetMembers) to get
 * the club, checks the pre-provisioned CaptainAccount and issues application
 * JWTs. Federation credentials prove API access, not member identity, so a
 * self-declared member can never create or switch a CaptainAccount.
 *
 * AFTT credentials are used only for the two SOAP calls and are never persisted
 * or logged.
 */
@Injectable()
export class CaptainAuthService {
  private readonly logger = new Logger(CaptainAuthService.name);

  constructor(
    @Inject('tabt-aftt') private readonly tabtClient: TabTAPISoap,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly tokens: CaptainTokenService,
  ) {}

  async login(dto: CaptainLoginDto): Promise<CaptainSessionDto> {
    const Credentials = { Account: dto.account, Password: dto.password };

    // 1. Verify the credentials are valid AFTT credentials.
    let isValid: boolean;
    try {
      const [test] = await this.tabtClient.TestAsync({ Credentials }, null, {});
      isValid = !!test?.IsValidAccount;
    } catch (e) {
      this.logger.error(`TabT TestAsync failed: ${e?.message ?? 'unknown'}`);
      throw new UnauthorizedException('Unable to verify AFTT credentials');
    }
    if (!isValid) {
      throw new UnauthorizedException('Invalid AFTT credentials');
    }

    // 2. The identity must have been provisioned by a trusted operator. TabT
    //    does not expose "who am I", so valid credentials alone cannot bind the
    //    caller to an arbitrary claimed member.
    const account = await this.prisma.captainAccount.findUnique({
      where: { uniqueIndex: dto.claimedUniqueIndex },
    });
    if (!account) {
      throw new UnauthorizedException('Captain access is not enabled');
    }

    // 3. Refresh the provisioned member data from the federation.
    const season = Number(this.config.get('CURRENT_SEASON')) || undefined;
    let member;
    try {
      const [result] = await this.tabtClient.GetMembersAsync(
        {
          Credentials,
          UniqueIndex: dto.claimedUniqueIndex,
          Season: season,
        } as any,
        null,
        {},
      );
      member = result?.MemberEntries?.[0];
    } catch (e) {
      this.logger.error(`TabT GetMembers failed: ${e?.message ?? 'unknown'}`);
      throw new UnauthorizedException('Unable to resolve member');
    }
    if (!member) {
      throw new UnauthorizedException(
        'Member not found for the provided unique index',
      );
    }

    const clubIndex = member.Club;

    if (
      member.UniqueIndex !== account.uniqueIndex ||
      clubIndex !== account.clubIndex
    ) {
      throw new UnauthorizedException('Captain identity does not match');
    }

    await this.prisma.captainAccount.update({
      where: { uniqueIndex: account.uniqueIndex },
      data: {
        clubIndex,
        firstName: member.FirstName,
        lastName: member.LastName,
        ranking: member.Ranking,
        lastVerifiedAt: new Date(),
      },
    });

    return this.issueSession(member.UniqueIndex, clubIndex, member);
  }

  async refresh(refreshToken: string): Promise<CaptainSessionDto> {
    let claims;
    try {
      claims = await this.tokens.verifyRefresh(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    const account = await this.prisma.captainAccount.findUnique({
      where: { uniqueIndex: claims.sub },
    });
    if (!account) {
      throw new UnauthorizedException('Captain account no longer exists');
    }
    return this.issueSession(account.uniqueIndex, account.clubIndex, {
      UniqueIndex: account.uniqueIndex,
      FirstName: account.firstName,
      LastName: account.lastName,
      Ranking: account.ranking,
    });
  }

  private async issueSession(
    uniqueIndex: number,
    clubIndex: string,
    member: {
      UniqueIndex: number;
      FirstName?: string;
      LastName?: string;
      Ranking?: string;
      RankingIndex?: number;
    },
  ): Promise<CaptainSessionDto> {
    const [accessToken, refreshToken] = await Promise.all([
      this.tokens.signAccess(uniqueIndex, clubIndex),
      this.tokens.signRefresh(uniqueIndex, clubIndex),
    ]);
    return {
      accessToken,
      refreshToken,
      member: {
        uniqueIndex,
        firstName: member.FirstName ?? '',
        lastName: member.LastName ?? '',
        clubIndex,
        ranking: member.Ranking,
        rankingIndex: member.RankingIndex,
      },
    };
  }
}
