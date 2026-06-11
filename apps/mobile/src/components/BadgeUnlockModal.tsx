import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { BadgeMilestone } from '@stopbet/shared-types';
import { Colors } from '../constants/colors';
import { Icon, type IconName } from './Icon';

interface BadgeDef {
  label: string;
  icon: IconName;
  daysLabel: string;
}

interface Props {
  milestone: BadgeMilestone | null;
  badgeDef: BadgeDef | null;
  onShare: () => void;
  onClose: () => void;
}

// Spark particles — pre-computed angles/distances so they're stable across renders
const SPARKS = [
  { angle: 0,   dist: 78, color: '#F0B040', size: 10 },
  { angle: 35,  dist: 92, color: '#E8883A', size: 7 },
  { angle: 72,  dist: 68, color: '#FFD060', size: 12 },
  { angle: 112, dist: 84, color: '#C9954A', size: 8 },
  { angle: 155, dist: 76, color: '#F0B040', size: 10 },
  { angle: 198, dist: 88, color: '#E8883A', size: 7 },
  { angle: 242, dist: 72, color: '#FFD060', size: 9 },
  { angle: 285, dist: 82, color: '#C9954A', size: 8 },
  { angle: 328, dist: 70, color: '#F0B040', size: 11 },
  { angle: 50,  dist: 96, color: '#C9954A', size: 5 },
  { angle: 150, dist: 94, color: '#F0B040', size: 5 },
  { angle: 250, dist: 98, color: '#E8883A', size: 5 },
] as const;

// Container big enough so sparks stay within bounds (center=100, max dist=98 → max reach=198 < 200)
const AREA = 200;
const CENTER = AREA / 2;

