import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AchievementsData, CommunityPost, SponsorInfo } from '@stopbet/shared-types';

// Las cachés se guardan POR PACIENTE. Antes la clave era una sola para toda la app, lo
// que no importaba mientras hubiera un único usuario fijo; con sesiones reales, entrar
// con otra cuenta y quedarse sin red mostraba el progreso - y el teléfono del padrino - del
// paciente anterior. Eso es una fuga entre pacientes de la misma sede.
function claveDe(base: string, userId: string): string {
  return `${base}/${userId}`;
}

/**
 * Borra las cachés de otras cuentas.
 *
 * Todo lo que se guarda para ver sin conexión cuelga del id del paciente (`.../<userId>`),
 * así que al cambiar de cuenta en el mismo teléfono lo anterior quedaba ahí para siempre:
 * nadie lo iba a leer y en una plataforma clínica es contenido de otra persona ocupando el
 * almacenamiento del aparato. Se corre al entrar.
 */
export async function podarCachésDeOtrasCuentas(userId: string): Promise<void> {
  try {
    const claves = await AsyncStorage.getAllKeys();
    const ajenas = claves.filter(
      (k) => k.startsWith('@stopbet/last-') && !k.endsWith(`/${userId}`),
    );
    // AsyncStorage 3 ya no trae `multiRemove`.
    await Promise.all(ajenas.map((k) => AsyncStorage.removeItem(k)));
  } catch {
    // Es limpieza, no un requisito para usar la app.
  }
}

// Sin red, la pantalla de inicio mostraba "0 días sin apostar": el estado parte
// vacío y la carga falla, así que el contador caía a cero. A un paciente eso le
// dice que perdió su racha cuando lo único que pasó es que se cayó el wifi.
// Se guarda el último progreso conocido para poder seguir mostrándolo, marcado
// como dato desactualizado.
const CACHE_KEY = '@stopbet/last-progress';

export interface CachedProgress {
  daysStreak: number;
  nextMilestone: number;
  savedAt: string;
}

export async function saveProgress(userId: string, daysStreak: number, nextMilestone: number): Promise<void> {
  const entry: CachedProgress = {
    daysStreak,
    nextMilestone,
    savedAt: new Date().toISOString(),
  };
  try {
    await AsyncStorage.setItem(claveDe(CACHE_KEY, userId), JSON.stringify(entry));
  } catch {
    // El caché es una mejora, no un requisito: si el disco falla se sigue igual.
  }
}

export async function readProgress(userId: string): Promise<CachedProgress | null> {
  try {
    const raw = await AsyncStorage.getItem(claveDe(CACHE_KEY, userId));
    return raw ? (JSON.parse(raw) as CachedProgress) : null;
  } catch {
    return null;
  }
}

// La pantalla de logros tiene el mismo problema y peor: sin datos muestra el
// contador en cero y toda la colección bloqueada, o sea le borra las insignias
// ya ganadas a alguien que solo se quedó sin señal.
const ACHIEVEMENTS_KEY = '@stopbet/last-achievements';

export async function saveAchievements(userId: string, data: AchievementsData): Promise<void> {
  try {
    await AsyncStorage.setItem(claveDe(ACHIEVEMENTS_KEY, userId), JSON.stringify(data));
  } catch {
    // Ver saveProgress: el caché es una mejora, no un requisito.
  }
}

export async function readAchievements(userId: string): Promise<AchievementsData | null> {
  try {
    const raw = await AsyncStorage.getItem(claveDe(ACHIEVEMENTS_KEY, userId));
    return raw ? (JSON.parse(raw) as AchievementsData) : null;
  } catch {
    return null;
  }
}

// Comunidad ya guardaba lo último cargado, pero en memoria: sobrevivía a navegar
// entre pantallas y no al reinicio de la app. Sin red, al abrir la app el feed
// aparecía vacío, como si nadie hubiera publicado nada.
const COMMUNITY_KEY = '@stopbet/last-community';

export interface CachedCommunity {
  announcements: CommunityPost[];
  posts: CommunityPost[];
}

/**
 * Cuánto se guarda del feed. El caché es para que la app no aparezca vacía sin red, no para
 * llevarse la comunidad entera en el teléfono: guardar un historial largo significa
 * serializarlo completo en cada guardado, y eso corre en el hilo de JS.
 */
const MÁXIMO_EN_CACHÉ = 50;
const ESPERA_ESCRITURA_MS = 1_000;

let escrituraPendiente: ReturnType<typeof setTimeout> | null = null;
let últimoDato: { userId: string; data: CachedCommunity } | null = null;

