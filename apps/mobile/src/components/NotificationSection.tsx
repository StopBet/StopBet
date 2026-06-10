import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Notification } from '@stopbet/shared-types';
import { Colors } from '../constants/colors';
import { Icon, type IconName } from './Icon';

const TYPE_STYLES: Record<string, { bg: string; border: string; iconColor: string; titleColor: string; icon: IconName }> = {
  warning: {
    bg: Colors.amber50,
    border: '#F3CDB9',
    iconColor: Colors.accent,
    titleColor: Colors.accent,
    icon: 'triangle-alert',
  },
  info: {
    bg: '#EAF3F2',
    border: '#C2DBD8',
    iconColor: Colors.primary,
    titleColor: Colors.primary,
    icon: 'calendar',
  },
  success: {
    bg: Colors.sage50,
    border: '#BDD6C7',
    iconColor: Colors.sage500,
    titleColor: Colors.sage500,
    icon: 'circle-check',
  },
  danger: {
    bg: '#FEECEC',
    border: '#F5C2C2',
    iconColor: Colors.danger,
    titleColor: Colors.danger,
    icon: 'siren',
  },
};

function timeAgo(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `Hace ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  return `Hace ${Math.floor(hrs / 24)}d`;
}

interface Props {
  notifications: Notification[];
  onViewAll: () => void;
  onMarkRead: (id: string) => void;
}

export function NotificationSection({ notifications, onViewAll, onMarkRead }: Props) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Icon name="bell" size={16} color={Colors.ink900} />
          <Text style={styles.title}>Notificaciones</Text>
        </View>
        <TouchableOpacity onPress={onViewAll}>
          <Text style={styles.viewAll}>Ver todo</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.list}>
        {notifications.map((n) => {
          const s = TYPE_STYLES[n.type] ?? TYPE_STYLES.info;
          return (
            <TouchableOpacity
              key={n.id}
              activeOpacity={0.85}
              onPress={() => onMarkRead(n.id)}
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
            </TouchableOpacity>
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
    fontWeight: '600',
    fontSize: 16,
    color: Colors.ink900,
  },
  viewAll: {
    fontWeight: '700',
    fontSize: 12,
    color: Colors.primary,
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
    fontWeight: '700',
    fontSize: 13.5,
    lineHeight: 18,
    flex: 1,
  },
  time: {
    fontSize: 11,
    color: Colors.fg2,
    marginLeft: 8,
  },
  body: {
    fontSize: 12.5,
    color: Colors.fg1,
    lineHeight: 18,
    marginTop: 3,
  },
});
