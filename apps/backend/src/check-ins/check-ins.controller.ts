import { Body, Controller, Delete, Get, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserId } from '../common/decorators/user-id.decorator';
import { CheckInsService } from './check-ins.service';
import { CreateCheckInDto } from './dto/create-check-in.dto';

@ApiTags('check-ins')
@ApiBearerAuth()
@Controller('check-ins')
export class CheckInsController {
  constructor(private readonly checkInsService: CheckInsService) {}

  @Get('today')
  @ApiOperation({ summary: 'Obtiene el check-in de hoy del paciente (null si no existe)' })
  @ApiResponse({ status: 200, description: 'CheckIn | null' })
  getToday(@UserId() userId: string) {
    return this.checkInsService.getToday(userId);
  }

  @Delete('today')
  @HttpCode(200)
  @ApiOperation({ summary: '[DEMO] Borra el check-in de hoy para volver a registrarlo' })
  @ApiResponse({ status: 200, description: '{ deleted: boolean }' })
  deleteToday(@UserId() userId: string) {
    return this.checkInsService.deleteToday(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Registra el check-in emocional diario' })
  @ApiResponse({ status: 201, description: 'CheckIn creado' })
  @ApiResponse({ status: 409, description: 'Ya existe un check-in hoy' })
  create(@UserId() userId: string, @Body() dto: CreateCheckInDto) {
    return this.checkInsService.create(userId, dto);
  }
}
