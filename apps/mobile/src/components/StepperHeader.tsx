import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/colors';
import { Icon } from './Icon';

interface Props {
  current: 1 | 2 | 3;
  labels?: [string, string, string];
}

type StepState = 'done' | 'active' | 'todo';

export function StepperHeader({ current, labels = ['Datos', 'Sede', 'Pago'] }: Props) {
  const state = (step: 1 | 2 | 3): StepState => {
    if (step < current) return 'done';
    if (step === current) return 'active';
    return 'todo';
  };

  return (
    <View style={styles.wrapper}>
      {([1, 2, 3] as const).map((step, idx) => {
        const s = state(step);
        return (
          <React.Fragment key={step}>
            <View style={styles.item}>
              <View style={[styles.dot, s === 'active' && styles.dotActive, s === 'done' && styles.dotDone]}>
                {s === 'done' ? (
                  <Icon name="check" size={15} color={Colors.white} />
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
            {idx < 2 && (
              <View style={[styles.line, s === 'done' && styles.lineDone]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  dotActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dotDone: {
    backgroundColor: Colors.sage500,
    borderColor: Colors.sage500,
  },
  dotNum: {
    fontWeight: '800',
    fontSize: 14,
    color: Colors.fg2,
  },
  dotNumActive: {
    color: Colors.white,
  },
  cap: {
    fontWeight: '600',
    fontSize: 11,
    color: Colors.fg2,
  },
  capActive: {
    color: Colors.primary,
  },
  capDone: {
    color: Colors.sage500,
  },
  line: {
    flex: 1,
    height: 2,
    backgroundColor: Colors.border,
    marginTop: 15,
    borderRadius: 2,
  },
  lineDone: {
    backgroundColor: Colors.sage500,
  },
});
