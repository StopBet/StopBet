import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface TbkReturnParams {
  token: string | null;
  // Solo vienen si el paciente apretó «Anular» en el formulario de Transbank.
  abortedBuyOrder: string | null;
  abortedSessionId: string | null;
}

const SAFE_VALUE = /^[\w-]{1,128}$/;

function pick(source: unknown, key: string): string | null {
  const value = (source as Record<string, unknown> | undefined)?.[key];
  return typeof value === 'string' && SAFE_VALUE.test(value) ? value : null;
}

// Transbank devuelve al paciente a nuestra URL con `TBK_TOKEN` y, si anuló, también
// `TBK_ORDEN_COMPRA` y `TBK_ID_SESION`. Según la versión de la API y el ambiente llegan por
// query (GET) o por cuerpo (POST), y no es seguro cuáles más agregue: por eso se lee a mano.
export function readTbkReturn(req: { query?: unknown; body?: unknown }): TbkReturnParams {
  const read = (key: string) => pick(req.query, key) ?? pick(req.body, key);
  return {
    token: read('TBK_TOKEN'),
    abortedBuyOrder: read('TBK_ORDEN_COMPRA'),
    abortedSessionId: read('TBK_ID_SESION'),
  };
}

// Con un DTO el endpoint se rompería: el ValidationPipe global (`forbidNonWhitelisted`,
// main.ts) responde 400 ante cualquier campo que el DTO no declare, y esa respuesta la vería el
// paciente en su navegador en vez de volver a la app. Los pipes globales corren antes que los de
// la ruta, así que no se puede relajar desde el controlador; los decoradores propios, en cambio,
// el pipe global no los valida (`validateCustomDecorators` es false por omisión).
export const TbkReturn = createParamDecorator((_data: unknown, ctx: ExecutionContext): TbkReturnParams =>
  readTbkReturn(ctx.switchToHttp().getRequest<{ query?: unknown; body?: unknown }>()),
);
