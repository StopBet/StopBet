import React from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/types';
import { BottomNav } from '../components/BottomNav';
import { Colors } from '../constants/colors';

type Props = NativeStackScreenProps<AppStackParamList, 'Profile'>;

export function ProfileScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mi Perfil</Text>
        <Text style={styles.headerSub}>Tu cuenta en StopBet</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.avatarCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarLetter}>C</Text>
          </View>
          <Text style={styles.userName}>Carlos</Text>
          <Text style={styles.userSub}>Paciente AJUTER</Text>
        </View>

        <View style={styles.menuCard}>
          {MENU_ITEMS.map((item, i) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.menuRow, i < MENU_ITEMS.length - 1 && styles.menuRowBorder]}
              activeOpacity={0.7}
            >
              <Text style={styles.menuEmoji}>{item.emoji}</Text>
              <View style={styles.menuText}>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Text style={styles.menuSub}>{item.sub}</Text>
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.comingSoonCard}>
          <Text style={styles.comingSoonText}>
            ⚙️ Configuración completa disponible próximamente
          </Text>
        </View>
      </ScrollView>

      <BottomNav
        active="profile"
        onTabPress={(tab) => {
          if (tab === 'home') navigation.navigate('Home');
          else if (tab === 'community') navigation.navigate('Community');
          else if (tab === 'achievements') navigation.navigate('Achievements');
        }}
        onPanicPress={() => navigation.navigate('Panic')}
      />
    </SafeAreaView>
  );
}

const MENU_ITEMS = [
  { emoji: '👤', label: 'Datos personales', sub: 'Nombre, RUT, contacto' },
  { emoji: '🏥', label: 'Mi sede AJUTER', sub: 'Centro de tratamiento asignado' },
  { emoji: '🔔', label: 'Notificaciones', sub: 'Recordatorios y alertas' },
  { emoji: '🔒', label: 'Privacidad', sub: 'Gestión de datos y permisos' },
];

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.primary },

  header: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 18,
    backgroundColor: Colors.primary,
  },
  headerTitle: { fontWeight: '700', fontSize: 20, color: Colors.white },
  headerSub: { fontSize: 14, color: Colors.teal400, marginTop: 3 },

  scroll: { flex: 1, backgroundColor: Colors.bg },
  scrollContent: { padding: 16, paddingBottom: 120, gap: 16 },

  avatarCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    shadowColor: Colors.shadowMedium,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarLetter: { fontWeight: '800', fontSize: 36, color: Colors.white },
  userName: { fontWeight: '700', fontSize: 22, color: Colors.ink900 },
  userSub: { fontSize: 14, color: Colors.fg2, marginTop: 4 },

  menuCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Colors.shadowSoft,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  menuRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuEmoji: { fontSize: 24 },
  menuText: { flex: 1 },
  menuLabel: { fontWeight: '600', fontSize: 15, color: Colors.ink900 },
  menuSub: { fontSize: 13, color: Colors.fg2, marginTop: 2 },
  menuArrow: { fontSize: 22, color: Colors.fg2, fontWeight: '300' },

  comingSoonCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  comingSoonText: { fontSize: 13, color: Colors.fg2, textAlign: 'center' },
});
