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
import type { Palette } from '../constants/colors';
import { useTheme, useColors, useStyles } from '../context/ThemeContext';
import { Fonts } from '../constants/typography';
import { Icon } from '../components/Icon';
import { api } from '../services/api';
import { conReintento } from '../services/reintentoEscritura';
import { readSponsor, saveSponsor } from '../services/offlineStore';
import { useUserId } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';

// ──────────────────────────────────────────────────────────────────────────────
// Constantes

const HOLD_DURATION_MS = 2000;
const POLL_INTERVAL_MS = 5000;
const ESCALATION_SECONDS = 120; // CA1.3: debe coincidir con ESCALATION_MS del backend
const CRISIS_LINE = '*4141';

function formatPhone(phone: string): string {
  const m = /^\+569(\d{4})(\d{4})$/.exec(phone.replace(/\s/g, ''));
  return m ? `+56 9 ${m[1]} ${m[2]}` : phone;
}

// ──────────────────────────────────────────────────────────────────────────────
// Tipos internos

type ScreenState =
  | { kind: 'loading' }
  | { kind: 'offline'; sponsor: SponsorInfo | null }
  | { kind: 'idle'; sponsor: SponsorInfo | null }
  | { kind: 'waiting'; alert: PanicAlertDto; sponsor: SponsorInfo | null }
  | { kind: 'responded'; alert: PanicAlertDto; sponsor: SponsorInfo | null }
  | { kind: 'escalated'; alert: PanicAlertDto };

type Props = NativeStackScreenProps<AppStackParamList, 'Panic'>;

// ──────────────────────────────────────────────────────────────────────────────

