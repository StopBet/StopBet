import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// JwtAuthGuard está registrado global: todo endpoint exige token salvo los marcados con
// @Public(). Úsalo solo donde no hay sesión posible (login, registro, catálogo de sedes,
// healthcheck) y deja escrito el porqué en el endpoint.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
