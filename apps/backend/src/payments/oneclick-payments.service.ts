import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { DataSource, In, LessThanOrEqual, QueryFailedError, Repository } from 'typeorm';
import { BillingService } from '../billing/billing.service';
import { Invoice } from '../billing/entities/invoice.entity';
import { todayInChile } from '../common/chile-date';
import { User } from '../users/entities/user.entity';
import { PaymentCharge, PaymentChargeStatus, PaymentChargeTrigger } from './entities/payment-charge.entity';
import { PaymentInscription, PaymentInscriptionStatus } from './entities/payment-inscription.entity';
import { ChargeResult, OneclickGateway } from './oneclick.gateway';
import { TbkReturnParams } from './tbk-return-params.decorator';

const PG_UNIQUE_VIOLATION = '23505';
const BUY_ORDER_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export type InscriptionOutcome = 'ok' | 'rechazada' | 'anulada' | 'error';

export interface InscriptionStarted {
  inscriptionId: string;
  token: string;
  urlWebpay: string;
}

export interface InscriptionView {
  id: string;
  status: PaymentInscriptionStatus;
  cardType: string | null;
  cardLast4: string | null;
  createdAt: string;
}

export interface ChargeView {
  id: string;
  invoiceId: string;
  amountCLP: number;
  triggeredBy: PaymentChargeTrigger;
  status: PaymentChargeStatus;
  buyOrder: string;
  responseCode: number | null;
  authorizationCode: string | null;
  transactionDate: string | null;
  createdAt: string;
}

// Lo que el familiar ve al pagar (HdU12 CA5 y CA6): cuáles cuotas se cobraron y cuáles no, con lo
// necesario para armar el comprobante. Nada de la tarjeta salvo el tipo y los últimos 4 dígitos.
export interface FamilyPaymentItem {
  chargeId: string;
  invoiceId: string;
  month: string;
  amountCLP: number;
  status: PaymentChargeStatus;
  buyOrder: string;
  authorizationCode: string | null;
  transactionDate: string | null;
}

export interface FamilyPaymentView {
  // `paid`: todas las pedidas. `partial`: se cobraron algunas y se frenó en la primera que falló.
  status: 'paid' | 'partial' | 'rejected' | 'error' | 'processing';
  items: FamilyPaymentItem[];
  totalPaidCLP: number;
  paidAt: string | null;
  card: { cardType: string | null; cardLast4: string | null };
}

export interface DueChargeSummary {
  invoiceId: string;
  month: string;
  result: 'authorized' | 'rejected' | 'error' | 'processing' | 'skipped';
  chargeId: string | null;
  buyOrder: string | null;
  responseCode: number | null;
  authorizationCode: string | null;
}

export interface TransbankStatusView {
  buyOrder: string;
  approved: boolean;
  status: string | null;
  responseCode: number | null;
  authorizationCode: string | null;
  transactionDate: string | null;
}

// Qué se supo de un cobro cuando el `authorize` falló: `result` (Transbank sí lo procesó, y dijo
// qué pasó), `closed` (Transbank confirmó que no se hizo: el cobro ya quedó como error) o
// `unknown` (no se pudo saber).
type GatewayErrorOutcome =
  | { kind: 'result'; result: ChargeResult }
  | { kind: 'closed' }
  | { kind: 'unknown' };

function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof QueryFailedError && (err.driverError as { code?: string } | undefined)?.code === PG_UNIQUE_VIOLATION
  );
}

// El SDK envuelve TODO error de axios en un TransbankError de texto, sin código estructurado:
// un rechazo HTTP y un corte de red se ven igual salvo por el mensaje. Una respuesta 4xx quiere
// decir que Transbank contestó que NO hizo la operación (credencial inválida, `tbk_user`
// inexistente, transacción desconocida). Cualquier otra cosa (5xx, timeout, red) es
// indeterminada: puede que Transbank sí cobrara y la respuesta se perdiera.
export function answeredWithClientError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /status code 4\d\d/.test(message);
}

