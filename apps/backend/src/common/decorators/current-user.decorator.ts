import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '@stopbet/shared-types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
