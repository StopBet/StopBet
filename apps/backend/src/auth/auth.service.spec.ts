import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: { findOne: jest.Mock };
  let refreshTokenRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  let jwtService: { sign: jest.Mock };

  const rawPassword = 'Stopbet2026!';
  let passwordHash: string;

  const baseUser: Partial<User> = {
    id: 'user-1',
    email: 'sofia.reyes@ajuter.cl',
    role: 'coordinator',
    firstName: 'Sofía',
    lastName: 'Reyes',
    sedeId: null,
  };

  beforeAll(async () => {
    passwordHash = await bcrypt.hash(rawPassword, 10);
  });

  beforeEach(() => {
    userRepo = { findOne: jest.fn() };
    refreshTokenRepo = {
      findOne: jest.fn(),
      save: jest.fn((entity) => Promise.resolve(entity)),
      create: jest.fn((data) => data),
      update: jest.fn(),
    };
    jwtService = { sign: jest.fn().mockReturnValue('signed.jwt.token') };

    service = new AuthService(
      userRepo as any,
      refreshTokenRepo as any,
      jwtService as unknown as JwtService,
    );
  });

  describe('login', () => {
    it('devuelve accessToken, refreshToken y user con la contraseña correcta', async () => {
      userRepo.findOne.mockResolvedValue({ ...baseUser, passwordHash });

      const result = await service.login(baseUser.email!, rawPassword);

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.refreshToken).toEqual(expect.any(String));
      expect(result.user).toEqual({
        id: baseUser.id,
        email: baseUser.email,
        role: baseUser.role,
        firstName: baseUser.firstName,
        lastName: baseUser.lastName,
        sedeId: baseUser.sedeId,
      });
      expect(refreshTokenRepo.save).toHaveBeenCalled();
    });

    it('rechaza con 401 cuando la contraseña es incorrecta', async () => {
      userRepo.findOne.mockResolvedValue({ ...baseUser, passwordHash });

      await expect(service.login(baseUser.email!, 'clave-incorrecta')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rechaza con 401 cuando el correo no existe', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.login('no-existe@ajuter.cl', rawPassword)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rechaza con 401 sin lanzar error de bcrypt cuando passwordHash es null', async () => {
      userRepo.findOne.mockResolvedValue({ ...baseUser, passwordHash: null });

      await expect(service.login(baseUser.email!, rawPassword)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refresh', () => {
    it('rota el refresh token: revoca el anterior y emite un par nuevo', async () => {
      const stored: Partial<RefreshToken> = {
        id: 'rt-1',
        userId: baseUser.id!,
        tokenHash: 'hash-viejo',
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        revokedAt: null,
      };
      refreshTokenRepo.findOne.mockResolvedValue(stored);
      userRepo.findOne.mockResolvedValue({ ...baseUser, passwordHash });

      const result = await service.refresh('token-valido');

      expect(stored.revokedAt).not.toBeNull();
      expect(refreshTokenRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'rt-1', revokedAt: expect.any(Date) }),
      );
      expect(result.accessToken).toBe('signed.jwt.token');
    });

    it('rechaza con 401 cuando el refresh token ya fue revocado', async () => {
      refreshTokenRepo.findOne.mockResolvedValue({
        id: 'rt-1',
        userId: baseUser.id!,
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        revokedAt: new Date(),
      });

      await expect(service.refresh('token-usado')).rejects.toThrow(UnauthorizedException);
    });

    it('rechaza con 401 cuando el refresh token expiró', async () => {
      refreshTokenRepo.findOne.mockResolvedValue({
        id: 'rt-1',
        userId: baseUser.id!,
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() - 1000),
        revokedAt: null,
      });

      await expect(service.refresh('token-expirado')).rejects.toThrow(UnauthorizedException);
    });

    it('rechaza con 401 cuando el refresh token no existe', async () => {
      refreshTokenRepo.findOne.mockResolvedValue(null);

      await expect(service.refresh('token-inexistente')).rejects.toThrow(UnauthorizedException);
    });
  });
});
