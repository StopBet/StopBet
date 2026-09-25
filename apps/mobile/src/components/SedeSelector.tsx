import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Palette } from '../constants/colors';
import { useColors, useStyles } from '../context/ThemeContext';
import { Fonts } from '../constants/typography';
import { useDialog } from '../context/DialogContext';
import { useSede } from '../context/SedeContext';
import { sedeCorta } from '../utils/staff';
import { Icon } from './Icon';
import { Touchable } from './Touchable';

/**
 * Con una sola sede no es un control: es una etiqueta. Un selector que solo puede
 * elegir lo ya elegido invita a tocarlo y no hace nada.
 */
export function SedeSelector() {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const { sedes, sede, elegirSede } = useSede();
  const { showDialog } = useDialog();

  if (!sede) return null;

  const nombre = sedeCorta(sede.name);

  if (sedes.length < 2) {
    return (
      <View style={styles.fija} accessibilityLabel={`Sede ${nombre}`}>
        <Icon name="map-pin" size={14} color={c.onPrimaryMuted} />
        <Text style={styles.textoFijo} numberOfLines={1}>{nombre}</Text>
      </View>
    );
  }

  const abrir = () => {
    showDialog({
      title: 'Cambiar de sede',
      message: 'Filtra el resumen y decide a qué sede llega lo que publiques.',
      actions: [
        ...sedes.map((s) => ({
          label: s.id === sede.id ? `${sedeCorta(s.name)} ·  actual` : sedeCorta(s.name),
          onPress: () => elegirSede(s.id),
        })),
        { label: 'Cancelar', tone: 'cancel' as const },
      ],
    });
  };

  return (
    <Touchable
      onPress={abrir}
      style={styles.boton}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`Sede ${nombre}. Tocar para cambiar de sede`}
    >
      <Icon name="map-pin" size={14} color={c.onPrimaryMuted} />
      <Text style={styles.texto} numberOfLines={1}>{nombre}</Text>
      <Icon name="chevron-down" size={16} color={c.onPrimaryMuted} />
    </Touchable>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  boton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 9999,
    backgroundColor: c.overlayWhite16,
  },
  fija: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  texto: { fontFamily: Fonts.bodyBold, fontSize: 14, color: c.white, maxWidth: 190 },
  textoFijo: { fontFamily: Fonts.body, fontSize: 14, color: c.onPrimaryMuted, maxWidth: 220 },
});
