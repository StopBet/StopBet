import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthUser, LoginResponse } from '@stopbet/shared-types';

/**
 * La sesión real del paciente.
 *
 * Hasta ahora `LoginScreen` tenía un TODO: esperaba 900 ms y entraba. Cualquier correo con
 * cualquier clave abría la sesión, y las siete pantallas leían un `TEMP_USER_ID` fijo. Por
 * eso todas las cuentas mostraban "Hola, Carlos" con el mismo progreso: no es que no se
 * guardara el cambio de cuenta, es que nunca hubo cuentas.
 *
 * El token vive en memoria para no leer disco en cada request, y en AsyncStorage para que
 * la sesión sobreviva a cerrar la app.
 */
const ACCESS_KEY = '@stopbet/access-token';
const REFRESH_KEY = '@stopbet/refresh-token';
const USER_KEY = '@stopbet/user';

let accessToken: string | null = null;
let refreshToken: string | null = null;
let user: AuthUser | null = null;
let onExpired: (() => void) | null = null;

export const session = {
  /** Se llama una vez al arrancar, antes de decidir qué navegador mostrar. */
  async load(): Promise<AuthUser | null> {
    try {
      const [a, r, u] = await Promise.all([
        AsyncStorage.getItem(ACCESS_KEY),
        AsyncStorage.getItem(REFRESH_KEY),
        AsyncStorage.getItem(USER_KEY),
      ]);
      accessToken = a;
      refreshToken = r;
      user = u ? (JSON.parse(u) as AuthUser) : null;
    } catch {
      accessToken = refreshToken = null;
      user = null;
    }
    return user;
  },

  async save(data: LoginResponse): Promise<void> {
    accessToken = data.accessToken;
    refreshToken = data.refreshToken;
    user = data.user;
    try {
      await Promise.all([
        AsyncStorage.setItem(ACCESS_KEY, data.accessToken),
        AsyncStorage.setItem(REFRESH_KEY, data.refreshToken),
        AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user)),
      ]);
    } catch {
      // La sesión sigue viva en memoria; solo no sobrevivirá a cerrar la app
    }
  },

  async clear(): Promise<void> {
    accessToken = refreshToken = null;
    user = null;
    try {
      await Promise.all([
        AsyncStorage.removeItem(ACCESS_KEY),
        AsyncStorage.removeItem(REFRESH_KEY),
        AsyncStorage.removeItem(USER_KEY),
      ]);
    } catch {
      // Nada que hacer: en memoria ya está limpia
    }
  },

  getAccessToken: () => accessToken,
  getRefreshToken: () => refreshToken,
  getUser: () => user,
  /** El id real del paciente, para los endpoints que todavía leen `x-user-id`. */
  getUserId: () => user?.id ?? null,

  /** `App.tsx` se registra acá para mandar al login cuando el refresh ya no sirve. */
  onSessionExpired(fn: () => void) {
    onExpired = fn;
  },
  notifyExpired() {
    onExpired?.();
  },
};
