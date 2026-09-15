import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { darkColors, lightColors, type Palette } from '../constants/colors';
import {
  readThemePreference,
  saveThemePreference,
  type ThemePreference,
} from '../services/offlineStore';

/**
 * El tema claro u oscuro según el ajuste del teléfono.
 *
 * El recordatorio del check-in llega a las 20:00 y los momentos difíciles suelen ser de
 * noche: una pantalla crema a pleno brillo en una pieza oscura es incómoda justo cuando
 * el paciente más va a abrir la app.
 *
 * `StyleSheet.create` corre una sola vez al cargar el módulo, así que una hoja de estilos
 * fija no puede cambiar de tema. Por eso cada archivo declara `makeStyles(c)` y cada
 * componente la resuelve con `useStyles`, que memoriza una hoja por tema y no la vuelve
 * a crear en cada render.
 */
interface ThemeValue {
  colors: Palette;
  isDark: boolean;
  /** Lo que eligió el paciente: seguir al teléfono, o forzar claro u oscuro. */
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeValue>({
  colors: lightColors,
  isDark: false,
  preference: 'system',
  setPreference: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const [preference, setPref] = useState<ThemePreference>('system');

  // Hasta que se lea la preferencia guardada se sigue al teléfono, que es el valor por
  // omisión: así no hay un parpadeo de claro a oscuro al abrir la app.
  useEffect(() => {
    let vigente = true;
    readThemePreference().then((p) => { if (vigente) setPref(p); });
    return () => { vigente = false; };
  }, []);

  const setPreference = useCallback((pref: ThemePreference) => {
    setPref(pref);
    void saveThemePreference(pref);
  }, []);

  const isDark = preference === 'system' ? scheme === 'dark' : preference === 'dark';

  const value = useMemo(
    () => ({ colors: isDark ? darkColors : lightColors, isDark, preference, setPreference }),
    [isDark, preference, setPreference],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}

export function useColors(): Palette {
  return useContext(ThemeContext).colors;
}

// Una hoja por fábrica y por tema. Sin esto, cada render crearía estilos nuevos.
const cache = new WeakMap<object, { light?: unknown; dark?: unknown }>();

export function useStyles<T>(factory: (c: Palette) => T): T {
  const { isDark } = useTheme();
  return useMemo(() => {
    let entry = cache.get(factory);
    if (!entry) {
      entry = {};
      cache.set(factory, entry);
    }
    const key = isDark ? 'dark' : 'light';
    if (!entry[key]) entry[key] = factory(isDark ? darkColors : lightColors);
    return entry[key] as T;
  }, [factory, isDark]);
}
