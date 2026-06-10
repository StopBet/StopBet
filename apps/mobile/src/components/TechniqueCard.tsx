import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { TechniqueType } from '@stopbet/shared-types';
import { Colors } from '../constants/colors';
import { Icon, type IconName } from './Icon';

interface TechniqueStep {
  label: string;
  secs?: string;
}

const TECHNIQUES: Record<
  TechniqueType,
  { title: string; icon: IconName; steps: TechniqueStep[] }
> = {
  breathing: {
    title: 'Respiración 4-7-8',
    icon: 'wind',
    steps: [
      { label: 'Inhala por la nariz',  secs: '4 seg' },
      { label: 'Mantén el aire',        secs: '7 seg' },
      { label: 'Exhala despacio',       secs: '8 seg' },
    ],
  },
  grounding: {
    title: 'Grounding 5-4-3-2-1',
    icon: 'leaf',
    steps: [
      { label: 'Nombra 5 cosas que ves' },
      { label: 'Toca 4 cosas a tu alrededor' },
      { label: 'Escucha 3 sonidos' },
      { label: 'Huele 2 aromas' },
      { label: 'Saborea 1 cosa' },
    ],
  },
  postponement: {
    title: 'Postponer el impulso',
    icon: 'hourglass',
    steps: [
      { label: 'Reconoce el impulso sin actuar' },
      { label: 'Comprométete a esperar 30 minutos' },
      { label: 'Haz otra actividad mientras tanto' },
      { label: 'Evalúa si el impulso bajó' },
    ],
  },
};

interface Props {
  type: TechniqueType;
  onStart: () => void;
}

export function TechniqueCard({ type, onStart }: Props) {
  const t = TECHNIQUES[type];
  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Icon name={t.icon} size={16} color={Colors.primary} />
        <Text style={styles.title}>{t.title}</Text>
      </View>

      <View style={styles.steps}>
        {t.steps.map((step, i) => (
          <View key={i} style={styles.stepRow}>
            <View style={styles.num}>
              <Text style={styles.numText}>{i + 1}</Text>
            </View>
            <Text style={styles.stepLabel}>{step.label}</Text>
            {step.secs && <Text style={styles.secs}>{step.secs}</Text>}
          </View>
        ))}
      </View>

      <TouchableOpacity activeOpacity={0.85} onPress={onStart} style={styles.cta}>
        <Icon name={t.icon} size={15} color={Colors.white} />
        <Text style={styles.ctaText}>Iniciar guía</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#E8F5F3',
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 16,
    padding: 14,
    maxWidth: '88%',
    alignSelf: 'flex-start',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontWeight: '600',
    fontSize: 15,
    color: Colors.primary,
  },
  steps: {
    marginTop: 12,
    gap: 8,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  num: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numText: {
    fontWeight: '700',
    fontSize: 12,
    color: Colors.white,
  },
  stepLabel: {
    flex: 1,
    fontSize: 13.5,
    color: Colors.ink900,
  },
  secs: {
    fontSize: 12,
    color: Colors.fg2,
    fontWeight: '600',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary,
    borderRadius: 9999,
    paddingHorizontal: 18,
    paddingVertical: 9,
    marginTop: 14,
  },
  ctaText: {
    fontWeight: '700',
    fontSize: 13.5,
    color: Colors.white,
  },
});
