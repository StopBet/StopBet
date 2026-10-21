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

/** Cuántas paradas hay hasta el último hito con insignia, contando el punto de partida. */
export const BADGE_STOP_COUNT = BADGE_DAYS.length + 1;

const NODE = 56;
const GAP = 84;
const PAD_TOP = 44;
const PAD_BOTTOM = 40;
const MARKER = 28;

/**
 * La parada número `index` del camino: el punto de partida, los hitos con insignia y,
 * pasado el último, una parada cada 30 días sin tope. Esas no tienen insignia: el
 * backend solo las otorga hasta el último hito de la colección.
 */
export function stopAt(index: number): Stop {
  if (index === 0) return { days: 0, label: 'Inicio', icon: 'map-pin' };
  if (index <= BADGE_DAYS.length) {
    const milestone = BADGE_DAYS[index - 1];
    return { days: milestone, label: BADGE_CONFIG[milestone].label, icon: BADGE_CONFIG[milestone].icon };
  }
  const days = LAST_BADGE + (index - BADGE_DAYS.length) * DAYS_BETWEEN_EXTRA_STOPS;
  return { days, label: `${Math.round(days / 30)} meses`, icon: 'star' };
}

export function lastReachedIndex(days: number): number {
  let index = 0;
  while (stopAt(index + 1).days <= days) index += 1;
  return index;
}

export function daysText(n: number): string {
  return `${n} día${n === 1 ? '' : 's'}`;
}

export function daysLeftText(n: number): string {
  return n === 1 ? 'Falta 1 día' : `Faltan ${n} días`;
}

export function journeyHeight(count: number): number {
  return PAD_TOP + (count - 1) * GAP + PAD_BOTTOM;
}

/** Dónde queda verticalmente una parada dentro del camino; sirve para llevar el scroll hasta ella. */
export function stopOffset(index: number, first: number, count: number): number {
  return journeyHeight(count) - PAD_BOTTOM - (index - first) * GAP;
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

interface Props {
  days: number;
  /** La primera parada que se dibuja (abajo del todo). */
  first: number;
  /** Cuántas paradas se dibujan desde `first` hacia arriba. */
  count: number;
  /**
   * En la tarjeta del Inicio el lector de pantalla lee un resumen y el dibujo se oculta;
   * en «Mi camino» el dibujo es el contenido, así que cada parada se anuncia.
   */
  announceStops?: boolean;
}

/** El camino de paradas con lo recorrido en verde y el marcador de dónde va el paciente. */
export function JourneyPath({ days, first, count, announceStops = false }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const [width, setWidth] = useState(0);

  const reached = lastReachedIndex(days);
  const reachedStop = stopAt(reached);
  const nextStop = stopAt(reached + 1);
  const segmentProgress = (days - reachedStop.days) / (nextStop.days - reachedStop.days);

  const height = journeyHeight(count);
  const leftX = width * 0.24;
  const rightX = width * 0.76;
  const pointOf = (index: number): Point => ({
    x: index % 2 === 0 ? leftX : rightX,
    y: stopOffset(index, first, count),
  });

  // Un tramo de más por arriba y por abajo, que el recorte deja a medias: es lo que dice
  // que el camino sigue sin tener que escribirlo.
  const pending: string[] = [];
  const done: string[] = [];
  for (let i = Math.max(0, first - 1); i < first + count; i += 1) {
    const curve = curveBetween(pointOf(i), pointOf(i + 1));
    if (i < reached) {
      done.push(toPath(curve));
    } else {
      pending.push(toPath(curve));
      if (i === reached && segmentProgress > 0) done.push(toPath(curveUpTo(curve, segmentProgress)));
    }
  }

  // Entre dos paradas el marcador va por el tramo medio de la curva: pegado a una parada se
  // leería como hito ya cumplido, y al salir de ella tapaba su nombre. Justo en una parada
  // va como distintivo en su esquina.
  const reachedPoint = pointOf(reached);
  const marker: Point =
    segmentProgress > 0
      ? curveUpTo(curveBetween(reachedPoint, pointOf(reached + 1)), 0.45 + 0.25 * segmentProgress)[3]
      : { x: reachedPoint.x + (reached % 2 === 0 ? -1 : 1) * (NODE / 2 - 4), y: reachedPoint.y - NODE / 2 + 4 };

  const labelWidth = rightX - leftX - NODE - 20;
  const visible = Array.from({ length: count }, (_, k) => first + k);

  return (
    <View
      style={[styles.map, { height }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      importantForAccessibility={announceStops ? 'auto' : 'no-hide-descendants'}
    >
      {width > 0 && (
        <>
          <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
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
            const state = isReached
              ? 'logrado'
              : isNext
              ? `tu próxima meta, ${daysLeftText(stop.days - days).toLowerCase()}`
              : 'por delante';
            return (
              <View
                key={index}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
                accessible={announceStops}
                accessibilityLabel={`${stop.label}${stop.days > 0 ? `, ${daysText(stop.days)}` : ''}: ${state}`}
              >
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
              </View>
            );
          })}

          <View
            style={[styles.marker, { left: marker.x - MARKER / 2, top: marker.y - MARKER / 2 }]}
            importantForAccessibility="no-hide-descendants"
          >
            <Icon name="user" size={14} color={c.white} strokeWidth={2.5} />
          </View>
        </>
      )}
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  map: {
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
});
