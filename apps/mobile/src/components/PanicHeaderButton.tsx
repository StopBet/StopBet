import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/typography';
import { Icon } from './Icon';
import { Touchable } from './Touchable';

/**
 * El acceso al pánico desde un encabezado.
 *
 * Había tres botones distintos para la misma acción: el SOS grande de la barra inferior,
 * una píldora roja en Comunidad y un círculo rosado pálido en el Asistente. Tamaños,
 * formas y colores diferentes para lo único que el paciente tiene que poder reconocer sin
 * pensar. Los dos de encabezado ahora son este mismo componente, con el rojo de pánico y
 * el área táctil de 48 dp; el SOS de la barra se mantiene aparte porque es otra pieza:
 * vive en la navegación, no en un encabezado.
 */
export function PanicHeaderButton({ onPress }: { onPress: () => void }) {
  return (
    <Touchable
      rippleColor="rgba(255,255,255,0.28)"
      style={styles.btn}
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Botón de pánico"
      accessibilityHint="Avisa a tu padrino ahora"
    >
      <View style={styles.row}>
        <Icon name="siren" size={16} color={Colors.white} />
        <Text style={styles.label}>Pánico</Text>
      </View>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: Colors.danger,
    borderRadius: 9999,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontFamily: Fonts.bodyBold, color: Colors.white, fontSize: 13 },
});
