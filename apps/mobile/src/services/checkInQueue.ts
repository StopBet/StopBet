import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import type { EmotionType } from '@stopbet/shared-types';
import { api } from './api';

// CA7.3: si el check-in no sale por falta de conexión, la emoción no se pierde:
// queda en disco y se reintenta sola al volver la red. Se guarda uno solo porque
// el dominio permite un único check-in por día (CA7.2).
const QUEUE_KEY = '@stopbet/pending-check-in';

export interface PendingCheckIn {
  userId: string;
  emotion: EmotionType;
  queuedAt: string;
}

export function isNetworkError(err: unknown): boolean {
  const msg = (err as Error)?.message ?? '';
  return (
    msg.includes('Network request failed') ||
    msg.includes('Failed to fetch') ||
    msg.includes('timeout')
  );
}

export async function savePending(userId: string, emotion: EmotionType): Promise<void> {
  const pending: PendingCheckIn = {
    userId,
    emotion,
    queuedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(pending));
}

export async function readPending(): Promise<PendingCheckIn | null> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingCheckIn;
  } catch {
    // Basura en disco: descartar en vez de reintentar para siempre
    await AsyncStorage.removeItem(QUEUE_KEY);
    return null;
  }
}

export async function clearPending(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

// Devuelve la emoción enviada si logró vaciar la cola, null si no había nada o
// si sigue sin conexión. Un 409 significa que el día ya tenía check-in: la cola
// se limpia igual, porque reintentarlo nunca va a funcionar.
export async function flushPending(): Promise<EmotionType | null> {
  const pending = await readPending();
  if (!pending) return null;

  try {
    await api.createCheckIn(pending.userId, pending.emotion);
    await clearPending();
    return pending.emotion;
  } catch (err) {
    if (!isNetworkError(err)) {
      await clearPending();
      return null;
    }
    return null;
  }
}

export function onReconnect(callback: () => void): () => void {
  return NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) callback();
  });
}
