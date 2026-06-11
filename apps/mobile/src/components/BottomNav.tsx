import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { Icon, type IconName } from './Icon';

export type NavTab = 'home' | 'community' | 'achievements' | 'profile';

const LEFT_TABS: { id: NavTab; icon: IconName; label: string }[] = [
  { id: 'home',      icon: 'house',          label: 'Inicio'    },
  { id: 'community', icon: 'message-circle', label: 'Comunidad' },
];
const RIGHT_TABS: { id: NavTab; icon: IconName; label: string }[] = [
  { id: 'achievements', icon: 'trophy', label: 'Logros'  },
  { id: 'profile',      icon: 'user',   label: 'Perfil'  },
];

interface Props {
  active: NavTab;
  onTabPress: (tab: NavTab) => void;
  onPanicPress: () => void;
}

export function BottomNav({ active, onTabPress, onPanicPress }: Props) {
  const { bottom } = useSafeAreaInsets();
  const renderTab = (tab: { id: NavTab; icon: IconName; label: string }) => {
    const isActive = active === tab.id;
    return (
      <TouchableOpacity
        key={tab.id}
        onPress={() => onTabPress(tab.id)}
        style={styles.tab}
        activeOpacity={0.7}
      >
        <Icon name={tab.icon} size={24} color={isActive ? Colors.primary : Colors.fg2} />
        <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
          {tab.label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(bottom, 12) }]}>
      {LEFT_TABS.map(renderTab)}

      <TouchableOpacity
        onPress={onPanicPress}
        activeOpacity={0.85}
        accessible
        accessibilityLabel="Botón de pánico"
        accessibilityRole="button"
        style={styles.panicButton}
      >
        <View style={styles.panicContent}>
          <Icon name="siren" size={20} color={Colors.white} />
          <Text style={styles.panicLabel}>SOS</Text>
        </View>
      </TouchableOpacity>

      {RIGHT_TABS.map(renderTab)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    backgroundColor: Colors.bg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: 8,
    paddingTop: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.fg2,
  },
  tabLabelActive: {
    fontWeight: '700',
    color: Colors.primary,
  },
  panicContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  panicLabel: {
    fontWeight: '900',
    fontSize: 12,
    color: Colors.white,
    letterSpacing: 1.5,
  },
  panicButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.danger,
    borderWidth: 5,
    borderColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -28,
    marginHorizontal: 4,
    shadowColor: Colors.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 10,
  },
});
