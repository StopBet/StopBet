import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { MaterialTopTabScreenProps } from '@react-navigation/material-top-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type {
  AbstinencePeriod,
  AchievementsData,
  BadgeMilestone,
  EarnedBadge,
} from '@stopbet/shared-types';
import type { AppStackParamList, MainTabsParamList } from '../navigation/types';
import { BadgeUnlockModal } from '../components/BadgeUnlockModal';
import { Icon, type IconName } from '../components/Icon';
import type { Palette } from '../constants/colors';
import { useColors, useStyles } from '../context/ThemeContext';
import { Fonts } from '../constants/typography';
import {
  api,
  hasPendingExternalRelapse,
  acknowledgePendingRelapse,
  suppressNextExternalRelapseDetection,
} from '../services/api';
import { useToast } from '../context/ToastContext';
import { devFlags } from '../store/devFlags';
import { isNetworkError } from '../services/checkInQueue';
import { readAchievements, saveAchievements } from '../services/offlineStore';
import { Touchable } from '../components/Touchable';
import { useUserId } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import { logInfo, logWarn, logError } from '../utils/log';

import { useIntervaloActivo } from '../hooks/useIntervaloActivo';

import { BADGE_CONFIG } from '../constants/badges';

// Ajustar cuando se conecte autenticación real
const REFRESH_MS = 3 * 60 * 1000;

const MONTHS_LONG = [
  'enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre',
];
const MONTHS_SHORT = [
  'ene','feb','mar','abr','may','jun',
  'jul','ago','sep','oct','nov','dic',
];

const MILESTONES: BadgeMilestone[] = [1, 3, 7, 14, 21, 30, 45, 60, 75, 90];

// Cuánto dura el chip "¡Nuevo!" sobre la última insignia ganada.
const NEW_BADGE_TTL_MS = 60 * 60 * 1000;

// Persiste mientras la app sigue viva - evita re-mostrar el modal al navegar de vuelta
const shownMilestones = new Set<BadgeMilestone>();


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

// Compara solo lo que la pantalla dibuja. Alcanza para saber si vale la pena
// volver a renderizar: el resto de los campos no cambia sin que cambie alguno
// de estos.
function sameAchievements(a: AchievementsData, b: AchievementsData): boolean {
  return (
    a.currentPeriod.id === b.currentPeriod.id &&
    a.currentPeriod.daysAchieved === b.currentPeriod.daysAchieved &&
    a.currentPeriod.startDate === b.currentPeriod.startDate &&
    a.currentPeriod.earnedBadges.length === b.currentPeriod.earnedBadges.length &&
    a.historicalPeriods.length === b.historicalPeriods.length &&
    a.newestMilestone === b.newestMilestone
  );
}

// Vive en el navegador de pestañas, pero también navega al stack de arriba
// (asistente, pánico), así que necesita los dos juegos de props.
type Props = CompositeScreenProps<
  MaterialTopTabScreenProps<MainTabsParamList, 'Achievements'>,
  NativeStackScreenProps<AppStackParamList>
>;

