import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Palette } from '../constants/colors';
import { Fonts } from '../constants/typography';
import { useColors, useStyles } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { activateBlocking, blocking, useBlockingStatus } from '../hooks/useBlocking';
import { Icon } from './Icon';
import { Touchable } from './Touchable';

/**
 * Estado del bloqueo de apuestas en Perfil. **Sin interruptor para apagarlo** a propósito: se
 * apaga desde Ajustes de Android, fuera de la app, para que desactivarlo sea una decisión y no un
 * toque en un momento de impulso. Acá solo se ve el estado y el camino hacia esos ajustes.
 */
export function BlockingProfileSection() {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const { showToast } = useToast();
  const { status, refresh } = useBlockingStatus();
  const [busy, setBusy] = useState(false);

  if (!blocking || !status) return null;
  const module = blocking;

  const activar = async () => {
    setBusy(true);
    const result = await activateBlocking();
    setBusy(false);
    if (result === 'on') showToast('Protección activada');
    else if (result === 'denied') showToast('Para activarla, acepta la solicitud de conexión', 'error');
    else showToast('No se pudo activar la protección', 'error');
    refresh();
  };

  const abrirAjustes = () => {
    module.openVpnSettings().catch(() => showToast('No se pudieron abrir los ajustes', 'error'));
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        Protección contra apuestas
      </Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.icon}>
            <Icon
              name={status.active ? 'shield-check' : 'shield'}
              size={22}
              color={status.active ? c.greenText : c.fg2}
            />
          </View>
          <View style={styles.text}>
            <Text style={styles.label}>{status.active ? 'Activa' : 'Apagada'}</Text>
            <Text style={styles.sub}>
              {status.active
                ? 'Los sitios de apuestas están bloqueados en todo el teléfono.'
                : 'Los sitios de apuestas no se están bloqueando.'}
            </Text>
          </View>
        </View>

        {status.active ? (
          <>
            <Text style={styles.hint}>
              Se desactiva desde los ajustes de VPN de tu teléfono. Si lo haces, podrás volver a
              activarla desde Inicio.
            </Text>
            <Touchable style={styles.secondaryBtn} onPress={abrirAjustes} accessibilityRole="button">
              <Icon name="settings" size={16} color={c.primaryText} />
              <Text style={styles.secondaryText}>Abrir ajustes de VPN</Text>
            </Touchable>
          </>
        ) : (
          <Touchable
            rippleColor="rgba(255,255,255,0.28)"
            style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
            onPress={activar}
            disabled={busy}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>Activar protección</Text>
          </Touchable>
        )}
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    section: { gap: 8 },
    sectionTitle: { fontFamily: Fonts.bodyBold, fontSize: 13, color: c.fg2, marginLeft: 4 },
    card: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 18,
      gap: 12,
      shadowColor: c.shadowSoft,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 6,
      elevation: 2,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    icon: { width: 28, alignItems: 'center' },
    text: { flex: 1 },
    label: { fontFamily: Fonts.bodyBold, fontSize: 15, color: c.ink900 },
    sub: { fontFamily: Fonts.body, fontSize: 13, color: c.fg2, marginTop: 2 },
    hint: { fontFamily: Fonts.body, fontSize: 12, color: c.fg2, lineHeight: 17 },
    primaryBtn: {
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 9999,
      backgroundColor: c.primary,
    },
    primaryText: { fontFamily: Fonts.bodyBold, fontSize: 14, color: c.white },
    secondaryBtn: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 9999,
      borderWidth: 1,
      borderColor: c.border,
    },
    secondaryText: { fontFamily: Fonts.bodyBold, fontSize: 14, color: c.primaryText },
  });
