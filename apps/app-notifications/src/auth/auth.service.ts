import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '@app/common';

const BCRYPT_COST = 10;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly prismaservice: PrismaService) {}

  async findOne(app: string, password: string): Promise<string | undefined> {
    const apiConsumer = await this.prismaservice.aPIConsumer.findUnique({
      where: { app },
    });

    if (!apiConsumer) {
      return undefined;
    }

    const stored = apiConsumer.password;

    if (this.isBcryptHash(stored)) {
      const matches = await bcrypt.compare(password, stored);
      return matches ? apiConsumer.app : undefined;
    }

    // Legacy base64(sha256(password)) unsalted comparison, with
    // transparent rehash-on-login migration to bcrypt on match.
    if (this.legacyHash(password) === stored) {
      await this.rehashPassword(app, password);
      return apiConsumer.app;
    }

    return undefined;
  }

  private isBcryptHash(value: string): boolean {
    return /^\$2[aby]\$/.test(value);
  }

  private legacyHash(password: string): string {
    return Buffer.from(
      createHash('sha256').update(password).digest('hex'),
    ).toString('base64');
  }

  private async rehashPassword(app: string, password: string): Promise<void> {
    try {
      const hash = await bcrypt.hash(password, BCRYPT_COST);
      await this.prismaservice.aPIConsumer.update({
        where: { app },
        data: { password: hash },
      });
    } catch (error) {
      // Never fail authentication because the migration write failed.
      this.logger.error(
        `Failed to migrate legacy password hash for app "${app}"`,
        error,
      );
    }
  }
}
