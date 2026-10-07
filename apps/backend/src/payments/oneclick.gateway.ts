import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Environment,
  IntegrationApiKeys,
  IntegrationCommerceCodes,
  Oneclick,
  Options,
  TransactionDetail,
} from 'transbank-sdk';
import { chileWallClockToDate } from '../common/chile-date';

export interface InscriptionStart {
  token: string;
  urlWebpay: string;
}

export interface InscriptionFinish {
  approved: boolean;
  responseCode: number;
  tbkUser: string | null;
  cardType: string | null;
  cardLast4: string | null;
  authorizationCode: string | null;
}

export interface ChargeRequest {
  username: string;
  tbkUser: string;
  parentBuyOrder: string;
  childBuyOrder: string;
  amountCLP: number;
}

export interface ChargeResult {
  approved: boolean;
  status: string | null;
  responseCode: number | null;
  authorizationCode: string | null;
  paymentTypeCode: string | null;
  installments: number | null;
  transactionDate: Date | null;
}

// Única puerta hacia `transbank-sdk`. Dos razones para que sea un archivo aparte:
// - El SDK devuelve `Promise<any>` en todos sus métodos y el repo no admite `any`: acá cada
//   respuesta se lee como `unknown` y se valida antes de tipar.
// - Cambiar de pasarela (Flow es el respaldo, ver docs/planning/spike2-pasarela-pago.md) tiene
//   que tocar este archivo y nada más.
//
// Igual que MailService y PushService, es opcional y se apaga solo: sin configuración de
// producción el backend arranca igual y los endpoints responden 503. Sin ninguna variable usa
// el ambiente de INTEGRACIÓN de Transbank, cuyas credenciales son públicas: no se cobra nada real.
@Injectable()
export class OneclickGateway implements OnModuleInit {
  private readonly logger = new Logger(OneclickGateway.name);
  private inscription: InstanceType<typeof Oneclick.MallInscription> | null = null;
  private transaction: InstanceType<typeof Oneclick.MallTransaction> | null = null;
  private childCommerceCode = '';

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const production = this.config.get<string>('TBK_ENVIRONMENT')?.trim() === 'production';
    const commerceCode =
      this.config.get<string>('TBK_ONECLICK_COMMERCE_CODE')?.trim() ||
      (production ? '' : IntegrationCommerceCodes.ONECLICK_MALL);
    const childCode =
      this.config.get<string>('TBK_ONECLICK_CHILD_COMMERCE_CODE')?.trim() ||
      (production ? '' : IntegrationCommerceCodes.ONECLICK_MALL_CHILD1);
    const apiKey =
      this.config.get<string>('TBK_API_KEY')?.trim() || (production ? '' : IntegrationApiKeys.WEBPAY);

    if (!commerceCode || !childCode || !apiKey) {
      this.logger.warn(
        'Webpay Oneclick sin configurar en producción (TBK_ONECLICK_COMMERCE_CODE, ' +
          'TBK_ONECLICK_CHILD_COMMERCE_CODE y TBK_API_KEY): los pagos quedan desactivados',
      );
      return;
    }

    const environment = production ? Environment.Production : Environment.Integration;
    this.inscription = new Oneclick.MallInscription(new Options(commerceCode, apiKey, environment));
    this.transaction = new Oneclick.MallTransaction(new Options(commerceCode, apiKey, environment));
    this.childCommerceCode = childCode;
    this.logger.log(`Webpay Oneclick listo (${production ? 'PRODUCCIÓN' : 'integración'})`);
  }

  isEnabled(): boolean {
    return this.inscription !== null && this.transaction !== null;
  }

  async startInscription(username: string, email: string, responseUrl: string): Promise<InscriptionStart> {
    const raw: unknown = await this.client().inscription.start(username, email, responseUrl);
    const token = readString(raw, 'token');
    const urlWebpay = readString(raw, 'url_webpay');
    if (!token || !urlWebpay) throw new Error('Respuesta inesperada de Transbank al iniciar la inscripción');
    return { token, urlWebpay };
  }

  async finishInscription(token: string): Promise<InscriptionFinish> {
    const raw: unknown = await this.client().inscription.finish(token);
    const responseCode = readNumber(raw, 'response_code');
    if (responseCode === null) throw new Error('Respuesta inesperada de Transbank al cerrar la inscripción');
    return {
      approved: responseCode === 0,
      responseCode,
      tbkUser: readString(raw, 'tbk_user'),
      cardType: readString(raw, 'card_type'),
      cardLast4: lastDigits(readString(raw, 'card_number'), 4),
      authorizationCode: readString(raw, 'authorization_code'),
    };
  }

  async deleteInscription(tbkUser: string, username: string): Promise<void> {
    await this.client().inscription.delete(tbkUser, username);
  }

  async authorize(request: ChargeRequest): Promise<ChargeResult> {
    const { transaction } = this.client();
    const raw: unknown = await transaction.authorize(request.username, request.tbkUser, request.parentBuyOrder, [
      new TransactionDetail(request.amountCLP, this.childCommerceCode, request.childBuyOrder, 1),
    ]);
    return toChargeResult(raw);
  }

  // Consulta a Transbank qué pasó con un cobro. Se usa cuando el `authorize` se cortó a medias
  // (timeout, red) y no sabemos si la tarjeta llegó a cobrarse.
  async chargeStatus(parentBuyOrder: string): Promise<ChargeResult> {
    const raw: unknown = await this.client().transaction.status(parentBuyOrder);
    return toChargeResult(raw);
  }

  private client(): {
    inscription: InstanceType<typeof Oneclick.MallInscription>;
    transaction: InstanceType<typeof Oneclick.MallTransaction>;
  } {
    if (!this.inscription || !this.transaction) {
      throw new Error('Webpay Oneclick no está configurado');
    }
    return { inscription: this.inscription, transaction: this.transaction };
  }
}

// ── Lectura segura de las respuestas del SDK (todas llegan como `any`) ──────────────────────

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function readString(raw: unknown, key: string): string | null {
  const value = asRecord(raw)?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readNumber(raw: unknown, key: string): number | null {
  const value = asRecord(raw)?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

// El número viene enmascarado o solo con los últimos dígitos según la versión de la API: se
// dejan únicamente los dígitos y se conservan los últimos 4. Nunca se guarda más que eso.
function lastDigits(value: string | null, count: number): string | null {
  const digits = value?.replace(/\D/g, '') ?? '';
  return digits.length > 0 ? digits.slice(-count) : null;
}

// Aprobado = `response_code` 0 Y `status` AUTHORIZED en CADA detalle. El ejemplo del propio SDK
// mira un `status` de nivel superior que esta respuesta no trae: por eso se lee `details`.
export function toChargeResult(raw: unknown): ChargeResult {
  const details = asRecord(raw)?.details;
  const list = Array.isArray(details) ? details : [];
  const first = asRecord(list[0]);
  const approved =
    list.length > 0 &&
    list.every((d) => {
      const detail = asRecord(d);
      return readNumber(detail, 'response_code') === 0 && readString(detail, 'status') === 'AUTHORIZED';
    });

  // `transaction_date` llega en hora de Chile con sufijo `Z`: ver chileWallClockToDate.
  const date = readString(raw, 'transaction_date');
  const parsed = date ? chileWallClockToDate(date) : null;
  return {
    approved,
    status: readString(first, 'status'),
    responseCode: readNumber(first, 'response_code'),
    authorizationCode: readString(first, 'authorization_code'),
    paymentTypeCode: readString(first, 'payment_type_code'),
    installments: readNumber(first, 'installments_number'),
    transactionDate: parsed,
  };
}
