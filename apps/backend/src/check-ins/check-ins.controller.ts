import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CheckInsService } from './check-ins.service';
import { CreateCheckInDto } from './dto/create-check-in.dto';

@ApiTags('check-ins')
@Controller('check-ins')
export class CheckInsController {
  constructor(private readonly checkInsService: CheckInsService) {}

  @Get('today')
  @ApiOperation({ summary: 'Obtiene el check-in de hoy del paciente (null si no existe)' })
  @ApiHeader({ name: 'x-user-id', description: 'UUID del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'CheckIn | null' })
  getToday(@Headers('x-user-id') userId: string) {
    return this.checkInsService.getToday(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Registra el check-in emocional diario' })
  @ApiHeader({ name: 'x-user-id', description: 'UUID del usuario autenticado' })
  @ApiResponse({ status: 201, description: 'CheckIn creado' })
  @ApiResponse({ status: 409, description: 'Ya existe un check-in hoy' })
  create(@Headers('x-user-id') userId: string, @Body() dto: CreateCheckInDto) {
    return this.checkInsService.create(userId, dto);
  }
}
