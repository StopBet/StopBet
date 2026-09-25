import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthUser } from '@stopbet/shared-types';

// El id de quien hace la petición, sacado del token verificado. Reemplaza a
// @Headers('x-user-id'), que el cliente podía llenar con cualquier UUID: quien supiera el id
// de un paciente leía sus check-ins o sus conversaciones con el asistente.
export const UserId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const user = ctx.switchToHttp().getRequest<{ user?: AuthUser }>().user;
  // Solo pasa si alguien marca @Public() un endpoint que necesita identidad: mejor un 401
  // explícito que un `undefined` que el servicio trate como un id válido.
  if (!user?.id) throw new UnauthorizedException('Sesión requerida');
  return user.id;
});
