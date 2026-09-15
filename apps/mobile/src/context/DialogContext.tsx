import React, { createContext, useCallback, useContext, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import type { Palette } from '../constants/colors';
import { useColors, useStyles } from './ThemeContext';
import { Touchable } from '../components/Touchable';
import { Fonts } from '../constants/typography';

/**
 * El diálogo de confirmación de la app.
 *
 * `Alert.alert` dibuja el cuadro del sistema: esquinas, tipografía y botones de Android,
 * que al lado del resto de la app se ven como si vinieran de otra aplicación. Eso importa
 * donde más: el paciente decide si registra una recaída o si cierra su sesión.
 *
 * Los avisos que solo hay que leer siguen yendo por `useToast`; esto es para las
 * decisiones.
 */
export type DialogTone = 'default' | 'danger';

export interface DialogAction {
  label: string;
  onPress?: () => void;
  /** `danger` para lo que destruye algo; `cancel` se dibuja como salida discreta. */
  tone?: DialogTone | 'cancel';
}

export interface DialogOptions {
  title: string;
  message?: string;
  actions: DialogAction[];
}

const DialogContext = createContext<{ showDialog: (o: DialogOptions) => void }>({
  showDialog: () => {},
});

export function useDialog() {
  return useContext(DialogContext);
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<DialogOptions | null>(null);
  const styles = useStyles(makeStyles);
  const c = useColors();

  const showDialog = useCallback((options: DialogOptions) => setDialog(options), []);

  const cerrar = () => setDialog(null);

  const ejecutar = (action: DialogAction) => {
    cerrar();
    action.onPress?.();
  };

  return (
    <DialogContext.Provider value={{ showDialog }}>
      {children}
      <Modal
        visible={dialog !== null}
        transparent
        animationType="fade"
        // El botón atrás de Android cierra el diálogo, como hace el del sistema
        onRequestClose={cerrar}
      >
        <View style={styles.overlay}>
          <View
            style={styles.card}
            accessibilityViewIsModal
            accessibilityLiveRegion="polite"
          >
            <Text style={styles.title} accessibilityRole="header">{dialog?.title}</Text>
            {!!dialog?.message && <Text style={styles.message}>{dialog.message}</Text>}

            <View style={styles.actions}>
              {dialog?.actions.map((action) => {
                const esCancelar = action.tone === 'cancel';
                const esPeligro = action.tone === 'danger';
                return (
                  <Touchable
                    key={action.label}
                    style={[
                      styles.action,
                      esCancelar && styles.actionCancel,
                      esPeligro && styles.actionDanger,
                    ]}
                    rippleColor={esCancelar ? undefined : 'rgba(255,255,255,0.28)'}
                    onPress={() => ejecutar(action)}
                    accessibilityRole="button"
                  >
                    <Text
                      style={[
                        styles.actionText,
                        esCancelar && styles.actionTextCancel,
                      ]}
                    >
                      {action.label}
                    </Text>
                  </Touchable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </DialogContext.Provider>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: c.overlay,
    justifyContent: 'center',
    paddingHorizontal: 26,
  },
  card: {
    backgroundColor: c.surface,
    borderRadius: 20,
    padding: 24,
    gap: 10,
  },
  title: { fontFamily: Fonts.headingBold, fontSize: 19, color: c.ink900 },
  message: { fontFamily: Fonts.body, fontSize: 14.5, color: c.fg1, lineHeight: 21 },
  actions: { marginTop: 8, gap: 10 },
  action: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
    borderRadius: 9999,
    backgroundColor: c.primary,
  },
  actionDanger: { backgroundColor: c.danger },
  actionCancel: { backgroundColor: 'transparent' },
  actionText: { fontFamily: Fonts.bodyBold, fontSize: 15, color: c.white },
  actionTextCancel: { color: c.fg2 },
});
