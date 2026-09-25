import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // Registrado global en AppModule, y además varios controladores lo declaran con
    // @UseGuards(JwtAuthGuard, RolesGuard). Si el global ya validó el token, no se repite:
    // cada validación consulta la base para revisar si la cuenta sigue activa.
    const request = context.switchToHttp().getRequest<{ user?: unknown }>();
    if (request.user) return true;

    return super.canActivate(context);
  }
}
