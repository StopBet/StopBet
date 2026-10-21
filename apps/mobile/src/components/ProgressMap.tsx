import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Palette } from '../constants/colors';
import { Fonts } from '../constants/typography';
import { useColors, useStyles } from '../context/ThemeContext';
import { Icon } from './Icon';
import { JourneyPath, daysLeftText, daysText, lastReachedIndex, stopAt } from './JourneyPath';
import { Touchable } from './Touchable';

interface Props {
  days: number;
  onOpenJourney: () => void;
  onOpenAchievements: () => void;
}

// El Inicio es un scroll con más tarjetas debajo: acá va solo el tramo en que va el
// paciente. El camino entero se recorre en «Mi camino», que se abre tocando la tarjeta.
const VISIBLE_STOPS = 3;

export function ProgressMap({ days, onOpenJourney, onOpenAchievements }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);

  const reached = lastReachedIndex(days);
  const nextStop = stopAt(reached + 1);
  const daysLeft = nextStop.days - days;

  return (
    <View style={styles.card}>
      <Touchable
        onPress={onOpenJourney}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`${daysText(days)} sin apostar. ${daysLeftText(daysLeft)} para ${nextStop.label}.`}
        accessibilityHint="Abre tu camino completo"
      >
        <View style={styles.header}>
          <Text style={styles.daysNumber}>{days}</Text>
          <View style={styles.headerText}>
            <Text style={styles.daysLabel}>día{days === 1 ? '' : 's'} sin apostar</Text>
            <Text style={styles.nextLabel}>
              {daysLeftText(daysLeft)} para{' '}
              <Text style={styles.nextName}>{nextStop.label}</Text>
            </Text>
          </View>
          <Icon name="chevron-right" size={20} color={c.fg2} />
        </View>

        {/* Con tres paradas se deja la última ganada y las dos que vienen: lo recorrido ya
            asoma como camino verde por abajo, y lo que motiva es lo que falta. */}
        <JourneyPath days={days} first={reached} count={VISIBLE_STOPS} />
      </Touchable>

      <Touchable style={styles.footer} onPress={onOpenAchievements} accessibilityRole="button">
        <Text style={styles.footerText}>Ver todos mis logros</Text>
        <Icon name="chevron-right" size={18} color={c.primaryText} />
      </Touchable>
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  card: {
    backgroundColor: c.surface,
    borderRadius: 20,
    marginHorizontal: 16,
    overflow: 'hidden',
    shadowColor: c.shadowMedium,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 4,
  },
  headerText: {
    flex: 1,
  },
  daysNumber: {
    fontFamily: Fonts.headingBold,
    fontSize: 48,
    lineHeight: 52,
    color: c.primaryText,
  },
  daysLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 15,
    color: c.fg1,
  },
  nextLabel: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: c.fg2,
    marginTop: 2,
  },
  nextName: {
    fontFamily: Fonts.bodyBold,
    color: c.fg1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 48,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  footerText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    color: c.primaryText,
  },
});
