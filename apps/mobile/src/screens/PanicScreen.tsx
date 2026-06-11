import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  Animated,
  Linking,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type {
  ActiveAlertResponse,
  PanicAlertDto,
  SponsorInfo,
} from '@stopbet/shared-types';
import type { AppStackParamList } from '../navigation/types';
import { Colors } from '../constants/colors';
import { Icon } from '../components/Icon';
import { api } from '../services/api';

// ──────────────────────────────────────────────────────────────────────────────
// Constantes

const TEMP_USER_ID = '11111111-1111-1111-1111-111111111111';
const HOLD_DURATION_MS = 2000;
const POLL_INTERVAL_MS = 5000;
const ESCALATION_SECONDS = 180; // 3 minutos
const CRISIS_LINE = '*4141';
const AUTO_RESET_MS = 30_000; // 30 s tras respuesta/comunidad/escalada

// ──────────────────────────────────────────────────────────────────────────────
// Tipos internos

type ScreenState =
  | { kind: 'loading' }
  | { kind: 'offline' }
  | { kind: 'idle'; sponsor: SponsorInfo | null }
  | { kind: 'waiting'; alert: PanicAlertDto; sponsor: SponsorInfo | null }
  | { kind: 'responded'; alert: PanicAlertDto; sponsor: SponsorInfo | null }
  | { kind: 'escalated'; alert: PanicAlertDto };

type Props = NativeStackScreenProps<AppStackParamList, 'Panic'>;

// ──────────────────────────────────────────────────────────────────────────────

