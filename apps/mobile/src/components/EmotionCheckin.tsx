import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { EmotionType } from '@stopbet/shared-types';
import type { Palette } from '../constants/colors';
import { useColors, useStyles } from '../context/ThemeContext';
import { Fonts } from '../constants/typography';
import { Icon } from './Icon';
import { Touchable } from './Touchable';

const EMOTIONS: { type: EmotionType; emoji: string; label: string }[] = [
  { type: 'tired',   emoji: '😴', label: 'Cansado' },
  { type: 'anxious', emoji: '😟', label: 'Ansioso' },
  { type: 'angry',   emoji: '😤', label: 'Enojado' },
  { type: 'lonely',  emoji: '😞', label: 'Solo'    },
  { type: 'good',    emoji: '😊', label: 'Bien'    },
];

interface Props {
  done: boolean;
  selected: EmotionType | null;
  onPick: (emotion: EmotionType) => void;
}

export function EmotionCheckin({ done, selected, onPick }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        {/* "Check emocional diario" era un anglicismo y no decía quién lo lee */}
        <Text style={styles.title} accessibilityRole="header">¿Cómo te sientes hoy?</Text>
        {done && (
          <View style={styles.badge}>
            <Icon name="check" size={13} color={c.greenText} />
            <Text style={styles.badgeText}>Completado hoy</Text>
          </View>
        )}
      </View>

      <Text style={styles.subtitle}>Tu psicólogo verá cómo te sentiste.</Text>

      {/* Cinco columnas flexibles: con la fila desplazable y tarjetas de 64 dp fijos,
          en pantallas de 360 dp "Bien" - la única opción positiva - quedaba fuera de la vista */}
      <View style={styles.row}>
        {EMOTIONS.map((o) => {
          const isSelected = done && selected === o.type;
          const dimmed = done && !isSelected;
          return (
            <Touchable
              key={o.type}
              activeOpacity={0.8}
              disabled={done}
              onPress={() => onPick(o.type)}
              // sin label TalkBack leería el nombre del emoji antes que la emoción
              accessibilityRole="button"
              accessibilityLabel={o.label}
              accessibilityState={{ selected: isSelected, disabled: done }}
              style={[
                styles.emotionCard,
                isSelected && styles.emotionCardSelected,
                dimmed && styles.emotionCardDimmed,
              ]}
            >
              <Text style={styles.emoji}>{o.emoji}</Text>
              <Text style={[styles.label, isSelected && styles.labelSelected]}>
                {o.label}
              </Text>
            </Touchable>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  wrapper: {
    paddingTop: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  title: {
    fontFamily: Fonts.headingBold,
    fontSize: 16,
    color: c.ink900,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: c.sage50,
    borderRadius: 9999,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  badgeText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    color: c.greenText,
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
    color: c.fg2,
    paddingHorizontal: 16,
    marginBottom: 12,
    marginTop: -6,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
  },
  emotionCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 92,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: c.surface,
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 2,
    shadowColor: c.shadowSoft,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  emotionCardSelected: {
    backgroundColor: c.sage50,
    borderColor: c.sage500,
    elevation: 0,
  },
  emotionCardDimmed: {
    opacity: 0.5,
  },
  emoji: {
    fontFamily: Fonts.body,
    fontSize: 26,
  },
  label: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: c.fg2,
    textAlign: 'center',
  },
  labelSelected: {
    fontFamily: Fonts.bodyBold,
    color: c.greenText,
  },
});
