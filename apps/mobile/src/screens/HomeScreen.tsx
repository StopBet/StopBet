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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { EmotionType, Notification, PatientProgress } from '@stopbet/shared-types';
import type { AppStackParamList } from '../navigation/types';
import { DayCounter } from '../components/DayCounter';
import { EmotionCheckin } from '../components/EmotionCheckin';
import { QuickAccess } from '../components/QuickAccess';
import { BottomNav, NavTab } from '../components/BottomNav';
import { NotificationSection } from '../components/NotificationSection';
import { Colors } from '../constants/colors';
import { api } from '../services/api';

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
  const [activeTab, setActiveTab] = useState<NavTab>('home');

  const load = useCallback(async () => {
    try {
      // Verifica suspensión antes de cargar el resto
      const billing = await api.getBillingStatus(TEMP_USER_ID);
      if (billing.accountStatus === 'suspended') {
        navigation.replace('SuspendedAccount');
        return;
      }

      const [prog, checkIn, notifs] = await Promise.all([
        api.getProgress(TEMP_USER_ID),
        api.getTodayCheckIn(TEMP_USER_ID),
        api.getNotifications(TEMP_USER_ID),
      ]);
      setProgress(prog);
      if (checkIn) {
        setTodayEmotion(checkIn.emotion);
        setCheckInDone(true);
      }
      setNotifications(notifs);
    } catch (err) {
      // Solo loguea el error sin exponer datos del paciente
      console.error('[HomeScreen] load error', (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [navigation]);

  useEffect(() => { load(); }, [load]);

  const handlePickEmotion = async (emotion: EmotionType) => {
    try {
      await api.createCheckIn(TEMP_USER_ID, emotion);
      setTodayEmotion(emotion);
      setCheckInDone(true);
    } catch {
      Alert.alert('Error', 'No se pudo guardar el check-in. Inténtalo de nuevo.');
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
          <Text style={styles.greeting}>Hola, {TEMP_FIRST_NAME} 👋</Text>
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

          <DayCounter
            days={progress?.daysStreak ?? 0}
            milestone={progress?.nextMilestone ?? 60}
          />

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
    paddingBottom: 120,
    gap: 24,
  },
});
