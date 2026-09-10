import { CanActivate, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Puerta trasera de demo: viva solo donde alguien la habilita a mano.
// No se usa NODE_ENV a propósito — Railway corre con NODE_ENV=development para que
// TypeORM cree el esquema con synchronize (no hay migraciones), así que un chequeo
// contra 'production' no cerraría nada allá.
@Injectable()
export class DevToolsGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(): boolean {
    if (this.config.get<string>('DEV_TOOLS_ENABLED') !== 'true') {
      throw new ForbiddenException('Endpoint de demo deshabilitado en este entorno');
    }
    return true;
  }
}
