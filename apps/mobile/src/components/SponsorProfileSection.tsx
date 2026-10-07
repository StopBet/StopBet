import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Palette } from '../constants/colors';
import { Fonts } from '../constants/typography';
import { useColors, useStyles } from '../context/ThemeContext';
import { useAcompanados } from '../hooks/useAcompanados';
import { Icon } from './Icon';
import { Touchable } from './Touchable';

/**
 * El rol de compañero de viaje en Perfil. Se suma al de paciente, no lo reemplaza: sin esta
 * sección, quien fue designado no tenía cómo saberlo ni dónde ver a quién acompaña si no había
 * una alerta en curso. Para un paciente común no se dibuja.
 */
export function SponsorProfileSection({ onOpen }: { onOpen: () => void }) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const { data } = useAcompanados();

  if (!data?.designated) return null;

  const n = data.patients.length;
  const resumen =
    n === 0
      ? 'Todavía no tienes a nadie asignado.'
      : n === 1
      ? 'Acompañas a 1 persona. Si pide ayuda, te llega un aviso.'
      : `Acompañas a ${n} personas. Si alguna pide ayuda, te llega un aviso.`;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        Compañero de viaje
      </Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.icon}>
            <Icon name="handshake" size={22} color={c.primaryText} />
          </View>
          <View style={styles.text}>
            <Text style={styles.label}>Eres compañero de viaje</Text>
            <Text style={styles.sub}>{resumen}</Text>
          </View>
        </View>
        <Touchable
          style={styles.secondaryBtn}
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel="Ver a quién acompaño"
        >
          <Text style={styles.secondaryText}>Ver a quién acompaño</Text>
          <Icon name="chevron-right" size={16} color={c.primaryText} />
        </Touchable>
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    section: { gap: 8 },
    sectionTitle: { fontFamily: Fonts.bodyBold, fontSize: 13, color: c.fg2, marginLeft: 4 },
    card: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 18,
      gap: 12,
      shadowColor: c.shadowSoft,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 6,
      elevation: 2,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    icon: { width: 28, alignItems: 'center' },
    text: { flex: 1 },
    label: { fontFamily: Fonts.bodyBold, fontSize: 15, color: c.ink900 },
    sub: { fontFamily: Fonts.body, fontSize: 13, color: c.fg2, marginTop: 2, lineHeight: 18 },
    secondaryBtn: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderRadius: 9999,
      borderWidth: 1,
      borderColor: c.border,
    },
    secondaryText: { fontFamily: Fonts.bodyBold, fontSize: 14, color: c.primaryText },
  });
