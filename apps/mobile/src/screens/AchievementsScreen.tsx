import React, { useCallback, useRef, useState } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type {
  AbstinencePeriod,
  AchievementsData,
  BadgeMilestone,
  EarnedBadge,
} from '@stopbet/shared-types';
import type { AppStackParamList } from '../navigation/types';
import { BadgeUnlockModal } from '../components/BadgeUnlockModal';
import { BottomNav, NavTab } from '../components/BottomNav';
import { Icon, type IconName } from '../components/Icon';
import { Colors } from '../constants/colors';
import {
  api,
  hasPendingExternalRelapse,
  acknowledgePendingRelapse,
  suppressNextExternalRelapseDetection,
} from '../services/api';
import { devFlags } from '../store/devFlags';

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

const MILESTONE_DRAFT: Record<BadgeMilestone, string> = {
  1:  'Hoy es el primer día de mi abstinencia. Espero que sea el inicio de un gran camino.',
  3:  'Tres días y aquí sigo. Cada día que pasa me demuestra que puedo lograrlo.',
  7:  'Una semana completa sin apostar. Nunca creí que llegaría aquí tan rápido.',
  14: 'Dos semanas de constancia. Estoy aprendiendo que hay vida más allá del juego.',
  21: '21 días. Lo que empezó como un reto se está convirtiendo en un hábito.',
  30: 'Un mes entero sin apostar. Hoy siento que realmente estoy cambiando.',
  45: '45 días. Cada vez que siento el impulso, recuerdo lo lejos que he llegado.',
  60: 'Dos meses sin apostar. Es más de lo que me imaginé cuando empecé.',
  75: '75 días enfocado en lo que realmente importa. El camino sigue y yo también.',
  90: 'Tres meses. No fue fácil, pero cada día valió la pena. Gracias a todos los que me acompañaron.',
};

// Persiste mientras la app sigue viva — evita re-mostrar el modal al navegar de vuelta
const shownMilestones = new Set<BadgeMilestone>();

