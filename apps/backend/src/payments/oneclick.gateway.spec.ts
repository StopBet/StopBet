import { OneclickGateway, toChargeResult } from './oneclick.gateway';

const sdk = {
  start: jest.fn(),
  finish: jest.fn(),
  delete: jest.fn(),
  authorize: jest.fn(),
  status: jest.fn(),
};
const builtWith: unknown[] = [];

jest.mock('transbank-sdk', () => ({
  Environment: { Integration: 'https://webpay3gint.transbank.cl', Production: 'https://webpay3g.transbank.cl' },
  IntegrationApiKeys: { WEBPAY: 'LLAVE_DE_INTEGRACION' },
  IntegrationCommerceCodes: { ONECLICK_MALL: '597055555541', ONECLICK_MALL_CHILD1: '597055555542' },
  Options: class {
    constructor(
      public commerceCode: string,
      public apiKey: string,
      public environment: string,
    ) {
      builtWith.push({ commerceCode, apiKey, environment });
    }
  },
  TransactionDetail: class {
    constructor(
      public amount: number,
      public commerceCode: string,
      public buyOrder: string,
      public installmentsNumber: number,
    ) {}
  },
  Oneclick: {
    MallInscription: class {
      start = sdk.start;
      finish = sdk.finish;
      delete = sdk.delete;
    },
    MallTransaction: class {
      authorize = sdk.authorize;
      status = sdk.status;
    },
  },
}));

function gatewayWith(env: Record<string, string> = {}): OneclickGateway {
  const gateway = new OneclickGateway({ get: (key: string) => env[key] } as any);
  gateway.onModuleInit();
  return gateway;
}

const approvedDetail = {
  amount: 30000,
  status: 'AUTHORIZED',
  authorization_code: '1213',
  payment_type_code: 'VN',
  response_code: 0,
  installments_number: 1,
  commerce_code: '597055555542',
  buy_order: 'CHILD1',
};

describe('OneclickGateway', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    builtWith.length = 0;
  });

  describe('configuración', () => {
    it('sin ninguna variable usa el ambiente de integración con las credenciales públicas', () => {
      const gateway = gatewayWith();

      expect(gateway.isEnabled()).toBe(true);
      expect(builtWith[0]).toEqual({
        commerceCode: '597055555541',
        apiKey: 'LLAVE_DE_INTEGRACION',
        environment: 'https://webpay3gint.transbank.cl',
      });
    });

    it('en producción sin los códigos queda apagado en vez de caer a las credenciales de prueba', () => {
      const gateway = gatewayWith({ TBK_ENVIRONMENT: 'production' });

      expect(gateway.isEnabled()).toBe(false);
      expect(builtWith).toHaveLength(0);
    });

    it('en producción con los tres datos usa el ambiente productivo', () => {
      const gateway = gatewayWith({
        TBK_ENVIRONMENT: 'production',
        TBK_ONECLICK_COMMERCE_CODE: '123',
        TBK_ONECLICK_CHILD_COMMERCE_CODE: '124',
        TBK_API_KEY: 'secreta',
      });

      expect(gateway.isEnabled()).toBe(true);
      expect(builtWith[0]).toEqual({ commerceCode: '123', apiKey: 'secreta', environment: 'https://webpay3g.transbank.cl' });
    });

    it('apagado, cualquier operación avisa que no está configurado', async () => {
      const gateway = gatewayWith({ TBK_ENVIRONMENT: 'production' });

      await expect(gateway.startInscription('u', 'a@b.cl', 'http://x')).rejects.toThrow('no está configurado');
    });
  });

  describe('inscripción', () => {
    it('devuelve el token y la URL del formulario', async () => {
      sdk.start.mockResolvedValue({ token: 'T'.repeat(64), url_webpay: 'https://webpay3gint.transbank.cl/form' });

      const result = await gatewayWith().startInscription('user-1', 'a@b.cl', 'http://localhost/return');

      expect(result).toEqual({ token: 'T'.repeat(64), urlWebpay: 'https://webpay3gint.transbank.cl/form' });
      expect(sdk.start).toHaveBeenCalledWith('user-1', 'a@b.cl', 'http://localhost/return');
    });

    it('una respuesta sin token falla en vez de seguir con datos a medias', async () => {
      sdk.start.mockResolvedValue({ url_webpay: 'https://x' });

      await expect(gatewayWith().startInscription('u', 'a@b.cl', 'http://x')).rejects.toThrow('inesperada');
    });

    it('al cerrarla, solo conserva el tipo y los últimos 4 dígitos de la tarjeta', async () => {
      sdk.finish.mockResolvedValue({
        response_code: 0,
        tbk_user: 'tbk-1',
        card_type: 'Visa',
        card_number: 'XXXXXXXXXXXX6623',
        authorization_code: '123456',
      });

      const result = await gatewayWith().finishInscription('tok');

      expect(result).toEqual({
        approved: true,
        responseCode: 0,
        tbkUser: 'tbk-1',
        cardType: 'Visa',
        cardLast4: '6623',
        authorizationCode: '123456',
      });
    });

    it('un código distinto de 0 no está aprobado', async () => {
      sdk.finish.mockResolvedValue({ response_code: -1 });

      expect((await gatewayWith().finishInscription('tok')).approved).toBe(false);
    });
  });

  describe('cobro', () => {
    it('manda un solo detalle, a nuestra tienda hija, en una cuota', async () => {
      sdk.authorize.mockResolvedValue({ details: [approvedDetail] });

      await gatewayWith().authorize({
        username: 'user-1',
        tbkUser: 'tbk-1',
        parentBuyOrder: 'PARENT',
        childBuyOrder: 'CHILD1',
        amountCLP: 30000,
      });

      const [username, tbkUser, parent, details] = sdk.authorize.mock.calls[0];
      expect([username, tbkUser, parent]).toEqual(['user-1', 'tbk-1', 'PARENT']);
      expect(details).toHaveLength(1);
      expect(details[0]).toMatchObject({ amount: 30000, commerceCode: '597055555542', buyOrder: 'CHILD1', installmentsNumber: 1 });
    });

    it('consulta el estado por la orden de compra padre', async () => {
      sdk.status.mockResolvedValue({ details: [approvedDetail] });

      const result = await gatewayWith().chargeStatus('PARENT');

      expect(sdk.status).toHaveBeenCalledWith('PARENT');
      expect(result.approved).toBe(true);
    });
  });
});

