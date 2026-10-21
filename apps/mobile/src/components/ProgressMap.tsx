import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { BadgeMilestone } from '@stopbet/shared-types';
import type { Palette } from '../constants/colors';
import { BADGE_CONFIG } from '../constants/badges';
import { Fonts } from '../constants/typography';
import { useColors, useStyles } from '../context/ThemeContext';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { Touchable } from './Touchable';

interface Props {
  days: number;
  onOpenAchievements: () => void;
}

interface Stop {
  days: number;
  label: string;
  icon: IconName;
}

interface Point {
  x: number;
  y: number;
}

const BADGE_DAYS = (Object.keys(BADGE_CONFIG).map(Number) as BadgeMilestone[]).sort((a, b) => a - b);
const LAST_BADGE = BADGE_DAYS[BADGE_DAYS.length - 1];
const DAYS_BETWEEN_EXTRA_STOPS = 30;

// El Inicio es un scroll con el check-in debajo: el mapa muestra solo el tramo en que va
// el paciente. Entero (10 hitos y los que siguen) dejaría el check-in a varias pantallas.
const VISIBLE_STOPS = 4;
const NODE = 56;
const GAP = 84;
const PAD_TOP = 44;
const PAD_BOTTOM = 40;
const MAP_HEIGHT = PAD_TOP + (VISIBLE_STOPS - 1) * GAP + PAD_BOTTOM;
const MARKER = 28;

/**
 * La parada número `index` del camino: el punto de partida, los hitos con insignia y,
 * pasado el último, una parada cada 30 días sin tope. Esas no tienen insignia: el
 * backend solo las otorga hasta el último hito de la colección.
 */
function stopAt(index: number): Stop {
  if (index === 0) return { days: 0, label: 'Inicio', icon: 'map-pin' };
  if (index <= BADGE_DAYS.length) {
    const milestone = BADGE_DAYS[index - 1];
    return { days: milestone, label: BADGE_CONFIG[milestone].label, icon: BADGE_CONFIG[milestone].icon };
  }
  const days = LAST_BADGE + (index - BADGE_DAYS.length) * DAYS_BETWEEN_EXTRA_STOPS;
  return { days, label: `${Math.round(days / 30)} meses`, icon: 'star' };
}

function lastReachedIndex(days: number): number {
  let index = 0;
  while (stopAt(index + 1).days <= days) index += 1;
  return index;
}

function daysText(n: number): string {
  return `${n} día${n === 1 ? '' : 's'}`;
}

const lerp = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

/** Los cuatro puntos de la curva entre dos paradas; sale y llega en vertical. */
function curveBetween(from: Point, to: Point): [Point, Point, Point, Point] {
  return [from, { x: from.x, y: from.y - GAP / 2 }, { x: to.x, y: to.y + GAP / 2 }, to];
}

function toPath([p0, c1, c2, p1]: [Point, Point, Point, Point]): string {
  return `M${p0.x} ${p0.y} C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p1.x} ${p1.y}`;
}

/** La curva recortada en `t` (de Casteljau) y el punto donde termina. */
function curveUpTo(curve: [Point, Point, Point, Point], t: number): [Point, Point, Point, Point] {
  const [p0, c1, c2, p1] = curve;
  const a = lerp(p0, c1, t);
  const b = lerp(c1, c2, t);
  const d = lerp(c2, p1, t);
  const ab = lerp(a, b, t);
  const bd = lerp(b, d, t);
  return [p0, a, ab, lerp(ab, bd, t)];
}

