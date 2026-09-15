/**
 * Varias pantallas piden datos a la vez (Inicio hace cuatro llamadas por vuelta). El
 * backend revoca el refresh token al primer uso, así que sin esto la primera lo rota y
 * las demás reciben 401 con un token ya revocado y cierran la sesión del paciente.
 */
export function singleFlight<T>(fn: () => Promise<T>): () => Promise<T> {
  let inFlight: Promise<T> | null = null;

  return () => {
    if (!inFlight) {
      inFlight = fn().finally(() => {
        inFlight = null;
      });
    }
    return inFlight;
  };
}
