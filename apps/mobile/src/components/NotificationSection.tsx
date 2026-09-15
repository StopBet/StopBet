import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Notification } from '@stopbet/shared-types';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/typography';
import { Icon, type IconName } from './Icon';
import { Touchable } from './Touchable';

const TYPE_STYLES: Record<string, { bg: string; border: string; iconColor: string; titleColor: string; icon: IconName }> = {
  warning: {
    bg: Colors.amber50,
    border: Colors.infoBorder,
    iconColor: Colors.primary,
    titleColor: Colors.primary,
    icon: 'triangle-alert',
  },
  info: {
    bg: Colors.infoSurface,
    border: Colors.infoBorder,
    iconColor: Colors.primary,
    titleColor: Colors.primary,
    icon: 'calendar',
  },
  success: {
    bg: Colors.sage50,
    border: Colors.infoBorder,
    iconColor: Colors.greenText,
    titleColor: Colors.greenText,
    icon: 'circle-check',
  },
  danger: {
    bg: Colors.dangerSurface,
    border: Colors.dangerBorder,
    iconColor: Colors.danger,
    titleColor: Colors.danger,
    icon: 'siren',
  },
};

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

interface Props {
  notifications: Notification[];
  onMarkRead: (id: string) => void;
}

export function NotificationSection({ notifications, onMarkRead }: Props) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Icon name="bell" size={16} color={Colors.ink900} />
          <Text style={styles.title} accessibilityRole="header">Notificaciones</Text>
        </View>
        {/* "Ver todo" no llevaba a ninguna parte: no existe pantalla de notificaciones */}
        <Text style={styles.count}>
          {notifications.length} sin leer
        </Text>
      </View>

      {/* Iban en un carrusel: las notificaciones 2 y 3 quedaban escondidas tras
          unos puntitos, en la pantalla que el paciente abre todos los días */}
      <View style={styles.list}>
        {notifications.map((n) => {
          const s = TYPE_STYLES[n.type] ?? TYPE_STYLES.info;
          return (
            <Touchable
              key={n.id}
              activeOpacity={0.85}
              onPress={() => onMarkRead(n.id)}
              accessibilityRole="button"
              accessibilityHint="Marca la notificación como leída"
              accessibilityLabel={`${n.title}. ${n.body}. ${timeAgo(n.createdAt)}`}
              style={[styles.card, { backgroundColor: s.bg, borderColor: s.border }]}
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
            </Touchable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontFamily: Fonts.headingBold,
    fontSize: 16,
    color: Colors.ink900,
  },
  count: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
    color: Colors.fg2,
  },
  list: {
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
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
    color: Colors.fg2,
    marginLeft: 8,
  },
  body: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
    color: Colors.fg1,
    lineHeight: 18,
    marginTop: 3,
  },
});
