import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { LoginResponse } from '@stopbet/shared-types';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  // El límite global es alto a propósito para no estorbar al dashboard; acá abajo
  // sí conviene apretar, porque es el único endpoint donde adivinar a repetición
  // tiene sentido para un atacante (S.9).
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Login con email y contraseña — emite access y refresh token' })
  @ApiResponse({ status: 200, description: 'LoginResponse' })
  @ApiResponse({ status: 401, description: 'Credenciales incorrectas' })
  @ApiResponse({ status: 429, description: 'Demasiados intentos de login' })
  login(@Body() body: LoginDto): Promise<LoginResponse> {
    return this.authService.login(body.email, body.password);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rota el refresh token y emite un nuevo par de tokens' })
  @ApiResponse({ status: 200, description: 'LoginResponse' })
  @ApiResponse({ status: 401, description: 'Refresh token inválido o expirado' })
  refresh(@Body() body: RefreshDto): Promise<LoginResponse> {
    return this.authService.refresh(body.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Revoca el refresh token' })
  @ApiResponse({ status: 200, description: 'Sesión cerrada' })
  logout(@Body() body: RefreshDto): Promise<void> {
    return this.authService.logout(body.refreshToken);
  }
}
