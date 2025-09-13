import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PassportModule } from '@nestjs/passport';
import { BasicStrategy } from './auth-basic.strategy';
import { CommonModule } from '../common/common.module';
import { AppCheckGuard } from './app-check.guard';

@Module({
  imports: [PassportModule, CommonModule],
  providers: [AuthService, BasicStrategy, AppCheckGuard],
  exports: [AppCheckGuard],
})
export class AuthModule {}
