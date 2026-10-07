import { useCallback, useState } from 'react';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import type { AccompaniedResponse } from '@stopbet/shared-types';
import { useUserId } from '../context/AuthContext';
import { api } from '../services/api';
import { logWarn } from '../utils/log';
import { useCargaFresca } from './useCargaFresca';
import { useIntervaloActivo } from './useIntervaloActivo';

/**
 * A quién acompaña quien fue designado compañero de viaje, con su alerta más reciente.
 *
 * Un paciente común también lo llama (la app no sabe quién es compañero hasta preguntar): le
 * sale una petición barata al enfocar la pantalla y nada más. El sondeo solo se enciende si de
 * verdad acompaña a alguien y la pantalla está a la vista, para que el resto no pague la
 * batería de una función que no usa.
 */
export function useAcompanados(pollMs: number = 15_000) {
  const userId = useUserId();
  const enfocada = useIsFocused();
  const [data, setData] = useState<AccompaniedResponse | null>(null);
  const [error, setError] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setData(await api.getAccompanied(userId));
      setError(false);
    } catch (err) {
      // Sin red: lo que ya se mostraba se queda. Una alerta no desaparece por un mal momento
      // de la conexión.
      logWarn('[useAcompanados] no se pudo cargar', (err as Error).message);
      setError(true);
      throw err;
    }
  }, [userId]);

  const alEnfocar = useCargaFresca(cargar);
  useFocusEffect(useCallback(() => { void alEnfocar(); }, [alEnfocar]));

  const acompana = (data?.patients.length ?? 0) > 0;
  useIntervaloActivo(
    () => { void cargar().catch(() => undefined); },
    pollMs,
    acompana && enfocada,
  );

  const recargar = useCallback(async () => {
    try {
      await cargar();
    } catch {
      // `error` ya quedó marcado.
    }
  }, [cargar]);

  return { data, error, recargar };
}
