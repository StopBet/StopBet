import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { MaterialTopTabScreenProps } from '@react-navigation/material-top-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CommunityPost, EmotionType, Notification, PatientProgress } from '@stopbet/shared-types';
import type { AppStackParamList, MainTabsParamList } from '../navigation/types';
import { DayCounter } from '../components/DayCounter';
import { EmotionCheckin } from '../components/EmotionCheckin';
import { QuickAccess } from '../components/QuickAccess';
import { NotificationSection } from '../components/NotificationSection';
import { Icon } from '../components/Icon';
import type { Palette } from '../constants/colors';
import { useColors, useStyles } from '../context/ThemeContext';
import { Fonts } from '../constants/typography';
import { api, hasPendingExternalRelapse, acknowledgePendingRelapse } from '../services/api';
import {
  flushPending,
  isNetworkError,
  onReconnect,
  savePending,
} from '../services/checkInQueue';
import { registrarParaNotificaciones } from '../services/pushNotifications';
import {
  readProgress,
  readReminderChoice,
  saveProgress,
  saveReminderChoice,
} from '../services/offlineStore';
import { conReintento } from '../services/reintentoEscritura';
import { useToast } from '../context/ToastContext';
import { Touchable } from '../components/Touchable';

// Ajustar cuando se conecte la autenticación real
const TEMP_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEMP_FIRST_NAME = 'Carlos';
const TEMP_SEDE = 'Santiago';
const REFRESH_MS = 3 * 60 * 1000;

// Vive en el navegador de pestañas, pero también navega al stack de arriba
// (asistente, pánico), así que necesita los dos juegos de props.
type Props = CompositeScreenProps<
  MaterialTopTabScreenProps<MainTabsParamList, 'Home'>,
  NativeStackScreenProps<AppStackParamList>
>;

function formatEventDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function HomeScreen({ navigation }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const { showToast } = useToast();
  const [progress, setProgress] = useState<PatientProgress | null>(null);
  const [todayEmotion, setTodayEmotion] = useState<EmotionType | null>(null);
  const [checkInDone, setCheckInDone] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  // Un error que no era de red dejaba «Cargando tu progreso…» para siempre
  const [loadFailed, setLoadFailed] = useState(false);
  // CA7.4: se pide el permiso recién cuando el paciente sabe para qué es
  const [askReminder, setAskReminder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  // Los accesos rápidos repetían la barra de abajo. En su lugar va lo del día que el
  // paciente no tiene en ninguna otra parte de Inicio: la próxima sesión de su sede.
  const [nextEvent, setNextEvent] = useState<CommunityPost | null>(null);

  const load = useCallback(async () => {
    setLoadFailed(false);
    try {
      // Verifica suspensión antes de cargar el resto
      const billing = await api.getBillingStatus(TEMP_USER_ID);
      if (billing.accountStatus === 'suspended') {
        navigation.replace('SuspendedAccount');
        return;
      }

      const [achData, checkIn, notifs, anns] = await Promise.all([
        api.getAchievements(TEMP_USER_ID),
        api.getTodayCheckIn(TEMP_USER_ID),
        api.getNotifications(TEMP_USER_ID),
        api.getAnnouncements(TEMP_USER_ID, TEMP_SEDE),
      ]);

      // Solo eventos que todavía no ocurren; si no hay ninguno, no se muestra nada
      const ahora = Date.now();
      const proximo = anns
        .filter((a) => a.eventDate && new Date(a.eventDate).getTime() > ahora)
        .sort((a, b) => new Date(a.eventDate!).getTime() - new Date(b.eventDate!).getTime())[0];
      setNextEvent(proximo ?? null);

      const days = achData.currentPeriod.daysAchieved;
      const HOME_MILESTONES = [30, 60, 90, 180, 365];
      const nextMilestone = HOME_MILESTONES.find(m => m > days) ?? 365;
      setProgress({
        userId: TEMP_USER_ID,
        daysStreak: days,
        nextMilestone,
        lastCheckIn: checkIn,
      });
      setOffline(false);
      void saveProgress(days, nextMilestone);

      if (checkIn) {
        setTodayEmotion(checkIn.emotion);
        setCheckInDone(true);
      }
      // Antes solo se asignaba si venía algo, así que con la lista vacía quedaban
      // 4 notificaciones de demo hardcodeadas — una de ellas afirmaba que la
      // psicóloga había revisado el check-in del paciente. Datos clínicos falsos.
      setNotifications(notifs);

      if (hasPendingExternalRelapse()) {
        acknowledgePendingRelapse();
        Alert.alert(
          'Recaída registrada por tu psicólogo',
          'Tu psicólogo ha registrado una recaída en tu historial. El contador ha sido reiniciado. Tu equipo AJUTER está aquí para apoyarte.',
          [
            { text: 'Ver mis logros', onPress: () => navigation.navigate('Achievements') },
            { text: 'Cerrar', style: 'cancel' },
          ],
        );
      }
    } catch (err) {
      // Quedarse sin red es un estado esperado —hay un simulador en Perfil— y no
      // un fallo. Con console.error React Native levanta el LogBox encima de la
      // pantalla; los errores de verdad sí lo siguen levantando.
      // Solo loguea el error sin exponer datos del paciente.
      if (isNetworkError(err)) {
        console.log('[HomeScreen] sin conexión al cargar');
        // Se recupera el último progreso conocido: mostrar 0 días le diría al
        // paciente que perdió su racha cuando solo se cayó la red.
        setOffline(true);
        const cached = await readProgress();
        if (cached) {
          setProgress(prev => prev ?? {
            userId: TEMP_USER_ID,
            daysStreak: cached.daysStreak,
            nextMilestone: cached.nextMilestone,
            lastCheckIn: null,
          });
        }
      } else {
        setLoadFailed(true);
        console.error('[HomeScreen] load error', (err as Error).message);
      }
    } finally {
      setLoading(false);
    }
  }, [navigation]);

  // Antes recargaba cada 5 s mientras la pantalla estuviera abierta: con 4 llamadas
  // por vuelta son 2.880 peticiones por hora de pantalla, en batería y datos del
  // paciente. Nada de acá cambia por segundo; lo urgente llega por push.
  useFocusEffect(
    useCallback(() => {
      load();
      const interval = setInterval(load, REFRESH_MS);
      return () => clearInterval(interval);
    }, [load]),
  );

  // CA7.4: el recordatorio de las 20:00 llega como push. Antes se pedía el permiso
  // del sistema apenas cargaba esta pantalla, sin explicar para qué: se pregunta
  // primero en la app y solo después aparece el diálogo de Android.
  useEffect(() => {
    let detener = () => {};
    let vigente = true;
    readReminderChoice().then((choice) => {
      if (!vigente) return;
      if (choice === null) {
        setAskReminder(true);
        return;
      }
      if (choice === 'accepted') {
        registrarParaNotificaciones(TEMP_USER_ID).then((r) => {
          detener = r.detener;
        });
      }
    });
    return () => {
      vigente = false;
      detener();
    };
  }, []);

  const handleActivarRecordatorio = async () => {
    setAskReminder(false);
    await saveReminderChoice('accepted');
    const { activado } = await registrarParaNotificaciones(TEMP_USER_ID);
    if (!activado) {
      Alert.alert(
        'Sin permiso para avisarte',
        'Android no nos dejó enviarte el recordatorio. Puedes darlo desde los ajustes del teléfono cuando quieras.',
        [
          { text: 'Ahora no', style: 'cancel' },
          { text: 'Abrir ajustes', onPress: () => Linking.openSettings() },
        ],
      );
    }
  };

  const handleRechazarRecordatorio = async () => {
    setAskReminder(false);
    await saveReminderChoice('dismissed');
  };

  // CA7.3: al recuperar la conexión se vacía la cola sola. También se intenta al
  // montar, por si la app se cerró y se reabrió sin red.
  useEffect(() => {
    const trySend = () => {
      flushPending()
        .then((sent) => {
          if (!sent) return;
          setTodayEmotion(sent);
          setCheckInDone(true);
        })
        .catch(() => {});
    };
    trySend();
    return onReconnect(trySend);
  }, []);

  const handlePickEmotion = async (emotion: EmotionType) => {
    try {
      // La respuesta de una escritura puede perderse aunque el servidor la haya
      // procesado. Se reintenta antes de darla por fallida: encolar un check-in
      // que en realidad ya está guardado solo produce un aviso falso de "sin
      // conexión" y un 409 más tarde.
      await conReintento(() => api.createCheckIn(TEMP_USER_ID, emotion));
      setTodayEmotion(emotion);
      setCheckInDone(true);
    } catch (err) {
      if (!isNetworkError(err)) {
        showToast('No pudimos guardar tu check-in. Inténtalo de nuevo.', 'error');
        return;
      }
      // CA7.3: sin conexión el ánimo no se descarta — queda en cola y se
      // reintenta solo al volver la red.
      await savePending(TEMP_USER_ID, emotion);
      setTodayEmotion(emotion);
      setCheckInDone(true);
      showToast('Sin conexión: guardamos tu check-in y lo enviaremos cuando vuelvas a tener internet.');
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await api.markNotificationRead(TEMP_USER_ID, id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
    } catch {
      // Fallo silencioso: el leído es cosmético
    }
  };

  const handlePanicPress = () => {
    navigation.navigate('Panic');
  };

  const unreadNotifs = notifications.filter((n) => !n.read);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={c.primary} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <View style={styles.greetingRow}>
            <Text style={styles.greeting}>Hola, {TEMP_FIRST_NAME}</Text>
            <Icon name="hand" size={20} color={c.white} />
          </View>
          <Text style={styles.subtitle}>
            Día {progress?.daysStreak ?? '…'} de tu camino
          </Text>
        </View>
        {/* Tenía tamaño, borde y posición de botón de perfil, y no hacía nada */}
        <Pressable
          style={styles.avatar}
          onPress={() => navigation.navigate('Profile')}
          accessibilityRole="button"
          accessibilityLabel="Mi perfil"
        >
          <Text style={styles.avatarLetter}>
            {TEMP_FIRST_NAME.charAt(0).toUpperCase()}
          </Text>
        </Pressable>
      </View>

      {/* Contenido principal */}
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
          {unreadNotifs.length > 0 && (
            <NotificationSection
              notifications={unreadNotifs}
              onMarkRead={handleMarkRead}
            />
          )}

          {askReminder && (
            <View style={styles.reminderCard}>
              <View style={styles.reminderHead}>
                <Icon name="bell" size={18} color={c.primaryText} />
                <Text style={styles.reminderTitle} accessibilityRole="header">
                  Recordatorio de las 20:00
                </Text>
              </View>
              <Text style={styles.reminderBody}>
                Podemos avisarte cada noche para que registres cómo estuvo tu día. Es un
                aviso al día y lo puedes desactivar cuando quieras.
              </Text>
              <View style={styles.reminderActions}>
                <Pressable
                  style={styles.reminderPrimary}
                  onPress={handleActivarRecordatorio}
                  accessibilityRole="button"
                >
                  <Text style={styles.reminderPrimaryText}>Activar recordatorio</Text>
                </Pressable>
                <Pressable
                  style={styles.reminderGhost}
                  onPress={handleRechazarRecordatorio}
                  accessibilityRole="button"
                >
                  <Text style={styles.reminderGhostText}>Ahora no</Text>
                </Pressable>
              </View>
            </View>
          )}

          {offline && (
            <View style={styles.offlineBanner}>
              <Icon name="triangle-alert" size={16} color={c.fg2} />
              <Text style={styles.offlineText}>
                {progress
                  ? 'Sin conexión — te mostramos tus últimos datos guardados.'
                  : 'Sin conexión — no pudimos cargar tu progreso.'}
              </Text>
            </View>
          )}

          {/* Sin dato no se dibuja el contador: un 0 se leería como racha perdida */}
          {progress ? (
            <DayCounter days={progress.daysStreak} milestone={progress.nextMilestone} />
          ) : (
            <View style={styles.counterPlaceholder}>
              <Text style={styles.counterPlaceholderText}>
                {offline
                  ? 'Tu progreso aparecerá al recuperar la conexión'
                  : loadFailed
                  ? 'No pudimos cargar tu progreso. Tus días no se perdieron.'
                  : 'Cargando tu progreso…'}
              </Text>
              {loadFailed && !offline && (
                <Pressable style={styles.retryBtn} onPress={load} accessibilityRole="button">
                  <Text style={styles.retryText}>Reintentar</Text>
                </Pressable>
              )}
            </View>
          )}

          <EmotionCheckin
            done={checkInDone}
            selected={todayEmotion}
            onPick={handlePickEmotion}
          />

          <QuickAccess onPressAssistant={() => navigation.navigate('Assistant')} />

          {nextEvent && (
            <Touchable
              style={styles.eventCard}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('Community', { initialTab: 'announcements' })}
              accessibilityRole="button"
              accessibilityLabel={`Próxima sesión de tu sede: ${formatEventDate(nextEvent.eventDate!)}. Ver en Anuncios`}
            >
              <View style={styles.eventIcon}>
                <Icon name="calendar" size={20} color={c.primaryText} />
              </View>
              <View style={styles.eventText}>
                <Text style={styles.eventLabel}>Próxima sesión de tu sede</Text>
                <Text style={styles.eventWhen}>{formatEventDate(nextEvent.eventDate!)}</Text>
              </View>
              <Icon name="chevron-right" size={20} color={c.fg2} />
            </Touchable>
          )}
        </ScrollView>
      )}

    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: c.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 18,
    paddingTop: 16,
    backgroundColor: c.primary,
    gap: 14,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  greeting: {
    fontFamily: Fonts.headingBold,
    fontSize: 22,
    color: c.white,
    lineHeight: 28,
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: c.onPrimaryMuted,
    marginTop: 2,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: c.overlayWhite16,
    borderWidth: 1.5,
    borderColor: c.overlayWhite35,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontFamily: Fonts.headingBold,
    fontSize: 20,
    color: c.white,
  },
  loader: {
    flex: 1,
    backgroundColor: c.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
    backgroundColor: c.bg,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 24,
    gap: 24,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  offlineText: {
    fontFamily: Fonts.body,
    flex: 1,
    fontSize: 13,
    color: c.fg2,
  },
  counterPlaceholder: {
    marginHorizontal: 20,
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
  },
  counterPlaceholderText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: c.fg2,
    textAlign: 'center',
  },
  reminderCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    marginHorizontal: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: c.border,
  },
  reminderHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reminderTitle: { fontFamily: Fonts.headingBold, fontSize: 15, color: c.ink900 },
  reminderBody: { fontFamily: Fonts.body, fontSize: 13, color: c.fg1, lineHeight: 19 },
  reminderActions: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  reminderPrimary: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: 9999,
    backgroundColor: c.primary,
  },
  reminderPrimaryText: { fontFamily: Fonts.bodyBold, fontSize: 14, color: c.white },
  reminderGhost: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 14 },
  reminderGhostText: { fontFamily: Fonts.bodyBold, fontSize: 14, color: c.fg2 },
  retryBtn: {
    marginTop: 14,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: c.primary,
  },
  retryText: { fontFamily: Fonts.bodyBold, fontSize: 14, color: c.primaryText },

  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  eventIcon: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: c.infoSurface,
    alignItems: 'center', justifyContent: 'center',
  },
  eventText: { flex: 1 },
  eventLabel: { fontFamily: Fonts.body, fontSize: 12.5, color: c.fg2 },
  eventWhen: { fontFamily: Fonts.bodyBold, fontSize: 14.5, color: c.ink900, marginTop: 2 },

});
