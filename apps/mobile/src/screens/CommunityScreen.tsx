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

type Props = NativeStackScreenProps<AppStackParamList, 'Community'>;

export function CommunityScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Comunidad</Text>
        <Text style={styles.headerSub}>Tu red de apoyo en AJUTER</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>💬</Text>
          <Text style={styles.emptyTitle}>Próximamente</Text>
          <Text style={styles.emptyText}>
            Aquí podrás ver los mensajes de apoyo de tu sede, compartir tus logros y conectar con otros que están en el mismo camino.
          </Text>
        </View>

        <View style={styles.featureList}>
          {FEATURES.map((f) => (
            <View key={f.label} style={styles.featureRow}>
              <Text style={styles.featureEmoji}>{f.emoji}</Text>
              <View style={styles.featureText}>
                <Text style={styles.featureLabel}>{f.label}</Text>
                <Text style={styles.featureSub}>{f.sub}</Text>
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.assistantBtn}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Assistant')}
        >
          <Text style={styles.assistantBtnText}>💬 Hablar con el asistente ahora</Text>
        </TouchableOpacity>
      </ScrollView>

      <BottomNav
        active="community"
        onTabPress={(tab) => {
          if (tab === 'home') navigation.navigate('Home');
          else if (tab === 'achievements') navigation.navigate('Achievements');
          else if (tab === 'profile') navigation.navigate('Profile');
        }}
        onPanicPress={() => navigation.navigate('Panic')}
      />
    </SafeAreaView>
  );
}

const FEATURES = [
  { emoji: '🏅', label: 'Compartir logros', sub: 'Celebra tus hitos con la comunidad' },
  { emoji: '🤝', label: 'Red de padrinos', sub: 'Conecta con tu padrino de apoyo' },
  { emoji: '📣', label: 'Mensajes de tu sede', sub: 'Avisos y eventos de AJUTER' },
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

  emptyCard: {
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
  emptyEmoji: { fontSize: 52, marginBottom: 16 },
  emptyTitle: { fontWeight: '700', fontSize: 20, color: Colors.ink900, marginBottom: 10 },
  emptyText: {
    fontSize: 14,
    color: Colors.fg2,
    textAlign: 'center',
    lineHeight: 22,
  },

  featureList: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Colors.shadowSoft,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  featureEmoji: { fontSize: 26 },
  featureText: { flex: 1 },
  featureLabel: { fontWeight: '600', fontSize: 15, color: Colors.ink900 },
  featureSub: { fontSize: 13, color: Colors.fg2, marginTop: 2 },

  assistantBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 9999,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  assistantBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
});
