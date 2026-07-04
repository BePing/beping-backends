import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CaptainPrincipal } from './captain-jwt.guard';

/** Injects the authenticated captain principal set by CaptainJwtGuard. */
export const CaptainUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CaptainPrincipal => {
    const request = ctx.switchToHttp().getRequest();
    return request.captain;
  },
);
