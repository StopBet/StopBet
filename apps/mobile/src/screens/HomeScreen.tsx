import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { EmotionType, Notification, PatientProgress } from '@stopbet/shared-types';
import type { AppStackParamList } from '../navigation/types';
import { DayCounter } from '../components/DayCounter';
import { EmotionCheckin } from '../components/EmotionCheckin';
import { QuickAccess } from '../components/QuickAccess';
import { BottomNav, NavTab } from '../components/BottomNav';
import { NotificationSection } from '../components/NotificationSection';
import { Icon } from '../components/Icon';
import { Colors } from '../constants/colors';
import { api, hasPendingExternalRelapse, acknowledgePendingRelapse } from '../services/api';
import {
  flushPending,
  isNetworkError,
  onReconnect,
  savePending,
} from '../services/checkInQueue';
import { registrarParaNotificaciones } from '../services/pushNotifications';
import { readProgress, saveProgress } from '../services/progressCache';

// Ajustar cuando se conecte la autenticación real
const TEMP_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEMP_FIRST_NAME = 'Carlos';

type Props = NativeStackScreenProps<AppStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const [progress, setProgress] = useState<PatientProgress | null>(null);
  const [todayEmotion, setTodayEmotion] = useState<EmotionType | null>(null);
  const [checkInDone, setCheckInDone] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [activeTab, setActiveTab] = useState<NavTab>('home');

  const load = useCallback(async () => {
    try {
      // Verifica suspensión antes de cargar el resto
      const billing = await api.getBillingStatus(TEMP_USER_ID);
      if (billing.accountStatus === 'suspended') {
        navigation.replace('SuspendedAccount');
        return;
      }

      const [achData, checkIn, notifs] = await Promise.all([
        api.getAchievements(TEMP_USER_ID),
        api.getTodayCheckIn(TEMP_USER_ID),
        api.getNotifications(TEMP_USER_ID),
      ]);

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
        console.error('[HomeScreen] load error', (err as Error).message);
      }
    } finally {
      setLoading(false);
    }
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      load();
      const interval = setInterval(load, 5_000);
      return () => clearInterval(interval);
    }, [load]),
  );

  // CA7.4: registrar el dispositivo para el recordatorio de las 20:00. Se hace acá
  // y no al abrir la app porque en Home el paciente ya está identificado.
  useEffect(() => {
    let dejarDeEscuchar = () => {};
    registrarParaNotificaciones(TEMP_USER_ID).then((f) => {
      dejarDeEscuchar = f;
    });
    return () => dejarDeEscuchar();
  }, []);

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
      await api.createCheckIn(TEMP_USER_ID, emotion);
      setTodayEmotion(emotion);
      setCheckInDone(true);
    } catch (err) {
      if (!isNetworkError(err)) {
        Alert.alert('Error', 'No se pudo guardar el check-in. Inténtalo de nuevo.');
        return;
      }
      // CA7.3: sin conexión el ánimo no se descarta — queda en cola y se
      // reintenta solo al volver la red.
      await savePending(TEMP_USER_ID, emotion);
      setTodayEmotion(emotion);
      setCheckInDone(true);
      Alert.alert(
        'Sin conexión',
        'Guardamos tu check-in en el teléfono y lo enviaremos solo cuando vuelvas a tener internet.',
      );
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

  const handleTabPress = (tab: NavTab) => {
    setActiveTab(tab);
    if (tab !== 'home') {
      navigation.navigate(
        tab === 'community'
          ? 'Community'
          : tab === 'achievements'
          ? 'Achievements'
          : 'Profile',
      );
    }
  };

  const handlePanicPress = () => {
    navigation.navigate('Panic');
  };

  const unreadNotifs = notifications.filter((n) => !n.read);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <View style={styles.greetingRow}>
            <Text style={styles.greeting}>Hola, {TEMP_FIRST_NAME}</Text>
            <Icon name="hand" size={20} color={Colors.white} />
          </View>
          <Text style={styles.subtitle}>
            Día {progress?.daysStreak ?? '…'} de tu camino
          </Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarLetter}>
            {TEMP_FIRST_NAME.charAt(0).toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Contenido principal */}
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
          {unreadNotifs.length > 0 && (
            <NotificationSection
              notifications={unreadNotifs}
              onViewAll={() => {}}
              onMarkRead={handleMarkRead}
            />
          )}

          {offline && (
            <View style={styles.offlineBanner}>
              <Icon name="triangle-alert" size={16} color={Colors.fg2} />
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
                {offline ? 'Tu progreso aparecerá al recuperar la conexión' : 'Cargando tu progreso…'}
              </Text>
            </View>
          )}

          <EmotionCheckin
            done={checkInDone}
            selected={todayEmotion}
            onPick={handlePickEmotion}
          />

          <QuickAccess
            onPressAssistant={() => navigation.navigate('Assistant')}
            onPressCommunity={() => navigation.navigate('Community')}
            onPressAchievements={() => navigation.navigate('Achievements')}
          />
        </ScrollView>
      )}

      <BottomNav
        active={activeTab}
        onTabPress={handleTabPress}
        onPanicPress={handlePanicPress}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 18,
    paddingTop: 2,
    backgroundColor: Colors.primary,
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
    fontWeight: '700',
    fontSize: 22,
    color: Colors.white,
    lineHeight: 28,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.teal400,
    marginTop: 2,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.overlayWhite16,
    borderWidth: 1.5,
    borderColor: Colors.overlayWhite35,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontWeight: '700',
    fontSize: 20,
    color: Colors.white,
  },
  loader: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
    backgroundColor: Colors.bg,
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
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  offlineText: {
    flex: 1,
    fontSize: 13,
    color: Colors.fg2,
  },
  counterPlaceholder: {
    marginHorizontal: 20,
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  counterPlaceholderText: {
    fontSize: 14,
    color: Colors.fg2,
    textAlign: 'center',
  },
});