export function AchievementsScreen({ navigation }: Props) {
  const { showDialog } = useDialog();
  const userId = useUserId();
  const c = useColors();
  const styles = useStyles(makeStyles);
  const { showToast } = useToast();
  const [data, setData] = useState<AchievementsData>(EMPTY_DATA);
  // Arranca en true: hasta que llegue la primera respuesta, EMPTY_DATA diría
  // "0 días" y se leería como un contador reiniciado, no como una carga.
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [relapseModal, setRelapseModal] = useState(false);
  const [relapseMessage, setRelapseMessage] = useState('');
  const [shareMilestone, setShareMilestone] = useState<BadgeMilestone | null>(null);
  // Tocar una insignia bloqueada no hacía nada: ahora dice cuánto falta
  const [lockedInfo, setLockedInfo] = useState<BadgeMilestone | null>(null);
  const [isExternalRelapse, setIsExternalRelapse] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await api.getAchievements(userId);
      // El poll corre cada 5 s y casi siempre trae lo mismo. Sin esta guarda,
      // cada vuelta reemplaza el estado por un objeto nuevo y vuelve a pintar
      // todos los períodos con sus insignias, lo que se nota en el dispositivo.
      setData((prev) => (sameAchievements(prev, result) ? prev : result));
      setOffline(false);
      void saveAchievements(userId, result);
      if (hasPendingExternalRelapse()) {
        acknowledgePendingRelapse();
        shownMilestones.clear();
        setIsExternalRelapse(true);
        setRelapseMessage(
          'Tu contador ha sido reiniciado. Recuerda que cada ciclo es parte de tu recuperación. Tu equipo clínico está acá para apoyarte en este proceso.',
        );
        setRelapseModal(true);
      } else if (result.newestMilestone && !shownMilestones.has(result.newestMilestone)) {
        shownMilestones.add(result.newestMilestone);
        setTimeout(() => setShareMilestone(result.newestMilestone), 450);
      }
    } catch (err) {
      // Sin red es un estado esperado, no un fallo: con console.error React
      // Native levanta el LogBox encima de la pantalla.
      if (isNetworkError(err)) {
        logInfo('[AchievementsScreen] sin conexión al cargar');
        // Sin esto la pantalla queda en EMPTY_DATA: cero días y todas las
        // insignias con candado, como si el paciente no hubiera avanzado nada.
        setOffline(true);
        const cached = await readAchievements(userId);
        if (cached) setData((prev) => (prev.currentPeriod.id ? prev : cached));
      } else {
        logError('[AchievementsScreen] load error', (err as Error).message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Antes recargaba cada 5 s mientras la pantalla estuviera abierta: con 4 llamadas
  // por vuelta son 2.880 peticiones por hora de pantalla, en batería y datos del
  // paciente. Nada de acá cambia por segundo; lo urgente llega por push.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const enfocada = useIsFocused();
  useIntervaloActivo(load, REFRESH_MS, enfocada);

  const handleRelapse = () => {
    showDialog({
      title: 'Registrar una recaída',
      message: 'Tu historial se conserva y el contador comienza de nuevo. Nadie te va a retar por esto.',
      actions: [
        {
          label: 'Registrar',
          tone: 'danger',
          onPress: async () => {
            try {
              const devStartDate = devFlags.overrideDays !== null
                ? new Date(Date.now() - devFlags.overrideDays * 86_400_000).toISOString().split('T')[0]
                : undefined;
              suppressNextExternalRelapseDetection();
              const { message } = await api.reportRelapse(userId, devStartDate);
              shownMilestones.clear();
              devFlags.setOverrideDays(null);
              await load();
              setIsExternalRelapse(false);
              setRelapseMessage(message);
              setRelapseModal(true);
            } catch (err) {
              showToast('No pudimos registrar la recaída. Inténtalo de nuevo.', 'error');
            }
          },
        },
        { label: 'Cancelar', tone: 'cancel' },
      ],
    });
  };

  const handleShare = async () => {
    if (!shareMilestone) return;
    try {
      await api.shareBadge(userId, shareMilestone);
      setData((prev) => ({
        ...prev,
        currentPeriod: {
          ...prev.currentPeriod,
          earnedBadges: prev.currentPeriod.earnedBadges.map((b) =>
            b.milestone === shareMilestone ? { ...b, sharedToCommunity: true } : b,
          ),
        },
      }));
      setShareMilestone(null);
      // CA5.2: el anuncio lo publica el backend al compartir. Antes se llegaba al foro
      // con el texto ya escrito en el composer y el paciente tenía que enviarlo él
      // mismo, así que veía su logro dos veces: el anuncio publicado y el borrador.
      navigation.navigate('Community', { initialTab: 'forum' });
    } catch {
      showToast('No pudimos compartir tu insignia. Inténtalo de nuevo.', 'error');
    }
  };

  // El backend no publica dos veces el mismo hito: el modal tiene que saberlo para no
  // ofrecer un botón que no va a hacer nada.
  const insigniaYaCompartida =
    shareMilestone !== null &&
    (data.currentPeriod.earnedBadges.find((b) => b.milestone === shareMilestone)
      ?.sharedToCommunity ?? false);

  const currentPeriod = data.currentPeriod;
  const days = currentPeriod.daysAchieved;
  const earnedSet = new Set(currentPeriod.earnedBadges.map((b) => b.milestone));
  // El chip marca la insignia recién ganada. Antes se elegía "la más alta que no
  // compartiste", que no tiene relación con cuándo se ganó: al compartir las de 30 y
  // 45 días, el chip retrocedía a la de 21 y se quedaba ahí para siempre.
  const newestEarnedMilestone = ((): BadgeMilestone | undefined => {
    const latest = currentPeriod.earnedBadges
      .filter((b) => Boolean(b.createdAt))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
    if (!latest) return undefined;
    const age = Date.now() - Date.parse(latest.createdAt);
    return age < NEW_BADGE_TTL_MS ? (latest.milestone as BadgeMilestone) : undefined;
  })();

  // EMPTY_DATA deja el id vacío: sirve para distinguir "todavía no hay datos"
  // de "el paciente lleva 0 días", que en pantalla se ven igual.
  const hasData = Boolean(currentPeriod?.id);
  const nextM = nextMilestoneFor(days);
  const progressFraction = nextM ? Math.min(days / nextM, 1) : 1;
  const daysLeft = nextM ? nextM - days : 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={c.primary} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Mis Logros</Text>
          <Text style={styles.headerSub}>
            {hasData ? `Periodo actual: ${days} días` : 'Periodo actual: -'}
          </Text>
        </View>
        <View style={styles.trophyCircle}>
          <Icon name="trophy" size={22} color={c.white} />
        </View>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={c.primaryText} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {offline && (
            <View style={styles.offlineBanner}>
              <Icon name="triangle-alert" size={16} color={c.fg2} />
              <Text style={styles.offlineText}>
                {hasData
                  ? 'Sin conexión. Te mostramos tus últimos datos guardados.'
                  : 'Sin conexión. No pudimos cargar tus logros.'}
              </Text>
            </View>
          )}

          {/* ── Contador principal ── */}
          {!hasData ? (
            // Con EMPTY_DATA saldría "0 días" y toda la colección con candado,
            // que se lee como haber perdido la racha y las insignias.
            <View style={styles.counterCard}>
              <Text style={styles.counterPlaceholderText}>
                Tus logros aparecerán al recuperar la conexión
              </Text>
            </View>
          ) : (
          <View style={styles.counterCard}>
            <Text style={styles.counterNum}>{days}</Text>
            <Text style={styles.counterUnit}>días sin apostar</Text>
            {currentPeriod?.startDate && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 }}>
                <Icon name="calendar" size={13} color={c.fg2} />
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
                  <Icon name="target" size={13} color={c.gold} />
                  <Text style={styles.progressLabel}>
                    Próximo hito: {nextM} día{nextM !== 1 ? 's' : ''} · faltan {daysLeft} día{daysLeft !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
            )}

            {/* Iba en el rojo reservado al pánico y en el centro de la tarjeta del logro:
                se leía como castigo. El modal que viene después ya tiene el tono correcto. */}
            <Touchable
              style={styles.relapseBtn}
              onPress={handleRelapse}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityHint="Reinicia tu contador. Nadie te va a retar por esto"
              hitSlop={{ top: 5, bottom: 5 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon name="hand-heart" size={15} color={c.fg2} />
                <Text style={styles.relapseBtnText}>Registrar una recaída</Text>
              </View>
            </Touchable>
          </View>
          )}

          {/* ── Colección de insignias ── */}
          {hasData && <>
          <Text style={styles.sectionTitle}>Tu colección</Text>
          <View style={styles.badgeGrid}>
            {MILESTONES.map((milestone) => {
              const earned = earnedSet.has(milestone);
              const isNewest = milestone === newestEarnedMilestone;
              const cfg = BADGE_CONFIG[milestone];
              return (
                <Touchable
                  key={milestone}
                  style={styles.badgeItem}
                  activeOpacity={earned ? 0.75 : 1}
                  onPress={
                    earned
                      ? () => setShareMilestone(milestone)
                      : () => setLockedInfo(milestone)
                  }
                  accessibilityRole="button"
                  // TalkBack leía igual una ganada y una bloqueada: solo el nombre
                  accessibilityLabel={
                    earned
                      ? `${cfg.label}, ${cfg.daysLabel}, conseguida`
                      : `${cfg.label}, ${cfg.daysLabel}, bloqueada${
                          milestone > days ? `, faltan ${milestone - days} día${milestone - days !== 1 ? 's' : ''}` : ''
                        }`
                  }
                  accessibilityState={{ selected: earned }}
                  accessibilityHint={earned ? 'Compartir con la comunidad' : 'Ver cuánto falta'}
                >
                  {isNewest && (
                    <View style={styles.newChip}>
                      <Text style={styles.newChipText}>¡Nuevo!</Text>
                    </View>
                  )}
                  <View style={[styles.badgeDisc, earned ? styles.badgeDiscEarned : styles.badgeDiscLocked]}>
                    <Icon name={cfg.icon} size={26} color={earned ? c.green : c.fg2} />
                  </View>
                  {!earned && (
                    <View style={styles.badgeLock}>
                      <Icon name="lock" size={10} color={c.white} />
                    </View>
                  )}
                  <Text style={[styles.badgeLabel, !earned && styles.badgeLabelLocked]}>
                    {cfg.label}
                  </Text>
                  <Text style={styles.badgeDays}>{cfg.daysLabel}</Text>
                </Touchable>
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
          </>}
        </ScrollView>
      )}

      <Modal
        visible={lockedInfo !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setLockedInfo(null)}
      >
        <View style={styles.lockedOverlay}>
          <View style={styles.lockedCard}>
            <Icon name="lock" size={26} color={c.fg2} />
            <Text style={styles.lockedTitle}>
              {lockedInfo !== null ? BADGE_CONFIG[lockedInfo].label : ''}
            </Text>
            <Text style={styles.lockedBody}>
              {lockedInfo !== null && lockedInfo > days
                ? `Se consigue a los ${BADGE_CONFIG[lockedInfo].daysLabel}. Te faltan ${lockedInfo - days} día${lockedInfo - days !== 1 ? 's' : ''}.`
                : 'Todavía no la consigues. Va a aparecer acá cuando la ganes.'}
            </Text>
            <Touchable
      rippleColor="rgba(255,255,255,0.28)"
              style={styles.lockedBtn}
              onPress={() => setLockedInfo(null)}
              accessibilityRole="button"
            >
              <Text style={styles.lockedBtnText}>Entendido</Text>
            </Touchable>
          </View>
        </View>
      </Modal>

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
              <Icon name={isExternalRelapse ? 'user' : 'heart'} size={42} color={c.sage500} />
            </View>
            <Text style={styles.modalTitle}>
              {isExternalRelapse ? 'Tu psicólogo registró una recaída' : 'No estás solo en esto'}
            </Text>
            <Text style={styles.modalText}>{relapseMessage}</Text>
            <Touchable
      rippleColor="rgba(255,255,255,0.28)"
              style={styles.btnPrimary}
              onPress={() => {
                setRelapseModal(false);
                setIsExternalRelapse(false);
                navigation.navigate('Assistant');
              }}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name="message-circle" size={18} color={c.white} />
                <Text style={styles.btnPrimaryText}>Hablar con el asistente ahora</Text>
              </View>
            </Touchable>
            <Touchable
              onPress={() => { setRelapseModal(false); setIsExternalRelapse(false); }}
              style={styles.btnLink}
              accessibilityRole="button"
            >
              <Text style={styles.btnLinkText}>Cerrar</Text>
            </Touchable>
          </View>
        </View>
      </Modal>

      {/* ── Modal: Compartir insignia (con animación) ── */}
      <BadgeUnlockModal
        milestone={shareMilestone}
        badgeDef={shareMilestone ? BADGE_CONFIG[shareMilestone] : null}
        isNew={shareMilestone !== null && shareMilestone === newestEarnedMilestone}
        yaCompartida={insigniaYaCompartida}
        onShare={handleShare}
        onVerEnComunidad={() => {
          setShareMilestone(null);
          navigation.navigate('Community', { initialTab: 'forum' });
        }}
        onClose={() => setShareMilestone(null)}
      />
    </SafeAreaView>
  );
}

/**
 * La tarjeta de cada ciclo cerraba con "Cada intento cuenta. Aprendiste algo valioso."
 * palabra por palabra, en todos: leído en fila suena a plantilla. Ahora dice algo que
 * solo se puede decir de ese ciclo.
 */
function cycleNote(period: AbstinencePeriod): string {
  const dias = period.daysAchieved;
  const insignias = period.earnedBadges.length;

  if (insignias > 0) {
    return `Ganaste ${insignias} insignia${insignias === 1 ? '' : 's'} en ${dias} día${dias === 1 ? '' : 's'}. Eso no se borra.`;
  }
  if (dias >= 7) {
    return `Aguantaste ${dias} días. La próxima parte desde más arriba.`;
  }
  if (dias >= 1) {
    return `${dias} día${dias === 1 ? '' : 's'} también cuentan: volviste a empezar.`;
  }
  return 'Volver a empezar ya es parte del proceso.';
}

/* ── CycleCard ─────────────────────────────────────────────────────────── */

function CycleCard({ period, attemptLabel }: { period: AbstinencePeriod; attemptLabel: number }) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.cycleCard}>
      <View style={styles.cycleTop}>
        <View style={styles.cycleChip}>
          <Text style={styles.cycleChipText}>Intento {attemptLabel}</Text>
        </View>
        <Text style={styles.cycleDates}>
          {formatDateShort(period.startDate)}
          {period.endDate ? ` - ${formatDateShort(period.endDate)}` : ''}
        </Text>
      </View>
      <Text style={styles.cycleProgress}>{period.daysAchieved} días de progreso</Text>
      {period.earnedBadges.length > 0 && (
        <View style={styles.miniBadges}>
          {[...period.earnedBadges]
            .sort((a, b) => a.milestone - b.milestone)
            .map((b: EarnedBadge) => (
              <View key={b.id} style={styles.miniBadge}>
                <Icon name={BADGE_CONFIG[b.milestone]?.icon ?? 'medal'} size={14} color={c.green} />
              </View>
            ))}
        </View>
      )}
      <View style={styles.cycleNote}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Icon name="leaf" size={12} color={c.fg2} />
          {/* La misma frase palabra por palabra en cada ciclo sonaba a plantilla */}
          <Text style={styles.cycleNoteText}>{cycleNote(period)}</Text>
        </View>
      </View>
    </View>
  );
}

