import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
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
  constructor(private readonly achievementsService: AchievementsService) {}

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
    return this.achievementsService.reportRelapse(userId, body?.devStartDate);
  }

  @Post('dev-set-days')
  @HttpCode(200)
  @ApiOperation({ summary: '[Dev] Sobreescribe los días de abstinencia del período actual' })
  @ApiHeader({ name: 'x-user-id', description: 'UUID del usuario' })
  devSetDays(
    @Headers('x-user-id') userId: string,
    @Body() body: DevSetDaysDto,
  ) {
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
