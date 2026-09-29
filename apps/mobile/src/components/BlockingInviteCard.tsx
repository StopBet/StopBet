import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Palette } from '../constants/colors';
import { Fonts } from '../constants/typography';
import { useColors, useStyles } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { activateBlocking, blocking, useBlockingStatus } from '../hooks/useBlocking';
import { Icon } from './Icon';

// El bloqueo es del teléfono, no de la cuenta: estas claves no llevan el id del paciente.
const INTRO_DISMISSED_KEY = '@stopbet/blocking-intro-dismissed';
const OFF_DISMISSED_KEY = '@stopbet/blocking-off-dismissed';

/**
 * Invitación a activar el bloqueo de apuestas, en Inicio.
 *
 * Es también el **aviso destacado** que Google Play exige a toda app con `VpnService`: aparece
 * en el uso normal de la app, dice qué ve la VPN y pide una acción del paciente. Por eso el texto
 * no se puede resumir a "Activar bloqueo" ni esconderse en la política de privacidad.
 *
 * Dos momentos:
 *  - nunca lo activó → la invitación, hasta que la acepte o toque "Ahora no".
 *  - lo apagó desde Ajustes → ofrecer reactivarlo. No se reenciende solo: lo decidió él.
 */
export function BlockingInviteCard() {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const { showToast } = useToast();
  const { status, refresh } = useBlockingStatus();
  const [dismissed, setDismissed] = useState<{ intro: boolean; offAt: string | null } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(INTRO_DISMISSED_KEY), AsyncStorage.getItem(OFF_DISMISSED_KEY)])
      .then(([intro, offAt]) => setDismissed({ intro: intro === '1', offAt }))
      .catch(() => setDismissed({ intro: false, offAt: null }));
  }, []);

  if (!blocking || !status || !dismissed || status.active || status.enabled) return null;

  const turnedOff = status.lastRevokedAt > 0;
  if (turnedOff ? dismissed.offAt === String(status.lastRevokedAt) : dismissed.intro) return null;

  const activar = async () => {
    setBusy(true);
    const result = await activateBlocking();
    setBusy(false);
    if (result === 'on') showToast('Protección activada');
    else if (result === 'denied') showToast('Para activarla, acepta la solicitud de conexión', 'error');
    else showToast('No se pudo activar la protección', 'error');
    refresh();
  };

  const ahoraNo = async () => {
    const next = turnedOff
      ? { ...dismissed, offAt: String(status.lastRevokedAt) }
      : { ...dismissed, intro: true };
    setDismissed(next);
    try {
      if (turnedOff) await AsyncStorage.setItem(OFF_DISMISSED_KEY, String(status.lastRevokedAt));
      else await AsyncStorage.setItem(INTRO_DISMISSED_KEY, '1');
    } catch {
      // Si no se guarda, la tarjeta vuelve la próxima vez: molesto, no grave.
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Icon name="shield-check" size={18} color={c.primaryText} />
        <Text style={styles.title} accessibilityRole="header">
          {turnedOff ? 'La protección está apagada' : 'Protección contra sitios de apuestas'}
        </Text>
      </View>
      <Text style={styles.body}>
        {turnedOff
          ? 'Se desactivó desde los ajustes del teléfono. Si fue sin querer, puedes volver a encenderla.'
          : 'StopBet puede bloquear los sitios de apuestas en todo tu teléfono, en cualquier navegador o app, para que un impulso no te lleve directo a apostar.'}
      </Text>
      {!turnedOff && (
        <Text style={styles.disclosure}>
          Para hacerlo usa la función de VPN de Android. Solo revisa el nombre de los sitios que
          abres, dentro de tu teléfono: no guarda tu navegación ni la envía a nadie, tampoco a tu
          psicólogo. Android te pedirá confirmar la conexión.
        </Text>
      )}
      <View style={styles.actions}>
        <Pressable
          style={[styles.primary, busy && { opacity: 0.6 }]}
          onPress={activar}
          disabled={busy}
          accessibilityRole="button"
        >
          <Text style={styles.primaryText}>{turnedOff ? 'Reactivar' : 'Activar protección'}</Text>
        </Pressable>
        <Pressable style={styles.ghost} onPress={ahoraNo} accessibilityRole="button">
          <Text style={styles.ghostText}>Ahora no</Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: 16,
      marginHorizontal: 16,
      padding: 16,
      gap: 10,
      borderWidth: 1,
      borderColor: c.border,
    },
    head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { fontFamily: Fonts.headingBold, fontSize: 15, color: c.ink900, flexShrink: 1 },
    body: { fontFamily: Fonts.body, fontSize: 13, color: c.fg1, lineHeight: 19 },
    disclosure: { fontFamily: Fonts.body, fontSize: 12, color: c.fg2, lineHeight: 17 },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
    primary: {
      minHeight: 48,
      justifyContent: 'center',
      paddingHorizontal: 18,
      borderRadius: 9999,
      backgroundColor: c.primary,
    },
    primaryText: { fontFamily: Fonts.bodyBold, fontSize: 14, color: c.white },
    ghost: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 14 },
    ghostText: { fontFamily: Fonts.bodyBold, fontSize: 14, color: c.fg2 },
  });
