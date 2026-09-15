import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Palette } from '../constants/colors';
import { useColors, useStyles } from './ThemeContext';
import { Fonts } from '../constants/typography';
import { Icon } from '../components/Icon';
import { useReduceMotion } from '../hooks/useReduceMotion';

/**
 * Un aviso pasajero que no interrumpe.
 *
 * La app usaba `Alert.alert` para todo: "Gracias, el equipo revisará esta publicación",
 * "Guardamos tu check-in en el teléfono"… Cada uno es un diálogo del sistema que se pone
 * encima, oscurece la pantalla y obliga a tocar "OK" para seguir. Para algo que el
 * paciente solo necesita leer, eso es interrumpir por nada.
 *
 * El diálogo se reserva para lo que sí es una decisión: eliminar una publicación, cerrar
 * sesión, registrar una recaída, salir de una alerta de pánico activa.
 */
type ToastTone = 'info' | 'error';

interface ToastState {
  message: string;
  tone: ToastTone;
}

interface ToastApi {
  showToast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastApi>({ showToast: () => {} });

export function useToast(): ToastApi {
  return useContext(ToastContext);
}

// Los ayudantes que viven fuera de un componente —como `alertFailure` de Comunidad—
// no pueden usar hooks. El proveedor deja acá su emisor para que igual puedan avisar.
let emitir: ToastApi['showToast'] | null = null;

export function toast(message: string, tone: ToastTone = 'info'): void {
  emitir?.(message, tone);
}

const VISIBLE_MS = 4000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const [toast, setToast] = useState<ToastState | null>(null);
  const { bottom } = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, tone: ToastTone = 'info') => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, tone });
    timer.current = setTimeout(() => setToast(null), VISIBLE_MS);
  }, []);

  useEffect(() => {
    emitir = showToast;
    return () => { emitir = null; };
  }, [showToast]);

  useEffect(() => {
    if (!toast) {
      opacity.setValue(0);
      return;
    }
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [toast, reduceMotion, opacity]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <Animated.View
          // Queda por encima de la barra inferior para no taparla mientras se lee
          style={[styles.wrap, { bottom: bottom + 88, opacity }]}
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          accessible
          accessibilityLabel={toast.message}
        >
          <View style={[styles.toast, toast.tone === 'error' && styles.toastError]}>
            <Icon
              name={toast.tone === 'error' ? 'triangle-alert' : 'circle-check'}
              size={17}
              color={toast.tone === 'error' ? c.danger : c.greenText}
            />
            <Text style={styles.text}>{toast.message}</Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16 },
  toast: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: c.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: c.shadowMedium,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 6,
  },
  toastError: { borderColor: c.dangerBorder, backgroundColor: c.dangerSurface },
  text: { fontFamily: Fonts.body, flex: 1, fontSize: 14, color: c.fg1, lineHeight: 20 },
});
