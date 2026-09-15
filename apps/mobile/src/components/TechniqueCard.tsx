import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { TechniqueType } from '@stopbet/shared-types';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/typography';
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
}

export function TechniqueCard({ type }: Props) {
  const t = TECHNIQUES[type];
  // null: la guía no ha empezado · steps.length: la guía terminó
  const [step, setStep] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);

  const finished = step !== null && step >= t.steps.length;
  const current = step !== null && !finished ? t.steps[step] : null;
  const timed = current?.secs ? parseInt(current.secs, 10) : 0;

  useEffect(() => {
    if (!timed) return;
    setRemaining(timed);
    const id = setInterval(() => setRemaining((r) => r - 1), 1000);
    return () => clearInterval(id);
  }, [step, timed]);

  useEffect(() => {
    if (timed && remaining <= 0 && step !== null) setStep(step + 1);
  }, [remaining]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = () => setStep((s) => (s === null ? 0 : s + 1));

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Icon name={t.icon} size={16} color={Colors.primary} />
        <Text style={styles.title}>{t.title}</Text>
      </View>

      <View style={styles.steps}>
        {t.steps.map((s, i) => {
          const active = step === i;
          const done = step !== null && i < step;
          return (
            <View key={i} style={[styles.stepRow, active && styles.stepRowActive]}>
              <View style={[styles.num, done && styles.numDone]}>
                {done ? (
                  <Icon name="check" size={12} color={Colors.white} />
                ) : (
                  <Text style={styles.numText}>{i + 1}</Text>
                )}
              </View>
              <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{s.label}</Text>
              {s.secs && (
                <Text style={[styles.secs, active && styles.secsActive]}>
                  {active ? `${Math.max(remaining, 0)} s` : s.secs}
                </Text>
              )}
            </View>
          );
        })}
      </View>

      <Text style={styles.status} accessibilityLiveRegion="polite">
        {finished
          ? 'Listo. Cuéntame cómo te sientes ahora.'
          : current
            ? `Paso ${(step ?? 0) + 1} de ${t.steps.length}: ${current.label}`
            : 'Te acompaño paso a paso.'}
      </Text>

      <View style={styles.actions}>
        {step === null && (
          <TouchableOpacity activeOpacity={0.85} onPress={next} style={styles.cta} accessibilityRole="button">
            <Icon name={t.icon} size={15} color={Colors.white} />
            <Text style={styles.ctaText}>Iniciar guía</Text>
          </TouchableOpacity>
        )}
        {current && !current.secs && (
          <TouchableOpacity activeOpacity={0.85} onPress={next} style={styles.cta} accessibilityRole="button">
            <Text style={styles.ctaText}>{step === t.steps.length - 1 ? 'Terminar' : 'Siguiente'}</Text>
            <Icon name="arrow-right" size={15} color={Colors.white} />
          </TouchableOpacity>
        )}
        {current && current.secs && (
          <TouchableOpacity activeOpacity={0.85} onPress={() => setStep(null)} style={styles.ctaGhost} accessibilityRole="button">
            <Text style={styles.ctaGhostText}>Detener</Text>
          </TouchableOpacity>
        )}
        {finished && (
          <TouchableOpacity activeOpacity={0.85} onPress={() => setStep(0)} style={styles.ctaGhost} accessibilityRole="button">
            <Text style={styles.ctaGhostText}>Repetir</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.amber50,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 16,
    padding: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontFamily: Fonts.bodyBold,
    fontSize: 15,
    color: Colors.primary,
  },
  steps: {
    marginTop: 12,
    gap: 4,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  stepRowActive: {
    backgroundColor: Colors.surface,
  },
  num: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numDone: {
    backgroundColor: Colors.fg2,
  },
  numText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    color: Colors.white,
  },
  stepLabel: {
    fontFamily: Fonts.body,
    flex: 1,
    fontSize: 13.5,
    color: Colors.ink900,
  },
  stepLabelActive: {
    fontFamily: Fonts.bodyBold,
  },
  secs: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    color: Colors.fg2,
    minWidth: 44,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  secsActive: {
    color: Colors.primary,
    fontSize: 14,
  },
  status: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.fg1,
    marginTop: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: Colors.primary,
    borderRadius: 9999,
    paddingHorizontal: 18,
    minHeight: 48,
  },
  ctaText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    color: Colors.white,
  },
  ctaGhost: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingHorizontal: 18,
    minHeight: 48,
  },
  ctaGhostText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    color: Colors.primary,
  },
});
