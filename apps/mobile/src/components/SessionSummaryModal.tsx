import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { AiSessionSummary } from '@stopbet/shared-types';
import { Colors } from '../constants/colors';
import { Icon, type IconName } from './Icon';

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

function buildChips(summary: AiSessionSummary, durationMinutes: number): SummaryChip[] {
  return [
    {
      bg: '#EAF3F2',
      icon: 'chart-column',
      iconColor: Colors.primary,
      label: 'Estado anímico',
      value: aiVal(summary.mood, 'No registrado'),
    },
    {
      bg: Colors.sage50,
      icon: 'leaf',
      iconColor: Colors.sage500,
      label: 'Hoy fue intenso',
      value: aiVal(summary.progressNote, 'Estás avanzando'),
      valueColor: Colors.sage500,
    },
    {
      bg: '#EAF3F2',
      icon: 'wind',
      iconColor: Colors.primary,
      label: 'Técnica usada',
      value: aiVal(summary.techniqueUsed, 'Ninguna'),
    },
    {
      bg: Colors.sage50,
      icon: 'moon',
      iconColor: Colors.sage500,
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
  onViewHistory: () => void;
}

export function SessionSummaryModal({
  visible,
  summary,
  durationMinutes,
  onContinue,
  onViewHistory,
}: Props) {
  if (!summary) return null;

  const chips = buildChips(summary, durationMinutes);

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
            <Icon name="clipboard-list" size={28} color={Colors.primary} />
            <View style={styles.iconCheck}>
              <Icon name="check" size={13} color={Colors.white} />
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
            <Icon name="lock" size={14} color={Colors.fg2} />
            <Text style={styles.note}>
              Solo se guarda este resumen general; el contenido de la conversación es privado y no se almacena. Tu psicólogo ve tu evolución para acompañarte mejor.
            </Text>
          </View>

          <TouchableOpacity activeOpacity={0.85} onPress={onContinue} style={styles.btn}>
            <Text style={styles.btnText}>Continuar</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onViewHistory} style={styles.linkBtn}>
            <Text style={styles.linkText}>Ver historial de sesiones</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(30,45,44,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 26,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EAF3F2',
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
    backgroundColor: Colors.sage500,
    borderWidth: 3,
    borderColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontWeight: '800', fontSize: 22, color: Colors.ink900, marginTop: 16 },
  sub: { fontSize: 13, color: Colors.fg2, lineHeight: 18, textAlign: 'center', marginTop: 4 },

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
  chipLabel: { fontSize: 10, color: Colors.fg2, fontWeight: '600', letterSpacing: 0.3 },
  chipValue: { fontWeight: '700', fontSize: 13.5, color: Colors.ink900, marginTop: 2 },

  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 18,
    marginBottom: 18,
  },
  note: {
    flex: 1,
    fontSize: 13,
    color: Colors.fg2,
    lineHeight: 18,
  },
  btn: {
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 9999,
    paddingVertical: 15,
    alignItems: 'center',
  },
  btnText: { fontWeight: '700', fontSize: 16, color: Colors.white },
  linkBtn: { marginTop: 12, padding: 4 },
  linkText: { fontWeight: '700', fontSize: 14, color: Colors.primary },
});