// Órdenes de compra de Transbank: únicas, hasta 26 caracteres. Solo [A-Z0-9], sin nada del
// paciente: viajan a un tercero y quedan en sus registros.
export function newBuyOrder(now: number = Date.now()): string {
  const time = now.toString(36).toUpperCase();
  const bytes = randomBytes(6);
  const suffix = Array.from(bytes, (b) => BUY_ORDER_ALPHABET[b % BUY_ORDER_ALPHABET.length]).join('');
  return `SB${time}${suffix}`;
}

@Injectable()
export class OneclickPaymentsService {
  private readonly logger = new Logger(OneclickPaymentsService.name);

  constructor(
    @InjectRepository(PaymentInscription)
    private readonly inscriptionRepo: Repository<PaymentInscription>,
    @InjectRepository(PaymentCharge)
    private readonly chargeRepo: Repository<PaymentCharge>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly gateway: OneclickGateway,
    private readonly billing: BillingService,
    private readonly config: ConfigService,
  ) {}

  // ── Inscripción de la tarjeta ─────────────────────────────────────────────────────────────

  async startInscription(userId: string): Promise<InscriptionStarted> {
    this.assertEnabled();

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const active = await this.inscriptionRepo.findOne({ where: { userId, status: 'active' } });
    if (active) throw new ConflictException('Ya tienes una tarjeta inscrita');

    const { token, urlWebpay } = await this.gateway.startInscription(userId, user.email, this.returnUrl());
    const saved = await this.inscriptionRepo.save(
      this.inscriptionRepo.create({ userId, username: userId, token, status: 'pending' }),
    );
    this.logger.log(`Inscripción ${saved.id} iniciada`);
    return { inscriptionId: saved.id, token, urlWebpay };
  }

  // Lo llama el paciente CON su sesión, nunca el retorno público de Transbank. Si cerrara la
  // inscripción solo con el token, quien abre un formulario con su propia cuenta podría hacer que
  // otra persona lo complete y quedarse con la tarjeta de esa persona atada a su cuenta. Por eso la
  // inscripción tiene que ser de quien llama; una ajena responde igual que una que no existe.
  // Es idempotente: volver a abrir la página de retorno no llama de nuevo a Transbank (el token ya
  // se consumió y volver a cerrarlo fallaría).
  async finishInscription(userId: string, params: TbkReturnParams): Promise<InscriptionOutcome> {
    if (!params.token) return 'error';

    const inscription = await this.inscriptionRepo.findOne({ where: { token: params.token } });
    if (!inscription || inscription.userId !== userId) return 'error';
    if (inscription.status !== 'pending') return this.outcomeOf(inscription.status);

    if (params.abortedBuyOrder) {
      await this.inscriptionRepo.update(
        { id: inscription.id, status: 'pending' },
        { status: 'aborted', finishedAt: new Date() },
      );
      this.logger.log(`Inscripción ${inscription.id} anulada por el paciente`);
      return 'anulada';
    }

    try {
      const finished = await this.gateway.finishInscription(params.token);
      if (!finished.approved || !finished.tbkUser) {
        await this.inscriptionRepo.update(
          { id: inscription.id, status: 'pending' },
          { status: 'failed', responseCode: finished.responseCode, finishedAt: new Date() },
        );
        this.logger.warn(`Inscripción ${inscription.id} rechazada (código ${finished.responseCode})`);
        return 'rechazada';
      }

      try {
        await this.inscriptionRepo.update(
          { id: inscription.id, status: 'pending' },
          {
            status: 'active',
            tbkUser: finished.tbkUser,
            cardType: finished.cardType,
            cardLast4: finished.cardLast4,
            authorizationCode: finished.authorizationCode,
            responseCode: finished.responseCode,
            finishedAt: new Date(),
          },
        );
      } catch (err) {
        // Otra inscripción del mismo paciente se activó mientras esta estaba abierta (el índice
        // único admite una sola). La de Transbank quedó creada igual: se borra para no dejar una
        // credencial de cobro que nadie usa.
        if (!isUniqueViolation(err)) throw err;
        await this.gateway.deleteInscription(finished.tbkUser, inscription.username).catch(() => undefined);
        await this.inscriptionRepo.update({ id: inscription.id }, { status: 'failed', finishedAt: new Date() });
        return 'error';
      }
      this.logger.log(`Inscripción ${inscription.id} activa`);
      return 'ok';
    } catch {
      await this.inscriptionRepo.update(
        { id: inscription.id, status: 'pending' },
        { status: 'failed', finishedAt: new Date() },
      );
      this.logger.warn(`Inscripción ${inscription.id} falló al cerrarse con Transbank`);
      return 'error';
    }
  }

