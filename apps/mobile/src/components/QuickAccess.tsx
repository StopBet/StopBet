import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/colors';
import { Icon } from './Icon';

interface Props {
  onPressAssistant: () => void;
  onPressCommunity: () => void;
  onPressAchievements: () => void;
}

export function QuickAccess({ onPressAssistant, onPressCommunity, onPressAchievements }: Props) {
  return (
    <View style={styles.wrapper}>
      {/* CTA principal — Hablar con el asistente IA */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPressAssistant}
        style={styles.primaryButton}
      >
        <View style={styles.primaryIcon}>
          <Icon name="sparkles" size={24} color={Colors.white} />
        </View>
        <View style={styles.primaryText}>
          <Text style={styles.primaryTitle}>Hablar con el asistente</Text>
          <Text style={styles.primarySubtitle}>Apoyo inmediato · disponible ahora</Text>
        </View>
        <Icon name="chevron-right" size={22} color={Colors.overlayWhite72} />
      </TouchableOpacity>

      {/* Grid secundario */}
      <View style={styles.grid}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onPressCommunity}
          style={styles.secondaryButton}
        >
          <View style={[styles.secondaryIcon, { backgroundColor: '#E6F4F2' }]}>
            <Icon name="users" size={20} color={Colors.primary} />
          </View>
          <Text style={styles.secondaryLabel}>Comunidad</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onPressAchievements}
          style={styles.secondaryButton}
        >
          <View style={[styles.secondaryIcon, { backgroundColor: Colors.gold50 }]}>
            <Icon name="trophy" size={20} color={Colors.gold} />
          </View>
          <Text style={styles.secondaryLabel}>Mis logros</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    gap: 10,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: Colors.primary,
    borderRadius: 18,
    padding: 18,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 16,
    elevation: 8,
  },
  primaryIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.overlayWhite16,
    borderWidth: 1.5,
    borderColor: Colors.overlayWhite35,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    flex: 1,
  },
  primaryTitle: {
    fontWeight: '700',
    fontSize: 17,
    color: Colors.white,
    lineHeight: 22,
  },
  primarySubtitle: {
    fontSize: 13,
    color: Colors.overlayWhite72,
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 10,
    alignItems: 'flex-start',
    shadowColor: Colors.shadowSoft,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  secondaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontWeight: '700',
    fontSize: 14,
    color: Colors.fg1,
  },
});
