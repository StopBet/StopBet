import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Notification } from '@stopbet/shared-types';
import type { Palette } from '../constants/colors';
import { useColors, useStyles } from '../context/ThemeContext';
import { Fonts } from '../constants/typography';
import { Icon, type IconName } from './Icon';
import { Touchable } from './Touchable';

type EstiloDeTipo = {
  bg: string;
  border: string;
  iconColor: string;
  titleColor: string;
  icon: IconName;
};

const makeTypeStyles = (c: Palette): Record<string, EstiloDeTipo> => ({
  warning: {
    bg: c.amber50,
    border: c.infoBorder,
    iconColor: c.primary,
    titleColor: c.primary,
    icon: 'triangle-alert',
  },
  info: {
    bg: c.infoSurface,
    border: c.infoBorder,
    iconColor: c.primary,
    titleColor: c.primary,
    icon: 'calendar',
  },
  success: {
    bg: c.sage50,
    border: c.infoBorder,
    iconColor: c.greenText,
    titleColor: c.greenText,
    icon: 'circle-check',
  },
  danger: {
    bg: c.dangerSurface,
    border: c.dangerBorder,
    iconColor: c.danger,
    titleColor: c.danger,
    icon: 'siren',
  },
});

function timeAgo(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  const mins = Math.floor(diff / 60000);
  // El reloj del teléfono puede ir atrasado respecto del servidor: sin esto una
  // notificación recién creada muestra "Hace -3min".
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `Hace ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  return `Hace ${Math.floor(hrs / 24)}d`;
}

/**
 * Una notificación. La usan la pantalla de Notificaciones y el Inicio, que solo muestra las
 * urgentes.
 *
 * Una ya leída se apaga en vez de desaparecer: sigue siendo el registro de lo que pasó, y en
 * la pantalla completa se ven todas.
 */
export const NotificationCard = React.memo(function NotificationCard({
  notification: n,
  onPress,
}: {
  notification: Notification;
  onPress: () => void;
}) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const TYPE_STYLES = useMemo(() => makeTypeStyles(c), [c]);
  const s = TYPE_STYLES[n.type] ?? TYPE_STYLES.info;
  const llevaAAlgunaParte = !!n.target;

  return (
    <Touchable
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint={
        llevaAAlgunaParte
          ? 'Abre la pantalla relacionada y la marca como leída'
          : 'Marca la notificación como leída'
      }
      accessibilityLabel={`${n.title}. ${n.body}. ${timeAgo(n.createdAt)}${n.read ? '. Leída' : ''}`}
      style={[
        styles.card,
        { backgroundColor: s.bg, borderColor: s.border },
        n.read && styles.leída,
      ]}
    >
      <View style={styles.iconWrap}>
        <Icon name={s.icon} size={16} color={s.iconColor} />
      </View>
      <View style={styles.content}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: s.titleColor }]}>{n.title}</Text>
          <Text style={styles.time}>{timeAgo(n.createdAt)}</Text>
        </View>
        <Text style={styles.body}>{n.body}</Text>
      </View>
      {llevaAAlgunaParte ? (
        <Icon name="chevron-right" size={16} color={c.fg2} />
      ) : null}
    </Touchable>
  );
}, (a, b) => a.notification === b.notification);

const makeStyles = (c: Palette) => StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  // Leída: baja el peso sin que deje de leerse
  leída: { opacity: 0.62 },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  cardTitle: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13.5,
    lineHeight: 18,
    flex: 1,
  },
  time: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: c.fg2,
    marginLeft: 8,
  },
  body: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
    color: c.fg1,
    lineHeight: 18,
    marginTop: 3,
  },
});
