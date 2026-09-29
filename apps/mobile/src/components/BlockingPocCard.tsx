import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import NativeBlocking, { type Spec } from '../specs/NativeBlocking';
import type { Palette } from '../constants/colors';
import { Fonts } from '../constants/typography';
import { useColors, useStyles } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { Icon } from './Icon';

type Status = Awaited<ReturnType<Spec['getStatus']>>;

/**
 * PoC del SPIKE 2 (CA2): enciende y apaga el `VpnService` que filtra DNS. Vive dentro de las
 * herramientas de prueba de Perfil, así que no existe en el APK de pacientes.
 *
 * Se consulta el estado cada segundo en vez de escuchar un evento: lo que se quiere mostrar en
 * el video es justamente que la app se entera cuando el bloqueo se apaga desde Ajustes, con la
 * app en segundo plano, y el sondeo lo refleja apenas se vuelve a ella.
 */
export function BlockingPocCard() {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const { showToast } = useToast();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!NativeBlocking) return;
    setStatus(await NativeBlocking.getStatus());
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 1000);
    return () => clearInterval(id);
  }, [refresh]);

  if (!NativeBlocking) {
    return (
      <Text style={styles.sub}>
        Bloqueo no disponible: recompila el nativo con pnpm run android:device.
      </Text>
    );
  }
  const blocking = NativeBlocking;

  const toggle = async (on: boolean) => {
    setBusy(true);
    try {
      if (on) {
        const granted = await blocking.requestPermission();
        if (!granted) {
          showToast('Sin el permiso de VPN no se puede bloquear', 'error');
          return;
        }
        await blocking.start();
      } else {
        await blocking.stop();
      }
    } catch {
      showToast('No se pudo cambiar el bloqueo', 'error');
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const revokedAt = status?.lastRevokedAt
    ? new Date(status.lastRevokedAt).toLocaleTimeString('es-CL')
    : null;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.text}>
          <Text style={styles.label}>Bloqueo de apuestas (Spike 2)</Text>
          <Text style={styles.sub}>
            {status?.active ? 'Activo' : 'Inactivo'} · {status?.domainCount ?? 0} dominios ·{' '}
            {status?.blockedCount ?? 0} consultas bloqueadas
          </Text>
        </View>
        <Switch
          value={!!status?.active}
          disabled={busy}
          accessibilityLabel="Bloqueo de apuestas"
          onValueChange={toggle}
          trackColor={{ false: c.border, true: c.primary }}
          thumbColor={c.white}
        />
      </View>

      {!!status?.recentBlocked.length && (
        <Text style={styles.sub}>Últimos bloqueados: {status.recentBlocked.join(', ')}</Text>
      )}
      {!!status?.privateDnsServer && (
        <View style={styles.badge}>
          <Icon name="triangle-alert" size={12} color={c.dangerText} />
          <Text style={styles.badgeText}>
            DNS privado activo ({status.privateDnsServer}): las consultas no pasan por el filtro
          </Text>
        </View>
      )}
      {revokedAt && (
        <View style={styles.badge}>
          <Icon name="triangle-alert" size={12} color={c.dangerText} />
          <Text style={styles.badgeText}>Desactivado desde el sistema a las {revokedAt}</Text>
        </View>
      )}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    wrap: { gap: 8 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    text: { flex: 1 },
    label: { fontFamily: Fonts.bodyBold, fontSize: 15, color: c.ink900 },
    sub: { fontFamily: Fonts.body, fontSize: 12, color: c.fg2, marginTop: 2, lineHeight: 17 },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: c.dangerSurface,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    badgeText: { fontFamily: Fonts.bodyBold, fontSize: 12, color: c.dangerText },
  });
