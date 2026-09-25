/**
 * Avisos de diagnóstico que **solo existen en desarrollo**.
 *
 * En release, `console.warn("...", err)` igual serializa sus argumentos aunque nadie tenga
 * la consola abierta, y la app no manda esos mensajes a ninguna parte: no hay Crashlytics
 * ni un recolector de errores, así que en el teléfono de un paciente no los lee nadie.
 *
 * No se borran los avisos, se apagan: varios son el único rastro de un error que un `catch`
 * se traga, y en desarrollo hacen falta. Si algún día entra un recolector de errores, este
 * es el único archivo que hay que cambiar.
 */

/**
 * Para lo esperable: sin conexión no es un fallo. Va por `console.log` a propósito, porque
 * `console.warn` levanta el LogBox amarillo encima de la pantalla y tapa lo que se está
 * mirando.
 */
export function logInfo(...args: unknown[]): void {
  if (__DEV__) console.log(...args);
}

export function logWarn(...args: unknown[]): void {
  if (__DEV__) console.warn(...args);
}

export function logError(...args: unknown[]): void {
  if (__DEV__) console.error(...args);
}
