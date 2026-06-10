import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/colors';
import { Icon } from './Icon';

interface Props {
  title: string;
  stepLabel?: string;   // "Paso 1 de 3"
  onBack?: () => void;
}

export function TopBar({ title, stepLabel, onBack }: Props) {
  return (
    <View style={styles.bar}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={styles.backBtn}>
          <Icon name="arrow-left" size={18} color={Colors.fg1} />
        </TouchableOpacity>
      ) : (
        <View style={styles.backBtn} />
      )}
      <Text style={styles.title}>{title}</Text>
      {stepLabel ? (
        <Text style={styles.stepLabel}>{stepLabel}</Text>
      ) : (
        <View style={styles.spacer} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontWeight: '700',
    fontSize: 15,
    color: Colors.fg1,
  },
  stepLabel: {
    fontWeight: '600',
    fontSize: 13,
    color: Colors.fg2,
  },
  spacer: {
    width: 38,
  },
});
