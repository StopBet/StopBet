import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Palette } from '../constants/colors';
import { Fonts } from '../constants/typography';
import { useColors, useStyles } from '../context/ThemeContext';
import { fechaLarga, sumarDias } from '../utils/tiempo';
import { Icon } from './Icon';
import { BADGE_STOP_COUNT, daysLeftText, daysText, lastReachedIndex, stopAt } from './JourneyPath';
import { Touchable } from './Touchable';

interface Props {
  /** La parada tocada en el camino; `null` cierra la hoja. */
  index: number | null;
  days: number;
  /** Inicio del período actual (`YYYY-MM-DD`); `null` si el Inicio cargó sin conexión. */
  startDate: string | null;
  onClose: () => void;
  onOpenAchievements: () => void;
}

/**
 * Lo que hay detrás de una parada de «Mi camino»: cuándo se alcanzó o cuándo se alcanzaría.
 *
 * Las fechas salen del inicio del período que entrega el servidor (parada de 30 días = inicio
 * + 30), nunca del reloj del teléfono: un celular con la fecha mal puesta daba «lo lograste
 * el 1 de enero de 2023». Sin ese dato la hoja dice cuántos días, sin fecha.
 */
export function StopDetailSheet({ index, days, startDate, onClose, onOpenAchievements }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  if (index === null) return null;

  const stop = stopAt(index);
  const reached = index <= lastReachedIndex(days);
  const isNext = index === lastReachedIndex(days) + 1;
  const diff = stop.days - days;
  const hasBadge = index > 0 && index < BADGE_STOP_COUNT;

  const dateOf = (offset: number) => (startDate ? fechaLarga(sumarDias(startDate, offset)) : null);
  const reachedOn = dateOf(stop.days);

  const when =
    index === 0
      ? days === 0
        ? 'Empezaste tu camino hoy.'
        : reachedOn
        ? `Empezaste tu camino el ${reachedOn}.`
        : `Empezaste tu camino hace ${daysText(days)}.`
      : reached
      ? diff === 0
        ? '¡Lo lograste hoy!'
        : reachedOn
        ? `Lo lograste el ${reachedOn}.`
        : `Lo lograste hace ${daysText(-diff)}.`
      : `${daysLeftText(diff)}.${reachedOn ? ` Si sigues así, llegas el ${reachedOn}.` : ''}`;

  const badge =
    index === 0
      ? null
      : !hasBadge
      ? 'Esta parada no tiene insignia: está para que veas todo lo que llevas.'
      : reached
      ? 'Ganaste esta insignia.'
      : 'Al llegar ganas esta insignia.';

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel="Cerrar" accessibilityRole="button">
        {/* El Pressable de adentro existe solo para que un toque en la hoja no la cierre */}
        <Pressable style={[styles.sheet, { paddingBottom: 24 + insets.bottom }]} onPress={() => {}}>
          <View style={styles.top}>
            <View style={[styles.disc, reached ? styles.discReached : isNext ? styles.discNext : styles.discLocked]}>
              <Icon name={stop.icon} size={32} color={reached ? c.greenText : isNext ? c.primaryText : c.fg2} />
            </View>
            <Touchable onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar" style={styles.close}>
              <Icon name="x" size={20} color={c.fg2} />
            </Touchable>
          </View>

          <Text style={styles.title} accessibilityRole="header">{stop.label}</Text>
          {stop.days > 0 && <Text style={styles.days}>{daysText(stop.days)} sin apostar</Text>}

          <View style={[styles.pill, reached ? styles.pillReached : isNext ? styles.pillNext : styles.pillLocked]}>
            <Text style={[styles.pillText, reached ? styles.pillTextReached : isNext ? styles.pillTextNext : null]}>
              {index === 0 ? 'Punto de partida' : reached ? 'Logrado' : isNext ? 'Tu próxima meta' : 'Por delante'}
            </Text>
          </View>

          <Text style={styles.body}>{when}</Text>
          {badge && <Text style={styles.body}>{badge}</Text>}

          {hasBadge && reached && (
            <Touchable style={styles.button} onPress={onOpenAchievements} accessibilityRole="button">
              <Text style={styles.buttonText}>Ver mis insignias</Text>
            </Touchable>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const DISC = 72;

const makeStyles = (c: Palette) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  disc: { width: DISC, height: DISC, borderRadius: DISC / 2, alignItems: 'center', justifyContent: 'center' },
  discReached: { backgroundColor: c.gold50, borderWidth: 3, borderColor: c.green },
  discNext: { backgroundColor: c.surface, borderWidth: 3, borderColor: c.primary },
  discLocked: { backgroundColor: c.bg, borderWidth: 2, borderColor: c.border },
  close: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: Fonts.headingBold, fontSize: 24, color: c.fg1, marginTop: 14 },
  days: { fontFamily: Fonts.body, fontSize: 15, color: c.fg2, marginTop: 2 },
  pill: { alignSelf: 'flex-start', borderRadius: 9999, paddingHorizontal: 12, paddingVertical: 5, marginTop: 12 },
  pillReached: { backgroundColor: c.gold50 },
  pillNext: { backgroundColor: c.infoSurface },
  pillLocked: { backgroundColor: c.bg },
  pillText: { fontFamily: Fonts.bodyBold, fontSize: 13, color: c.fg2 },
  pillTextReached: { color: c.greenText },
  pillTextNext: { color: c.primaryText },
  body: { fontFamily: Fonts.body, fontSize: 16, lineHeight: 23, color: c.fg1, marginTop: 12 },
  button: {
    marginTop: 20,
    minHeight: 48,
    borderRadius: 9999,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontFamily: Fonts.bodyBold, fontSize: 16, color: c.white },
});
