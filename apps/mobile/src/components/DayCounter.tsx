import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Colors } from '../constants/colors';

interface Props {
  days: number;
  milestone: number;
}

const RING_RADIUS = 60;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function DayCounter({ days, milestone }: Props) {
  const pct = Math.min(days / milestone, 1);
  const offset = CIRCUMFERENCE * (1 - pct);
  const daysLeft = milestone - days;

  return (
    <View style={styles.card}>
      <View style={styles.ringContainer}>
        <Svg width={140} height={140} style={styles.svg}>
          <Circle
            cx={70} cy={70} r={RING_RADIUS}
            fill="none" stroke={Colors.sage50} strokeWidth={10}
          />
          <Circle
            cx={70} cy={70} r={RING_RADIUS}
            fill="none" stroke={Colors.sage500} strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            strokeDashoffset={offset}
            // Rotación para que el arco empiece arriba
            rotation="-90" origin="70, 70"
          />
        </Svg>
        <View style={styles.ringLabel}>
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

      <Text style={styles.daysLeftText}>
        {daysLeft} días para tu próxima insignia 🏅
      </Text>
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
    position: 'relative',
  },
  svg: {},
  ringLabel: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
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
  daysLeftText: {
    fontSize: 13,
    color: Colors.fg2,
    marginTop: 10,
    textAlign: 'center',
  },
});