export function PanicScreen({ navigation }: Props) {
  const { showDialog } = useDialog();
  const userId = useUserId();
  const { isDark } = useTheme();
  const c = useColors();
  const styles = useStyles(makeStyles);
  const [state, setState] = useState<ScreenState>({ kind: 'loading' });
  const [countdown, setCountdown] = useState(ESCALATION_SECONDS);

  // ── Hold-to-activate animation ─────────────────────────────────────────
  const holdProgress = useRef(new Animated.Value(0)).current;
  const holdAnim = useRef<Animated.CompositeAnimation | null>(null);
  const isActivating = useRef(false);

  // ── Polls / timers ─────────────────────────────────────────────────────
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Refleja state.kind sin stale-closure; el poll lo usa para guardar navegación
  const stateKindRef = useRef<ScreenState['kind']>('loading');

  // Mantener stateKindRef en sync para que callbacks sin acceso al state actual
  // (como el interval del poll) puedan consultar el kind sin stale-closure.
  useEffect(() => { stateKindRef.current = state.kind; }, [state.kind]);

  // ──────────────────────────────────────────────────────────────────────
  // Load inicial

  const load = useCallback(async () => {
    // El botón no espera al servidor: aparece de inmediato con el último padrino conocido
    const cached = await readSponsor(userId);
    setState((prev) => (prev.kind === 'loading' ? { kind: 'idle', sponsor: cached } : prev));
    try {
      const [sponsorInfo, activeResp] = await Promise.all([
        api.getSponsorInfo(userId),
        api.getPanicActiveAlert(userId),
      ]);
      void saveSponsor(userId, sponsorInfo);

      if (activeResp.alert) {
        const { alert, sponsor } = activeResp;
        if (alert.status === 'pending') {
          setState({ kind: 'waiting', alert, sponsor });
          startCountdown(new Date(alert.createdAt));
          startPolling();
        } else if (alert.status === 'responded') {
          setState({ kind: 'responded', alert, sponsor });
        } else if (alert.status === 'escalated') {
          // Ya navegamos al asistente cuando se escaló. Al volver a esta pantalla
          // no tiene sentido bloquearla con "Asistente IA listo" — ir directo a idle.
          setState({ kind: 'idle', sponsor: sponsorInfo });
          api.cancelPanicAlert(userId, alert.id).catch(() => {});
        } else {
          setState({ kind: 'idle', sponsor: sponsorInfo });
        }
      } else {
        setState({ kind: 'idle', sponsor: sponsorInfo });
      }
    } catch (err) {
      const isNetworkError = (err as Error).message?.includes('Network request failed') ||
        (err as Error).message?.includes('Failed to fetch');
      setState(isNetworkError ? { kind: 'offline', sponsor: await readSponsor(userId) } : { kind: 'idle', sponsor: null });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      holdProgress.setValue(0);
      load();
      return () => {
        stopPolling();
        stopCountdown();
      };
    }, [load, holdProgress]),
  );

  // ──────────────────────────────────────────────────────────────────────
  // Polling

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const resp = await api.getPanicActiveAlert(userId);
        if (!resp.alert) return;
        const { alert, sponsor } = resp;
        if (alert.status === 'responded') {
          stopPolling();
          stopCountdown();
          setState({ kind: 'responded', alert, sponsor });
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
      // `alertCreatedAt` viene del servidor y se compara con el reloj del teléfono.
      // Si el teléfono va atrasado, `elapsed` sale negativo y la cuenta arrancaba
      // sobre el tope: se vio "2:10" con 10 s de desfase. Se acota por ambos lados
      // para que la pantalla nunca prometa más espera de la que el backend respeta.
      const elapsed = Math.floor((Date.now() - alertCreatedAt.getTime()) / 1000);
      const remaining = Math.min(
        ESCALATION_SECONDS,
        Math.max(0, ESCALATION_SECONDS - elapsed),
      );
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

  // La pantalla de respuesta se borraba sola a los 30 s —podía desaparecer mientras
  // el paciente todavía la leía— y de paso marcaba como cancelada una alerta que sí
  // había sido respondida. Ahora la cierra el paciente cuando quiere.
  const handleCloseResponded = useCallback(async (alertId: string, sponsorForIdle: SponsorInfo | null) => {
    setState({ kind: 'idle', sponsor: sponsorForIdle });
    navigation.navigate('MainTabs', { screen: 'Home' });
    try {
      await api.cancelPanicAlert(userId, alertId);
    } catch {
      // Best effort: el backend la cierra igual cuando el paciente abre una nueva
    }
  }, [navigation]);

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
      // Una escritura puede procesarse en el servidor y aun así perderse la respuesta
      // de vuelta. En una pantalla de pánico eso es lo peor que puede pasar: el
      // padrino ya fue avisado y el paciente cree que no. Se reintenta antes de
      // rendirse; el backend reutiliza la alerta abierta, así que no duplica.
      const alert = await conReintento(() => api.createPanicAlert(userId));
      if (!alert) throw new Error('sin respuesta de la alerta');

      // CA1.2: sin padrino activo el backend devuelve la alerta ya escalada.
      // Al asistente de inmediato, sin cuenta regresiva ni espera.
      if (alert.status === 'escalated') {
        navigation.navigate('Assistant');
        return;
      }

      const resp = await api.getPanicActiveAlert(userId);
      setCountdown(ESCALATION_SECONDS);
      setState({ kind: 'waiting', alert, sponsor: resp.sponsor });
      startCountdown(new Date(alert.createdAt));
      startPolling();
    } catch (err) {
      const isNetworkError = (err as Error).message?.includes('Network request failed') ||
        (err as Error).message?.includes('Failed to fetch');
      if (isNetworkError) setState({ kind: 'offline', sponsor: await readSponsor(userId) });
    } finally {
      isActivating.current = false;
      holdProgress.setValue(0);
    }
  }, [holdProgress, navigation, startCountdown, startPolling]);

  // ──────────────────────────────────────────────────────────────────────
  // Acciones desde Estado 2

  const handleCancel = useCallback(async () => {
    if (state.kind !== 'waiting') return;
    // Parar todo antes del await para evitar race condition con el poll
    stopPolling();
    stopCountdown();
    setCountdown(ESCALATION_SECONDS);
    setState({ kind: 'idle', sponsor: state.sponsor });
    try {
      await api.cancelPanicAlert(userId, state.alert.id);
    } catch {
      // Best effort — el estado local ya volvió a idle
    }
  }, [state]);

  // Salir de la espera sin cancelar la alerta: el paciente necesita saber que sigue viva
  const handleLeaveWaiting = useCallback(() => {
    showDialog({
      title: 'Tu alerta sigue activa',
      message: 'Si vuelves al inicio, la alerta ya enviada sigue en pie y tu compañero de viaje puede responderla. Puedes volver a esta pantalla cuando quieras.',
      actions: [
        { label: 'Ir al inicio', onPress: () => navigation.navigate('MainTabs', { screen: 'Home' }) },
        { label: 'Seguir esperando', tone: 'cancel' },
      ],
    });
  }, [navigation]);

  const handleAlertCommunity = useCallback(async () => {
    if (state.kind !== 'waiting') return;
    try {
      const { communityNotified } = await api.notifyCommunity(userId, state.alert.id);
      // CA5.1: el backend responde 200 con `false` cuando no hay foro donde publicar
      // (paciente sin sede asignada). Marcarlo igual ocultaba la tarjeta y el botón
      // —ambos se pintan con este flag—, así que el paciente en crisis se quedaba sin
      // la opción y creyendo que su red ya sabía, cuando nadie había visto nada.
      if (!communityNotified) {
        showDialog({
          title: 'No pudimos avisar a tu comunidad',
          message: `Tu mensaje no llegó al foro. Puedes intentarlo otra vez, hablar ahora con el asistente o llamar al ${CRISIS_LINE}.`,
          actions: [{ label: 'Entendido' }],
        });
        return;
      }
      setState({ kind: 'waiting', alert: { ...state.alert, communityNotified: true }, sponsor: state.sponsor });
    } catch {
      // Silencioso — navegar igual
    }
    const draft = 'Hola 🚨 no me encuentro muy bien, ¿alguien podría ayudarme conversando?';
    navigation.navigate('MainTabs', {
      screen: 'Community',
      params: { initialTab: 'forum', draft },
    });
  }, [state, navigation]);

  const handleEscalateToAI = useCallback(async () => {
    if (state.kind !== 'waiting') return;
    const { id: alertId, } = state.alert;
    const sponsor = state.sponsor;
    try {
      await api.escalatePanicAlert(userId, alertId);
    } catch {
      // Si falla la escalada igual redirigimos al asistente
    }
    stopPolling();
    stopCountdown();
    void sponsor;
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
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={c.bg} />
        <View style={styles.center}>
          <Text style={styles.loadingText}>Cargando…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Estado 4: Sin conexión ─────────────────────────────────────────────
  if (state.kind === 'offline') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <StatusBar barStyle="light-content" backgroundColor={c.danger} />
        <Pressable style={styles.backBtn} onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })} hitSlop={10} accessibilityRole="button" accessibilityLabel="Volver al inicio">
          <Icon name="arrow-left" size={20} color={c.fg1} />
        </Pressable>
        <View style={styles.offlineBanner}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="triangle-alert" size={14} color={c.white} />
            <Text style={styles.offlineBannerText}>Sin conexión a internet</Text>
          </View>
        </View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>¿Necesitas ayuda ahora?</Text>
          <Text style={styles.subtitle}>Sin conexión, la alerta no puede salir. Llama directo:</Text>

          <View style={styles.disabledBtnWrap}>
            <View style={[styles.panicBtn, styles.panicBtnDisabled]}>
              <Icon name="hand" size={40} color={c.white} />
              <Text style={styles.panicBtnLabel}>PÁNICO</Text>
            </View>
            <Text style={styles.holdHintDisabled}>Necesitas conexión para activarlo</Text>
          </View>

          {/* Decía "No fue posible enviar el aviso" nada más abrir la pantalla,
              sin que el paciente hubiera intentado enviar nada */}
          <View style={styles.warnCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="triangle-alert" size={14} color={c.accent} />
              <Text style={styles.warnCardTitle}>El botón de pánico necesita conexión</Text>
            </View>
            <Text style={styles.warnCardBody}>
              Mientras tanto, llamar es la vía más rápida y no depende de internet.
            </Text>
          </View>

          {state.sponsor?.phone && (
            <Pressable
              style={styles.callRow}
              onPress={() => Linking.openURL(`tel:${state.sponsor?.phone ?? ''}`)}
              accessibilityLabel={`Llamar a ${state.sponsor.firstName}, tu compañero de viaje`}
            >
              <View style={styles.callIcon}><Icon name="phone" size={20} color={c.primaryText} /></View>
              <View style={styles.callMeta}>
                <Text style={styles.callLabel}>Llama directamente a {state.sponsor.firstName}</Text>
                <Text style={styles.callNumber}>{formatPhone(state.sponsor.phone)}</Text>
              </View>
              <Icon name="chevron-right" size={20} color={c.fg2} />
            </Pressable>
          )}

          <Pressable
            style={[styles.callRow, styles.callRowDanger]}
            onPress={() => Linking.openURL(`tel:${CRISIS_LINE}`)}
            accessibilityLabel="Llamar a la línea de prevención del suicidio *4141"
          >
            <View style={[styles.callIcon, styles.callIconDanger]}><Icon name="siren" size={20} color={c.dangerText} /></View>
            <View style={styles.callMeta}>
              <Text style={[styles.callLabel, { color: c.ink900 }]}>
                Línea de prevención del suicidio
              </Text>
              <Text style={[styles.callNumber, { color: c.dangerText, fontSize: 20 }]}>
                *4141
              </Text>
              <Text style={styles.callSubLabel}>Gratuita · 24 horas · Confidencial</Text>
            </View>
            <Icon name="chevron-right" size={20} color={c.dangerText} />
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Estado 3: Padrino respondió ────────────────────────────────────────
  if (state.kind === 'responded' || state.kind === 'escalated') {
    const sponsor = state.kind === 'responded' ? state.sponsor : null;
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: c.successSurface }]} edges={['top', 'bottom']}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={c.successSurface} />
        <Pressable
          style={styles.backBtn}
          onPress={() => handleCloseResponded(state.alert.id, sponsor)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Volver al inicio"
        >
          <Icon name="arrow-left" size={20} color={c.fg1} />
        </Pressable>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { justifyContent: 'space-between', flex: 1 }]}
        >
          <View style={styles.respondedTop}>
            <View style={styles.checkBadge}>
              <Icon name="circle-check" size={52} color={c.sage500} />
            </View>
            <Text style={styles.respondedTitle}>
              {state.kind === 'responded' && sponsor
                ? `${sponsor.firstName} respondió a tu alerta`
                : 'Asistente IA listo'}
            </Text>
            <Text style={styles.respondedSub}>
              {state.kind === 'responded'
                ? 'Ya sabe que necesitas apoyo'
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
                </View>
                <View style={styles.sponsorMeta}>
                  <Text style={styles.sponsorName}>{sponsor.firstName} {sponsor.lastName}</Text>
                  <Text style={styles.sponsorStatus}>Tu compañero de viaje</Text>
                </View>
                <Icon name="handshake" size={24} color={c.sage500} />
              </View>
            </View>
          )}

          <View style={styles.actions}>
            {state.kind === 'responded' && sponsor?.phone && (
              <Pressable
                style={[styles.btn, styles.btnPrimary]}
                onPress={() => Linking.openURL(`tel:${sponsor.phone}`)}
                accessibilityRole="button"
                accessibilityLabel={`Llamar a ${sponsor.firstName}`}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Icon name="phone" size={18} color={c.white} />
                  <Text style={styles.btnTextLight}>Llamar a {sponsor.firstName}</Text>
                </View>
              </Pressable>
            )}
            <Pressable style={[styles.btn, styles.btnOutlineTeal]} onPress={() => navigation.navigate('Assistant')}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name="sparkles" size={18} color={c.primaryText} />
                <Text style={styles.btnTextPrimary}>Hablar con el asistente</Text>
              </View>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnGhost]}
              onPress={() => handleCloseResponded(state.alert.id, sponsor)}
              accessibilityRole="button"
            >
              <Text style={styles.btnTextMuted}>Estoy mejor, volver al inicio</Text>
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
      <SafeAreaView style={[styles.safeArea, { backgroundColor: c.dangerSurface }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={c.dangerSurface} />
        {/* Sin salida explícita, el gesto atrás del sistema detenía la cuenta regresiva
            y el paciente perdía de vista la escalada sin saber si la alerta seguía viva */}
        <Pressable
          style={styles.backBtn}
          onPress={handleLeaveWaiting}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Volver al inicio"
        >
          <Icon name="arrow-left" size={20} color={c.fg1} />
        </Pressable>
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
            Alerta enviada a {sponsor?.firstName ?? 'tu compañero de viaje'}
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
                {/* "está siendo notificado" concuerda en masculino con cualquier nombre:
                    a Daniela le decía "notificado". El género del padrino no se conoce. */}
                <Text style={styles.sponsorName}>
                  {sponsor ? `Avisando a ${sponsor.firstName}` : 'Avisando a tu compañero de viaje…'}
                </Text>
                <Text style={styles.notifTime}>hace un momento</Text>
              </View>
              <Icon name="bell" size={18} color={c.accent} />
            </View>
          </View>

          {/* IA banner */}
          <View style={styles.iaBanner}>
            <Icon name="sparkles" size={20} color={c.accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.iaBannerTitle}>Asistente IA disponible</Text>
              <Text style={styles.iaBannerBody}>
                Tomará contacto automáticamente en{' '}
                <Text style={{ fontFamily: Fonts.bodyBold }}>{formatCountdown(countdown)}</Text>
                {' '}si nadie responde, o inicia el chat ahora mismo.
              </Text>
            </View>
          </View>

          {/* Comunidad */}
          {!alert.communityNotified && (
            <View style={styles.communityCard}>
              <Icon name="users" size={22} color={c.primaryText} />
              <View style={{ flex: 1 }}>
                <Text style={styles.communityTitle}>¿Avisar a la Comunidad?</Text>
                <Text style={styles.communityBody}>Tu red de apoyo también puede saber que necesitas ayuda.</Text>
              </View>
            </View>
          )}

          {!alert.communityNotified && (
            <Pressable style={[styles.btn, styles.btnOutlineTeal]} onPress={handleAlertCommunity}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name="users" size={18} color={c.primaryText} />
                <Text style={styles.btnTextPrimary}>Alertar a mi comunidad</Text>
              </View>
            </Pressable>
          )}

          <Pressable style={[styles.btn, styles.btnOutlineTeal]} onPress={handleEscalateToAI}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="sparkles" size={18} color={c.primaryText} />
              <Text style={styles.btnTextPrimary}>Hablar con el asistente ahora</Text>
            </View>
          </Pressable>

          <Pressable
            style={[styles.btn, styles.btnOutlineDanger, { marginBottom: 24 }]}
            onPress={handleCancel}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="x" size={18} color={c.dangerText} />
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
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={c.bg} />
      <Pressable style={styles.backBtn} onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })} hitSlop={10} accessibilityRole="button" accessibilityLabel="Volver al inicio">
        <Icon name="arrow-left" size={20} color={c.fg1} />
      </Pressable>
      <View style={styles.content}>
        {/* Pregunta */}
        <View style={styles.topSection}>
          <Text style={styles.title}>¿Necesitas ayuda ahora?</Text>
          <Text style={styles.subtitle}>Tu compañero de viaje recibirá una alerta inmediata</Text>
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
                accessibilityLabel="Botón de pánico"
                accessibilityHint="Avisa a tu compañero de viaje. Mantén presionado 2 segundos o, con TalkBack, toca dos veces."
                accessibilityRole="button"
                accessibilityActions={[{ name: 'activate', label: 'Enviar alerta de pánico' }]}
                onAccessibilityAction={(e) => {
                  if (e.nativeEvent.actionName === 'activate') handleActivate();
                }}
              >
                <Icon name="hand" size={40} color={c.white} />
                <Text style={styles.panicBtnLabel}>PÁNICO</Text>
              </Pressable>
            </Animated.View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
            <Icon name="clock" size={14} color={c.fg2} />
            <Text style={styles.holdHint}>Mantén presionado 2 segundos para activar</Text>
          </View>
        </View>

        {/* Sponsor card */}
        <View style={[styles.card, styles.sponsorCard]}>
          <Text style={styles.sponsorCardLabel}>Tu compañero de viaje asignado</Text>
          <View style={styles.avatarRow}>
            {sponsor ? (
              <>
                <View style={styles.avatar}>
                  <Text style={styles.avatarLetter}>{sponsor.firstName.charAt(0)}</Text>
                </View>
                <View style={styles.sponsorMeta}>
                  {/* "● Disponible" y el punto verde eran texto fijo: nadie sabe si el
                      padrino está disponible, y prometerlo en una crisis es peor que callar */}
                  <Text style={styles.sponsorName}>{sponsor.firstName} {sponsor.lastName}</Text>
                  <Text style={styles.sponsorStatus}>Recibirá tu alerta al instante</Text>
                </View>
                {sponsor.phone && (
                  <Pressable
                    style={styles.callSmallBtn}
                    onPress={() => Linking.openURL(`tel:${sponsor.phone}`)}
                    accessibilityLabel={`Llamar a ${sponsor.firstName}`}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Icon name="phone" size={14} color={c.primaryText} />
                      <Text style={styles.callSmallBtnText}>Llamar</Text>
                    </View>
                  </Pressable>
                )}
              </>
            ) : (
              <Text style={styles.noSponsorText}>Sin compañero de viaje asignado — contacta a tu psicólogo</Text>
            )}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Estilos

