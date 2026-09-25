import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { AiSessionSummary } from '@stopbet/shared-types';
import type { Palette } from '../constants/colors';
import { useColors, useStyles } from '../context/ThemeContext';
import { Fonts } from '../constants/typography';
import { Icon, type IconName } from './Icon';
import { Touchable } from './Touchable';

interface SummaryChip {
  bg: string;
  icon: IconName;
  iconColor: string;
  label: string;
  value: string;
  valueColor?: string;
}

function aiVal(v: string | null | undefined, fallback: string): string {
  if (!v || v.toLowerCase() === 'null' || v.trim() === '') return fallback;
  return v.trim();
}

function buildChips(summary: AiSessionSummary, durationMinutes: number, c: Palette): SummaryChip[] {
  return [
    {
      bg: c.infoSurface,
      icon: 'chart-column',
      iconColor: c.primary,
      label: 'Estado anímico',
      value: aiVal(summary.mood, 'No registrado'),
    },
    {
      bg: c.sage50,
      icon: 'leaf',
      iconColor: c.sage500,
      label: 'Cómo te vas',
      value: aiVal(summary.progressNote, 'Estás avanzando'),
      valueColor: c.sage500,
    },
    {
      bg: c.infoSurface,
      icon: 'wind',
      iconColor: c.primary,
      label: 'Técnica usada',
      value: aiVal(summary.techniqueUsed, 'Ninguna'),
    },
    {
      bg: c.sage50,
      icon: 'moon',
      iconColor: c.sage500,
      label: 'Detonante',
      value: aiVal(summary.trigger, 'Sin detonante'),
    },
  ];
}

interface Props {
  visible: boolean;
  summary: AiSessionSummary | null;
  durationMinutes: number;
  onContinue: () => void;
}

export function SessionSummaryModal({
  visible,
  summary,
  durationMinutes,
  onContinue,
}: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  if (!summary) return null;

  const chips = buildChips(summary, durationMinutes, c);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Ícono central */}
          <View style={styles.iconWrap}>
            <Icon name="clipboard-list" size={28} color={c.primaryText} />
            <View style={styles.iconCheck}>
              <Icon name="check" size={13} color={c.white} />
            </View>
          </View>

          <Text style={styles.title}>Sesión guardada</Text>
          <Text style={styles.sub}>
            Hablamos durante {durationMinutes} minuto{durationMinutes !== 1 ? 's' : ''}. Esto es lo que registré:
          </Text>

          {/* Grid 2x2 */}
          <View style={styles.grid}>
            {chips.map((c, i) => (
              <View key={i} style={[styles.chip, { backgroundColor: c.bg }]}>
                <View style={styles.chipIcon}>
                  <Icon name={c.icon} size={16} color={c.iconColor} />
                </View>
                <View style={styles.chipText}>
                  <Text style={styles.chipLabel}>{c.label}</Text>
                  <Text style={[styles.chipValue, c.valueColor ? { color: c.valueColor } : {}]}>
                    {c.value}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.noteRow}>
            <Icon name="lock" size={14} color={c.fg2} />
            <Text style={styles.note}>
              Este resumen ayuda al asistente a retomar la próxima vez. La conversación queda guardada en tu cuenta y tu psicólogo no la lee.
            </Text>
          </View>

          <Touchable
      rippleColor="rgba(255,255,255,0.28)" activeOpacity={0.85} onPress={onContinue} style={styles.btn} accessibilityRole="button">
            <Text style={styles.btnText}>Continuar</Text>
          </Touchable>

        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(30,45,44,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    width: '100%',
    backgroundColor: c.surface,
    borderRadius: 24,
    padding: 26,
    alignItems: 'center',
    shadowColor: c.shadowMedium,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: c.infoSurface,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconCheck: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: c.sage500,
    borderWidth: 3,
    borderColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: Fonts.headingBold, fontSize: 22, color: c.ink900, marginTop: 16 },
  sub: { fontFamily: Fonts.body, fontSize: 13, color: c.fg2, lineHeight: 18, textAlign: 'center', marginTop: 4 },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 20,
    width: '100%',
  },
  chip: {
    width: '47%',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chipIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { flex: 1 },
  chipLabel: { fontFamily: Fonts.bodyBold, fontSize: 12, color: c.fg2, letterSpacing: 0.3 },
  chipValue: { fontFamily: Fonts.bodyBold, fontSize: 13.5, color: c.ink900, marginTop: 2 },

  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 18,
    marginBottom: 18,
  },
  note: {
    fontFamily: Fonts.body,
    flex: 1,
    fontSize: 13,
    color: c.fg2,
    lineHeight: 18,
  },
  btn: {
    width: '100%',
    backgroundColor: c.primary,
    borderRadius: 9999,
    paddingVertical: 15,
    alignItems: 'center',
  },
  btnText: { fontFamily: Fonts.bodyBold, fontSize: 16, color: c.white },
});
