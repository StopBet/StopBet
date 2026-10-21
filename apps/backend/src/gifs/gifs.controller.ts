import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { GifSearchResponse } from '@stopbet/shared-types';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { SearchGifsDto } from './dto/search-gifs.dto';
import { GifsService } from './gifs.service';

/** El buscador de GIFs del chat, con el filtro de apuestas aplicado en el servidor. */
@ApiTags('gifs')
@ApiBearerAuth()
@UseGuards(RolesGuard)
// Los mismos que pueden escribir en la comunidad y en los mensajes directos.
@Roles('patient', 'sponsor')
@Controller('gifs')
export class GifsController {
  constructor(private readonly service: GifsService) {}

  @Get()
  // Se busca mientras se escribe: el tope es para que una sesión no gaste la cuota de GIPHY.
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Buscar GIFs (sin texto: los del momento), sin contenido de apuestas' })
  @ApiResponse({ status: 200, description: 'GifSearchResponse; `blocked` si la búsqueda tenía un término bloqueado' })
  @ApiResponse({ status: 503, description: 'GIPHY sin configurar o caído' })
  buscar(@Query() dto: SearchGifsDto): Promise<GifSearchResponse> {
    return this.service.buscar(dto.q ?? '', dto.offset ?? 0);
  }
}
