import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'crypto';
import { AuthUser, JwtPayload, LoginResponse } from '@stopbet/shared-types';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    sedeId: user.sedeId,
  };
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string): Promise<LoginResponse> {
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    return this.issueTokens(user);
  }

  async refresh(refreshToken: string): Promise<LoginResponse> {
    const tokenHash = hashToken(refreshToken);
    const stored = await this.refreshTokenRepo.findOne({ where: { tokenHash } });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    const user = await this.userRepo.findOne({ where: { id: stored.userId } });
    if (!user) throw new UnauthorizedException('Usuario no encontrado');

    // Rotación: el refresh token usado queda inutilizable de inmediato
    stored.revokedAt = new Date();
    await this.refreshTokenRepo.save(stored);

    return this.issueTokens(user);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = hashToken(refreshToken);
    await this.refreshTokenRepo.update({ tokenHash }, { revokedAt: new Date() });
  }

  private async issueTokens(user: User): Promise<LoginResponse> {
    const payload: JwtPayload = { sub: user.id, role: user.role, sedeId: user.sedeId };
    const accessToken = this.jwtService.sign(payload, { expiresIn: ACCESS_TOKEN_TTL });

    const refreshToken = randomUUID() + randomUUID();
    await this.refreshTokenRepo.save(
      this.refreshTokenRepo.create({
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        revokedAt: null,
      }),
    );

    return { accessToken, refreshToken, user: toAuthUser(user) };
  }
}
