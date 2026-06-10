import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/colors';
import { Icon } from './Icon';

interface Props {
  days: number;
  milestone: number;
}

export function DayCounter({ days, milestone }: Props) {
  const pct = Math.min(days / milestone, 1);
  const daysLeft = milestone - days;

  return (
    <View style={styles.card}>
      <View style={styles.ringContainer}>
        <View style={styles.ring}>
          <Text style={styles.daysNumber}>{days}</Text>
          <Text style={styles.daysText}>días sin apostar</Text>
        </View>
      </View>

      <View style={styles.milestoneRow}>
        <Text style={styles.milestoneLabel}>Próximo hito · {milestone} días</Text>
        <Text style={styles.milestonePercent}>{Math.round(pct * 100)}%</Text>
      </View>

      <View style={styles.progressBg}>
        <View style={[styles.progressFill, { width: `${pct * 100}%` }]} />
      </View>

      <View style={styles.daysLeftRow}>
        <Text style={styles.daysLeftText}>
          {daysLeft} días para tu próxima insignia
        </Text>
        <Icon name="medal" size={15} color={Colors.gold} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginHorizontal: 16,
    shadowColor: Colors.shadowMedium,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  ringContainer: {
    alignItems: 'center',
  },
  ring: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 10,
    borderColor: Colors.sage500,
    backgroundColor: Colors.sage50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daysNumber: {
    fontFamily: 'System',
    fontWeight: '800',
    fontSize: 44,
    lineHeight: 48,
    color: Colors.primary,
  },
  daysText: {
    fontSize: 12,
    color: Colors.fg2,
    marginTop: 4,
  },
  milestoneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 16,
    marginBottom: 6,
  },
  milestoneLabel: {
    fontSize: 13,
    color: Colors.fg2,
  },
  milestonePercent: {
    fontWeight: '700',
    fontSize: 13,
    color: Colors.sage500,
  },
  progressBg: {
    height: 8,
    borderRadius: 9999,
    backgroundColor: Colors.sage50,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.sage500,
    borderRadius: 9999,
  },
  daysLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 10,
  },
  daysLeftText: {
    fontSize: 13,
    color: Colors.fg2,
    textAlign: 'center',
  },
});