/* ── Estilos ───────────────────────────────────────────────────────────── */

const makeStyles = (c: Palette) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: c.primary },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 18,
    backgroundColor: c.primary,
    gap: 12,
  },
  headerText: { flex: 1 },
  headerTitle: { fontFamily: Fonts.headingBold, fontSize: 20, color: c.white, lineHeight: 26 },
  headerSub: { fontFamily: Fonts.body, fontSize: 14, color: c.onPrimaryMuted, marginTop: 3 },
  trophyCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.overlayWhite16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loader: { flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' },

  scroll: { flex: 1, backgroundColor: c.bg },
  scrollContent: { padding: 16, paddingBottom: 24, gap: 0 },

  /* Counter card */
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    marginBottom: 16,
  },
  offlineText: {
    fontFamily: Fonts.body,
    flex: 1,
    fontSize: 13,
    color: c.fg2,
  },
  counterPlaceholderText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: c.fg2,
    textAlign: 'center',
    paddingVertical: 20,
  },
  counterCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: c.shadowMedium,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 0,
  },
  counterNum: {
    // El manual reserva Chillax para los números grandes; Inicio ya lo usaba y acá
    // el mismo dato salía en Satoshi
    fontFamily: Fonts.headingBold,
    fontSize: 72,
    color: c.primaryText,
    letterSpacing: -1,
    lineHeight: 80,
  },
  counterUnit: { fontFamily: Fonts.bodyBold, fontSize: 18, color: c.fg2, marginTop: 2 },
  counterStart: { fontFamily: Fonts.body, fontSize: 12, color: c.fg2 },

  progressWrap: { width: '100%', marginTop: 20 },
  progressTrack: {
    height: 8,
    borderRadius: 9999,
    backgroundColor: c.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 9999,
    backgroundColor: c.sage500,
  },
  progressLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    color: c.greenText,
    textAlign: 'center',
  },

  relapseBtn: {
    marginTop: 22,
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: 9999,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  relapseBtnText: { fontFamily: Fonts.bodyBold, color: c.fg2, fontSize: 13.5 },

  /* Section title */
  sectionTitle: {
    fontFamily: Fonts.headingBold,
    fontSize: 18,
    color: c.fg1,
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
    backgroundColor: c.gold50,
    borderWidth: 2,
    borderColor: c.green,
    shadowColor: c.green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  badgeDiscLocked: {
    backgroundColor: c.border,
    opacity: 0.6,
  },
  badgeLock: {
    position: 'absolute',
    top: 0,
    right: '12%',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: c.fg2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newChip: {
    position: 'absolute',
    top: -7,
    right: '8%',
    backgroundColor: c.primary,
    borderRadius: 9999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    zIndex: 1,
  },
  newChipText: { fontFamily: Fonts.bodyBold, color: c.white, fontSize: 12 },
  badgeLabel: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: c.fg1,
    textAlign: 'center',
    marginTop: 7,
    lineHeight: 13,
    paddingHorizontal: 2,
  },
  badgeLabelLocked: { color: c.fg2 },
  badgeDays: { fontFamily: Fonts.bodyBold, fontSize: 12, color: c.fg2, marginTop: 2 },

  /* Cycle card */
  cycleCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    borderTopWidth: 3,
    borderTopColor: c.sage500,
    padding: 16,
    marginBottom: 12,
    shadowColor: c.shadowSoft,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 1,
  },
  cycleTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cycleChip: {
    backgroundColor: c.sage50,
    borderRadius: 9999,
    paddingHorizontal: 11,
    paddingVertical: 4,
  },
  cycleChipText: { fontFamily: Fonts.bodyBold, color: c.greenText, fontSize: 12 },
  cycleDates: { fontFamily: Fonts.body, fontSize: 12, color: c.fg2 },
  cycleProgress: {
    fontFamily: Fonts.bodyBold,
    fontSize: 15,
    color: c.ink900,
    marginTop: 11,
    marginBottom: 12,
  },
  miniBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  miniBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: c.gold50,
    borderWidth: 1.5,
    borderColor: c.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cycleNote: { marginTop: 13 },
  cycleNoteText: { fontFamily: Fonts.body, fontSize: 12, color: c.fg2, fontStyle: 'italic', lineHeight: 18 },

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
    backgroundColor: c.surface,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    shadowColor: c.ink900,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 16,
  },
  modalIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: c.infoSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontFamily: Fonts.headingBold,
    fontSize: 22,
    color: c.ink900,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
    lineHeight: 28,
  },
  modalText: {
    fontFamily: Fonts.body,
    fontSize: 15,
    color: c.fg2,
    textAlign: 'center',
    lineHeight: 23,
    marginHorizontal: 8,
  },

  /* Buttons */
  btnPrimary: {
    width: '100%',
    backgroundColor: c.primary,
    borderRadius: 9999,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 22,
  },
  btnPrimaryText: { fontFamily: Fonts.bodyBold, color: c.white, fontSize: 16 },
  btnLink: { marginTop: 14, minHeight: 48, paddingHorizontal: 12, justifyContent: 'center' },
  btnLinkText: { fontFamily: Fonts.bodyBold, color: c.fg2, fontSize: 14 },
  lockedOverlay: {
    flex: 1,
    backgroundColor: c.overlay,
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  lockedCard: {
    backgroundColor: c.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  lockedTitle: { fontFamily: Fonts.headingBold, fontSize: 18, color: c.ink900 },
  lockedBody: { fontFamily: Fonts.body, fontSize: 14, color: c.fg1, lineHeight: 20, textAlign: 'center' },
  lockedBtn: {
    marginTop: 8,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 26,
    borderRadius: 9999,
    backgroundColor: c.primary,
  },
  lockedBtnText: { fontFamily: Fonts.bodyBold, fontSize: 15, color: c.white },

});
