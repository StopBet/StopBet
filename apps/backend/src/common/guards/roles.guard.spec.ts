import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthUser } from '@stopbet/shared-types';
import { RolesGuard } from './roles.guard';

function makeContext(user: AuthUser | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

const coordinator: AuthUser = {
  id: 'u1',
  email: 'coord@ajuter.cl',
  role: 'coordinator',
  firstName: 'Sofía',
  lastName: 'Reyes',
  sedeId: null,
};

const psychologist: AuthUser = {
  id: 'u2',
  email: 'psych@ajuter.cl',
  role: 'psychologist',
  firstName: 'Miguel',
  lastName: 'Lara',
  sedeId: null,
};

describe('RolesGuard', () => {
  function guardWithRequiredRoles(roles: string[] | undefined) {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(roles) } as unknown as Reflector;
    return new RolesGuard(reflector);
  }

  it('permite el acceso cuando el endpoint no declara @Roles()', () => {
    const guard = guardWithRequiredRoles(undefined);
    expect(guard.canActivate(makeContext(psychologist))).toBe(true);
  });

  it('permite el acceso cuando el rol del usuario coincide', () => {
    const guard = guardWithRequiredRoles(['coordinator']);
    expect(guard.canActivate(makeContext(coordinator))).toBe(true);
  });

  it('rechaza con 403 cuando el rol del usuario no coincide (S.5)', () => {
    const guard = guardWithRequiredRoles(['coordinator']);
    expect(() => guard.canActivate(makeContext(psychologist))).toThrow(ForbiddenException);
  });

  it('rechaza con 403 cuando no hay usuario autenticado', () => {
    const guard = guardWithRequiredRoles(['coordinator']);
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(ForbiddenException);
  });
});
