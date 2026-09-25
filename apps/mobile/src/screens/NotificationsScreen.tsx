import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Notification, NotificationTarget } from '@stopbet/shared-types';
import { Icon } from '../components/Icon';
import { Touchable } from '../components/Touchable';
import { NotificationCard } from '../components/NotificationCard';
import type { AppStackParamList } from '../navigation/types';
import type { Palette } from '../constants/colors';
import { useColors, useStyles } from '../context/ThemeContext';
import { Fonts } from '../constants/typography';
import { useUserId } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { isNetworkError } from '../services/checkInQueue';
import { logInfo } from '../utils/log';

type Props = CompositeScreenProps<
  NativeStackScreenProps<AppStackParamList, 'Notifications'>,
  NativeStackScreenProps<AppStackParamList>
>;

/**
 * Todas las notificaciones del paciente, en su propia pantalla.
 *
 * Vivían dentro del Inicio y ahí no tenían techo: con seis avisos, la racha y el check-in
 * quedaban debajo del pliegue. Sacarlas exigía darles un lugar real adonde ir - eso es lo
 * que faltaba cuando se quitó el carrusel de la pantalla de inicio (INI-05).
 */
export function NotificationsScreen({ navigation }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const userId = useUserId();
  const { showToast } = useToast();

  const [notificaciones, setNotificaciones] = useState<Notification[] | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const [sinConexión, setSinConexión] = useState(false);

  const cargar = useCallback(async (esRefresco = false) => {
    if (!userId) return;
    if (esRefresco) setRefrescando(true);
    try {
      setNotificaciones(await api.getNotifications(userId));
      setSinConexión(false);
    } catch (err) {
      setSinConexión(true);
      setNotificaciones((prev) => prev ?? []);
      if (isNetworkError(err)) logInfo('[Notificaciones] sin conexión al cargar');
    } finally {
      setRefrescando(false);
    }
  }, [userId]);

  useEffect(() => { void cargar(); }, [cargar]);

  const sinLeer = (notificaciones ?? []).filter((n) => !n.read).length;

  /**
   * Marcar leída va optimista: la petición puede tardar y quedarse mirando un aviso que no
   * se apaga hace dudar de si el toque funcionó. Si falla, vuelve a su estado.
   */
  const abrir = useCallback((n: Notification) => {
    if (!n.read && userId) {
      setNotificaciones((prev) =>
        (prev ?? []).map((x) => (x.id === n.id ? { ...x, read: true } : x)),
      );
      api.markNotificationRead(userId, n.id).catch(() => {
        setNotificaciones((prev) =>
          (prev ?? []).map((x) => (x.id === n.id ? { ...x, read: false } : x)),
        );
      });
    }
    irAlDestino(n.target ?? null);
  }, [navigation, userId]);

  // Las notificaciones viejas no tienen destino guardado: esas solo se marcan leídas.
  const irAlDestino = (target: NotificationTarget | null) => {
    switch (target) {
      case 'check-in':
        navigation.navigate('MainTabs', { screen: 'Home' });
        break;
      case 'community':
        navigation.navigate('MainTabs', { screen: 'Community', params: { initialTab: 'forum' } });
        break;
      case 'achievements':
        navigation.navigate('MainTabs', { screen: 'Achievements' });
        break;
      case 'panic':
        navigation.navigate('Panic');
        break;
      case 'payment':
        navigation.navigate('MainTabs', { screen: 'Profile' });
        break;
      default:
        break;
    }
  };

  const marcarTodas = async () => {
    if (!userId || sinLeer === 0) return;
    const previas = notificaciones ?? [];
    setNotificaciones(previas.map((n) => ({ ...n, read: true })));
    try {
      await api.markAllNotificationsRead(userId);
    } catch {
      setNotificaciones(previas);
      showToast('No pudimos marcarlas como leídas. Inténtalo de nuevo.', 'error');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={c.primary} />

      <View style={styles.header}>
        <Touchable
          style={styles.volver}
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <Icon name="arrow-left" size={22} color={c.white} />
        </Touchable>
        <View style={styles.flex}>
          <Text style={styles.titulo} accessibilityRole="header">Notificaciones</Text>
          <Text style={styles.subtitulo}>
            {sinLeer > 0 ? `${sinLeer} sin leer` : 'Estás al día'}
          </Text>
        </View>
        {sinLeer > 0 ? (
          <Touchable
            style={styles.marcarTodas}
            onPress={marcarTodas}
            accessibilityRole="button"
            accessibilityLabel="Marcar todas como leídas"
          >
            <Text style={styles.marcarTodasTexto}>Marcar todas</Text>
          </Touchable>
        ) : null}
      </View>

      {notificaciones === null ? (
        <View style={styles.centro}>
          <ActivityIndicator size="large" color={c.primaryText} />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.contenido}
          data={notificaciones}
          keyExtractor={(n) => n.id}
          renderItem={({ item }) => (
            <NotificationCard notification={item} onPress={() => abrir(item)} />
          )}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={9}
          removeClippedSubviews
          refreshControl={
            <RefreshControl
              refreshing={refrescando}
              onRefresh={() => cargar(true)}
              colors={[c.primary]}
              tintColor={c.primary}
            />
          }
          ListHeaderComponent={
            sinConexión ? (
              <Text style={styles.aviso}>
                Sin conexión. Puede que falte algo de lo más reciente.
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.vacío}>
              <Icon name="bell" size={28} color={c.fg2} />
              <Text style={styles.vacíoTitulo}>No tienes notificaciones</Text>
              <Text style={styles.vacíoTexto}>
                Acá van a llegar los avisos de tu sede, tu comunidad y tu progreso.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  flex: { flex: 1 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    backgroundColor: c.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 14,
  },
  volver: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontFamily: Fonts.headingBold, fontSize: 22, color: c.white, letterSpacing: -0.3 },
  subtitulo: { fontFamily: Fonts.body, fontSize: 13, color: c.onPrimaryMuted },
  marcarTodas: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  marcarTodasTexto: { fontFamily: Fonts.bodyBold, fontSize: 13, color: c.white },

  contenido: { padding: 16, gap: 10, paddingBottom: 24 },
  aviso: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: c.fg2,
    lineHeight: 19,
    marginBottom: 4,
  },

  vacío: { alignItems: 'center', gap: 8, paddingVertical: 56, paddingHorizontal: 24 },
  vacíoTitulo: { fontFamily: Fonts.headingBold, fontSize: 17, color: c.fg1 },
  vacíoTexto: { fontFamily: Fonts.body, fontSize: 13, color: c.fg2, textAlign: 'center', lineHeight: 20 },
});