  async getInscription(userId: string): Promise<InscriptionView | null> {
    const inscription = await this.inscriptionRepo.findOne({ where: { userId, status: 'active' } });
    return inscription ? this.toInscriptionView(inscription) : null;
  }

  async deleteInscription(userId: string): Promise<void> {
    this.assertEnabled();
    const inscription = await this.inscriptionRepo.findOne({ where: { userId, status: 'active' } });
    if (!inscription || !inscription.tbkUser) throw new NotFoundException('No tienes una tarjeta inscrita');

    try {
      await this.gateway.deleteInscription(inscription.tbkUser, inscription.username);
    } catch {
      throw new ServiceUnavailableException('No pudimos eliminar la tarjeta en Transbank. Inténtalo de nuevo');
    }
    await this.inscriptionRepo.update({ id: inscription.id }, { status: 'deleted', finishedAt: new Date() });
  }

  // ── Cobros ────────────────────────────────────────────────────────────────────────────────

  // Cobra UNA cuota con la tarjeta enrolada. `triggeredBy` solo deja constancia de quién lo pidió:
  // el paciente (cobro 1) o el backend por su cuenta (cobro 2, sin interacción).
  async chargeInvoice(userId: string, triggeredBy: PaymentChargeTrigger, invoiceId?: string): Promise<ChargeView> {
    this.assertEnabled();

    // Suspender una cuenta cierra su acceso: ningún cobro, y menos el automático que no tiene
    // sesión, debe pasar por encima de eso. En el lote queda como «skipped».
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || user.accountStatus !== 'active') throw new ConflictException('La cuenta no está activa: no se cobra');

    const inscription = await this.inscriptionRepo.findOne({ where: { userId, status: 'active' } });
    if (!inscription || !inscription.tbkUser) throw new ConflictException('Primero inscribe una tarjeta');