describe('toChargeResult', () => {
  it('aprobado: response_code 0 y AUTHORIZED en el detalle', () => {
    const result = toChargeResult({ transaction_date: '2026-10-07T18:00:00.000Z', details: [approvedDetail] });

    expect(result).toMatchObject({
      approved: true,
      status: 'AUTHORIZED',
      responseCode: 0,
      authorizationCode: '1213',
      paymentTypeCode: 'VN',
      installments: 1,
    });
    expect(result.transactionDate?.toISOString()).toBe('2026-10-07T18:00:00.000Z');
  });

  // El ejemplo del propio SDK mira un `status` de nivel superior que la respuesta no trae:
  // se mira el del detalle.
  it('un status AUTHORIZED de nivel superior no basta: se lee el del detalle', () => {
    const result = toChargeResult({ status: 'AUTHORIZED', details: [{ ...approvedDetail, status: 'FAILED', response_code: -1 }] });

    expect(result.approved).toBe(false);
    expect(result.responseCode).toBe(-1);
  });

  it('con status AUTHORIZED pero response_code distinto de 0 no está aprobado', () => {
    expect(toChargeResult({ details: [{ ...approvedDetail, response_code: -96 }] }).approved).toBe(false);
  });

  it('con response_code 0 pero status distinto de AUTHORIZED no está aprobado', () => {
    expect(toChargeResult({ details: [{ ...approvedDetail, status: 'REVERSED' }] }).approved).toBe(false);
  });

  it('si algún detalle no está aprobado, el cobro no lo está', () => {
    const failed = { ...approvedDetail, status: 'FAILED', response_code: -97 };

    expect(toChargeResult({ details: [approvedDetail, failed] }).approved).toBe(false);
  });

  it('una respuesta sin detalles o malformada nunca cuenta como aprobada', () => {
    expect(toChargeResult({ details: [] }).approved).toBe(false);
    expect(toChargeResult({}).approved).toBe(false);
    expect(toChargeResult(null).approved).toBe(false);
    expect(toChargeResult('basura').approved).toBe(false);
  });
});
