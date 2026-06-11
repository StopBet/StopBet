import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');

const COLORS = ['#E8883A', '#F0B040', '#4CAF50', '#2196F3', '#E91E63', '#9C27B0', '#FF5722', '#00BCD4', '#FFEB3B'];
const COUNT = 70;

interface Particle {
  tx: Animated.Value;
  ty: Animated.Value;
  opacity: Animated.Value;
  rotate: Animated.Value;
  color: string;
  size: number;
  startX: number;
  isRect: boolean;
}

function makeParticles(): Particle[] {
  return Array.from({ length: COUNT }, (_, i) => {
    // Primeros 20: burst desde el centro (fuegos artificiales)
    // Resto: confetti que cae desde arriba
    const isBurst = i < 20;
    return {
      tx: new Animated.Value(0),
      ty: new Animated.Value(0),
      opacity: new Animated.Value(0),
      rotate: new Animated.Value(0),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: isBurst ? 8 + Math.random() * 6 : 6 + Math.random() * 8,
      startX: Math.random() * W,
      isRect: Math.random() > 0.5,
    };
  });
}

export function ConfettiEffect({ active }: { active: boolean }) {
  const particles = useRef<Particle[]>(makeParticles()).current;

  useEffect(() => {
    if (!active) return;

    // Reset todos los valores
    particles.forEach((p) => {
      p.tx.setValue(0);
      p.ty.setValue(0);
      p.opacity.setValue(0);
      p.rotate.setValue(0);
    });

    const anims = particles.map((p, i) => {
      const isBurst = i < 20;

      if (isBurst) {
        // Explota desde el centro-superior hacia afuera
        const angle = (i / 20) * 2 * Math.PI;
        const dist = 120 + Math.random() * 160;
        const destX = Math.cos(angle) * dist;
        const destY = -80 - Math.sin(angle) * dist * 0.6;

        return Animated.sequence([
          Animated.delay(i * 15),
          Animated.parallel([
            Animated.timing(p.opacity, { toValue: 1, duration: 80, useNativeDriver: true }),
            Animated.timing(p.tx, { toValue: destX, duration: 500 + Math.random() * 200, useNativeDriver: true }),
            Animated.timing(p.ty, {
              toValue: destY + 300, // cae por gravedad
              duration: 900 + Math.random() * 300,
              useNativeDriver: true,
            }),
            Animated.timing(p.rotate, { toValue: 1, duration: 900, useNativeDriver: true }),
            Animated.sequence([
              Animated.delay(400),
              Animated.timing(p.opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
            ]),
          ]),
        ]);
      } else {
        // Confetti cae desde la parte superior con deriva lateral
        const driftX = (Math.random() - 0.5) * 120;
        const fallY = H * 0.7 + Math.random() * 200;
        const delay = Math.random() * 300;

        return Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(p.opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
            Animated.timing(p.tx, { toValue: driftX, duration: 1400 + Math.random() * 600, useNativeDriver: true }),
            Animated.timing(p.ty, { toValue: fallY, duration: 1400 + Math.random() * 600, useNativeDriver: true }),
            Animated.timing(p.rotate, { toValue: 3 + Math.random() * 4, duration: 1600, useNativeDriver: true }),
            Animated.sequence([
              Animated.delay(900),
              Animated.timing(p.opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
            ]),
          ]),
        ]);
      }
    });

    Animated.parallel(anims).start();
  }, [active]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p, i) => {
        const isBurst = i < 20;
        const originX = isBurst ? W / 2 : p.startX;
        const originY = isBurst ? H * 0.25 : -20;

        const spin = p.rotate.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '360deg'],
        });

        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: originX - p.size / 2,
              top: originY - p.size / 2,
              width: p.size,
              height: p.isRect ? p.size * 0.5 : p.size,
              borderRadius: p.isRect ? 2 : p.size / 2,
              backgroundColor: p.color,
              opacity: p.opacity,
              transform: [
                { translateX: p.tx },
                { translateY: p.ty },
                { rotate: spin },
              ],
            }}
          />
        );
      })}
    </View>
  );
}
