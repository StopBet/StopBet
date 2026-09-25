import React from 'react';
import type { Sede } from '@stopbet/shared-types';
import { api } from '../services/api';
import { readStaffSede, saveStaffSede } from '../services/offlineStore';
import { useUserId } from './AuthContext';

interface SedeValue {
  sedes: Sede[];
  sede: Sede | null;
  elegirSede: (sedeId: string) => void;
  cargando: boolean;
  /** No pudimos leer las sedes del psicólogo: el resumen se muestra igual, sin filtrar. */
  falló: boolean;
  reintentar: () => void;
}

const SedeCtx = React.createContext<SedeValue>({
  sedes: [], sede: null, elegirSede: () => {}, cargando: true, falló: false, reintentar: () => {},
});

/**
 * Un psicólogo puede atender en varias sedes (`psychologist_sedes`), y un anuncio se
 * publica **a una sede**. La sede elegida acá filtra el resumen y decide a quiénes les
 * llega lo que publique, así que vive arriba de las dos pestañas y no dentro de una.
 */
export function SedeProvider({ children }: { children: React.ReactNode }) {
  const userId = useUserId();
  const [sedes, setSedes] = React.useState<Sede[]>([]);
  const [sedeId, setSedeId] = React.useState<string | null>(null);
  const [cargando, setCargando] = React.useState(true);
  const [falló, setFalló] = React.useState(false);

  const cargar = React.useCallback(() => {
    if (!userId) return;
    setCargando(true);
    setFalló(false);
    Promise.all([api.getStaffProfile(userId), readStaffSede(userId)])
      .then(([perfil, guardada]) => {
        setSedes(perfil.sedes);
        // La guardada puede ser de una sede que ya no atiende: en ese caso, la primera
        const válida = perfil.sedes.some((s) => s.id === guardada);
        setSedeId(válida ? guardada : (perfil.sedes[0]?.id ?? null));
        setFalló(false);
      })
      .catch(() => setFalló(true))
      .finally(() => setCargando(false));
  }, [userId]);

  React.useEffect(() => { cargar(); }, [cargar]);

  const elegirSede = React.useCallback((id: string) => {
    setSedeId(id);
    if (userId) void saveStaffSede(userId, id);
  }, [userId]);

  const value = React.useMemo<SedeValue>(() => ({
    sedes,
    sede: sedes.find((s) => s.id === sedeId) ?? null,
    elegirSede,
    cargando,
    falló,
    reintentar: cargar,
  }), [sedes, sedeId, elegirSede, cargando, falló, cargar]);

  return <SedeCtx.Provider value={value}>{children}</SedeCtx.Provider>;
}

export function useSede(): SedeValue {
  return React.useContext(SedeCtx);
}
