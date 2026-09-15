import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Linking,
  Animated,
  Easing,
  Modal,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BillingStatus, Invoice } from '@stopbet/shared-types';
import type { AppStackParamList } from '../navigation/types';
import { Icon } from '../components/Icon';
import type { Palette } from '../constants/colors';
import { useTheme, useColors, useStyles } from '../context/ThemeContext';
import { Fonts } from '../constants/typography';
import { api } from '../services/api';
import { isNetworkError } from '../services/checkInQueue';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { Touchable } from '../components/Touchable';
import { useCurrentUser, useUserId } from '../context/AuthContext';


const MONTH_LABELS: Record<string, string> = {
  '01': 'Enero',  '02': 'Febrero',   '03': 'Marzo',
  '04': 'Abril',  '05': 'Mayo',      '06': 'Junio',
  '07': 'Julio',  '08': 'Agosto',    '09': 'Septiembre',
  '10': 'Octubre','11': 'Noviembre', '12': 'Diciembre',
};

function formatMonth(yyyyMM: string): string {
  const [year, month] = yyyyMM.split('-');
  return `${MONTH_LABELS[month] ?? month} ${year}`;
}

function formatDate(yyyyMMdd: string): string {
  const [y, m, d] = yyyyMMdd.split('-');
  return `${d}/${m}/${y}`;
}

function formatCLP(amount: number): string {
  return `$${amount.toLocaleString('es-CL')}`;
}

type ScreenState = 'suspended' | 'reactivated';

type Props = NativeStackScreenProps<AppStackParamList, 'SuspendedAccount'>;

