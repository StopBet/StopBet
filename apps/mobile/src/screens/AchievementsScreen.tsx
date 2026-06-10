import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type {
  AbstinencePeriod,
  AchievementsData,
  BadgeMilestone,
  EarnedBadge,
} from '@stopbet/shared-types';
import type { AppStackParamList } from '../navigation/types';
import { BottomNav, NavTab } from '../components/BottomNav';
import { Colors } from '../constants/colors';
import { api } from '../services/api';

// Ajustar cuando se conecte autenticación real
const TEMP_USER_ID = '11111111-1111-1111-1111-111111111111';

const MONTHS_LONG = [
  'enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre',
];
const MONTHS_SHORT = [
  'ene','feb','mar','abr','may','jun',
  'jul','ago','sep','oct','nov','dic',
];

const MILESTONES: BadgeMilestone[] = [1, 3, 7, 14, 21, 30, 45, 60, 75, 90];

const BADGE_CONFIG: Record<BadgeMilestone, { label: string; emoji: string; daysLabel: string }> = {
  1:  { label: 'Primer día',    emoji: '🌱', daysLabel: '1 día' },
  3:  { label: 'Primeros pasos',emoji: '📈', daysLabel: '3 días' },
  7:  { label: 'Una semana',    emoji: '⭐', daysLabel: '7 días' },
  14: { label: 'Dos semanas',   emoji: '🌅', daysLabel: '14 días' },
  21: { label: 'Constancia',    emoji: '🔥', daysLabel: '21 días' },
  30: { label: 'Un mes',        emoji: '🏅', daysLabel: '30 días' },
  45: { label: 'Más fuerte',    emoji: '🛡️', daysLabel: '45 días' },
  60: { label: 'Dos meses',     emoji: '🏆', daysLabel: '60 días' },
  75: { label: 'Enfoque',       emoji: '🎯', daysLabel: '75 días' },
  90: { label: 'Tres meses',    emoji: '🌄', daysLabel: '90 días' },
};

function formatDateLong(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${d} de ${MONTHS_LONG[m - 1]} de ${y}`;
}

function formatDateShort(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${String(d).padStart(2, '0')} ${MONTHS_SHORT[m - 1]} ${y}`;
}

function nextMilestoneFor(days: number): BadgeMilestone | null {
  return MILESTONES.find((m) => m > days) ?? null;
}

const EMPTY_DATA: AchievementsData = {
  currentPeriod: {
    id: '', userId: '', startDate: new Date().toISOString().split('T')[0],
    endDate: null, daysAchieved: 0, attemptNumber: 1, earnedBadges: [],
  },
  historicalPeriods: [],
  newestMilestone: null,
};

type Props = NativeStackScreenProps<AppStackParamList, 'Achievements'>;