    const invoice = await this.pickInvoice(userId, invoiceId);
    return this.runCharge({ inscription, invoice, payerId: userId, triggeredBy, reactivateAccount: false });
  }

  // HdU12: el familiar paga cuotas del paciente vinculado con SU tarjeta. `patientId` lo resuelve el
  // controlador desde el vínculo activo, nunca desde el cuerpo. A diferencia del cobro del paciente,
  // acá sí se acepta una cuenta suspendida: es justamente lo que el familiar viene a regularizar, y
  // quien la reabre es una persona con sesión, no un cobro sin nadie detrás (CA2). Se cobra de a una,
  // en orden de vencimiento, y se frena en la primera que no se autoriza para no seguir cobrando
  // sobre una tarjeta que ya falló (CA5): las anteriores quedan pagadas y las siguientes, intactas.
  async chargeInvoicesForFamily(
    familyUserId: string,
    patientId: string,
    invoiceIds: string[],
  ): Promise<FamilyPaymentView> {
    this.assertEnabled();

    const inscription = await this.inscriptionRepo.findOne({ where: { userId: familyUserId, status: 'active' } });
    if (!inscription || !inscription.tbkUser) throw new ConflictException('Primero inscribe una tarjeta');

    const invoices = await this.pickInvoicesOf(patientId, invoiceIds);

    const items: FamilyPaymentItem[] = [];
    for (const invoice of invoices) {
      let charge: ChargeView;
      try {
        charge = await this.runCharge({
          inscription,
          invoice,
          payerId: familyUserId,
          triggeredBy: 'user',
          reactivateAccount: true,
        });
      } catch (err) {
        // Un cobro en curso de esa cuota (otra pestaña, un doble clic) no debe esconder lo que ya se
        // pagó en este mismo pedido. Si fue la primera, no hay nada que informar y se propaga.
        if (items.length === 0 || !(err instanceof ConflictException)) throw err;
        break;
      }
      items.push({
        chargeId: charge.id,
        invoiceId: invoice.id,
        month: invoice.month,
        amountCLP: invoice.amountCLP,
        status: charge.status,
        buyOrder: charge.buyOrder,
        authorizationCode: charge.authorizationCode,
        transactionDate: charge.transactionDate,
      });
      if (charge.status !== 'authorized') break;
    }

    return this.toFamilyPaymentView(items, invoices.length, inscription);
  }

  // El cobro automático: recorre las cuotas vencidas de quienes tienen tarjeta y las cobra sin
  // que nadie inicie sesión. No hay `userId` de una sesión: el cobro sale del backend.
  async chargeDueInvoices(asOf: string = todayInChile()): Promise<DueChargeSummary[]> {
    this.assertEnabled();

    const active = await this.inscriptionRepo.find({ where: { status: 'active' } });
    const userIds = [...new Set(active.map((i) => i.userId))];
    if (userIds.length === 0) return [];

    const due = await this.invoiceRepo.find({
      where: { userId: In(userIds), status: In(['overdue', 'pending']), dueDate: LessThanOrEqual(asOf) },
      order: { dueDate: 'ASC' },
    });

    const summary: DueChargeSummary[] = [];
    for (const invoice of due) {
      try {
        const charge = await this.chargeInvoice(invoice.userId, 'automatic', invoice.id);
        summary.push(this.summaryOf(invoice, charge.status, charge));
      } catch (err) {
        // Un fallo no debe frenar a los demás: es un lote.
        const skipped = err instanceof ConflictException;
        if (!skipped) this.logger.error(`Cobro automático de la cuota ${invoice.id} falló`);
        summary.push(this.summaryOf(invoice, skipped ? 'skipped' : 'error', null));
      }
    }
    return summary;
  }

  // Apagado por omisión: Railway comparte una base de demo con cuentas sembradas, y un cron que
  // cobra todos los días no debería correr ahí sin que alguien lo pida.
  @Cron('0 9 * * *', { timeZone: 'America/Santiago' })
  async runScheduledCharges(): Promise<void> {
    if (this.config.get<string>('TBK_AUTO_CHARGE_CRON') !== 'true' || !this.gateway.isEnabled()) return;
    const summary = await this.chargeDueInvoices();
    const authorized = summary.filter((s) => s.result === 'authorized').length;
    this.logger.log(`Cobro automático: ${authorized} autorizados de ${summary.length}`);
  }

  async listCharges(userId: string): Promise<ChargeView[]> {
    const charges = await this.chargeRepo.find({ where: { userId }, order: { createdAt: 'DESC' } });
    return charges.map((c) => this.toChargeView(c));
  }

  // Lo que Transbank mismo dice de un cobro: es la evidencia de que no nos inventamos el resultado.
  async transbankStatus(chargeId: string): Promise<TransbankStatusView> {
    this.assertEnabled();
    const charge = await this.chargeRepo.findOne({ where: { id: chargeId } });
    if (!charge) throw new NotFoundException('Cobro no encontrado');

    let result: ChargeResult;
    try {
      result = await this.gateway.chargeStatus(charge.parentBuyOrder);
    } catch {
      throw new ServiceUnavailableException('Transbank no pudo informar el estado de ese cobro');
    }
    return {
      buyOrder: charge.parentBuyOrder,
      approved: result.approved,
      status: result.status,
      responseCode: result.responseCode,
      authorizationCode: result.authorizationCode,
      transactionDate: result.transactionDate?.toISOString() ?? null,
    };
  }

  // ── Internos ──────────────────────────────────────────────────────────────────────────────

  private assertEnabled(): void {
    if (!this.gateway.isEnabled()) throw new ServiceUnavailableException('Los pagos no están configurados');
  }

  private returnUrl(): string {
    const base = this.config.get<string>('BACKEND_PUBLIC_URL')?.trim().replace(/\/$/, '');
    return `${base || `http://localhost:${this.config.get<string>('PORT') ?? '3000'}`}/payments/oneclick/inscriptions/return`;
  }

  private outcomeOf(status: PaymentInscriptionStatus): InscriptionOutcome {
    if (status === 'active') return 'ok';
    if (status === 'aborted') return 'anulada';
    if (status === 'failed') return 'rechazada';
    return 'error';
  }

  private async pickInvoice(userId: string, invoiceId?: string): Promise<Invoice> {
    let invoice: Invoice | null;
    if (invoiceId) {
      invoice = await this.invoiceRepo.findOne({ where: { id: invoiceId, userId } });
      if (!invoice) throw new NotFoundException('Cuota no encontrada');
    } else {
      [invoice = null] = await this.invoiceRepo.find({
        where: { userId, status: In(['overdue', 'pending']) },
        order: { dueDate: 'ASC' },
        take: 1,
      });
      if (!invoice) throw new NotFoundException('No tienes cuotas por pagar');
    }
    if (invoice.status === 'paid') throw new ConflictException('Esa cuota ya está pagada');
    return invoice;
  }

  // Lo que comparten todos los cobros: fila en `processing` ANTES de llamar a Transbank, `authorize`
  // y cierre. `payerId` es quien puso la tarjeta; el dueño de la cuota es `invoice.userId`.
  private async runCharge(opts: {
    inscription: PaymentInscription;
    invoice: Invoice;
    payerId: string;
    triggeredBy: PaymentChargeTrigger;
    reactivateAccount: boolean;
  }): Promise<ChargeView> {
    const { inscription, invoice, payerId, triggeredBy, reactivateAccount } = opts;

    const parentBuyOrder = newBuyOrder();
    const created = this.chargeRepo.create({
      userId: invoice.userId,
      payerUserId: payerId === invoice.userId ? null : payerId,
      invoiceId: invoice.id,
      inscriptionId: inscription.id,
      parentBuyOrder,
      childBuyOrder: `${parentBuyOrder}1`,
      amountCLP: invoice.amountCLP,
      triggeredBy,
      status: 'processing',
    });
    // La fila va ANTES de llamar a Transbank. Si dos pedidos intentan cobrar la misma cuota, el
    // índice único hace perder al segundo sin que Transbank llegue a enterarse.
    let charge: PaymentCharge;
    try {
      charge = await this.chargeRepo.save(created);
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictException('Esa cuota ya tiene un cobro en curso o pagado');
      throw err;
    }

    let outcome: GatewayErrorOutcome;
    try {
      const result = await this.gateway.authorize({
        username: inscription.username,
        tbkUser: inscription.tbkUser as string,
        parentBuyOrder,
        childBuyOrder: charge.childBuyOrder,
        amountCLP: invoice.amountCLP,
      });
      outcome = { kind: 'result', result };
    } catch (err) {
      outcome = await this.resolveAfterGatewayError(charge, err);
    }

    if (outcome.kind === 'result') return this.recordResult(charge, invoice, outcome.result, reactivateAccount);
    if (outcome.kind === 'closed') return this.toChargeView(charge);

    // Transbank no contestó y tampoco pudo confirmar qué pasó: se deja `processing`, que mantiene
    // la cuota bloqueada. Es a propósito: liberarla arriesga cobrarle dos veces a quien sí pagó.
    this.logger.error(`Cobro ${charge.id} quedó sin confirmar: requiere conciliación con Transbank`);
    return this.toChargeView(charge);
  }

  // Todas las cuotas pedidas tienen que ser del paciente y estar sin pagar, o no se cobra ninguna.
  // Una ajena responde igual que una inexistente. Salen por orden de vencimiento.
  private async pickInvoicesOf(ownerId: string, invoiceIds: string[]): Promise<Invoice[]> {
    const ids = [...new Set(invoiceIds)];
    const found = await this.invoiceRepo.find({ where: { id: In(ids), userId: ownerId }, order: { dueDate: 'ASC' } });
    if (found.length !== ids.length) throw new NotFoundException('Cuota no encontrada');
    if (found.some((i) => i.status === 'paid')) throw new ConflictException('Una de las cuotas ya está pagada');
    return found;
  }

  // El `authorize` falló. ¿Se cobró o no? Ver `answeredWithClientError`.
  private async resolveAfterGatewayError(charge: PaymentCharge, err: unknown): Promise<GatewayErrorOutcome> {
    if (answeredWithClientError(err)) {
      await this.closeAsError(charge);
      this.logger.warn(`Cobro ${charge.id} rechazado por Transbank antes de procesarse`);
      return { kind: 'closed' };
    }

    try {
      return { kind: 'result', result: await this.gateway.chargeStatus(charge.parentBuyOrder) };
    } catch (statusErr) {
      if (answeredWithClientError(statusErr)) {
        // Transbank no conoce esa orden de compra: el cobro nunca llegó a hacerse.
        await this.closeAsError(charge);
        return { kind: 'closed' };
      }
      return { kind: 'unknown' };
    }
  }

  private async closeAsError(charge: PaymentCharge): Promise<void> {
    await this.chargeRepo.update({ id: charge.id, status: 'processing' }, { status: 'error' });
    charge.status = 'error';
  }

  private async recordResult(
    charge: PaymentCharge,
    invoice: Invoice,
    result: ChargeResult,
    reactivateAccount: boolean,
  ): Promise<ChargeView> {
    const fields = {
      responseCode: result.responseCode,
      authorizationCode: result.authorizationCode,
      paymentTypeCode: result.paymentTypeCode,
      installmentsNumber: result.installments,
      transactionDate: result.transactionDate,
    };

    if (result.approved) {
      // El cobro y la cuota cambian juntos: o la cuota queda pagada con su cobro autorizado, o
      // ninguna de las dos cosas. El update es condicional por si otro camino ya cerró este cobro.
      await this.dataSource.transaction(async (manager) => {
        const updated = await manager
          .getRepository(PaymentCharge)
          .update({ id: charge.id, status: 'processing' }, { status: 'authorized', ...fields });
        if (!updated.affected) return;
        await this.billing.settleInvoices(charge.userId, [invoice], { notification: 'payment', reactivateAccount, manager });
      });
      this.logger.log(`Cobro ${charge.id} autorizado (${charge.triggeredBy})`);
    } else {
      await this.chargeRepo.update({ id: charge.id, status: 'processing' }, { status: 'rejected', ...fields });
      this.logger.warn(`Cobro ${charge.id} rechazado (código ${result.responseCode})`);
    }

    const closed = await this.chargeRepo.findOne({ where: { id: charge.id } });
    return this.toChargeView(closed ?? charge);
  }

  private summaryOf(invoice: Invoice, result: DueChargeSummary['result'], charge: ChargeView | null): DueChargeSummary {
    return {
      invoiceId: invoice.id,
      month: invoice.month,
      result,
      chargeId: charge?.id ?? null,
      buyOrder: charge?.buyOrder ?? null,
      responseCode: charge?.responseCode ?? null,
      authorizationCode: charge?.authorizationCode ?? null,
    };
  }

  private toFamilyPaymentView(
    items: FamilyPaymentItem[],
    requested: number,
    inscription: PaymentInscription,
  ): FamilyPaymentView {
    const authorized = items.filter((i) => i.status === 'authorized');
    const last = items[items.length - 1];
    let status: FamilyPaymentView['status'];
    if (authorized.length === requested) status = 'paid';
    else if (authorized.length > 0) status = 'partial';
    else status = last.status as 'rejected' | 'error' | 'processing';
    const dates = authorized.map((i) => i.transactionDate).filter((d): d is string => !!d);
    return {
      status,
      items,
      totalPaidCLP: authorized.reduce((sum, i) => sum + i.amountCLP, 0),
      paidAt: dates.length > 0 ? dates.sort()[dates.length - 1] : null,
      card: { cardType: inscription.cardType, cardLast4: inscription.cardLast4 },
    };
  }

  private toInscriptionView(i: PaymentInscription): InscriptionView {
    return { id: i.id, status: i.status, cardType: i.cardType, cardLast4: i.cardLast4, createdAt: i.createdAt.toISOString() };
  }

  private toChargeView(c: PaymentCharge): ChargeView {
    return {
      id: c.id,
      invoiceId: c.invoiceId,
      amountCLP: c.amountCLP,
      triggeredBy: c.triggeredBy,
      status: c.status,
      buyOrder: c.parentBuyOrder,
      responseCode: c.responseCode,
      authorizationCode: c.authorizationCode,
      transactionDate: c.transactionDate?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
    };
  }
}
