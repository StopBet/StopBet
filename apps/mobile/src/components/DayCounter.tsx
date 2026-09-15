import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { Palette } from '../constants/colors';
import { useColors, useStyles } from '../context/ThemeContext';
import { Fonts } from '../constants/typography';
import { Icon } from './Icon';

interface Props {
  days: number;
  milestone: number;
}

export function DayCounter({ days, milestone }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const pct = Math.min(days / milestone, 1);
  const daysLeft = milestone - days;

  // El aro era un borde verde entero: con 75 % de avance se leía como hito cumplido
  const RADIO = 65;
  const GROSOR = 10;
  const PERIMETRO = 2 * Math.PI * RADIO;

  return (
    <View style={styles.card}>
      <View style={styles.ringContainer}>
        <View style={styles.ring}>
          <Svg width={140} height={140} style={StyleSheet.absoluteFill}>
            <Circle
              cx={70}
              cy={70}
              r={RADIO}
              stroke={c.border}
              strokeWidth={GROSOR}
              fill="none"
            />
            <Circle
              cx={70}
              cy={70}
              r={RADIO}
              stroke={c.sage500}
              strokeWidth={GROSOR}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${PERIMETRO * pct} ${PERIMETRO}`}
              transform={`rotate(-90 70 70)`}
            />
          </Svg>
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
        <Icon name="medal" size={15} color={c.greenText} />
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  card: {
    backgroundColor: c.surface,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginHorizontal: 16,
    shadowColor: c.shadowMedium,
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
    backgroundColor: c.sage50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daysNumber: {
    fontFamily: Fonts.headingBold,
    fontSize: 44,
    lineHeight: 48,
    color: c.primaryText,
  },
  daysText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: c.fg2,
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
    fontFamily: Fonts.body,
    fontSize: 13,
    color: c.fg2,
  },
  milestonePercent: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    color: c.greenText,
  },
  progressBg: {
    height: 8,
    borderRadius: 9999,
    backgroundColor: c.sage50,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: c.sage500,
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
    fontFamily: Fonts.body,
    fontSize: 13,
    color: c.fg2,
    textAlign: 'center',
  },
});
