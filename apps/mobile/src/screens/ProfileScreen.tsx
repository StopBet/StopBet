import React, { useState } from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/types';
import { BottomNav } from '../components/BottomNav';
import { Icon, type IconName } from '../components/Icon';
import { Colors } from '../constants/colors';
import { devFlags } from '../store/devFlags';

type Props = NativeStackScreenProps<AppStackParamList, 'Profile'>;

export function ProfileScreen({ navigation }: Props) {
  const [offline, setOffline] = useState(devFlags.simulateOffline);
  const [daysInput, setDaysInput] = useState(
    devFlags.overrideDays !== null ? String(devFlags.overrideDays) : '',
  );

  const toggleOffline = (v: boolean) => {
    devFlags.setSimulateOffline(v);
    setOffline(v);
  };

  const applyDays = () => {
    const n = parseInt(daysInput, 10);
    devFlags.setOverrideDays(Number.isFinite(n) && n >= 0 ? n : null);
  };

  const clearDays = () => {
    setDaysInput('');
    devFlags.setOverrideDays(null);
  };

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
              <View style={styles.menuIcon}>
                <Icon name={item.icon} size={22} color={Colors.primary} />
              </View>
              <View style={styles.menuText}>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Text style={styles.menuSub}>{item.sub}</Text>
              </View>
              <Icon name="chevron-right" size={20} color={Colors.fg2} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.comingSoonCard}>
          <Icon name="settings" size={15} color={Colors.fg2} />
          <Text style={styles.comingSoonText}>
            Configuración completa disponible próximamente
          </Text>
        </View>

        {/* Herramientas de prueba */}
        <View style={styles.devCard}>
          <View style={styles.devHeader}>
            <Icon name="flask-conical" size={14} color={Colors.fg2} />
            <Text style={styles.devTitle}>Herramientas de prueba</Text>
          </View>
          <View style={styles.devRow}>
            <View style={styles.devText}>
              <Text style={styles.devLabel}>Simular sin conexión</Text>
              <Text style={styles.devSub}>
                Fuerza error de red en todas las llamadas a la API
              </Text>
            </View>
            <Switch
              value={offline}
              onValueChange={toggleOffline}
              trackColor={{ false: Colors.border, true: Colors.danger }}
              thumbColor={Colors.white}
            />
          </View>
          {offline && (
            <View style={styles.devBadge}>
              <Icon name="triangle-alert" size={12} color={Colors.danger} />
              <Text style={styles.devBadgeText}>Modo sin conexión activo</Text>
            </View>
          )}

          <View style={styles.devDivider} />

          <View style={styles.devRow}>
            <View style={styles.devText}>
              <Text style={styles.devLabel}>Días sin apostar</Text>
              <Text style={styles.devSub}>Sobreescribe el contador para la demo</Text>
            </View>
            <View style={styles.devDaysRow}>
              <TextInput
                style={styles.devDaysInput}
                value={daysInput}
                onChangeText={setDaysInput}
                keyboardType="number-pad"
                placeholder="—"
                placeholderTextColor={Colors.fg2}
                maxLength={4}
                returnKeyType="done"
                onSubmitEditing={applyDays}
              />
              <TouchableOpacity style={styles.devApplyBtn} onPress={applyDays}>
                <Text style={styles.devApplyText}>OK</Text>
              </TouchableOpacity>
              {devFlags.overrideDays !== null && (
                <TouchableOpacity style={styles.devClearBtn} onPress={clearDays}>
                  <Icon name="x" size={14} color={Colors.fg2} />
                </TouchableOpacity>
              )}
            </View>
          </View>
          {devFlags.overrideDays !== null && (
            <View style={[styles.devBadge, { backgroundColor: '#EFF9F4' }]}>
              <Icon name="check" size={12} color={Colors.sage500} />
              <Text style={[styles.devBadgeText, { color: Colors.sage500 }]}>
                Mostrando {devFlags.overrideDays} días
              </Text>
            </View>
          )}
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

const MENU_ITEMS: { icon: IconName; label: string; sub: string }[] = [
  { icon: 'user',     label: 'Datos personales', sub: 'Nombre, RUT, contacto' },
  { icon: 'hospital', label: 'Mi sede AJUTER', sub: 'Centro de tratamiento asignado' },
  { icon: 'bell',     label: 'Notificaciones', sub: 'Recordatorios y alertas' },
  { icon: 'lock',     label: 'Privacidad', sub: 'Gestión de datos y permisos' },
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
  menuIcon: { width: 28, alignItems: 'center' },
  menuText: { flex: 1 },
  menuLabel: { fontWeight: '600', fontSize: 15, color: Colors.ink900 },
  menuSub: { fontSize: 13, color: Colors.fg2, marginTop: 2 },

  comingSoonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  comingSoonText: { fontSize: 13, color: Colors.fg2, textAlign: 'center' },

  devCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  devHeader: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  devTitle: { fontSize: 12, fontWeight: '700', color: Colors.fg2, textTransform: 'uppercase', letterSpacing: 0.5 },
  devRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  devText: { flex: 1 },
  devLabel: { fontWeight: '600', fontSize: 15, color: Colors.ink900 },
  devSub: { fontSize: 12, color: Colors.fg2, marginTop: 2, lineHeight: 17 },
  devBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  devBadgeText: { fontSize: 12, fontWeight: '700', color: Colors.danger },
  devDivider: { height: 1, backgroundColor: Colors.border },
  devDaysRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  devDaysInput: {
    width: 64,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.ink900,
    textAlign: 'center',
    backgroundColor: Colors.bg,
  },
  devApplyBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  devApplyText: { color: Colors.white, fontWeight: '700', fontSize: 13 },
  devClearBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
