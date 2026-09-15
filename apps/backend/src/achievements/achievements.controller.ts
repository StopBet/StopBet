import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsOptional, IsString } from 'class-validator';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AchievementsService } from './achievements.service';

class RelapseBodyDto {
  @IsOptional()
  @IsString()
  devStartDate?: string;
}

class DevSetDaysDto {
  @IsOptional()
  days!: number;
}

@ApiTags('achievements')
@Controller('achievements')
export class AchievementsController {
  constructor(
    private readonly achievementsService: AchievementsService,
    private readonly config: ConfigService,
  ) {}

  // Railway corre con NODE_ENV=development (ver CLAUDE.md), así que NODE_ENV no distingue
  // producción: las herramientas de demo se encienden solo con una variable explícita.
  private devToolsEnabled(): boolean {
    return this.config.get<string>('ENABLE_DEV_TOOLS') === 'true';
  }

  @Get()
  @ApiOperation({ summary: 'Obtiene logros, insignias y ciclos históricos del paciente' })
  @ApiHeader({ name: 'x-user-id', description: 'UUID del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'AchievementsData' })
  getAchievements(@Headers('x-user-id') userId: string) {
    return this.achievementsService.getAchievements(userId);
  }

  @Post('relapse')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reporta una recaída y reinicia el contador de abstinencia' })
  @ApiHeader({ name: 'x-user-id', description: 'UUID del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Nuevo AbstinencePeriod' })
  reportRelapse(
    @Headers('x-user-id') userId: string,
    @Body() body: RelapseBodyDto,
  ) {
    const devStartDate = this.devToolsEnabled() ? body?.devStartDate : undefined;
    return this.achievementsService.reportRelapse(userId, devStartDate);
  }

  @Post('dev-set-days')
  @HttpCode(200)
  @ApiOperation({ summary: '[Dev] Sobreescribe los días de abstinencia del período actual' })
  @ApiHeader({ name: 'x-user-id', description: 'UUID del usuario' })
  @ApiResponse({ status: 404, description: 'Deshabilitado si ENABLE_DEV_TOOLS no es "true"' })
  devSetDays(
    @Headers('x-user-id') userId: string,
    @Body() body: DevSetDaysDto,
  ) {
    if (!this.devToolsEnabled()) throw new NotFoundException();
    return this.achievementsService.devSetDays(userId, body.days);
  }

  @Post('badges/:milestone/share')
  @HttpCode(200)
  @ApiOperation({ summary: 'Comparte una insignia en la comunidad de la sede' })
  @ApiHeader({ name: 'x-user-id', description: 'UUID del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Insignia marcada como compartida' })
  shareBadge(
    @Headers('x-user-id') userId: string,
    @Param('milestone', ParseIntPipe) milestone: number,
  ) {
    return this.achievementsService.shareBadge(userId, milestone);
  }
}
