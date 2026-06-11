import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { EmotionType } from '@stopbet/shared-types';
import { Colors } from '../constants/colors';
import { Icon } from './Icon';

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
  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <Text style={styles.title}>Check emocional diario</Text>
        {done && (
          <View style={styles.badge}>
            <Icon name="check" size={13} color={Colors.sage500} />
            <Text style={styles.badgeText}>Completado hoy</Text>
          </View>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {EMOTIONS.map((o) => {
          const isSelected = done && selected === o.type;
          const dimmed = done && !isSelected;
          return (
            <TouchableOpacity
              key={o.type}
              activeOpacity={0.8}
              disabled={done}
              onPress={() => onPick(o.type)}
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
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
    fontWeight: '600',
    fontSize: 16,
    color: Colors.ink900,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.sage50,
    borderRadius: 9999,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  badgeText: {
    fontWeight: '700',
    fontSize: 12,
    color: Colors.sage500,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  emotionCard: {
    width: 64,
    minHeight: 84,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 4,
    shadowColor: Colors.shadowSoft,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  emotionCardSelected: {
    backgroundColor: Colors.sage50,
    borderColor: Colors.sage500,
    elevation: 0,
  },
  emotionCardDimmed: {
    opacity: 0.5,
  },
  emoji: {
    fontSize: 26,
  },
  label: {
    fontSize: 11.5,
    color: Colors.fg2,
  },
  labelSelected: {
    fontWeight: '600',
    color: Colors.sage500,
  },
});