const makeStyles = (c: Palette) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: c.bg,
  },
  backBtn: {
    alignSelf: 'flex-start',
    marginLeft: 16,
    marginTop: 10,
    marginBottom: 6,
    padding: 8,
    borderRadius: 20,
    backgroundColor: c.surface,
    shadowColor: c.shadowSoft,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
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
    fontFamily: Fonts.body,
    color: c.fg2,
    fontSize: 16,
  },

  // ── Offline ──
  offlineBanner: {
    backgroundColor: c.danger,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  offlineBannerText: {
    fontFamily: Fonts.bodyBold,
    color: c.white,
    fontSize: 14,
  },
  warnCard: {
    backgroundColor: c.infoSurface,
    borderLeftWidth: 4,
    borderLeftColor: c.accent,
    borderRadius: 16,
    padding: 14,
  },
  warnCardTitle: {
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    color: c.ink900,
  },
  warnCardBody: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: c.fg2,
    marginTop: 4,
    lineHeight: 20,
  },

  // ── Llamadas ──
  callRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: c.successSurface,
    borderRadius: 16,
    padding: 14,
  },
  callRowDanger: {
    backgroundColor: c.dangerSurface,
    borderWidth: 1.5,
    borderColor: 'rgba(184,50,50,0.18)',
  },
  callIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callIconDanger: {
    backgroundColor: c.white,
  },
  callMeta: { flex: 1 },
  callLabel: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: c.fg2,
  },
  callNumber: {
    fontFamily: Fonts.headingBold,
    fontSize: 16,
    color: c.primaryText,
  },
  callSubLabel: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: c.fg2,
    marginTop: 2,
  },

  // ── Textos generales ──
  title: {
    fontFamily: Fonts.headingBold,
    fontSize: 24,
    color: c.ink900,
    textAlign: 'center',
    lineHeight: 30,
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: c.fg2,
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
    borderColor: c.danger,
    opacity: 0.6,
  },
  panicBtn: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: c.danger,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: c.danger,
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
    backgroundColor: c.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  panicBtnLabel: {
    fontFamily: Fonts.bodyBold,
    color: c.white,
    fontSize: 14,
    letterSpacing: 2,
  },
  holdHint: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: c.fg2,
    textAlign: 'center',
  },
  holdHintDisabled: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: c.border,
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
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: c.shadowMedium,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  sponsorCard: {
    marginBottom: 8,
  },
  sponsorCardLabel: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: c.fg2,
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
    backgroundColor: c.teal400,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarLetter: {
    fontFamily: Fonts.bodyBold,
    color: c.white,
    fontSize: 18,
  },
  btnGhost: { backgroundColor: 'transparent' },
  btnTextMuted: { fontFamily: Fonts.bodyBold, fontSize: 15, color: c.fg2 },
  sponsorMeta: { flex: 1 },
  sponsorName: {
    fontFamily: Fonts.headingBold,
    fontSize: 16,
    color: c.ink900,
  },
  sponsorStatus: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: c.fg2,
    marginTop: 2,
  },
  noSponsorText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: c.fg2,
    flex: 1,
  },
  callSmallBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: c.primary,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  callSmallBtnText: {
    fontFamily: Fonts.bodyBold,
    color: c.primaryText,
    fontSize: 13,
  },
  notifTime: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: c.fg2,
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
    backgroundColor: c.danger,
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
    shadowColor: c.shadowSoft,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  timerNum: {
    fontFamily: Fonts.bodyBold,
    fontSize: 48,
    color: c.dangerText,
    lineHeight: 52,
    fontVariant: ['tabular-nums'],
  },
  timerNumUrgent: {
    color: c.dangerText,
  },
  timerCap: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    color: c.fg2,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  },
  waitTitle: {
    fontFamily: Fonts.headingBold,
    fontSize: 18,
    color: c.ink900,
    textAlign: 'center',
  },
  waitSub: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: c.fg2,
    textAlign: 'center',
  },
  waitingDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  waitDots: {
    fontFamily: Fonts.body,
    color: c.fg2,
    fontSize: 14,
  },

  // ── IA banner ──
  iaBanner: {
    backgroundColor: c.amber50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.infoBorder,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  iaBannerTitle: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13.5,
    color: c.primaryText,
  },
  iaBannerBody: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: c.ink900,
    lineHeight: 20,
    marginTop: 2,
  },

  // ── Comunidad banner ──
  communityCard: {
    backgroundColor: c.successSurface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.infoBorder,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  communityTitle: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13.5,
    color: c.primaryText,
  },
  communityBody: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: c.ink900,
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
    backgroundColor: c.successSurface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 5,
    borderColor: c.sage500,
  },
  respondedTitle: {
    fontFamily: Fonts.headingBold,
    fontSize: 24,
    color: c.ink900,
    textAlign: 'center',
    lineHeight: 30,
  },
  respondedSub: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: c.fg2,
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
    backgroundColor: c.primary,
  },
  btnOutlineTeal: {
    backgroundColor: 'transparent',
    borderColor: c.primary,
  },
  btnOutlineDanger: {
    backgroundColor: 'transparent',
    borderColor: c.danger,
  },
  btnTextLight: {
    fontFamily: Fonts.bodyBold,
    color: c.white,
    fontSize: 16,
  },
  btnTextPrimary: {
    fontFamily: Fonts.bodyBold,
    color: c.primaryText,
    fontSize: 16,
  },
  btnTextDanger: {
    fontFamily: Fonts.bodyBold,
    color: c.dangerText,
    fontSize: 16,
  },
});
