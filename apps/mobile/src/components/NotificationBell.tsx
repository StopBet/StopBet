import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Palette } from '../constants/colors';
import { useColors, useStyles } from '../context/ThemeContext';
import { Fonts } from '../constants/typography';
import { Icon } from './Icon';
import { Touchable } from './Touchable';

/** Más que esto no cabe en el globo sin encogerlo. */
const MÁXIMO_VISIBLE = 9;

/**
 * La campana del encabezado, con el número de notificaciones sin leer.
 *
 * Antes la lista completa iba dentro del Inicio y con seis avisos empujaba la racha, el
 * check-in y el asistente fuera de pantalla: lo que el paciente abre la app a ver quedaba
 * abajo. Acá el número avisa y la lista vive en su propia pantalla, que es lo que faltaba
 * cuando se sacó el carrusel.
 */
export function NotificationBell({
  sinLeer,
  onPress,
}: {
  sinLeer: number;
  onPress: () => void;
}) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const hay = sinLeer > 0;

  return (
    <Touchable
      style={styles.botón}
      onPress={onPress}
      borderless
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={
        hay
          ? `Notificaciones, ${sinLeer} sin leer`
          : 'Notificaciones, ninguna sin leer'
      }
    >
      <Icon name="bell" size={22} color={c.white} />
      {hay ? (
        <View style={styles.globo}>
          <Text style={styles.globoTexto}>
            {sinLeer > MÁXIMO_VISIBLE ? `${MÁXIMO_VISIBLE}+` : sinLeer}
          </Text>
        </View>
      ) : null}
    </Touchable>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  // 44 de lado: el mínimo táctil, aunque el ícono mida 22
  botón: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  globo: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: c.danger,
    alignItems: 'center',
    justifyContent: 'center',
    // Separa el globo del ícono cuando los dos caen sobre el azul del encabezado
    borderWidth: 1.5,
    borderColor: c.primary,
  },
  globoTexto: {
    fontFamily: Fonts.bodyBold,
    fontSize: 10,
    lineHeight: 13,
    color: c.white,
  },
});
