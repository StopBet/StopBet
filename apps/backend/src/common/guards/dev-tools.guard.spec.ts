import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { DevToolsGuard } from './dev-tools.guard';

// La comparación es estricta contra 'true': cualquier otro valor, incluido un
// 'TRUE' en mayúsculas o un string vacío, debe cerrar el endpoint.
describe('DevToolsGuard', () => {
  function guardWithEnvValue(value: string | undefined) {
    const config = { get: jest.fn().mockReturnValue(value) } as unknown as ConfigService;
    return new DevToolsGuard(config);
  }

  it("permite el acceso cuando DEV_TOOLS_ENABLED === 'true'", () => {
    const guard = guardWithEnvValue('true');
    expect(guard.canActivate()).toBe(true);
  });

  it('rechaza con 403 cuando la variable no está definida', () => {
    const guard = guardWithEnvValue(undefined);
    expect(() => guard.canActivate()).toThrow(ForbiddenException);
  });

  it("rechaza con 403 cuando vale 'false'", () => {
    const guard = guardWithEnvValue('false');
    expect(() => guard.canActivate()).toThrow(ForbiddenException);
  });

  it("rechaza con 403 cuando vale 'TRUE' (mayúsculas, comparación estricta)", () => {
    const guard = guardWithEnvValue('TRUE');
    expect(() => guard.canActivate()).toThrow(ForbiddenException);
  });

  it('rechaza con 403 cuando vale un string vacío', () => {
    const guard = guardWithEnvValue('');
    expect(() => guard.canActivate()).toThrow(ForbiddenException);
  });
});
