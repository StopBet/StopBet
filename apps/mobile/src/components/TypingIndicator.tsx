import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import type { Palette } from '../constants/colors';
import { useStyles } from '../context/ThemeContext';
import { useReduceMotion } from '../hooks/useReduceMotion';

export function TypingIndicator() {
  const styles = useStyles(makeStyles);
  const reduceMotion = useReduceMotion();
  const dots = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    // Tres puntos saltando sin parar mientras el asistente responde: con "quitar
    // animaciones" se dejan quietos y visibles, que es lo que informan igual.
    if (reduceMotion) {
      dots.forEach((d) => d.setValue(1));
      return;
    }
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 200),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay((2 - i) * 200),
        ]),
      ),
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, [reduceMotion]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.container}>
      {dots.map((dot, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            {
              opacity: dot,
              transform: [
                {
                  translateY: dot.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -3],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: c.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 13,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: c.fg2,
  },
});