export function ProgressMap({ days, onOpenAchievements }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const [width, setWidth] = useState(0);

  const reached = lastReachedIndex(days);
  const reachedStop = stopAt(reached);
  const nextStop = stopAt(reached + 1);
  const daysLeft = nextStop.days - days;
  const segmentProgress = (days - reachedStop.days) / (nextStop.days - reachedStop.days);

  const first = Math.max(0, reached - 1);
  const leftX = width * 0.24;
  const rightX = width * 0.76;
  const pointOf = (index: number): Point => ({
    x: index % 2 === 0 ? leftX : rightX,
    y: MAP_HEIGHT - PAD_BOTTOM - (index - first) * GAP,
  });

  // Un tramo de más por arriba y por abajo, que el recorte de la tarjeta deja a medias:
  // es lo que dice que el camino sigue sin tener que escribirlo.
  const pending: string[] = [];
  const done: string[] = [];
  for (let i = Math.max(0, first - 1); i < first + VISIBLE_STOPS; i += 1) {
    const curve = curveBetween(pointOf(i), pointOf(i + 1));
    if (i < reached) {
      done.push(toPath(curve));
    } else {
      pending.push(toPath(curve));
      if (i === reached && segmentProgress > 0) done.push(toPath(curveUpTo(curve, segmentProgress)));
    }
  }

  // Entre dos paradas el marcador nunca llega a tocarlas: pegado a una se leería como
  // hito ya cumplido. Justo en una parada va como distintivo en su esquina.
  const reachedPoint = pointOf(reached);
  const marker: Point =
    segmentProgress > 0
      ? curveUpTo(curveBetween(reachedPoint, pointOf(reached + 1)), 0.2 + 0.6 * segmentProgress)[3]
      : { x: reachedPoint.x + (reached % 2 === 0 ? -1 : 1) * (NODE / 2 - 4), y: reachedPoint.y - NODE / 2 + 4 };

  const labelWidth = rightX - leftX - NODE - 20;
  const visible = Array.from({ length: VISIBLE_STOPS }, (_, k) => first + k);

  return (
    <View style={styles.card}>
      <View
        accessible
        accessibilityLabel={
          `${daysText(days)} sin apostar. ` +
          `${daysLeft === 1 ? 'Falta 1 día' : `Faltan ${daysLeft} días`} para ${nextStop.label}.`
        }
      >
        <View style={styles.header}>
          <Text style={styles.daysNumber}>{days}</Text>
          <View style={styles.headerText}>
            <Text style={styles.daysLabel}>día{days === 1 ? '' : 's'} sin apostar</Text>
            <Text style={styles.nextLabel}>
              {daysLeft === 1 ? 'Falta 1 día' : `Faltan ${daysLeft} días`} para{' '}
              <Text style={styles.nextName}>{nextStop.label}</Text>
            </Text>
          </View>
        </View>

        <View
          style={styles.map}
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          importantForAccessibility="no-hide-descendants"
        >
          {width > 0 && (
            <>
              <Svg width={width} height={MAP_HEIGHT} style={StyleSheet.absoluteFill}>
                {pending.map((d) => (
                  <Path
                    key={d}
                    d={d}
                    stroke={c.border}
                    strokeWidth={8}
                    strokeLinecap="round"
                    strokeDasharray="0.1 17"
                    fill="none"
                  />
                ))}
                {done.map((d) => (
                  <Path key={d} d={d} stroke={c.green} strokeWidth={10} strokeLinecap="round" fill="none" />
                ))}
              </Svg>

              {visible.map((index) => {
                const stop = stopAt(index);
                const p = pointOf(index);
                const isReached = index <= reached;
                const isNext = index === reached + 1;
                const onLeft = index % 2 === 0;
                return (
                  <React.Fragment key={index}>
                    <View
                      style={[
                        styles.node,
                        isReached ? styles.nodeReached : isNext ? styles.nodeNext : styles.nodeLocked,
                        { left: p.x - NODE / 2, top: p.y - NODE / 2 },
                      ]}
                    >
                      <Icon
                        name={stop.icon}
                        size={26}
                        color={isReached ? c.greenText : isNext ? c.primaryText : c.fg2}
                      />
                    </View>
                    <View
                      style={[
                        styles.label,
                        { width: labelWidth, top: p.y - 24, left: leftX + NODE / 2 + 10 },
                        !onLeft && styles.labelRight,
                      ]}
                    >
                      <Text
                        style={[styles.stopName, !isReached && !isNext && styles.stopNameLocked, !onLeft && styles.textRight]}
                        numberOfLines={2}
                      >
                        {stop.label}
                      </Text>
                      {stop.days > 0 && (
                        <Text style={[styles.stopDays, !onLeft && styles.textRight]}>{daysText(stop.days)}</Text>
                      )}
                    </View>
                  </React.Fragment>
                );
              })}

              <View style={[styles.marker, { left: marker.x - MARKER / 2, top: marker.y - MARKER / 2 }]}>
                <Icon name="user" size={14} color={c.white} strokeWidth={2.5} />
              </View>
            </>
          )}
        </View>
      </View>

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
  map: {
    height: MAP_HEIGHT,
    overflow: 'hidden',
  },
  node: {
    position: 'absolute',
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeReached: {
    backgroundColor: c.gold50,
    borderWidth: 3,
    borderColor: c.green,
  },
  nodeNext: {
    backgroundColor: c.surface,
    borderWidth: 3,
    borderColor: c.primary,
  },
  nodeLocked: {
    backgroundColor: c.bg,
    borderWidth: 2,
    borderColor: c.border,
  },
  label: {
    position: 'absolute',
    height: 48,
    justifyContent: 'center',
  },
  labelRight: {
    alignItems: 'flex-end',
  },
  textRight: {
    textAlign: 'right',
  },
  stopName: {
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    lineHeight: 17,
    color: c.fg1,
  },
  stopNameLocked: {
    color: c.fg2,
  },
  stopDays: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: c.fg2,
  },
  marker: {
    position: 'absolute',
    width: MARKER,
    height: MARKER,
    borderRadius: MARKER / 2,
    backgroundColor: c.primary,
    borderWidth: 3,
    borderColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
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