export function SuspendedAccountScreen({ navigation }: Props) {
  const userId = useUserId();
  const user = useCurrentUser();
  const sede = user?.sedeId ?? '';
  const { isDark } = useTheme();
  const c = useColors();
  const styles = useStyles(makeStyles);
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [screenState, setScreenState] = useState<ScreenState>('suspended');
  const [familySheetOpen, setFamilySheetOpen] = useState(false);
  const [familyLink, setFamilyLink] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  // Sin datos no se inventan cifras: la pantalla dice que está cargando o que falló.
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [payError, setPayError] = useState<string | null>(null);
  const [confirmPayOpen, setConfirmPayOpen] = useState(false);
  const [familyLinkError, setFamilyLinkError] = useState(false);

  const reduceMotion = useReduceMotion();

  // Animación del halo en Estado 2
  const haloAnim = useRef(new Animated.Value(0)).current;
  const haloLoop = useRef<Animated.CompositeAnimation | null>(null);

  const load = useCallback(async () => {
    setLoadState('loading');
    try {
      const status = await api.getBillingStatus(userId);
      setBillingStatus(status);
      setLoadState('ready');
    } catch (err) {
      setLoadState('error');
      // Sin red es un estado esperado, no un fallo: con console.error React
      // Native levanta el LogBox encima de la pantalla.
      if (isNetworkError(err)) {
        console.log('[SuspendedAccountScreen] sin conexión al cargar');
      } else {
        console.error('[SuspendedAccountScreen] load error', (err as Error).message);
      }
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    // El halo latía en bucle indefinidamente en la pantalla de cuenta reactivada
    if (screenState === 'reactivated' && !reduceMotion) {
      haloAnim.setValue(0);
      haloLoop.current = Animated.loop(
        Animated.timing(haloAnim, {
          toValue: 1,
          duration: 2400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      );
      haloLoop.current.start();
    }
    return () => haloLoop.current?.stop();
  }, [screenState, haloAnim, reduceMotion]);

  const haloScale = haloAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] });
  const haloOpacity = haloAnim.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0.22, 0.03, 0],
  });

  const handlePay = async () => {
    setConfirmPayOpen(false);
    setPaying(true);
    setPayError(null);
    try {
      const updated = await api.payOverdue(userId);
      setBillingStatus(updated);
      setScreenState('reactivated');
    } catch (err) {
      // Antes el botón volvía a su estado sin decir nada y el paciente no sabía si había pagado
      setPayError(
        isNetworkError(err)
          ? 'No hay conexión. No se registró ningún pago; inténtalo de nuevo.'
          : 'No pudimos registrar el pago. No se cobró nada; inténtalo de nuevo.',
      );
    } finally {
      setPaying(false);
    }
  };

  const handleOpenFamilySheet = async () => {
    if (!familyLink) {
      try {
        const { url } = await api.getFamilyLink(userId);
        setFamilyLink(url);
        setFamilyLinkError(false);
      } catch {
        // Antes ponía 'stopbet.cl/pago/...' y el familiar recibía un enlace roto
        setFamilyLinkError(true);
      }
    }
    setFamilySheetOpen(true);
  };

  const handleShareFamilyLink = async () => {
    if (!familyLink) return;
    try {
      await Share.share({
        message: `Hola, necesito que me ayudes a reactivar mi cuenta en StopBet. Puedes pagar aquí: https://${familyLink}`,
      });
    } catch {
      // El usuario canceló el share
    }
  };

  const handleGoHome = () => {
    navigation.replace('MainTabs', { screen: 'Home' });
  };

  const handlePanic = () => {
    navigation.navigate('Panic');
  };

  if (screenState === 'reactivated') {
    return (
      <SafeAreaView style={styles.safeReactivated} edges={['top', 'bottom']}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={c.successSurface} />
        <View style={styles.reactivatedContent}>
          {/* Halo + check badge */}
          <View style={styles.checkWrap}>
            <Animated.View
              style={[
                styles.checkHalo,
                { transform: [{ scale: haloScale }], opacity: haloOpacity },
              ]}
            />
            <View style={styles.checkBadge}>
              <Icon name="circle-check" size={44} color={c.sage500} />
            </View>
          </View>

          <View style={{ alignItems: 'center' }}>
            <Text style={styles.reactivatedTitle}>¡Cuenta reactivada!</Text>
            <Text style={styles.reactivatedSub}>
              Bienvenido de vuelta, {(user?.firstName ?? '')}. Tu proceso continúa.
            </Text>
          </View>

          {billingStatus?.nextPaymentDate && (
            <View style={styles.nextPaymentRow}>
              <Icon name="calendar" size={15} color={c.fg2} />
              <Text style={styles.nextPaymentText}>Próxima mensualidad:</Text>
              <Text style={styles.nextPaymentVal}>
                {formatDate(billingStatus.nextPaymentDate)}
              </Text>
            </View>
          )}

          <Touchable
      rippleColor="rgba(255,255,255,0.28)" style={styles.btnPrimary} onPress={handleGoHome} activeOpacity={0.85} accessibilityRole="button">
            <Icon name="house" size={17} color={c.white} />
            <Text style={styles.btnPrimaryText}>Ir a mi inicio</Text>
          </Touchable>
        </View>
      </SafeAreaView>
    );
  }

  /* ── Estado 1: Cuenta suspendida ── */
  const overdue = billingStatus?.overdueInvoices ?? [];

  return (
    <SafeAreaView style={styles.safeSuspended} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={c.amber50} />

      {/* Banner de suspensión */}
      <View style={styles.suspBanner}>
        <Icon name="triangle-alert" size={15} color={c.accent} />
        <Text style={styles.suspBannerText}>
          Cuenta suspendida
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Bloque central: ícono + título */}
        <View style={styles.centerBlock}>
          <View style={styles.lockBadge}>
            <Icon name="lock" size={44} color={c.accent} />
          </View>
          <Text style={styles.mainTitle}>Tu cuenta está suspendida</Text>
          <Text style={styles.mainSub}>
            Para volver a usar la app hay que ponerse al día con el plan. Tu proceso te sigue
            esperando.
          </Text>
        </View>

        {/* Tarjeta de adeudos. Antes, sin datos, mostraba "3 meses de mora" y "$0 adeudado":
            cifras de relleno en la pantalla donde el paciente decide cuánto pagar. */}
        {loadState === 'loading' ? (
          <View style={styles.overdueCard}>
            <Text style={styles.stateText}>Cargando tu estado de cuenta…</Text>
          </View>
        ) : !billingStatus ? (
          <View style={styles.overdueCard}>
            <Text style={styles.stateText}>
              No pudimos cargar tu estado de cuenta, así que tampoco podemos mostrarte cuánto
              falta. Revisa tu conexión e inténtalo de nuevo.
            </Text>
            <Touchable style={styles.retryBtn} onPress={load} accessibilityRole="button">
              <Text style={styles.retryText}>Reintentar</Text>
            </Touchable>
          </View>
        ) : (
          <View style={styles.overdueCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <Icon name="calendar" size={15} color={c.accent} />
              <Text style={styles.overdueCardTitle}>
                {overdue.length} mensualidad{overdue.length !== 1 ? 'es' : ''} pendiente
                {overdue.length !== 1 ? 's' : ''}
              </Text>
            </View>

            <View style={styles.overdueMonths}>
              {overdue.map((inv: Invoice) => (
                <View key={inv.id} style={styles.monthRow}>
                  <Text style={styles.monthLabel}>{formatMonth(inv.month)}</Text>
                  <Text style={styles.monthAmount}>{formatCLP(inv.amountCLP)}</Text>
                </View>
              ))}
            </View>

            <View style={styles.divider} />

            <View style={styles.totalRow}>
              <Text style={styles.totalAmount}>{formatCLP(billingStatus.totalOwedCLP)}</Text>
              <Text style={styles.totalLabel}> CLP · total pendiente</Text>
            </View>

            {billingStatus.firstOverdueDate && (
              <>
                <View style={styles.divider} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon name="clock" size={13} color={c.fg2} />
                  <Text style={styles.overdueDate}>
                    Desde el {formatDate(billingStatus.firstOverdueDate)}
                  </Text>
                </View>
              </>
            )}
          </View>
        )}

        {/* Acciones de pago */}
        <View style={styles.actions}>
          {payError && (
            <View style={styles.payErrorBox} accessibilityLiveRegion="polite">
              <Icon name="triangle-alert" size={15} color={c.dangerText} />
              <Text style={styles.payErrorText}>{payError}</Text>
            </View>
          )}
          <Touchable
      rippleColor="rgba(255,255,255,0.28)"
            style={[styles.btnPrimary, (paying || loadState !== 'ready') && styles.btnDisabled]}
            onPress={() => setConfirmPayOpen(true)}
            activeOpacity={0.85}
            disabled={paying || loadState !== 'ready'}
            accessibilityRole="button"
            accessibilityState={{ busy: paying }}
          >
            {paying ? (
              <Text style={styles.btnPrimaryText}>Procesando...</Text>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name="credit-card" size={17} color={c.white} />
                <Text style={styles.btnPrimaryText}>Pagar ahora y reactivar</Text>
              </View>
            )}
          </Touchable>

          <Touchable
            style={styles.btnOutline}
            onPress={handleOpenFamilySheet}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="users" size={17} color={c.primaryText} />
              <Text style={styles.btnOutlineText}>Avisar a mi familiar</Text>
            </View>
          </Touchable>

          {/* Antes decía soporte@stopbet.cl acá y contacto@ajuter.cl en el registro, y
              ninguno abría el correo. El pago se coordina con la sede, así que el
              contacto es el mismo del registro. */}
          <Touchable
            style={styles.helpLinkBtn}
            onPress={() => Linking.openURL('mailto:contacto@ajuter.cl?subject=Problemas%20para%20pagar%20mi%20plan')}
            accessibilityRole="button"
            accessibilityLabel="Escribir a contacto@ajuter.cl"
          >
            <Text style={styles.helpLink}>
              ¿Tienes problemas para pagar?{' '}
              <Text style={styles.helpLinkBold}>contacto@ajuter.cl</Text>
            </Text>
          </Touchable>
        </View>

        {/* Divisor de emergencia */}
        <View style={styles.emDivider}>
          <View style={styles.emDividerLine} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Icon name="siren" size={11} color={c.dangerText} />
            <Text style={styles.emDividerText}>Emergencia</Text>
          </View>
          <View style={styles.emDividerLine} />
        </View>

        {/* Tarjeta de pánico — siempre accesible */}
        <View style={styles.panicCard}>
          <Text style={styles.panicCardLead}>
            Aunque tu cuenta esté suspendida, siempre puedes usar:
          </Text>
          <Touchable
            style={styles.panicButton}
            onPress={handlePanic}
            activeOpacity={0.85}
            accessibilityLabel="Botón de pánico"
            accessibilityRole="button"
          >
            <Icon name="siren" size={30} color={c.white} />
          </Touchable>
          <Text style={styles.panicButtonLabel}>BOTÓN DE PÁNICO</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="heart" size={13} color={c.dangerText} />
            <Text style={styles.panicFoot}>El botón de pánico y la línea *4141 siguen disponibles</Text>
          </View>
        </View>
      </ScrollView>

      {/* Confirmación de pago: antes un toque llamaba a payOverdue sin decir cuánto ni preguntar */}
      <Modal
        visible={confirmPayOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmPayOpen(false)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.sheetTitle}>Confirmar pago</Text>
            <Text style={styles.sheetSub}>
              Vas a registrar el pago de {formatCLP(billingStatus?.totalOwedCLP ?? 0)} y reactivar
              tu cuenta.
            </Text>
            <Text style={styles.confirmNote}>
              Esta acción no cobra ninguna tarjeta: deja el pago registrado y te devuelve el acceso.
            </Text>
            <View style={styles.sheetActions}>
              <Touchable
      rippleColor="rgba(255,255,255,0.28)" style={styles.btnPrimary} onPress={handlePay} accessibilityRole="button">
                <Text style={styles.btnPrimaryText}>Confirmar y reactivar</Text>
              </Touchable>
              <Touchable
                style={styles.btnOutline}
                onPress={() => setConfirmPayOpen(false)}
                accessibilityRole="button"
              >
                <Text style={styles.btnOutlineText}>Cancelar</Text>
              </Touchable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Bottom sheet: Avisar a familiar ── */}
      <Modal
        visible={familySheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFamilySheetOpen(false)}
      >
        <Touchable
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={() => setFamilySheetOpen(false)}
          // accessible={false}: si no, TalkBack agrupa toda la hoja en un solo elemento y no llega a sus botones
          accessible={false}
        >
          <Touchable activeOpacity={1} style={styles.sheet} accessible={false}>
            <View style={styles.sheetGrip} />
            <Text style={styles.sheetTitle}>Avisar a un familiar</Text>
            <Text style={styles.sheetSub}>
              Comparte un enlace de pago seguro para que un familiar pueda reactivar tu cuenta por ti.
            </Text>

            {/* Acá salía "Patricia Soto · Madre", el mismo familiar inventado para todos */}
            {familyLink ? (
              <View style={styles.linkBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon name="link" size={13} color={c.primaryText} />
                  <Text style={styles.linkBoxText}>{familyLink}</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.stateText}>
                {familyLinkError
                  ? 'No pudimos generar el enlace de pago. Inténtalo de nuevo más tarde.'
                  : 'Generando el enlace…'}
              </Text>
            )}

            <View style={styles.sheetActions}>
              <Touchable
      rippleColor="rgba(255,255,255,0.28)"
                style={[styles.btnPrimary, !familyLink && styles.btnDisabled]}
                onPress={handleShareFamilyLink}
                activeOpacity={0.85}
                disabled={!familyLink}
                accessibilityRole="button"
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Icon name="share" size={17} color={c.white} />
                  <Text style={styles.btnPrimaryText}>Compartir enlace de pago</Text>
                </View>
              </Touchable>
              <Touchable
                style={styles.btnOutline}
                onPress={() => setFamilySheetOpen(false)}
                activeOpacity={0.8}
                accessibilityRole="button"
              >
                <Text style={styles.btnOutlineText}>Cancelar</Text>
              </Touchable>
            </View>
          </Touchable>
        </Touchable>
      </Modal>
    </SafeAreaView>
  );
}