const BADGE_CONFIG: Record<BadgeMilestone, { label: string; icon: IconName; daysLabel: string }> = {
  1:  { label: 'Primer día',    icon: 'sprout',       daysLabel: '1 día' },
  3:  { label: 'Primeros pasos',icon: 'chart-column', daysLabel: '3 días' },
  7:  { label: 'Una semana',    icon: 'star',         daysLabel: '7 días' },
  14: { label: 'Dos semanas',   icon: 'sunrise',      daysLabel: '14 días' },
  21: { label: 'Constancia',    icon: 'flame',        daysLabel: '21 días' },
  30: { label: 'Un mes',        icon: 'medal',        daysLabel: '30 días' },
  45: { label: 'Más fuerte',    icon: 'shield',       daysLabel: '45 días' },
  60: { label: 'Dos meses',     icon: 'trophy',       daysLabel: '60 días' },
  75: { label: 'Enfoque',       icon: 'target',       daysLabel: '75 días' },
  90: { label: 'Tres meses',    icon: 'crown',        daysLabel: '90 días' },
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
  const [isExternalRelapse, setIsExternalRelapse] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await api.getAchievements(TEMP_USER_ID);
      setData(result);
      if (hasPendingExternalRelapse()) {
        acknowledgePendingRelapse();
        shownMilestones.clear();
        setIsExternalRelapse(true);
        setRelapseMessage(
          'Tu contador ha sido reiniciado. Recuerda que cada ciclo es parte de tu recuperación — tu equipo AJUTER está aquí para apoyarte en este proceso.',
        );
        setRelapseModal(true);
      } else if (result.newestMilestone && !shownMilestones.has(result.newestMilestone)) {
        shownMilestones.add(result.newestMilestone);
        setTimeout(() => setShareMilestone(result.newestMilestone), 450);
      }
    } catch (err) {
      console.error('[AchievementsScreen] load error', (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      const interval = setInterval(load, 5_000);
      return () => clearInterval(interval);
    }, [load]),
  );

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
              const devStartDate = devFlags.overrideDays !== null
                ? new Date(Date.now() - devFlags.overrideDays * 86_400_000).toISOString().split('T')[0]
                : undefined;
              suppressNextExternalRelapseDetection();
              const { message } = await api.reportRelapse(TEMP_USER_ID, devStartDate);
              shownMilestones.clear();
              devFlags.setOverrideDays(null);
              await load();
              setIsExternalRelapse(false);
              setRelapseMessage(message);
              setRelapseModal(true);
            } catch (err) {
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
      setData((prev) => ({
        ...prev,
        currentPeriod: {
          ...prev.currentPeriod,
          earnedBadges: prev.currentPeriod.earnedBadges.map((b) =>
            b.milestone === shareMilestone ? { ...b, sharedToCommunity: true } : b,
          ),
        },
      }));
      const draft = MILESTONE_DRAFT[shareMilestone] ?? `¡${shareMilestone} días sin apostar!`;
      setShareMilestone(null);
      navigation.navigate('Community', { initialTab: 'forum', draft });
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
          <Icon name="trophy" size={22} color={Colors.white} />
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 }}>
                <Icon name="calendar" size={13} color={Colors.fg2} />
                <Text style={styles.counterStart}>Comenzaste el {formatDateLong(currentPeriod.startDate)}</Text>
              </View>
            )}

            {/* Barra de progreso */}
            {nextM && (
              <View style={styles.progressWrap}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progressFraction * 100}%` }]} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 10 }}>
                  <Icon name="target" size={13} color={Colors.gold} />
                  <Text style={styles.progressLabel}>Próximo hito: {nextM} días · faltan {daysLeft} día{daysLeft !== 1 ? 's' : ''}</Text>
                </View>
              </View>
            )}

            <TouchableOpacity style={styles.relapseBtn} onPress={handleRelapse} activeOpacity={0.8}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon name="heart" size={14} color={Colors.danger} />
                <Text style={styles.relapseBtnText}>Reportar recaída</Text>
              </View>
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
                    <Icon name={cfg.icon} size={26} color={earned ? '#C9954A' : Colors.fg2} />
                  </View>
                  {!earned && (
                    <View style={styles.badgeLock}>
                      <Icon name="lock" size={10} color={Colors.white} />
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
              {data.historicalPeriods.map((period, i, arr) => (
                <CycleCard key={period.id} period={period} attemptLabel={arr.length - i} />
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
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => { setRelapseModal(false); setIsExternalRelapse(false); }}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalIcon}>
              <Icon name={isExternalRelapse ? 'user' : 'heart'} size={42} color={Colors.sage500} />
            </View>
            <Text style={styles.modalTitle}>
              {isExternalRelapse ? 'Tu psicólogo registró una recaída' : 'No estás solo en esto'}
            </Text>
            <Text style={styles.modalText}>{relapseMessage}</Text>
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={() => {
                setRelapseModal(false);
                setIsExternalRelapse(false);
                navigation.navigate('Assistant');
              }}
              activeOpacity={0.85}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name="message-circle" size={18} color={Colors.white} />
                <Text style={styles.btnPrimaryText}>Hablar con el asistente ahora</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setRelapseModal(false); setIsExternalRelapse(false); }}
              style={styles.btnLink}
            >
              <Text style={styles.btnLinkText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Modal: Compartir insignia (con animación) ── */}
      <BadgeUnlockModal
        milestone={shareMilestone}
        badgeDef={shareMilestone ? BADGE_CONFIG[shareMilestone] : null}
        onShare={handleShare}
        onClose={() => setShareMilestone(null)}
      />
    </SafeAreaView>
  );
}

/* ── CycleCard ─────────────────────────────────────────────────────────── */

function CycleCard({ period, attemptLabel }: { period: AbstinencePeriod; attemptLabel: number }) {
  return (
    <View style={styles.cycleCard}>
      <View style={styles.cycleTop}>
        <View style={styles.cycleChip}>
          <Text style={styles.cycleChipText}>Intento {attemptLabel}</Text>
        </View>
        <Text style={styles.cycleDates}>
          {formatDateShort(period.startDate)}
          {period.endDate ? ` – ${formatDateShort(period.endDate)}` : ''}
        </Text>
      </View>
      <Text style={styles.cycleProgress}>{period.daysAchieved} días de progreso</Text>
      {period.earnedBadges.length > 0 && (
        <View style={styles.miniBadges}>
          {[...period.earnedBadges]
            .sort((a, b) => a.milestone - b.milestone)
            .map((b: EarnedBadge) => (
              <View key={b.id} style={styles.miniBadge}>
                <Icon name={BADGE_CONFIG[b.milestone]?.icon ?? 'medal'} size={14} color="#C9954A" />
              </View>
            ))}
        </View>
      )}
      <View style={styles.cycleNote}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Icon name="leaf" size={12} color={Colors.fg2} />
          <Text style={styles.cycleNoteText}>Cada intento cuenta. Aprendiste algo valioso.</Text>
        </View>
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

  loader: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },

  scroll: { flex: 1, backgroundColor: Colors.bg },
  scrollContent: { padding: 16, paddingBottom: 24, gap: 0 },

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
  counterStart: { fontSize: 12, color: Colors.fg2 },

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
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 100,
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
