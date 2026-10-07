import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserId } from '../common/decorators/user-id.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ChargeInvoiceDto } from './dto/charge-invoice.dto';
import { FinishInscriptionDto } from './dto/finish-inscription.dto';
import { RunDueChargesDto } from './dto/run-due-charges.dto';
import { InscriptionOutcome, OneclickPaymentsService } from './oneclick-payments.service';
import { ONECLICK_TEST_PAGE } from './oneclick-test-page';
import { TbkReturn, TbkReturnParams } from './tbk-return-params.decorator';

// SPIKE 2 CA6 — sandbox de Webpay Oneclick. Ningún paciente ni familiar lo usa todavía: las
// pantallas siguen con el pago simulado (docs/planning/spike2-pasarela-pago.md, §7).
@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('payments/oneclick')
export class OneclickController {
  constructor(
    private readonly payments: OneclickPaymentsService,
    private readonly config: ConfigService,
  ) {}

  // Igual que las herramientas de demo de `achievements`: NODE_ENV no distingue producción
  // (Railway corre con development), así que se exige una variable explícita.
  private requireDevTools(): void {
    if (this.config.get<string>('ENABLE_DEV_TOOLS') !== 'true') throw new NotFoundException();
  }

  // ── Inscripción de la tarjeta ─────────────────────────────────────────────────────────────

  @Post('inscriptions')
  @Roles('patient')
  @ApiOperation({ summary: 'Inicia la inscripción de una tarjeta: devuelve el token y la URL del formulario de Transbank' })
  @ApiResponse({ status: 201, description: '{ inscriptionId, token, urlWebpay } — el navegador debe hacer POST a urlWebpay con TBK_TOKEN' })
  @ApiResponse({ status: 409, description: 'Ya tiene una tarjeta inscrita' })
  @ApiResponse({ status: 503, description: 'Los pagos no están configurados' })
  startInscription(@UserId() userId: string) {
    return this.payments.startInscription(userId);
  }