export function BadgeUnlockModal({ milestone, badgeDef, onShare, onClose }: Props) {
  const visible = milestone !== null && badgeDef !== null;

  // ── Animated values ────────────────────────────────────────────────────────
  const overlayOp   = useRef(new Animated.Value(0)).current;
  const modalY      = useRef(new Animated.Value(70)).current;
  const modalOp     = useRef(new Animated.Value(0)).current;
  const badgeScale  = useRef(new Animated.Value(0)).current;
  const ringScale   = useRef(new Animated.Value(0.25)).current;
  const ringOp      = useRef(new Animated.Value(0.95)).current;
  const textOp      = useRef(new Animated.Value(0)).current;
  const textY       = useRef(new Animated.Value(14)).current;
  const btnsOp      = useRef(new Animated.Value(0)).current;

  const sparks = useRef(
    SPARKS.map(() => ({
      x:  new Animated.Value(0),
      y:  new Animated.Value(0),
      op: new Animated.Value(0),
      sc: new Animated.Value(0),
    })),
  ).current;

  const reset = () => {
    overlayOp.setValue(0);
    modalY.setValue(70);
    modalOp.setValue(0);
    badgeScale.setValue(0);
    ringScale.setValue(0.25);
    ringOp.setValue(0.95);
    textOp.setValue(0);
    textY.setValue(14);
    btnsOp.setValue(0);
    sparks.forEach((s) => { s.x.setValue(0); s.y.setValue(0); s.op.setValue(0); s.sc.setValue(0); });
  };

  useEffect(() => {
    if (!visible) { reset(); return; }
    reset();

    // Phase 1 — overlay + modal slide-up
    Animated.parallel([
      Animated.timing(overlayOp, {
        toValue: 1, duration: 240,
        easing: Easing.out(Easing.quad), useNativeDriver: true,
      }),
      Animated.timing(modalOp, {
        toValue: 1, duration: 320,
        easing: Easing.out(Easing.quad), useNativeDriver: true,
      }),
      Animated.timing(modalY, {
        toValue: 0, duration: 400,
        easing: Easing.out(Easing.back(1.6)), useNativeDriver: true,
      }),
    ]).start(() => {
      // Phase 2 — badge pop + ring + sparks + text
      Animated.parallel([
        // Shockwave ring
        Animated.parallel([
          Animated.timing(ringScale, {
            toValue: 2.4, duration: 540,
            easing: Easing.out(Easing.quad), useNativeDriver: true,
          }),
          Animated.timing(ringOp, {
            toValue: 0, duration: 540,
            easing: Easing.in(Easing.quad), useNativeDriver: true,
          }),
        ]),
        // Badge dramatic spring
        Animated.spring(badgeScale, {
          toValue: 1, friction: 3.5, tension: 140, useNativeDriver: true,
        }),
        // Spark burst (staggered)
        Animated.stagger(
          22,
          SPARKS.map((spark, i) => {
            const rad = (spark.angle * Math.PI) / 180;
            return Animated.parallel([
              Animated.timing(sparks[i].x, {
                toValue: Math.cos(rad) * spark.dist,
                duration: 430, easing: Easing.out(Easing.cubic), useNativeDriver: true,
              }),
              Animated.timing(sparks[i].y, {
                toValue: Math.sin(rad) * spark.dist,
                duration: 430, easing: Easing.out(Easing.cubic), useNativeDriver: true,
              }),
              Animated.sequence([
                Animated.timing(sparks[i].op, { toValue: 1, duration: 70, useNativeDriver: true }),
                Animated.timing(sparks[i].op, {
                  toValue: 0, duration: 360,
                  easing: Easing.in(Easing.quad), useNativeDriver: true,
                }),
              ]),
              Animated.timing(sparks[i].sc, {
                toValue: 1, duration: 430,
                easing: Easing.out(Easing.quad), useNativeDriver: true,
              }),
            ]);
          }),
        ),
        // Text slide-up (delayed)
        Animated.sequence([
          Animated.delay(200),
          Animated.parallel([
            Animated.timing(textOp, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.timing(textY, {
              toValue: 0, duration: 300,
              easing: Easing.out(Easing.quad), useNativeDriver: true,
            }),
          ]),
        ]),
        // Buttons fade-in (more delayed)
        Animated.sequence([
          Animated.delay(380),
          Animated.timing(btnsOp, { toValue: 1, duration: 270, useNativeDriver: true }),
        ]),
      ]).start();
    });
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible || !milestone || !badgeDef) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[styles.overlay, { opacity: overlayOp }]}>
        <Animated.View
          style={[styles.modal, { opacity: modalOp, transform: [{ translateY: modalY }] }]}
        >
          {/* Badge animation area */}
          <View style={styles.badgeArea}>
            {/* Shockwave ring */}
            <Animated.View
              style={[styles.ring, { opacity: ringOp, transform: [{ scale: ringScale }] }]}
            />

            {/* Spark particles */}
            {SPARKS.map((spark, i) => (
              <Animated.View
                key={i}
                style={{
                  position: 'absolute',
                  left: CENTER - spark.size / 2,
                  top: CENTER - spark.size / 2,
                  width: spark.size,
                  height: spark.size,
                  borderRadius: spark.size / 2,
                  backgroundColor: spark.color,
                  opacity: sparks[i].op,
                  transform: [
                    { translateX: sparks[i].x },
                    { translateY: sparks[i].y },
                    { scale: sparks[i].sc },
                  ],
                }}
              />
            ))}

            {/* Badge disc */}
            <Animated.View
              style={[styles.badgeDisc, { transform: [{ scale: badgeScale }] }]}
            >
              <Icon name={badgeDef.icon} size={42} color="#C9954A" />
            </Animated.View>
          </View>

          {/* Text */}
          <Animated.View
            style={{ opacity: textOp, transform: [{ translateY: textY }], alignItems: 'center', width: '100%' }}
          >
            <Text style={styles.headline}>¡Nueva insignia desbloqueada!</Text>
            <Text style={styles.days}>{milestone}</Text>
            <Text style={styles.daysUnit}>días sin apostar</Text>
            <Text style={styles.label}>{badgeDef.label}</Text>
            <Text style={styles.sub}>Compártela con quienes te acompañan en tu sede.</Text>
          </Animated.View>

          {/* Buttons */}
          <Animated.View style={{ opacity: btnsOp, width: '100%', alignItems: 'center', marginTop: 4 }}>
            <TouchableOpacity style={styles.btnPrimary} onPress={onShare} activeOpacity={0.85}>
              <Icon name="users" size={18} color={Colors.white} />
              <Text style={styles.btnPrimaryText}>Compartir con la comunidad</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.btnLink}>
              <Text style={styles.btnLinkText}>Ahora no</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(30,20,10,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modal: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 28,
    paddingTop: 8,
    paddingBottom: 28,
    paddingHorizontal: 28,
    alignItems: 'center',
    shadowColor: Colors.ink900,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 28,
    elevation: 18,
    overflow: 'visible',
  },
  badgeArea: {
    width: AREA,
    height: AREA,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  ring: {
    position: 'absolute',
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 5,
    borderColor: Colors.accent,
  },
  badgeDisc: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: '#FDF8E1',
    borderWidth: 3,
    borderColor: '#C9954A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#C9954A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 8,
  },
  headline: {
    fontWeight: '800',
    fontSize: 19,
    color: Colors.ink900,
    textAlign: 'center',
    marginBottom: 4,
  },
  days: {
    fontWeight: '900',
    fontSize: 58,
    color: Colors.primary,
    letterSpacing: -2,
    lineHeight: 62,
  },
  daysUnit: {
    fontWeight: '600',
    fontSize: 16,
    color: Colors.fg2,
    marginTop: 0,
  },
  label: {
    fontWeight: '700',
    fontSize: 14,
    color: Colors.accent,
    marginTop: 5,
  },
  sub: {
    fontSize: 13,
    color: Colors.fg2,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 8,
    marginBottom: 18,
    paddingHorizontal: 8,
  },
  btnPrimary: {
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 9999,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnPrimaryText: { color: Colors.white, fontWeight: '700', fontSize: 16 },
  btnLink: { marginTop: 14, padding: 4 },
  btnLinkText: { color: Colors.fg2, fontWeight: '700', fontSize: 14 },
});