export function AchievementsScreen({ navigation }: Props) {
  const [data, setData] = useState<AchievementsData>(EMPTY_DATA);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<NavTab>('achievements');
  const [relapseModal, setRelapseModal] = useState(false);
  const [relapseMessage, setRelapseMessage] = useState('');
  const [shareMilestone, setShareMilestone] = useState<BadgeMilestone | null>(null);
  const shareShownRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const result = await api.getAchievements(TEMP_USER_ID);
      setData(result);
      // Muestra modal de compartir solo la primera vez que se otorga una insignia nueva
      if (result.newestMilestone && !shareShownRef.current) {
        shareShownRef.current = true;
        setShareMilestone(result.newestMilestone);
      }
    } catch (err) {
      console.error('[AchievementsScreen] load error', (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRelapse = () => {
    Alert.alert(
      'Reportar recaída',
      '¿Quieres reportar una recaída? Tu historial se conserva y el contador comenzará de nuevo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Reportar',
          style: 'destructive',
          onPress: async () => {
            try {
              const { message } = await api.reportRelapse(TEMP_USER_ID);
              shareShownRef.current = false;
              await load();
              setRelapseMessage(message);
              setRelapseModal(true);
            } catch {
              Alert.alert('Error', 'No se pudo registrar la recaída. Inténtalo de nuevo.');
            }
          },
        },
      ],
    );
  };

  const handleShare = async () => {
    if (!shareMilestone) return;
    try {
      await api.shareBadge(TEMP_USER_ID, shareMilestone);
      setShareMilestone(null);
      // Actualiza el estado local para reflejar sharedToCommunity: true
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          currentPeriod: {
            ...prev.currentPeriod,
            earnedBadges: prev.currentPeriod.earnedBadges.map((b) =>
              b.milestone === shareMilestone ? { ...b, sharedToCommunity: true } : b,
            ),
          },
        };
      });
    } catch {
      Alert.alert('Error', 'No se pudo compartir la insignia.');
    }
  };

  const handleTabPress = (tab: NavTab) => {
    setActiveTab(tab);
    if (tab === 'home') navigation.navigate('Home');
    else if (tab === 'community') navigation.navigate('Community');
    else if (tab === 'profile') navigation.navigate('Profile');
  };

  const currentPeriod = data.currentPeriod;
  const days = currentPeriod.daysAchieved;
  const earnedSet = new Set(currentPeriod.earnedBadges.map((b) => b.milestone));
  const newestEarnedMilestone = currentPeriod.earnedBadges
    .filter((b) => !b.sharedToCommunity)
    .sort((a, b) => b.milestone - a.milestone)[0]?.milestone as BadgeMilestone | undefined;

  const nextM = nextMilestoneFor(days);
  const progressFraction = nextM ? Math.min(days / nextM, 1) : 1;
  const daysLeft = nextM ? nextM - days : 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Mis Logros</Text>
          <Text style={styles.headerSub}>Periodo actual: {days} días</Text>
        </View>
        <View style={styles.trophyCircle}>
          <Text style={styles.trophyEmoji}>🏆</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Contador principal ── */}
          <View style={styles.counterCard}>
            <Text style={styles.counterNum}>{days}</Text>
            <Text style={styles.counterUnit}>días sin apostar</Text>
            {currentPeriod?.startDate && (
              <Text style={styles.counterStart}>
                📅 Comenzaste el {formatDateLong(currentPeriod.startDate)}
              </Text>
            )}

            {/* Barra de progreso */}
            {nextM && (
              <View style={styles.progressWrap}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progressFraction * 100}%` }]} />
                </View>
                <Text style={styles.progressLabel}>
                  🎯 Próximo hito: {nextM} días · faltan {daysLeft} día{daysLeft !== 1 ? 's' : ''}
                </Text>
              </View>
            )}

            <TouchableOpacity style={styles.relapseBtn} onPress={handleRelapse} activeOpacity={0.8}>
              <Text style={styles.relapseBtnText}>❤️ Reportar recaída</Text>
            </TouchableOpacity>
          </View>

          {/* ── Colección de insignias ── */}
          <Text style={styles.sectionTitle}>Tu colección</Text>
          <View style={styles.badgeGrid}>
            {MILESTONES.map((milestone) => {
              const earned = earnedSet.has(milestone);
              const isNewest = milestone === newestEarnedMilestone;
              const cfg = BADGE_CONFIG[milestone];
              return (
                <TouchableOpacity
                  key={milestone}
                  style={styles.badgeItem}
                  activeOpacity={earned ? 0.75 : 1}
                  onPress={earned ? () => setShareMilestone(milestone) : undefined}
                >
                  {isNewest && (
                    <View style={styles.newChip}>
                      <Text style={styles.newChipText}>¡Nuevo!</Text>
                    </View>
                  )}
                  <View style={[styles.badgeDisc, earned ? styles.badgeDiscEarned : styles.badgeDiscLocked]}>
                    <Text style={[styles.badgeEmoji, !earned && styles.badgeEmojiLocked]}>
                      {cfg.emoji}
                    </Text>
                  </View>
                  {!earned && (
                    <View style={styles.badgeLock}>
                      <Text style={styles.badgeLockText}>🔒</Text>
                    </View>
                  )}
                  <Text style={[styles.badgeLabel, !earned && styles.badgeLabelLocked]}>
                    {cfg.label}
                  </Text>
                  <Text style={styles.badgeDays}>{cfg.daysLabel}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Ciclos históricos ── */}
          {data.historicalPeriods.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Ciclos históricos</Text>
              {data.historicalPeriods.map((period) => (
                <CycleCard key={period.id} period={period} />
              ))}
            </>
          )}
        </ScrollView>
      )}

      <BottomNav
        active={activeTab}
        onTabPress={handleTabPress}
        onPanicPress={() => navigation.navigate('Panic')}
      />

      {/* ── Modal: Recaída reportada ── */}
      <Modal
        visible={relapseModal}
        transparent
        animationType="fade"
        onRequestClose={() => setRelapseModal(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalIcon}>
              <Text style={styles.modalIconEmoji}>❤️</Text>
            </View>
            <Text style={styles.modalTitle}>No estás solo en esto</Text>
            <Text style={styles.modalText}>{relapseMessage}</Text>
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={() => {
                setRelapseModal(false);
                navigation.navigate('Assistant');
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.btnPrimaryText}>💬 Hablar con el asistente ahora</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setRelapseModal(false)} style={styles.btnLink}>
              <Text style={styles.btnLinkText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Modal: Compartir insignia ── */}
      <Modal
        visible={shareMilestone !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setShareMilestone(null)}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            {shareMilestone && (
              <>
                <Text style={styles.shareHead}>¡Nueva insignia desbloqueada!</Text>
                <Text style={styles.shareSub}>
                  Compártela con quienes te acompañan en tu sede.
                </Text>
                <View style={styles.sharePreview}>
                  <View style={styles.shareDisc}>
                    <Text style={{ fontSize: 36 }}>{BADGE_CONFIG[shareMilestone].emoji}</Text>
                  </View>
                  <Text style={styles.shareBig}>{shareMilestone} días</Text>
                  <Text style={styles.shareUnit}>
                    sin apostar · {BADGE_CONFIG[shareMilestone].label}
                  </Text>
                  <Text style={styles.shareBy}>❤️ StopBet · AJUTER</Text>
                </View>
                <TouchableOpacity style={styles.btnPrimary} onPress={handleShare} activeOpacity={0.85}>
                  <Text style={styles.btnPrimaryText}>👥 Compartir en la comunidad de mi sede</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShareMilestone(null)} style={styles.btnLink}>
                  <Text style={styles.btnLinkText}>Ahora no</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ── CycleCard ─────────────────────────────────────────────────────────── */

function CycleCard({ period }: { period: AbstinencePeriod }) {
  return (
    <View style={styles.cycleCard}>
      <View style={styles.cycleTop}>
        <View style={styles.cycleChip}>
          <Text style={styles.cycleChipText}>Intento {period.attemptNumber}</Text>
        </View>
        <Text style={styles.cycleDates}>
          {formatDateShort(period.startDate)}
          {period.endDate ? ` – ${formatDateShort(period.endDate)}` : ''}
        </Text>
      </View>
      <Text style={styles.cycleProgress}>{period.daysAchieved} días de progreso</Text>
      {period.earnedBadges.length > 0 && (
        <View style={styles.miniBadges}>
          {period.earnedBadges.map((b: EarnedBadge) => (
            <View key={b.id} style={styles.miniBadge}>
              <Text style={{ fontSize: 14 }}>{BADGE_CONFIG[b.milestone]?.emoji ?? '🏅'}</Text>
            </View>
          ))}
        </View>
      )}
      <View style={styles.cycleNote}>
        <Text style={styles.cycleNoteText}>
          🌿 Cada intento cuenta. Aprendiste algo valioso.
        </Text>
      </View>
    </View>
  );
}

/* ── Estilos ───────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.primary },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 18,
    backgroundColor: Colors.primary,
    gap: 12,
  },
  headerText: { flex: 1 },
  headerTitle: { fontWeight: '700', fontSize: 20, color: Colors.white, lineHeight: 26 },
  headerSub: { fontSize: 14, color: Colors.teal400, marginTop: 3 },
  trophyCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.overlayWhite16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trophyEmoji: { fontSize: 22 },

  loader: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },

  scroll: { flex: 1, backgroundColor: Colors.bg },
  scrollContent: { padding: 16, paddingBottom: 120, gap: 0 },

  /* Counter card */
  counterCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: Colors.shadowMedium,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 0,
  },
  counterNum: {
    fontWeight: '800',
    fontSize: 72,
    color: Colors.primary,
    letterSpacing: -1,
    lineHeight: 80,
  },
  counterUnit: { fontWeight: '600', fontSize: 18, color: Colors.fg2, marginTop: 2 },
  counterStart: { fontSize: 12, color: Colors.fg2, marginTop: 10 },

  progressWrap: { width: '100%', marginTop: 20 },
  progressTrack: {
    height: 8,
    borderRadius: 9999,
    backgroundColor: Colors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 9999,
    backgroundColor: Colors.sage500,
  },
  progressLabel: {
    fontSize: 13,
    color: Colors.gold,
    fontWeight: '600',
    marginTop: 10,
    textAlign: 'center',
  },

  relapseBtn: {
    marginTop: 18,
    borderWidth: 1.5,
    borderColor: Colors.danger,
    borderRadius: 9999,
    paddingVertical: 9,
    paddingHorizontal: 18,
  },
  relapseBtnText: { color: Colors.danger, fontWeight: '700', fontSize: 13 },

  /* Section title */
  sectionTitle: {
    fontWeight: '600',
    fontSize: 18,
    color: Colors.fg1,
    marginTop: 28,
    marginBottom: 14,
    marginLeft: 4,
  },

  /* Badge grid */
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  badgeItem: {
    width: '25%',
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  badgeDisc: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDiscEarned: {
    backgroundColor: '#FDF8E1',
    borderWidth: 2,
    borderColor: '#C9954A',
    shadowColor: '#C9954A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  badgeDiscLocked: {
    backgroundColor: Colors.border,
    opacity: 0.6,
  },
  badgeEmoji: { fontSize: 26 },
  badgeEmojiLocked: { opacity: 0.5 },
  badgeLock: {
    position: 'absolute',
    top: 0,
    right: '12%',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.fg2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLockText: { fontSize: 9 },
  newChip: {
    position: 'absolute',
    top: -7,
    right: '8%',
    backgroundColor: '#C9954A',
    borderRadius: 9999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    zIndex: 1,
  },
  newChipText: { color: Colors.white, fontWeight: '700', fontSize: 9 },
  badgeLabel: {
    fontSize: 10,
    color: Colors.fg1,
    textAlign: 'center',
    marginTop: 7,
    lineHeight: 13,
    paddingHorizontal: 2,
  },
  badgeLabelLocked: { color: Colors.fg2 },
  badgeDays: { fontSize: 9, color: Colors.fg2, fontWeight: '600', marginTop: 2 },

  /* Cycle card */
  cycleCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderTopWidth: 3,
    borderTopColor: Colors.sage500,
    padding: 16,
    marginBottom: 12,
    shadowColor: Colors.shadowSoft,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 1,
  },
  cycleTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cycleChip: {
    backgroundColor: Colors.sage50,
    borderRadius: 9999,
    paddingHorizontal: 11,
    paddingVertical: 4,
  },
  cycleChipText: { color: Colors.sage500, fontWeight: '700', fontSize: 11 },
  cycleDates: { fontSize: 12, color: Colors.fg2 },
  cycleProgress: {
    fontWeight: '600',
    fontSize: 15,
    color: Colors.ink900,
    marginTop: 11,
    marginBottom: 12,
  },
  miniBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  miniBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FDF8E1',
    borderWidth: 1.5,
    borderColor: '#C9954A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cycleNote: { marginTop: 13 },
  cycleNoteText: { fontSize: 12, color: Colors.fg2, fontStyle: 'italic', lineHeight: 18 },

  /* Overlay + modals */
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(30,45,44,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    shadowColor: Colors.ink900,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 16,
  },
  modalIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#E6F4F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalIconEmoji: { fontSize: 42 },
  modalTitle: {
    fontWeight: '700',
    fontSize: 22,
    color: Colors.ink900,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
    lineHeight: 28,
  },
  modalText: {
    fontSize: 15,
    color: Colors.fg2,
    textAlign: 'center',
    lineHeight: 23,
    marginHorizontal: 8,
  },

  /* Share modal */
  shareHead: {
    fontWeight: '700',
    fontSize: 20,
    color: Colors.ink900,
    marginBottom: 4,
    textAlign: 'center',
  },
  shareSub: {
    fontSize: 13,
    color: Colors.fg2,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  sharePreview: {
    width: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 20,
    padding: 26,
    alignItems: 'center',
    marginBottom: 4,
  },
  shareDisc: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#FDF8E1',
    borderWidth: 2,
    borderColor: '#C9954A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  shareBig: {
    fontWeight: '800',
    fontSize: 34,
    color: Colors.white,
    lineHeight: 40,
  },
  shareUnit: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  shareBy: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 14 },

  /* Buttons */
  btnPrimary: {
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 9999,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 22,
  },
  btnPrimaryText: { color: Colors.white, fontWeight: '700', fontSize: 16 },
  btnLink: { marginTop: 14, padding: 4 },
  btnLinkText: { color: Colors.fg2, fontWeight: '700', fontSize: 14 },
});
