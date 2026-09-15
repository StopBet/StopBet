import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Palette } from '../constants/colors';
import { useColors, useStyles } from '../context/ThemeContext';
import { Fonts } from '../constants/typography';
import { Icon } from './Icon';
import { Touchable } from './Touchable';

interface Props {
  title: string;
  stepLabel?: string;   // "Paso 1 de 3"
  onBack?: () => void;
}

export function TopBar({ title, stepLabel, onBack }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.bar}>
      {onBack ? (
        <Touchable
          onPress={onBack}
          activeOpacity={0.7}
          style={styles.backBtn}
          hitSlop={5}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <Icon name="arrow-left" size={18} color={c.fg1} />
        </Touchable>
      ) : (
        <View style={styles.backBtn} />
      )}
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      {stepLabel ? (
        <Text style={styles.stepLabel}>{stepLabel}</Text>
      ) : (
        <View style={styles.spacer} />
      )}
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 6,
    paddingTop: 2,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: Fonts.bodyBold,
    flex: 1,
    fontSize: 15,
    color: c.fg1,
  },
  stepLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    color: c.fg2,
  },
  spacer: {
    width: 38,
  },
});