export function PanicScreen({ navigation }: Props) {
  const [state, setState] = useState<ScreenState>({ kind: 'loading' });
  const [countdown, setCountdown] = useState(ESCALATION_SECONDS);

  // ── Hold-to-activate animation ─────────────────────────────────────────
  const holdProgress = useRef(new Animated.Value(0)).current;
  const holdAnim = useRef<Animated.CompositeAnimation | null>(null);
  const isActivating = useRef(false);

  // ── Polls / timers ─────────────────────────────────────────────────────
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Refleja state.kind sin stale-closure; el poll lo usa para guardar navegación
  const stateKindRef = useRef<ScreenState['kind']>('loading');

  // Mantener stateKindRef en sync para que callbacks sin acceso al state actual
  // (como el interval del poll) puedan consultar el kind sin stale-closure.
  useEffect(() => { stateKindRef.current = state.kind; }, [state.kind]);

  // ──────────────────────────────────────────────────────────────────────
  // Load inicial

  const load = useCallback(async () => {
    try {
      const sponsorInfo = await api.getSponsorInfo(TEMP_USER_ID);
      const activeResp = await api.getPanicActiveAlert(TEMP_USER_ID);

      if (activeResp.alert) {
        const { alert, sponsor } = activeResp;
        if (alert.status === 'pending') {
          setState({ kind: 'waiting', alert, sponsor });
          startCountdown(new Date(alert.createdAt));
          startPolling();
        } else if (alert.status === 'responded') {
          setState({ kind: 'responded', alert, sponsor });
          scheduleAutoReset(alert.id, sponsor);
        } else if (alert.status === 'escalated') {
          // Ya navegamos al asistente cuando se escaló. Al volver a esta pantalla
          // no tiene sentido bloquearla con "Asistente IA listo" — ir directo a idle.
          setState({ kind: 'idle', sponsor: sponsorInfo });
          api.cancelPanicAlert(TEMP_USER_ID, alert.id).catch(() => {});
        } else {
          setState({ kind: 'idle', sponsor: sponsorInfo });
        }
      } else {
        setState({ kind: 'idle', sponsor: sponsorInfo });
      }
    } catch (err) {
      const isNetworkError = (err as Error).message?.includes('Network request failed') ||
        (err as Error).message?.includes('Failed to fetch');
      setState(isNetworkError ? { kind: 'offline' } : { kind: 'idle', sponsor: null });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      return () => {
        stopPolling();
        stopCountdown();
        clearAutoReset();
      };
    }, [load]),
  );

  // ──────────────────────────────────────────────────────────────────────
  // Polling

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const resp = await api.getPanicActiveAlert(TEMP_USER_ID);
        if (!resp.alert) return;
        const { alert, sponsor } = resp;
        if (alert.status === 'responded') {
          stopPolling();
          stopCountdown();
          setState({ kind: 'responded', alert, sponsor });
          scheduleAutoReset(alert.id, sponsor);
        } else if (alert.status === 'escalated') {
          // Solo navegar si el usuario no canceló mientras el callback estaba en vuelo
          if (stateKindRef.current === 'waiting') {
            stopPolling();
            stopCountdown();
            navigation.navigate('Assistant');
          }
        }
      } catch {
        // Red fluctuante — seguir intentando
      }
    }, POLL_INTERVAL_MS);
  }, [navigation]);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  // ──────────────────────────────────────────────────────────────────────
  // Countdown

  const startCountdown = useCallback((alertCreatedAt: Date) => {
    if (countdownRef.current) return;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - alertCreatedAt.getTime()) / 1000);
      const remaining = Math.max(0, ESCALATION_SECONDS - elapsed);
      setCountdown(remaining);
    };
    tick();
    countdownRef.current = setInterval(tick, 1000);
  }, []);

  const stopCountdown = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  };

  const clearAutoReset = () => {
    if (autoResetRef.current) {
      clearTimeout(autoResetRef.current);
      autoResetRef.current = null;
    }
  };

  const scheduleAutoReset = (alertId: string, sponsorForIdle: SponsorInfo | null) => {
    clearAutoReset();
    autoResetRef.current = setTimeout(async () => {
      try {
        await api.cancelPanicAlert(TEMP_USER_ID, alertId);
      } catch { /* best effort */ }
      setState({ kind: 'idle', sponsor: sponsorForIdle });
    }, AUTO_RESET_MS);
  };

  // ──────────────────────────────────────────────────────────────────────
  // Hold-to-activate

  const onPressIn = useCallback(() => {
    if (isActivating.current) return;
    holdAnim.current = Animated.timing(holdProgress, {
      toValue: 1,
      duration: HOLD_DURATION_MS,
      useNativeDriver: false,
    });
    holdAnim.current.start(({ finished }) => {
      if (finished) handleActivate();
    });
  }, [holdProgress]);

  const onPressOut = useCallback(() => {
    if (isActivating.current) return;
    holdAnim.current?.stop();
    Animated.timing(holdProgress, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [holdProgress]);

  const handleActivate = useCallback(async () => {
    if (isActivating.current) return;
    isActivating.current = true;
    try {
      const alert = await api.createPanicAlert(TEMP_USER_ID);
      const resp = await api.getPanicActiveAlert(TEMP_USER_ID);
      setCountdown(ESCALATION_SECONDS);
      setState({ kind: 'waiting', alert, sponsor: resp.sponsor });
      startCountdown(new Date(alert.createdAt));
      startPolling();
    } catch (err) {
      const isNetworkError = (err as Error).message?.includes('Network request failed') ||
        (err as Error).message?.includes('Failed to fetch');
      if (isNetworkError) setState({ kind: 'offline' });
    } finally {
      isActivating.current = false;
      holdProgress.setValue(0);
    }
  }, [holdProgress, startCountdown, startPolling]);

  // ──────────────────────────────────────────────────────────────────────
  // Acciones desde Estado 2

  const handleCancel = useCallback(async () => {
    if (state.kind !== 'waiting') return;
    // Parar todo antes del await para evitar race condition con el poll
    stopPolling();
    stopCountdown();
    clearAutoReset();
    setCountdown(ESCALATION_SECONDS);
    setState({ kind: 'idle', sponsor: state.sponsor });
    try {
      await api.cancelPanicAlert(TEMP_USER_ID, state.alert.id);
    } catch {
      // Best effort — el estado local ya volvió a idle
    }
  }, [state]);

  const handleAlertCommunity = useCallback(async () => {
    if (state.kind !== 'waiting') return;
    try {
      await api.notifyCommunity(TEMP_USER_ID, state.alert.id);
      setState({ kind: 'waiting', alert: { ...state.alert, communityNotified: true }, sponsor: state.sponsor });
      scheduleAutoReset(state.alert.id, state.sponsor);
    } catch {
      // Silencioso
    }
  }, [state]);

  const handleEscalateToAI = useCallback(async () => {
    if (state.kind !== 'waiting') return;
    const { id: alertId, } = state.alert;
    const sponsor = state.sponsor;
    try {
      await api.escalatePanicAlert(TEMP_USER_ID, alertId);
    } catch {
      // Si falla la escalada igual redirigimos al asistente
    }
    stopPolling();
    stopCountdown();
    scheduleAutoReset(alertId, sponsor);
    navigation.navigate('Assistant');
  }, [state, navigation]);

  // ──────────────────────────────────────────────────────────────────────
  // Helpers de formato

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const ringBorderWidth = holdProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 7],
  });
  const btnScale = holdProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.05],
  });

  // ──────────────────────────────────────────────────────────────────────
  // Renders por estado

  if (state.kind === 'loading') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.bg} />
        <View style={styles.center}>
          <Text style={styles.loadingText}>Cargando…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Estado 4: Sin conexión ─────────────────────────────────────────────
  if (state.kind === 'offline') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.danger} />
        <View style={styles.offlineBanner}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="triangle-alert" size={14} color="#fff" />
            <Text style={styles.offlineBannerText}>Sin conexión a internet</Text>
          </View>
        </View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>¿Necesitas ayuda ahora?</Text>
          <Text style={styles.subtitle}>No podemos enviar la alerta sin conexión</Text>

          <View style={styles.disabledBtnWrap}>
            <View style={[styles.panicBtn, styles.panicBtnDisabled]}>
              <Icon name="hand" size={40} color="#fff" />
              <Text style={styles.panicBtnLabel}>PÁNICO</Text>
            </View>
            <Text style={styles.holdHintDisabled}>Necesitas conexión para activarlo</Text>
          </View>

          <View style={styles.warnCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="triangle-alert" size={14} color={Colors.accent} />
              <Text style={styles.warnCardTitle}>No fue posible enviar el aviso</Text>
            </View>
            <Text style={styles.warnCardBody}>Conéctate a internet e inténtalo nuevamente.</Text>
          </View>

          <Pressable
            style={styles.callRow}
            onPress={() => Linking.openURL('tel:+56987654321')}
            accessibilityLabel="Llamar directamente al padrino"
          >
            <View style={styles.callIcon}><Icon name="phone" size={20} color={Colors.primary} /></View>
            <View style={styles.callMeta}>
              <Text style={styles.callLabel}>Llama directamente a tu padrino</Text>
              <Text style={styles.callNumber}>+56 9 8765 4321</Text>
            </View>
            <Icon name="chevron-right" size={20} color={Colors.fg2} />
          </Pressable>

          <Pressable
            style={[styles.callRow, styles.callRowDanger]}
            onPress={() => Linking.openURL(`tel:${CRISIS_LINE}`)}
            accessibilityLabel="Llamar a la línea de prevención del suicidio *4141"
          >
            <View style={[styles.callIcon, styles.callIconDanger]}><Icon name="siren" size={20} color={Colors.danger} /></View>
            <View style={styles.callMeta}>
              <Text style={[styles.callLabel, { fontWeight: '700', color: Colors.ink900 }]}>
                Línea de prevención del suicidio
              </Text>
              <Text style={[styles.callNumber, { color: Colors.danger, fontSize: 20 }]}>
                *4141
              </Text>
              <Text style={styles.callSubLabel}>Gratuita · 24 horas · Confidencial</Text>
            </View>
            <Icon name="chevron-right" size={20} color={Colors.danger} />
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Estado 3: Padrino respondió ────────────────────────────────────────
  if (state.kind === 'responded' || state.kind === 'escalated') {
    const sponsor = state.kind === 'responded' ? state.sponsor : null;
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: '#F0FAF5' }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#F0FAF5" />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { justifyContent: 'space-between', flex: 1 }]}
        >
          <View style={styles.respondedTop}>
            <View style={styles.checkBadge}>
              <Icon name="circle-check" size={52} color={Colors.sage500} />
            </View>
            <Text style={styles.respondedTitle}>
              {state.kind === 'responded' && sponsor
                ? `${sponsor.firstName} está en camino`
                : 'Asistente IA listo'}
            </Text>
            <Text style={styles.respondedSub}>
              {state.kind === 'responded'
                ? 'Tu padrino respondió hace un momento'
                : 'La alerta fue escalada al asistente'}
            </Text>
          </View>

          {sponsor && (
            <View style={styles.card}>
              <View style={styles.avatarRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarLetter}>
                    {sponsor.firstName.charAt(0)}
                  </Text>
                  <View style={styles.onlineDot} />
                </View>
                <View style={styles.sponsorMeta}>
                  <Text style={styles.sponsorName}>{sponsor.firstName} {sponsor.lastName}</Text>
                  <Text style={styles.sponsorStatus}>Respondió · disponible</Text>
                </View>
                <Icon name="handshake" size={24} color={Colors.sage500} />
              </View>
            </View>
          )}

          <View style={styles.actions}>
            {state.kind === 'responded' && (
              <Pressable style={[styles.btn, styles.btnPrimary]} onPress={() => navigation.navigate('Assistant')}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Icon name="message-circle" size={18} color="#fff" />
                  <Text style={styles.btnTextLight}>Iniciar chat con {sponsor?.firstName ?? 'padrino'}</Text>
                </View>
              </Pressable>
            )}
            <Pressable style={[styles.btn, styles.btnOutlineTeal]} onPress={() => navigation.navigate('Assistant')}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name="sparkles" size={18} color={Colors.primary} />
                <Text style={styles.btnTextPrimary}>Hablar con asistente IA</Text>
              </View>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Estado 2: Esperando respuesta ──────────────────────────────────────
  if (state.kind === 'waiting') {
    const { alert, sponsor } = state;
    const isCountdownUrgent = countdown <= 30;
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: '#FFF5F5' }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF5F5" />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Timer */}
          <View style={styles.timerWrap}>
            <View style={[styles.timerPulse, styles.timerPulse1]} />
            <View style={[styles.timerPulse, styles.timerPulse2]} />
            <View style={styles.timerCore}>
              <Text style={[styles.timerNum, isCountdownUrgent && styles.timerNumUrgent]}>
                {formatCountdown(countdown)}
              </Text>
              <Text style={styles.timerCap}>para escalar</Text>
            </View>
          </View>

          <Text style={styles.waitTitle}>
            Alerta enviada a {sponsor?.firstName ?? 'tu padrino'}
          </Text>
          <View style={styles.waitingDotsRow}>
            <Text style={styles.waitSub}>Esperando respuesta </Text>
            <Text style={styles.waitDots}>•••</Text>
          </View>

          {/* Sponsor card */}
          <View style={styles.card}>
            <View style={styles.avatarRow}>
              {sponsor && (
                <View style={styles.avatar}>
                  <Text style={styles.avatarLetter}>{sponsor.firstName.charAt(0)}</Text>
                </View>
              )}
              <View style={styles.sponsorMeta}>
                <Text style={styles.sponsorName}>
                  {sponsor
                    ? `${sponsor.firstName} está siendo notificado`
                    : 'Notificando padrino…'}
                </Text>
                <Text style={styles.notifTime}>hace un momento</Text>
              </View>
              <Icon name="bell" size={18} color={Colors.accent} />
            </View>
          </View>

          {/* IA banner */}
          <View style={styles.iaBanner}>
            <Icon name="sparkles" size={20} color={Colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.iaBannerTitle}>Asistente IA disponible</Text>
              <Text style={styles.iaBannerBody}>
                Tomará contacto automáticamente en{' '}
                <Text style={{ fontWeight: '700' }}>{formatCountdown(countdown)}</Text>
                {' '}si nadie responde, o inicia el chat ahora mismo.
              </Text>
            </View>
          </View>

          {/* Comunidad */}
          {!alert.communityNotified && (
            <View style={styles.communityCard}>
              <Icon name="users" size={22} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.communityTitle}>¿Avisar a la Comunidad?</Text>
                <Text style={styles.communityBody}>Tu red de apoyo también puede saber que necesitas ayuda.</Text>
              </View>
            </View>
          )}

          {!alert.communityNotified && (
            <Pressable style={[styles.btn, styles.btnOutlineTeal]} onPress={handleAlertCommunity}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name="users" size={18} color={Colors.primary} />
                <Text style={styles.btnTextPrimary}>Alertar a mi comunidad</Text>
              </View>
            </Pressable>
          )}

          <Pressable style={[styles.btn, styles.btnOutlineTeal]} onPress={handleEscalateToAI}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="sparkles" size={18} color={Colors.primary} />
              <Text style={styles.btnTextPrimary}>Hablar con el asistente ahora</Text>
            </View>
          </Pressable>

          <Pressable
            style={[styles.btn, styles.btnOutlineDanger, { marginBottom: 24 }]}
            onPress={handleCancel}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="x" size={18} color={Colors.danger} />
              <Text style={styles.btnTextDanger}>Cancelar alerta</Text>
            </View>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Estado 1: Idle (listo) ─────────────────────────────────────────────
  const { sponsor } = state;
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bg} />
      <View style={styles.content}>
        {/* Pregunta */}
        <View style={styles.topSection}>
          <Text style={styles.title}>¿Necesitas ayuda ahora?</Text>
          <Text style={styles.subtitle}>Tu padrino recibirá una alerta inmediata</Text>
        </View>

        {/* Botón hold */}
        <View style={styles.holdSection}>
          <View style={styles.holdWrap}>
            {/* Anillo de progreso (se va haciendo visible mientras se mantiene) */}
            <Animated.View
              style={[
                styles.holdRing,
                { borderWidth: ringBorderWidth },
              ]}
              pointerEvents="none"
            />
            <Animated.View style={{ transform: [{ scale: btnScale }] }}>
              <Pressable
                style={({ pressed }) => [styles.panicBtn, pressed && styles.panicBtnPressed]}
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                android_ripple={null}
                accessibilityLabel="Botón de pánico. Mantén presionado 2 segundos para activar"
                accessibilityRole="button"
              >
                <Icon name="hand" size={40} color="#fff" />
                <Text style={styles.panicBtnLabel}>PÁNICO</Text>
              </Pressable>
            </Animated.View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
            <Icon name="clock" size={14} color={Colors.fg2} />
            <Text style={styles.holdHint}>Mantén presionado 2 segundos para activar</Text>
          </View>
        </View>

        {/* Sponsor card */}
        <View style={[styles.card, styles.sponsorCard]}>
          <Text style={styles.sponsorCardLabel}>Tu padrino asignado</Text>
          <View style={styles.avatarRow}>
            {sponsor ? (
              <>
                <View style={styles.avatar}>
                  <Text style={styles.avatarLetter}>{sponsor.firstName.charAt(0)}</Text>
                  <View style={styles.onlineDot} />
                </View>
                <View style={styles.sponsorMeta}>
                  <Text style={styles.sponsorName}>{sponsor.firstName} {sponsor.lastName}</Text>
                  <Text style={styles.sponsorOnline}>● Disponible</Text>
                </View>
                {sponsor.phone && (
                  <Pressable
                    style={styles.callSmallBtn}
                    onPress={() => Linking.openURL(`tel:${sponsor.phone}`)}
                    accessibilityLabel={`Llamar a ${sponsor.firstName}`}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Icon name="phone" size={14} color={Colors.primary} />
                      <Text style={styles.callSmallBtnText}>Llamar</Text>
                    </View>
                  </Pressable>
                )}
              </>
            ) : (
              <Text style={styles.noSponsorText}>Sin padrino asignado — contacta a tu psicólogo</Text>
            )}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Estilos

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 14,
  },
  content: {
    flex: 1,
    paddingHorizontal: 22,
    justifyContent: 'space-between',
    paddingBottom: 24,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: Colors.fg2,
    fontSize: 16,
  },

  // ── Offline ──
  offlineBanner: {
    backgroundColor: Colors.danger,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  offlineBannerText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  warnCard: {
    backgroundColor: '#FFF5EB',
    borderLeftWidth: 4,
    borderLeftColor: Colors.accent,
    borderRadius: 16,
    padding: 14,
  },
  warnCardTitle: {
    fontWeight: '700',
    fontSize: 14,
    color: Colors.ink900,
  },
  warnCardBody: {
    fontSize: 13,
    color: Colors.fg2,
    marginTop: 4,
    lineHeight: 20,
  },

  // ── Llamadas ──
  callRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#EFF4F1',
    borderRadius: 16,
    padding: 14,
  },
  callRowDanger: {
    backgroundColor: '#FFF0F0',
    borderWidth: 1.5,
    borderColor: 'rgba(184,50,50,0.18)',
  },
  callIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callIconDanger: {
    backgroundColor: '#fff',
  },
  callMeta: { flex: 1 },
  callLabel: {
    fontSize: 12,
    color: Colors.fg2,
  },
  callNumber: {
    fontWeight: '700',
    fontSize: 16,
    color: Colors.primary,
  },
  callSubLabel: {
    fontSize: 11,
    color: Colors.fg2,
    marginTop: 2,
  },

  // ── Textos generales ──
  title: {
    fontWeight: '700',
    fontSize: 24,
    color: Colors.ink900,
    textAlign: 'center',
    lineHeight: 30,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.fg2,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 6,
  },
  topSection: {
    marginTop: 12,
    alignItems: 'center',
  },
  holdSection: {
    alignItems: 'center',
    gap: 16,
  },

  // ── Botón pánico ──
  holdWrap: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  holdRing: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    borderColor: Colors.danger,
    opacity: 0.6,
  },
  panicBtn: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: Colors.danger,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  panicBtnPressed: {
    opacity: 0.9,
    elevation: 6,
  },
  panicBtnDisabled: {
    backgroundColor: '#ccc',
    shadowOpacity: 0,
    elevation: 0,
  },
  panicBtnLabel: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 2,
  },
  holdHint: {
    fontSize: 13,
    color: Colors.fg2,
    textAlign: 'center',
  },
  holdHintDisabled: {
    fontSize: 13,
    color: '#ccc',
    textAlign: 'center',
    marginTop: 8,
  },
  disabledBtnWrap: {
    alignItems: 'center',
    marginVertical: 12,
    gap: 10,
  },

  // ── Sponsor card ──
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: Colors.shadowMedium,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  sponsorCard: {
    marginBottom: 8,
  },
  sponsorCardLabel: {
    fontSize: 12,
    color: Colors.fg2,
    marginBottom: 10,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.teal400,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarLetter: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 18,
  },
  onlineDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.sage500,
    borderWidth: 2.5,
    borderColor: Colors.surface,
  },
  sponsorMeta: { flex: 1 },
  sponsorName: {
    fontWeight: '700',
    fontSize: 16,
    color: Colors.ink900,
  },
  sponsorStatus: {
    fontSize: 12,
    color: Colors.sage500,
    marginTop: 2,
    fontWeight: '600',
  },
  sponsorOnline: {
    fontSize: 12,
    color: Colors.sage500,
    marginTop: 2,
    fontWeight: '600',
  },
  noSponsorText: {
    fontSize: 14,
    color: Colors.fg2,
    flex: 1,
  },
  callSmallBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  callSmallBtnText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  notifTime: {
    fontSize: 12,
    color: Colors.fg2,
    marginTop: 2,
  },

  // ── Timer (estado 2) ──
  timerWrap: {
    alignSelf: 'center',
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  timerPulse: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: Colors.danger,
    opacity: 0.1,
  },
  timerPulse1: { transform: [{ scale: 1.4 }], opacity: 0.07 },
  timerPulse2: { transform: [{ scale: 1.2 }], opacity: 0.12 },
  timerCore: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.shadowSoft,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  timerNum: {
    fontWeight: '800',
    fontSize: 48,
    color: Colors.danger,
    lineHeight: 52,
    fontVariant: ['tabular-nums'],
  },
  timerNumUrgent: {
    color: Colors.danger,
  },
  timerCap: {
    fontSize: 11,
    color: Colors.fg2,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
    fontWeight: '600',
  },
  waitTitle: {
    fontWeight: '600',
    fontSize: 18,
    color: Colors.ink900,
    textAlign: 'center',
  },
  waitSub: {
    fontSize: 14,
    color: Colors.fg2,
    textAlign: 'center',
  },
  waitingDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  waitDots: {
    color: Colors.fg2,
    fontSize: 14,
  },

  // ── IA banner ──
  iaBanner: {
    backgroundColor: Colors.amber50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EDCFAA',
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  iaBannerTitle: {
    fontWeight: '700',
    fontSize: 13.5,
    color: Colors.accent,
  },
  iaBannerBody: {
    fontSize: 13,
    color: Colors.ink900,
    lineHeight: 20,
    marginTop: 2,
  },

  // ── Comunidad banner ──
  communityCard: {
    backgroundColor: '#EFF4F1',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D5E4E0',
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  communityTitle: {
    fontWeight: '700',
    fontSize: 13.5,
    color: Colors.primary,
  },
  communityBody: {
    fontSize: 13,
    color: Colors.ink900,
    lineHeight: 20,
    marginTop: 2,
  },

  // ── Estado 3: Respondió ──
  respondedTop: {
    alignItems: 'center',
    gap: 16,
    marginTop: 40,
    marginBottom: 24,
  },
  checkBadge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#EFF4F1',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 5,
    borderColor: Colors.sage500,
  },
  respondedTitle: {
    fontWeight: '700',
    fontSize: 24,
    color: Colors.ink900,
    textAlign: 'center',
    lineHeight: 30,
  },
  respondedSub: {
    fontSize: 14,
    color: Colors.fg2,
    textAlign: 'center',
  },

  // ── Botones ──
  actions: {
    gap: 12,
    marginBottom: 24,
  },
  btn: {
    borderRadius: 999,
    paddingVertical: 15,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  btnPrimary: {
    backgroundColor: Colors.primary,
  },
  btnOutlineTeal: {
    backgroundColor: 'transparent',
    borderColor: Colors.primary,
  },
  btnOutlineDanger: {
    backgroundColor: 'transparent',
    borderColor: Colors.danger,
  },
  btnTextLight: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  btnTextPrimary: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 16,
  },
  btnTextDanger: {
    color: Colors.danger,
    fontWeight: '700',
    fontSize: 16,
  },
});
