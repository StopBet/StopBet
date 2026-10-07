import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Palette } from '../constants/colors';
import { Fonts } from '../constants/typography';
import { useColors, useStyles } from '../context/ThemeContext';
import { useAcompanados } from '../hooks/useAcompanados';
import { haceCuanto } from '../utils/tiempo';
import { Icon } from './Icon';
import { Touchable } from './Touchable';

// Lo primero que ve en el Inicio quien fue designado compañero de viaje cuando una persona a
// la que acompaña aprieta el SOS. El push dice «abre StopBet» y no nombra a nadie porque la
// pantalla de bloqueo la ve cualquiera; esta tarjeta es la que explica quién es y lleva a
// responder. Para un paciente que no acompaña a nadie no se dibuja y no sondea.
export function SponsorAlertBanner({ onOpen }: { onOpen: () => void }) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const { data } = useAcompanados();

  const pendientes = (data?.patients ?? []).filter((p) => p.recentAlert?.status === 'pending');
  if (pendientes.length === 0) return null;

  const [primera] = pendientes;
  const nombre = primera.firstName;
  const titulo =
    pendientes.length === 1
      ? `${nombre} necesita contención ahora`
      : `${pendientes.length} personas necesitan contención ahora`;

  return (
    <Touchable
      style={styles.card}
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${titulo}. Toca para responder`}
    >
      <View style={styles.icon}>
        <Icon name="siren" size={22} color={c.white} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{titulo}</Text>
        <Text style={styles.sub}>
          {haceCuanto(primera.recentAlert!.createdAt)} · Toca para responder
        </Text>
      </View>
      <Icon name="chevron-right" size={20} color={c.dangerText} />
    </Touchable>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: {
      marginHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      minHeight: 72,
      borderRadius: 16,
      backgroundColor: c.dangerSurface,
      borderWidth: 1.5,
      borderColor: c.danger,
    },
    icon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.danger,
    },
    text: { flex: 1 },
    title: { fontFamily: Fonts.headingBold, fontSize: 16, color: c.ink900 },
    sub: { fontFamily: Fonts.body, fontSize: 13, color: c.fg2, marginTop: 2 },
  });
