// Colapsa llamadas concurrentes en una sola: mientras haya una en vuelo, los
// demás esperan ese mismo resultado en vez de lanzar otra.
//
// Hace falta para el refresh de sesión. El backend rota el refresh token y
// revoca el usado de inmediato (auth.service.ts:64-66), así que si dos queries
// reciben 401 a la vez y ambas llaman a /auth/refresh con el mismo token, la
// segunda recibe 401 y la sesión se limpia aunque el refresh haya funcionado.
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