  // A donde Transbank devuelve al paciente. Es público porque es una redirección del NAVEGADOR
  // (no una llamada de servidor a servidor) y el paciente llega sin nuestro token. Por eso mismo
  // NO cierra la inscripción: con solo el token cualquiera podría completar la tarjeta de otra
  // persona dentro de SU cuenta (quien abre el formulario le pasa el enlace a la víctima). Se
  // limita a reenviar los parámetros de Transbank a la página de resultado, que llama a
  // `POST inscriptions/finish` con la sesión del paciente. Responde siempre con una redirección,
  // nunca con un error. GET y POST: según la versión de la API, Transbank vuelve por uno u otro.
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Get('inscriptions/return')
  @ApiOperation({ summary: 'Retorno de Transbank tras el formulario de la tarjeta (GET). No cierra la inscripción' })
  @ApiResponse({ status: 303, description: 'Redirige a la página de resultado con los parámetros TBK_* para que el paciente cierre la inscripción con su sesión' })
  returnFromGet(@TbkReturn() params: TbkReturnParams, @Res() res: Response) {
    res.redirect(303, this.resultUrl(params));
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('inscriptions/return')
  @ApiOperation({ summary: 'Retorno de Transbank tras el formulario de la tarjeta (POST). No cierra la inscripción' })
  @ApiResponse({ status: 303, description: 'Redirige a la página de resultado con los parámetros TBK_* para que el paciente cierre la inscripción con su sesión' })
  returnFromPost(@TbkReturn() params: TbkReturnParams, @Res() res: Response) {
    res.redirect(303, this.resultUrl(params));
  }

  @Post('inscriptions/finish')
  @Roles('patient')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cierra la inscripción con lo que Transbank devolvió al navegador. Solo la puede cerrar quien la abrió' })
  @ApiResponse({ status: 200, description: '{ outcome: "ok" | "rechazada" | "anulada" | "error" }. Una inscripción ajena o inexistente responde "error"' })
  async finishInscription(
    @UserId() userId: string,
    @Body() dto: FinishInscriptionDto,
  ): Promise<{ outcome: InscriptionOutcome }> {
    const outcome = await this.payments.finishInscription(userId, {
      token: dto.token,
      abortedBuyOrder: dto.abortedBuyOrder ?? null,
      abortedSessionId: dto.abortedSessionId ?? null,
    });
    return { outcome };
  }

  @Get('inscription')
  @Roles('patient')
  @ApiOperation({ summary: 'Tarjeta inscrita del paciente (tipo y últimos 4 dígitos), o null' })
  @ApiResponse({ status: 200, description: 'InscriptionView | null' })
  getInscription(@UserId() userId: string) {
    return this.payments.getInscription(userId);
  }

  @Delete('inscription')
  @Roles('patient')
  @HttpCode(204)
  @ApiOperation({ summary: 'Elimina la tarjeta inscrita, en Transbank y acá' })
  @ApiResponse({ status: 204, description: 'Tarjeta eliminada' })
  @ApiResponse({ status: 404, description: 'No tiene una tarjeta inscrita' })
  async deleteInscription(@UserId() userId: string): Promise<void> {
    await this.payments.deleteInscription(userId);
  }

  // ── Cobros ────────────────────────────────────────────────────────────────────────────────

  @Post('charges')
  @Roles('patient')
  @ApiOperation({ summary: 'Cobro 1: el paciente paga una cuota con su tarjeta inscrita' })
  @ApiResponse({ status: 201, description: 'ChargeView — status authorized | rejected | error' })
  @ApiResponse({ status: 409, description: 'Sin tarjeta, o la cuota ya está pagada o tiene un cobro en curso' })
  chargeInvoice(@UserId() userId: string, @Body() dto: ChargeInvoiceDto) {
    return this.payments.chargeInvoice(userId, 'user', dto.invoiceId);
  }

  @Get('charges')
  @Roles('patient')
  @ApiOperation({ summary: 'Cobros del paciente, el más reciente primero' })
  @ApiResponse({ status: 200, description: 'ChargeView[]' })
  listCharges(@UserId() userId: string) {
    return this.payments.listCharges(userId);
  }

  // Cobro 2: lo dispara el backend, sin que el paciente inicie sesión ni haga nada. En producción
  // lo haría el cron diario; este endpoint existe para poder mostrarlo en el momento (CA6).
  @Post('charges/run-due')
  @Roles('coordinator')
  @HttpCode(200)
  @ApiOperation({ summary: '[Dev] Cobro 2: cobra sin el paciente las cuotas vencidas de quienes tienen tarjeta' })
  @ApiResponse({ status: 200, description: 'DueChargeSummary[]' })
  @ApiResponse({ status: 404, description: 'Deshabilitado si ENABLE_DEV_TOOLS no es "true"' })
  runDue(@Body() dto: RunDueChargesDto) {
    this.requireDevTools();
    return this.payments.chargeDueInvoices(dto.asOf);
  }

  @Get('charges/:id/transbank-status')
  @Roles('coordinator')
  @ApiOperation({ summary: '[Dev] Estado de un cobro según Transbank (la evidencia del CA6)' })
  @ApiResponse({ status: 200, description: 'TransbankStatusView' })
  @ApiResponse({ status: 404, description: 'Deshabilitado si ENABLE_DEV_TOOLS no es "true", o el cobro no existe' })
  transbankStatus(@Param('id', ParseUUIDPipe) id: string) {
    this.requireDevTools();
    return this.payments.transbankStatus(id);
  }

  // ── Página de prueba ──────────────────────────────────────────────────────────────────────

  @Public()
  @Get('test-page')
  @ApiProduces('text/html')
  @ApiOperation({ summary: '[Dev] Página mínima para recorrer el sandbox de Oneclick en un navegador' })
  @ApiResponse({ status: 404, description: 'Deshabilitado si ENABLE_DEV_TOOLS no es "true"' })
  testPage(@Res() res: Response) {
    this.requireDevTools();
    res.type('html').send(ONECLICK_TEST_PAGE);
  }

  // Reenvía lo que Transbank dejó en la URL de retorno. El token viaja en la URL, pero solo sirve
  // con la sesión de quien abrió la inscripción: sin ella `finish` responde «error».
  private resultUrl(params: TbkReturnParams): string {
    const configured = this.config.get<string>('TBK_RESULT_URL')?.trim();
    const base = this.config.get<string>('BACKEND_PUBLIC_URL')?.trim().replace(/\/$/, '');
    const fallback = `${base || `http://localhost:${this.config.get<string>('PORT') ?? '3000'}`}/payments/oneclick/test-page`;
    const url = new URL(configured || fallback);
    if (params.token) {
      url.searchParams.set('TBK_TOKEN', params.token);
      if (params.abortedBuyOrder) url.searchParams.set('TBK_ORDEN_COMPRA', params.abortedBuyOrder);
      if (params.abortedSessionId) url.searchParams.set('TBK_ID_SESION', params.abortedSessionId);
    } else {
      url.searchParams.set('inscripcion', 'error');
    }
    return url.toString();
  }
}
