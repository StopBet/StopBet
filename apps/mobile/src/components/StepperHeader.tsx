import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Palette } from '../constants/colors';
import { useColors, useStyles } from '../context/ThemeContext';
import { Fonts } from '../constants/typography';
import { Icon } from './Icon';

interface Props {
  current: number;
  /** El registro termina en "Solicitud enviada": prometer un paso "Pago" que nadie
   *  alcanza es un contrato que la app no cumple. Cuando exista la pasarela, se agrega. */
  labels?: string[];
}

type StepState = 'done' | 'active' | 'todo';

export function StepperHeader({ current, labels = ['Datos', 'Sede'] }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const steps = labels.map((_, i) => i + 1);
  const state = (step: number): StepState => {
    if (step < current) return 'done';
    if (step === current) return 'active';
    return 'todo';
  };

  return (
    <View style={styles.wrapper}>
      {steps.map((step, idx) => {
        const s = state(step);
        return (
          <React.Fragment key={step}>
            <View style={styles.item}>
              <View style={[styles.dot, s === 'active' && styles.dotActive, s === 'done' && styles.dotDone]}>
                {s === 'done' ? (
                  <Icon name="check" size={15} color={c.white} />
                ) : (
                  <Text style={[styles.dotNum, s === 'active' && styles.dotNumActive]}>{step}</Text>
                )}
              </View>
              <Text style={[
                styles.cap,
                s === 'active' && styles.capActive,
                s === 'done' && styles.capDone,
              ]}>
                {labels[idx]}
              </Text>
            </View>
            {idx < steps.length - 1 && (
              <View style={[styles.line, s === 'done' && styles.lineDone]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 26,
    paddingBottom: 16,
    paddingTop: 8,
  },
  item: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 7,
    width: 56,
  },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface,
    borderWidth: 2,
    borderColor: c.border,
  },
  dotActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  dotDone: {
    backgroundColor: c.sage500,
    borderColor: c.sage500,
  },
  dotNum: {
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    color: c.fg2,
  },
  dotNumActive: {
    color: c.white,
  },
  cap: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    color: c.fg2,
  },
  capActive: {
    color: c.primaryText,
  },
  capDone: {
    color: c.greenText,
  },
  line: {
    flex: 1,
    height: 2,
    backgroundColor: c.border,
    marginTop: 15,
    borderRadius: 2,
  },
  lineDone: {
    backgroundColor: c.sage500,
  },
});