/* ── Estilos ─────────────────────────────────────────────────────────────── */

const makeStyles = (c: Palette) => StyleSheet.create({
  /* Suspended state */
  safeSuspended: { flex: 1, backgroundColor: c.amber50 },

  suspBanner: {
    backgroundColor: c.amber50,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    paddingVertical: 11,
    paddingHorizontal: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 7,
  },
  suspBannerText: { fontFamily: Fonts.bodyBold, fontSize: 13, color: c.primaryText },

  scroll: { flex: 1, backgroundColor: c.bg },
  scrollContent: { padding: 22, paddingBottom: 48, gap: 22 },

  centerBlock: { alignItems: 'center', paddingHorizontal: 8 },
  lockBadge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: c.amber50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
  },
  mainTitle: {
    fontFamily: Fonts.headingBold,
    fontSize: 26,
    color: c.fg1,
    textAlign: 'center',
    marginTop: 22,
    lineHeight: 32,
    letterSpacing: -0.3,
  },
  mainSub: {
    fontFamily: Fonts.body,
    fontSize: 15,
    color: c.fg2,
    textAlign: 'center',
    lineHeight: 23,
    marginTop: 8,
    paddingHorizontal: 6,
  },

  /* Overdue card */
  overdueCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: c.accent,
    padding: 18,
    shadowColor: c.shadowMedium,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  overdueCardTitle: { fontFamily: Fonts.headingBold, fontSize: 16, color: c.primaryText },
  overdueMonths: { marginTop: 10, gap: 0 },
  monthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 0,
  },
  monthLabel: { fontFamily: Fonts.body, fontSize: 13.5, color: c.fg2 },
  monthAmount: { fontFamily: Fonts.bodyBold, fontSize: 13.5, color: c.fg1 },
  divider: { height: 1, backgroundColor: c.border, marginVertical: 14 },
  totalRow: { flexDirection: 'row', alignItems: 'baseline' },
  totalAmount: { fontFamily: Fonts.headingBold, fontSize: 24, color: c.fg1, letterSpacing: -0.3 },
  totalLabel: { fontFamily: Fonts.bodyBold, fontSize: 13, color: c.fg2 },
  // Rojo de alarma sobre una fecha: es un dato, no una emergencia
  overdueDate: { fontFamily: Fonts.bodyBold, fontSize: 13, color: c.fg2 },

  /* Actions */
  actions: { gap: 12 },
  helpLinkBtn: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 },
  helpLink: { fontFamily: Fonts.body, fontSize: 12, color: c.fg2, textAlign: 'center' },
  helpLinkBold: { fontFamily: Fonts.bodyBold, color: c.primaryText },

  /* Emergency divider */
  emDivider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emDividerLine: { flex: 1, height: 1, backgroundColor: c.border },
  emDividerText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 1,
    color: c.dangerText,
    textTransform: 'uppercase',
  },

  /* Panic card */
  panicCard: {
    backgroundColor: c.dangerSurface,
    borderWidth: 2,
    borderColor: c.danger,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    paddingBottom: 20,
  },
  panicCardLead: { fontFamily: Fonts.body, fontSize: 13, color: c.fg2, lineHeight: 20, textAlign: 'center' },
  panicButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: c.danger,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    marginBottom: 10,
    shadowColor: c.danger,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  panicButtonEmoji: { fontFamily: Fonts.body, fontSize: 30 },
  panicButtonLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    letterSpacing: 1,
    color: c.dangerText,
    textTransform: 'uppercase',
  },
  panicFoot: { fontFamily: Fonts.body, fontSize: 12, color: c.dangerText, marginTop: 8 },

  /* Bottom sheet */
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(30,45,44,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    paddingBottom: 28,
  },
  sheetGrip: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: { fontFamily: Fonts.headingBold, fontSize: 19, color: c.fg1 },
  sheetSub: { fontFamily: Fonts.body, fontSize: 13.5, color: c.fg2, lineHeight: 20, marginTop: 6 },
  famRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: c.bg,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 16,
    padding: 12,
    marginTop: 16,
    marginBottom: 16,
  },
  famAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: c.teal400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  famAvatarText: { fontFamily: Fonts.bodyBold, fontSize: 16, color: c.white },
  famInfo: { flex: 1 },
  famName: { fontFamily: Fonts.bodyBold, fontSize: 15, color: c.fg1 },
  famRel: { fontFamily: Fonts.body, fontSize: 12, color: c.fg2, marginTop: 2 },
  linkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.infoSurface,
    borderRadius: 12,
    padding: 11,
    marginBottom: 16,
    gap: 10,
  },
  linkBoxText: { fontFamily: Fonts.body, fontSize: 12.5, color: c.primaryText, flex: 1 },
  sheetActions: { gap: 10 },

  /* Buttons */
  btnPrimary: {
    backgroundColor: c.primary,
    borderRadius: 9999,
    paddingVertical: 15,
    // El botón de "Ir a mi inicio" vive en un contenedor centrado y se encogía al ancho
    // del ícono: su texto salía cortado por los dos lados.
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: { fontFamily: Fonts.bodyBold, color: c.white, fontSize: 16 },
  btnOutline: {
    borderRadius: 9999,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: c.primary,
    backgroundColor: 'transparent',
  },
  btnOutlineText: { fontFamily: Fonts.bodyBold, color: c.primaryText, fontSize: 16 },
  btnDisabled: { opacity: 0.6 },

  /* Reactivated state */
  safeReactivated: { flex: 1, backgroundColor: c.successSurface },
  reactivatedContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 26,
  },
  checkWrap: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkHalo: {
    position: 'absolute',
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: c.sage500,
  },
  checkBadge: {
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: c.sage50,
    borderWidth: 5,
    borderColor: c.sage500,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: c.sage500,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 8,
  },
  checkEmoji: { fontFamily: Fonts.body, fontSize: 52 },
  reactivatedTitle: {
    fontFamily: Fonts.headingBold,
    fontSize: 28,
    color: c.fg1,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  reactivatedSub: {
    fontFamily: Fonts.body,
    fontSize: 15,
    color: c.fg2,
    textAlign: 'center',
    lineHeight: 23,
    marginTop: 8,
  },
  nextPaymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  nextPaymentLabel: { fontFamily: Fonts.body, fontSize: 12, color: c.fg2 },
  nextPaymentText: { fontFamily: Fonts.body, fontSize: 12, color: c.fg2 },
  nextPaymentVal: { fontFamily: Fonts.bodyBold, fontSize: 14, color: c.fg1 },
  stateText: { fontFamily: Fonts.body, fontSize: 14, color: c.fg1, lineHeight: 20 },
  retryBtn: {
    marginTop: 14, alignSelf: 'flex-start', minHeight: 48, justifyContent: 'center',
    paddingHorizontal: 18, borderRadius: 9999, borderWidth: 1.5, borderColor: c.primary,
  },
  retryText: { fontFamily: Fonts.bodyBold, fontSize: 14, color: c.primaryText },
  payErrorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 12,
    backgroundColor: c.dangerSurface, borderRadius: 12, padding: 12,
  },
  payErrorText: { fontFamily: Fonts.body, flex: 1, fontSize: 13.5, color: c.dangerText, lineHeight: 19 },
  confirmOverlay: {
    flex: 1, backgroundColor: 'rgba(45,90,158,0.32)', justifyContent: 'center', paddingHorizontal: 22,
  },
  confirmCard: { backgroundColor: c.surface, borderRadius: 20, padding: 22 },
  confirmNote: { fontFamily: Fonts.body, fontSize: 13, color: c.fg2, lineHeight: 19, marginTop: 10 },

});
