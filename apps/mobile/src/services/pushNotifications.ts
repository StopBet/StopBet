import { PermissionsAndroid, Platform } from 'react-native';
import { getApp } from '@react-native-firebase/app';
import {
  getMessaging,
  getToken,
  onTokenRefresh,
  requestPermission,
  AuthorizationStatus,
} from '@react-native-firebase/messaging';
import { api } from './api';

// CA7.4: el recordatorio de las 20:00 llega como push, sin abrir la app. Para eso
// el backend necesita el token del dispositivo, que FCM entrega acá y rota por su
// cuenta cada cierto tiempo.

async function pedirPermiso(): Promise<boolean> {
  // Android 13+ exige permiso en tiempo de ejecución. En versiones anteriores se
  // concede al instalar, y PermissionsAndroid no conoce la constante.
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    const resultado = await PermissionsAndroid.request(
      'android.permission.POST_NOTIFICATIONS' as never,
    );
    if (resultado !== PermissionsAndroid.RESULTS.GRANTED) return false;
  }

  const estado = await requestPermission(getMessaging(getApp()));
  return (
    estado === AuthorizationStatus.AUTHORIZED ||
    estado === AuthorizationStatus.PROVISIONAL
  );
}

/**
 * Registra el dispositivo para recibir el recordatorio diario.
 * Devuelve una función para dejar de escuchar la rotación del token.
 *
 * Nunca lanza: quedarse sin push es molesto, pero no puede impedir que el
 * paciente use la app — y menos el botón de pánico.
 */
export async function registrarParaNotificaciones(
  userId: string,
): Promise<() => void> {
  const sinEfecto = () => {};
  try {
    if (!(await pedirPermiso())) return sinEfecto;

    const messaging = getMessaging(getApp());
    const token = await getToken(messaging);
    if (token) await api.registrarTokenPush(userId, token);

    // FCM rota el token solo (reinstalación, limpieza de datos, restauración).
    // Sin esto el dispositivo deja de recibir avisos en silencio.
    return onTokenRefresh(messaging, (nuevo) => {
      api.registrarTokenPush(userId, nuevo).catch(() => {});
    });
  } catch {
    return sinEfecto;
  }
}
