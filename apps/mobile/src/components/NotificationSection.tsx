import React, { useRef, useState } from 'react';
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Notification } from '@stopbet/shared-types';
import { Colors } from '../constants/colors';
import { Icon, type IconName } from './Icon';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 32; // 16px padding cada lado

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
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH);
    setActiveIndex(index);
  };

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

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH}
        decelerationRate="fast"
        onMomentumScrollEnd={handleScroll}
        contentContainerStyle={styles.scrollContent}
      >
        {notifications.map((n) => {
          const s = TYPE_STYLES[n.type] ?? TYPE_STYLES.info;
          return (
            <TouchableOpacity
              key={n.id}
              activeOpacity={0.85}
              onPress={() => onMarkRead(n.id)}
              style={[styles.card, { width: CARD_WIDTH, backgroundColor: s.bg, borderColor: s.border }]}
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
      </ScrollView>

      {notifications.length > 1 && (
        <View style={styles.dots}>
          {notifications.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === activeIndex && styles.dotActive]}
            />
          ))}
        </View>
      )}
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
  scrollContent: {
    gap: 0,
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
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.border,
  },
  dotActive: {
    width: 18,
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
});