/**
 * Guarda lo último cargado, **recortado y sin escribir en cada cambio**.
 *
 * Con un mensaje cada pocos segundos, escribir el feed entero por cada uno es el tirón más
 * fácil de provocar en esta pantalla: `JSON.stringify` de cientos de mensajes bloquea el
 * hilo de JS justo cuando el paciente está leyendo. Se acumula y se escribe una vez.
 */
export function saveCommunity(userId: string, data: CachedCommunity): void {
  últimoDato = {
    userId,
    data: {
      announcements: data.announcements.slice(0, MÁXIMO_EN_CACHÉ),
      posts: data.posts.slice(0, MÁXIMO_EN_CACHÉ),
    },
  };
  if (escrituraPendiente) return;
  escrituraPendiente = setTimeout(() => {
    escrituraPendiente = null;
    const pendiente = últimoDato;
    últimoDato = null;
    if (!pendiente) return;
    AsyncStorage.setItem(
      claveDe(COMMUNITY_KEY, pendiente.userId),
      JSON.stringify(pendiente.data),
      // Ver saveProgress: el caché es una mejora, no un requisito.
    ).catch(() => {});
  }, ESPERA_ESCRITURA_MS);
}

export async function readCommunity(userId: string): Promise<CachedCommunity | null> {
  try {
    const raw = await AsyncStorage.getItem(claveDe(COMMUNITY_KEY, userId));
    return raw ? (JSON.parse(raw) as CachedCommunity) : null;
  } catch {
    return null;
  }
}

// Sin red, la pantalla de pánico ofrecía llamar a un número fijo (el padrino del
// seed) a cualquier paciente. Se guarda el padrino real de la última carga.
const SPONSOR_KEY = '@stopbet/last-sponsor';

export async function saveSponsor(userId: string, sponsor: SponsorInfo | null): Promise<void> {
  try {
    if (sponsor) await AsyncStorage.setItem(claveDe(SPONSOR_KEY, userId), JSON.stringify(sponsor));
    else await AsyncStorage.removeItem(claveDe(SPONSOR_KEY, userId));
  } catch {
    // Ver saveProgress: el caché es una mejora, no un requisito.
  }
}

export async function readSponsor(userId: string): Promise<SponsorInfo | null> {
  try {
    const raw = await AsyncStorage.getItem(claveDe(SPONSOR_KEY, userId));
    return raw ? (JSON.parse(raw) as SponsorInfo) : null;
  } catch {
    return null;
  }
}

// CA7.4 · El permiso de notificaciones aparecía de golpe apenas iniciada la sesión:
// Android preguntaba "Allow StopBet to send you notifications?" sin que la app
// hubiera explicado que es para el recordatorio de las 20:00. Quien decía que no,
// perdía el recordatorio sin enterarse. Se guarda la decisión para preguntar una
// sola vez y poder reactivarlo desde Perfil.
const REMINDER_KEY = '@stopbet/daily-reminder';

export type ReminderChoice = 'accepted' | 'dismissed';

export async function saveReminderChoice(choice: ReminderChoice): Promise<void> {
  try {
    await AsyncStorage.setItem(REMINDER_KEY, choice);
  } catch {
    // Quedarse sin la preferencia solo significa volver a preguntar
  }
}

export async function readReminderChoice(): Promise<ReminderChoice | null> {
  try {
    const stored = await AsyncStorage.getItem(REMINDER_KEY);
    return stored === 'accepted' || stored === 'dismissed' ? stored : null;
  } catch {
    return null;
  }
}

// Preferencia de tema. Por omisión sigue al teléfono, que es lo que espera la mayoría;
// la elección manual existe porque el sistema no siempre acompaña: alguien puede tener el
// teléfono en claro y querer la app oscura para el check-in de la noche.
const THEME_KEY = '@stopbet/theme';

export type ThemePreference = 'system' | 'light' | 'dark';

export async function saveThemePreference(pref: ThemePreference): Promise<void> {
  try {
    await AsyncStorage.setItem(THEME_KEY, pref);
  } catch {
    // Sin la preferencia guardada se vuelve a seguir al teléfono: no es un fallo grave
  }
}

export async function readThemePreference(): Promise<ThemePreference> {
  try {
    const stored = await AsyncStorage.getItem(THEME_KEY);
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
  } catch {
    return 'system';
  }
}

// Sede elegida por un psicólogo que atiende en más de una. Va por usuario: en un teléfono
// compartido, la sede del anterior no debe decidir a quién le llega el anuncio del siguiente.
const SEDE_KEY = '@stopbet/staff-sede';

export async function saveStaffSede(userId: string, sedeId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(claveDe(SEDE_KEY, userId), sedeId);
  } catch {
    // Sin la preferencia guardada se vuelve a la primera sede: no es un fallo grave
  }
}

export async function readStaffSede(userId: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(claveDe(SEDE_KEY, userId));
  } catch {
    return null;
  }
}
