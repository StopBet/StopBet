import AsyncStorage from '@react-native-async-storage/async-storage';

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

export async function saveProgress(daysStreak: number, nextMilestone: number): Promise<void> {
  const entry: CachedProgress = {
    daysStreak,
    nextMilestone,
    savedAt: new Date().toISOString(),
  };
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // El caché es una mejora, no un requisito: si el disco falla se sigue igual.
  }
}

export async function readProgress(): Promise<CachedProgress | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as CachedProgress) : null;
  } catch {
    return null;
  }
}
