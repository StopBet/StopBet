import { isNetworkError } from '../services/checkInQueue';

// Android reutiliza conexiones de un pool. Si el servidor cerró una que quedó
// ociosa y la app manda un POST justo por ahí, la petición llega y se procesa,
// pero la respuesta se pierde: el cliente ve "Network request failed" con el
// cambio ya hecho. OkHttp reintenta solo los GET - nunca un POST, porque no sabe
// si es seguro repetirlo, y por eso el feed carga bien y solo fallan las
// escrituras.
//
// Verificado en la tablet: `curl` al mismo endpoint responde 200 en 0,5 s
// mientras la app falla, y el reporte igual quedaba registrado.
//
// Reintentar es seguro porque estas escrituras ya son idempotentes: publicar y
// responder van con `clientRequestId`, y reportar comprueba en el backend antes
// de insertar.
export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    // Da tiempo a que el pool descarte la conexión muerta antes de reintentar.
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 600));
    return fn();
  }
}

// Identifica un envío para que el backend reconozca el reintento. No es
// criptografía y no sale del par teléfono-servidor: solo tiene que ser
// irrepetible entre envíos, así que no se agrega una dependencia de UUID.
export function newRequestId(): string {
  const rand = () => Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${rand()}-${rand()}`;
}
