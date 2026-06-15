import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '@app/common';

@Injectable()
export class AuthService {
  constructor(private readonly prismaservice: PrismaService) {}

  async findOne(app: string, password: string): Promise<string | undefined> {
    //make sha256 of password
    const hash = Buffer.from(
      createHash('sha256').update(password).digest('hex'),
    ).toString('base64');
    const apiConsumer = await this.prismaservice.aPIConsumer.findFirst({
      where: { app, password: hash },
    });
    if (apiConsumer) {
      return apiConsumer.app;
    }
    return undefined;
  }
}
