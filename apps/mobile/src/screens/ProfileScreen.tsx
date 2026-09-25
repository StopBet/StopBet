import React, { useContext, useEffect, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { MaterialTopTabScreenProps } from '@react-navigation/material-top-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList, MainTabsParamList } from '../navigation/types';
import { Icon, type IconName } from '../components/Icon';
import type { Palette } from '../constants/colors';
import { useColors, useStyles, useTheme } from '../context/ThemeContext';
import { Fonts } from '../constants/typography';
import { devFlags } from '../store/devFlags';
import { api } from '../services/api';
import { registrarParaNotificaciones } from '../services/pushNotifications';
import { useToast } from '../context/ToastContext';
import {
  readReminderChoice,
  saveReminderChoice,
  type ThemePreference,
} from '../services/offlineStore';
import { AuthContext, useCurrentUser, useUserId } from '../context/AuthContext';
import { Touchable } from '../components/Touchable';
import { useDialog } from '../context/DialogContext';


// Vive en el navegador de pestañas, pero también navega al stack de arriba
// (asistente, pánico), así que necesita los dos juegos de props.
type Props = CompositeScreenProps<
  MaterialTopTabScreenProps<MainTabsParamList, 'Profile'>,
  NativeStackScreenProps<AppStackParamList>
>;

export function ProfileScreen({ navigation }: Props) {
  const { showDialog } = useDialog();
  const userId = useUserId();
  const c = useColors();
  const styles = useStyles(makeStyles);
  const { showToast } = useToast();
  const { preference, setPreference } = useTheme();
  const user = useCurrentUser();
  const { signOut } = useContext(AuthContext);
  const [offline, setOffline] = useState(devFlags.simulateOffline);
  const [communityMuted, setCommunityMuted] = useState(false);
  const [muteLoading, setMuteLoading] = useState(false);
  // Quien rechazó el recordatorio de las 20:00 no tenía forma de volver a activarlo
  const [reminderOn, setReminderOn] = useState(false);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [daysInput, setDaysInput] = useState(
    devFlags.overrideDays !== null ? String(devFlags.overrideDays) : '',
  );
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'ok' | 'error'>('idle');
  const [checkInResetStatus, setCheckInResetStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [panicResetStatus, setPanicResetStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');

  const toggleOffline = (v: boolean) => {
    devFlags.setSimulateOffline(v);
    setOffline(v);
  };

  useEffect(() => {
    api.getCommunityMute(userId)
      .then(({ muted }) => setCommunityMuted(muted))
      .catch(() => {});
    readReminderChoice().then((choice) => setReminderOn(choice === 'accepted'));
  }, []);

  const toggleReminder = async (v: boolean) => {
    setReminderLoading(true);
    try {
      if (!v) {
        await saveReminderChoice('dismissed');
        setReminderOn(false);
        return;
      }
      const { activado } = await registrarParaNotificaciones(userId);
      await saveReminderChoice(activado ? 'accepted' : 'dismissed');
      setReminderOn(activado);
      if (!activado) {
        showDialog({
          title: 'Sin permiso para avisarte',
          message: 'Android no nos dejó enviarte el recordatorio. Puedes darlo desde los ajustes del teléfono.',
          actions: [
            { label: 'Abrir ajustes', onPress: () => Linking.openSettings() },
            { label: 'Ahora no', tone: 'cancel' },
          ],
        });
      }
    } finally {
      setReminderLoading(false);
    }
  };

  const toggleCommunityMute = async (v: boolean) => {
    setMuteLoading(true);
    try {
      const { muted } = v
        ? await api.muteCommunity(userId)
        : await api.unmuteCommunity(userId);
      setCommunityMuted(muted);
    } catch {
      showToast('Sin conexión: no pudimos guardar tu preferencia.', 'error');
    } finally {
      setMuteLoading(false);
    }
  };

  const applyDays = async () => {
    const n = parseInt(daysInput, 10);
    if (!Number.isFinite(n) || n < 0) return;
    devFlags.setOverrideDays(n);
    setSyncStatus('syncing');
    try {
      await api.devSetDays('11111111-1111-1111-1111-111111111111', n);
      setSyncStatus('ok');
    } catch {
      setSyncStatus('error');
    }
  };

  const clearDays = () => {
    setDaysInput('');
    devFlags.setOverrideDays(null);
  };

  const resetPanicAlert = async () => {
    setPanicResetStatus('loading');
    try {
      const res = await api.cancelActivePanicAlert('11111111-1111-1111-1111-111111111111');
      if (res.cancelled) {
        setPanicResetStatus('ok');
        setTimeout(() => setPanicResetStatus('idle'), 2500);
      } else {
        setPanicResetStatus('idle');
        showToast('No había ninguna alerta de pánico activa.');
      }
    } catch {
      setPanicResetStatus('error');
      setTimeout(() => setPanicResetStatus('idle'), 2500);
    }
  };

  const resetCheckIn = async () => {
    setCheckInResetStatus('loading');
    try {
      const res = await api.resetTodayCheckIn('11111111-1111-1111-1111-111111111111');
      if (res.deleted) {
        setCheckInResetStatus('ok');
        setTimeout(() => setCheckInResetStatus('idle'), 2500);
      } else {
        setCheckInResetStatus('idle');
        showToast('No había check-in registrado hoy.');
      }
    } catch {
      setCheckInResetStatus('error');
      setTimeout(() => setCheckInResetStatus('idle'), 2500);
    }
  };

  const confirmSignOut = () => {
    showDialog({
      title: 'Cerrar sesión',
      message: '¿Seguro que quieres salir de tu cuenta?',
      actions: [
        { label: 'Cerrar sesión', tone: 'danger', onPress: signOut },
        { label: 'Cancelar', tone: 'cancel' },
      ],
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={c.primary} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mi Perfil</Text>
        <Text style={styles.headerSub}>Tu cuenta en StopBet</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* El nombre y la inicial estaban escritos a mano: Perfil decía "Carlos" con
            cualquier cuenta. Y "Paciente AJUTER" ponía al cliente donde va el dato del
            paciente: su sede. */}
        <View style={styles.avatarCard}>
          <View style={styles.avatarCircle} importantForAccessibility="no-hide-descendants">
            <Text style={styles.avatarLetter}>
              {(user?.firstName ?? '?').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.avatarText}>
            <Text style={styles.userName}>
              {[user?.firstName, user?.lastName].filter(Boolean).join(' ')}
            </Text>
            <Text style={styles.userSub}>
              {user?.sedeId ? `Paciente · Sede ${user.sedeId}` : 'Paciente'}
            </Text>
          </View>
        </View>

        {/* Antes el tema solo seguía al teléfono. Alguien puede tener el teléfono en
            claro y querer la app oscura para el check-in de la noche, así que se elige
            acá; "Automático" sigue siendo lo de siempre. */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">Apariencia</Text>
          <View style={styles.menuCard}>
            <View style={styles.themeRow} accessibilityRole="radiogroup">
              {THEME_OPTIONS.map((opt) => {
                const selected = preference === opt.id;
                return (
                  <Touchable
                    key={opt.id}
                    style={[styles.themeOption, selected && styles.themeOptionOn]}
                    onPress={() => setPreference(opt.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={opt.label}
                    accessibilityHint={opt.hint}
                  >
                    <Icon
                      name={opt.icon}
                      size={20}
                      color={selected ? c.primaryText : c.fg2}
                    />
                    <Text style={[styles.themeLabel, selected && styles.themeLabelOn]}>
                      {opt.label}
                    </Text>
                  </Touchable>
                );
              })}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">Notificaciones</Text>
          <View style={styles.menuCard}>
            {/* Toda la fila es el interruptor: el Switch solo mide 46×27 dp */}
            <Pressable
              style={[styles.menuRow, styles.menuRowBorder, { paddingVertical: 14 }]}
              onPress={() => toggleReminder(!reminderOn)}
              disabled={reminderLoading}
              accessibilityRole="switch"
              accessibilityLabel="Recordatorio diario de las 20:00"
              accessibilityHint="Te avisamos cada noche para registrar cómo estuvo tu día"
              accessibilityState={{ checked: reminderOn, disabled: reminderLoading }}
            >
              <View style={styles.menuIcon}>
                <Icon name="clock" size={22} color={c.primaryText} />
              </View>
              <View style={styles.menuText}>
                <Text style={styles.menuLabel}>Recordatorio diario de las 20:00</Text>
                <Text style={styles.menuSub}>
                  Un aviso cada noche para registrar cómo estuvo tu día
                </Text>
              </View>
              <Switch
                value={reminderOn}
                onValueChange={toggleReminder}
                disabled={reminderLoading}
                importantForAccessibility="no"
                trackColor={{ false: c.border, true: c.primary }}
                thumbColor={c.white}
              />
            </Pressable>

            <Pressable
              style={[styles.menuRow, { paddingVertical: 14 }]}
              onPress={() => toggleCommunityMute(!communityMuted)}
              disabled={muteLoading}
              accessibilityRole="switch"
              accessibilityLabel="Silenciar notificaciones de comunidad"
              accessibilityHint="No te avisaremos cuando alguien reaccione o responda tus publicaciones"
              accessibilityState={{ checked: communityMuted, disabled: muteLoading }}
            >
              <View style={styles.menuIcon}>
                <Icon name="bell" size={22} color={c.primaryText} />
              </View>
              <View style={styles.menuText}>
                <Text style={styles.menuLabel}>Silenciar notificaciones de comunidad</Text>
                <Text style={styles.menuSub}>
                  No te avisaremos cuando alguien reaccione o responda tus publicaciones
                </Text>
              </View>
              <Switch
                value={communityMuted}
                onValueChange={toggleCommunityMute}
                disabled={muteLoading}
                importantForAccessibility="no"
                trackColor={{ false: c.border, true: c.primary }}
                thumbColor={c.white}
              />
            </Pressable>
          </View>
        </View>

        {/* Sin destino todavía: se muestran como lo que viene, no como botones */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">Próximamente</Text>
          <View style={styles.menuCard}>
            {UPCOMING_ITEMS.map((item, i) => (
              <View
                key={item.label}
                style={[styles.menuRow, i < UPCOMING_ITEMS.length - 1 && styles.menuRowBorder]}
                accessible
              >
                <View style={styles.menuIcon}>
                  <Icon name={item.icon} size={22} color={c.fg2} />
                </View>
                <View style={styles.menuText}>
                  <Text style={styles.menuLabelMuted}>{item.label}</Text>
                  <Text style={styles.menuSub}>{item.sub}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Herramientas de prueba: solo en builds de desarrollo, nunca en el APK de pacientes */}
        {__DEV__ && (
          <View style={styles.devCard}>
            <View style={styles.devHeader}>
              <Icon name="flask-conical" size={14} color={c.fg2} />
              <Text style={styles.devTitle}>Herramientas de prueba</Text>
            </View>
            <View style={styles.devRow}>
              <View style={styles.devText}>
                <Text style={styles.devLabel}>Simular sin conexión</Text>
                <Text style={styles.devSub}>
                  Fuerza error de red en todas las llamadas a la API
                </Text>
              </View>
              <Switch
                value={offline}
                accessibilityLabel="Simular sin conexión"
                onValueChange={toggleOffline}
                trackColor={{ false: c.border, true: c.danger }}
                thumbColor={c.white}
              />
            </View>
            {offline && (
              <View style={styles.devBadge}>
                <Icon name="triangle-alert" size={12} color={c.dangerText} />
                <Text style={styles.devBadgeText}>Modo sin conexión activo</Text>
              </View>
            )}

            <View style={styles.devDivider} />

            <View style={styles.devRow}>
              <View style={styles.devText}>
                <Text style={styles.devLabel}>Días sin apostar</Text>
                <Text style={styles.devSub}>Sobreescribe el contador para la demo</Text>
              </View>
              <View style={styles.devDaysRow}>
                <TextInput
                  style={styles.devDaysInput}
                  value={daysInput}
                  onChangeText={setDaysInput}
                  keyboardType="number-pad"
                  placeholder="-"
                  placeholderTextColor={c.fg2}
                  maxLength={4}
                  returnKeyType="done"
                  onSubmitEditing={applyDays}
                />
                <Touchable
      rippleColor="rgba(255,255,255,0.28)" style={styles.devApplyBtn} onPress={applyDays}>
                  <Text style={styles.devApplyText}>OK</Text>
                </Touchable>
                {devFlags.overrideDays !== null && (
                  <Touchable style={styles.devClearBtn} onPress={clearDays}>
                    <Icon name="x" size={14} color={c.fg2} />
                  </Touchable>
                )}
              </View>
            </View>
            {devFlags.overrideDays !== null && (
              <View style={[styles.devBadge, { backgroundColor: c.successSurface }]}>
                <Icon name="check" size={12} color={c.greenText} />
                <Text style={[styles.devBadgeText, { color: c.greenText }]}>
                  Mostrando {devFlags.overrideDays} días
                  {syncStatus === 'syncing' ? ' · sincronizando…' : ''}
                  {syncStatus === 'ok' ? ' · sincronizado ✓' : ''}
                </Text>
              </View>
            )}
            {syncStatus === 'error' && (
              <View style={[styles.devBadge, { backgroundColor: c.dangerSurface }]}>
                <Icon name="triangle-alert" size={12} color={c.dangerText} />
                <Text style={[styles.devBadgeText, { color: c.dangerText }]}>
                  Error al sincronizar con el servidor
                </Text>
              </View>
            )}

            <View style={styles.devDivider} />

            <View style={styles.devRow}>
              <View style={styles.devText}>
                <Text style={styles.devLabel}>Check-in emocional</Text>
                <Text style={styles.devSub}>Reinicia el check-in de hoy para volver a registrarlo</Text>
              </View>
              <Touchable
      rippleColor="rgba(255,255,255,0.28)"
                style={[styles.devApplyBtn, checkInResetStatus === 'loading' && { opacity: 0.5 }]}
                onPress={resetCheckIn}
                disabled={checkInResetStatus === 'loading'}
              >
                <Text style={styles.devApplyText}>
                  {checkInResetStatus === 'loading' ? '…' : 'Reset'}
                </Text>
              </Touchable>
            </View>
            {checkInResetStatus === 'ok' && (
              <View style={[styles.devBadge, { backgroundColor: c.successSurface }]}>
                <Icon name="check" size={12} color={c.greenText} />
                <Text style={[styles.devBadgeText, { color: c.greenText }]}>
                  Check-in borrado. Ya puedes registrarlo de nuevo
                </Text>
              </View>
            )}
            {checkInResetStatus === 'error' && (
              <View style={[styles.devBadge, { backgroundColor: c.dangerSurface }]}>
                <Icon name="triangle-alert" size={12} color={c.dangerText} />
                <Text style={[styles.devBadgeText, { color: c.dangerText }]}>
                  Error al borrar el check-in
                </Text>
              </View>
            )}

            <View style={styles.devDivider} />

            <View style={styles.devRow}>
              <View style={styles.devText}>
                <Text style={styles.devLabel}>Alerta de pánico</Text>
                <Text style={styles.devSub}>Cancela la alerta activa para volver al botón idle</Text>
              </View>
              <Touchable
      rippleColor="rgba(255,255,255,0.28)"
                style={[styles.devApplyBtn, panicResetStatus === 'loading' && { opacity: 0.5 }]}
                onPress={resetPanicAlert}
                disabled={panicResetStatus === 'loading'}
              >
                <Text style={styles.devApplyText}>
                  {panicResetStatus === 'loading' ? '…' : 'Reset'}
                </Text>
              </Touchable>
            </View>
            {panicResetStatus === 'ok' && (
              <View style={[styles.devBadge, { backgroundColor: c.successSurface }]}>
                <Icon name="check" size={12} color={c.greenText} />
                <Text style={[styles.devBadgeText, { color: c.greenText }]}>
                  Alerta cancelada. El botón de pánico vuelve al estado normal
                </Text>
              </View>
            )}
            {panicResetStatus === 'error' && (
              <View style={[styles.devBadge, { backgroundColor: c.dangerSurface }]}>
                <Icon name="triangle-alert" size={12} color={c.dangerText} />
                <Text style={[styles.devBadgeText, { color: c.dangerText }]}>
                  Error al cancelar la alerta
                </Text>
              </View>
            )}
          </View>
        )}

        <Touchable
          style={styles.signOutBtn}
          onPress={confirmSignOut}
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión"
        >
          <Icon name="log-out" size={18} color={c.fg1} />
          <Text style={styles.signOutText}>Cerrar sesión</Text>
        </Touchable>
      </ScrollView>

    </SafeAreaView>
  );
}

const THEME_OPTIONS: { id: ThemePreference; icon: IconName; label: string; hint: string }[] = [
  { id: 'system', icon: 'smartphone', label: 'Automático', hint: 'Sigue el ajuste de tu teléfono' },
  { id: 'light',  icon: 'sunrise',    label: 'Claro',      hint: 'La app siempre en claro' },
  { id: 'dark',   icon: 'moon',       label: 'Oscuro',     hint: 'La app siempre en oscuro' },
];

const UPCOMING_ITEMS: { icon: IconName; label: string; sub: string }[] = [
  { icon: 'user',     label: 'Datos personales', sub: 'Nombre, RUT y contacto' },
  { icon: 'hospital', label: 'Mi sede',         sub: 'Tu centro de tratamiento' },
  { icon: 'lock',     label: 'Privacidad',       sub: 'Tus datos y permisos' },
  // Va acá y no como algo usable a propósito: la pasarela la define el cliente y
  // todavía no hay reunión, y falta decidir si paga el propio paciente o el
  // familiar que asignó. Anunciarlo sin poder cobrar sería otra promesa vacía.
  { icon: 'credit-card', label: 'Portal de pago', sub: 'Pagar tu plan desde la app, tú o tu familiar' },
];

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.primary },

  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 18,
    backgroundColor: c.primary,
  },
  headerTitle: { fontFamily: Fonts.headingBold, fontSize: 20, color: c.white },
  headerSub: { fontFamily: Fonts.body, fontSize: 14, color: c.onPrimaryMuted, marginTop: 3 },

  scroll: { flex: 1, backgroundColor: c.bg },
  scrollContent: { padding: 16, paddingBottom: 24, gap: 16 },

  avatarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: c.shadowSoft,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { fontFamily: Fonts.headingBold, fontSize: 22, color: c.white },
  avatarText: { flex: 1 },
  userName: { fontFamily: Fonts.headingBold, fontSize: 18, color: c.ink900 },
  userSub: { fontFamily: Fonts.body, fontSize: 14, color: c.fg2, marginTop: 2 },

  section: { gap: 8 },
  sectionTitle: { fontFamily: Fonts.bodyBold, fontSize: 13, color: c.fg2, marginLeft: 4 },

  menuCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: c.shadowSoft,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  menuRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  menuIcon: { width: 28, alignItems: 'center' },
  menuText: { flex: 1 },
  menuLabel: { fontFamily: Fonts.bodyBold, fontSize: 15, color: c.ink900 },
  menuLabelMuted: { fontFamily: Fonts.bodyBold, fontSize: 15, color: c.fg1 },
  menuSub: { fontFamily: Fonts.body, fontSize: 13, color: c.fg2, marginTop: 2 },

  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: c.surface,
    borderRadius: 12,
    borderWidth: 1,
    // neutro: el rojo del manual es solo para pánico y alertas críticas
    borderColor: c.border,
    padding: 16,
  },
  signOutText: { fontFamily: Fonts.bodyBold, fontSize: 15, color: c.fg1 },

  devCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: c.border,
    gap: 12,
  },
  devHeader: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  devTitle: { fontFamily: Fonts.bodyBold, fontSize: 12, color: c.fg2, textTransform: 'uppercase', letterSpacing: 0.5 },
  devRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  devText: { flex: 1 },
  devLabel: { fontFamily: Fonts.bodyBold, fontSize: 15, color: c.ink900 },
  devSub: { fontFamily: Fonts.body, fontSize: 12, color: c.fg2, marginTop: 2, lineHeight: 17 },
  devBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.dangerSurface,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  devBadgeText: { fontFamily: Fonts.bodyBold, fontSize: 12, color: c.dangerText },
  devDivider: { height: 1, backgroundColor: c.border },
  devDaysRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  devDaysInput: {
    fontFamily: Fonts.bodyBold,
    width: 64,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 16,
    color: c.ink900,
    textAlign: 'center',
    backgroundColor: c.bg,
  },
  devApplyBtn: {
    backgroundColor: c.primary,
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  devApplyText: { fontFamily: Fonts.bodyBold, color: c.white, fontSize: 13 },
  devClearBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: c.bg,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeRow: { flexDirection: 'row', padding: 8, gap: 8 },
  themeOption: {
    flex: 1,
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: c.border,
  },
  themeOptionOn: { borderColor: c.primaryText, backgroundColor: c.infoSurface },
  themeLabel: { fontFamily: Fonts.body, fontSize: 13, color: c.fg2 },
  themeLabelOn: { fontFamily: Fonts.bodyBold, color: c.primaryText },

});
