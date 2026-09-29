import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import NativeBlocking, { type Spec } from '../specs/NativeBlocking';
import { logWarn } from '../utils/log';

export type BlockingStatus = Awaited<ReturnType<Spec['getStatus']>>;

/** Solo Android tiene el módulo; en iOS, o con un APK compilado antes del módulo, no existe. */
export const blocking: Spec | null = Platform.OS === 'android' ? NativeBlocking : null;

/**
 * Estado del bloqueo, releído cada vez que la app vuelve al frente: el paciente lo apaga desde
 * Ajustes de Android, fuera de la app, y al volver la pantalla tiene que mostrarlo apagado.
 */
export function useBlockingStatus() {
  const [status, setStatus] = useState<BlockingStatus | null>(null);

  const refresh = useCallback(async () => {
    if (!blocking) return;
    try {
      setStatus(await blocking.getStatus());
    } catch (err) {
      logWarn('[blocking] getStatus falló', err);
    }
  }, []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  return { status, refresh };
}

export type ActivationResult = 'on' | 'denied' | 'error';

/** Pide el consentimiento (solo se ve la primera vez) y enciende el bloqueo. */
export async function activateBlocking(): Promise<ActivationResult> {
  if (!blocking) return 'error';
  try {
    if (!(await blocking.requestPermission())) return 'denied';
    await blocking.start();
    return 'on';
  } catch (err) {
    logWarn('[blocking] no se pudo activar', err);
    return 'error';
  }
}

/**
 * Vuelve a levantar el bloqueo al abrir la app si el paciente lo tenía encendido y el sistema
 * lo cerró (ahorro de batería, actualización de la app). **No** lo enciende si el paciente lo
 * apagó desde Ajustes: eso lo decide él, y Inicio le ofrece reactivarlo.
 */
export function useBlockingAutoStart() {
  useEffect(() => {
    if (!blocking) return;
    const module = blocking;
    const ensure = async () => {
      try {
        const s = await module.getStatus();
        if (s.enabled && s.hasPermission && !s.active) await module.start();
      } catch (err) {
        logWarn('[blocking] no se pudo reanudar', err);
      }
    };
    ensure();
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') ensure();
    });
    return () => sub.remove();
  }, []);
}
