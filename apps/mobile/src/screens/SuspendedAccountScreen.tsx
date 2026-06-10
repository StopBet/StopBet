import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BillingStatus, Invoice } from '@stopbet/shared-types';
import type { AppStackParamList } from '../navigation/types';
import { Icon } from '../components/Icon';
import { Colors } from '../constants/colors';
import { api } from '../services/api';

const TEMP_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEMP_FIRST_NAME = 'Carlos';

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
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [screenState, setScreenState] = useState<ScreenState>('suspended');
  const [familySheetOpen, setFamilySheetOpen] = useState(false);
  const [familyLink, setFamilyLink] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  // Animación del halo en Estado 2
  const haloAnim = useRef(new Animated.Value(0)).current;
  const haloLoop = useRef<Animated.CompositeAnimation | null>(null);

  const load = useCallback(async () => {
    try {
      const status = await api.getBillingStatus(TEMP_USER_ID);
      setBillingStatus(status);
    } catch (err) {
      console.error('[SuspendedAccountScreen] load error', (err as Error).message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (screenState === 'reactivated') {
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
  }, [screenState, haloAnim]);

  const haloScale = haloAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] });
  const haloOpacity = haloAnim.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0.22, 0.03, 0],
  });

  const handlePay = async () => {
    setPaying(true);
    try {
      const updated = await api.payOverdue(TEMP_USER_ID);
      setBillingStatus(updated);
      setScreenState('reactivated');
    } catch (err) {
      console.error('[SuspendedAccountScreen] pay error', (err as Error).message);
    } finally {
      setPaying(false);
    }
  };

  const handleOpenFamilySheet = async () => {
    if (!familyLink) {
      try {
        const { url } = await api.getFamilyLink(TEMP_USER_ID);
        setFamilyLink(url);
      } catch {
        // Muestra el sheet igualmente con link placeholder
        setFamilyLink('stopbet.cl/pago/...');
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
    navigation.replace('Home');
  };

  const handlePanic = () => {
    navigation.navigate('Panic');
  };

  if (screenState === 'reactivated') {
    return (
      <SafeAreaView style={styles.safeReactivated} edges={['top', 'bottom']}>
        <StatusBar barStyle="dark-content" backgroundColor="#F0FAF5" />
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
              <Icon name="circle-check" size={44} color={Colors.sage500} />
            </View>
          </View>

          <View style={{ alignItems: 'center' }}>
            <Text style={styles.reactivatedTitle}>¡Cuenta reactivada!</Text>
            <Text style={styles.reactivatedSub}>
              Bienvenido de vuelta, {TEMP_FIRST_NAME}. Tu proceso continúa.
            </Text>
          </View>

          {billingStatus?.nextPaymentDate && (
            <View style={styles.nextPaymentRow}>
              <Icon name="calendar" size={15} color={Colors.fg2} />
              <Text style={styles.nextPaymentText}>Próxima mensualidad:</Text>
              <Text style={styles.nextPaymentVal}>
                {formatDate(billingStatus.nextPaymentDate)}
              </Text>
            </View>
          )}

          <TouchableOpacity style={styles.btnPrimary} onPress={handleGoHome} activeOpacity={0.85}>
            <Icon name="house" size={17} color={Colors.white} />
            <Text style={styles.btnPrimaryText}>Ir a mi inicio</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  /* ── Estado 1: Cuenta suspendida ── */
  const overdue = billingStatus?.overdueInvoices ?? [];

  return (
    <SafeAreaView style={styles.safeSuspended} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.amber50} />

      {/* Banner de suspensión */}
      <View style={styles.suspBanner}>
        <Text style={styles.suspBannerText}>
          ⚠️ Cuenta suspendida · {billingStatus?.overdueMonths ?? 3} meses de mora
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
            <Text style={styles.lockEmoji}>🔒</Text>
          </View>
          <Text style={styles.mainTitle}>Tu cuenta está suspendida</Text>
          <Text style={styles.mainSub}>
            Llevas {billingStatus?.overdueMonths ?? 3} meses sin pagar. Reactiva tu cuenta para
            continuar tu proceso de rehabilitación.
          </Text>
        </View>

        {/* Tarjeta de adeudos */}
        <View style={styles.overdueCard}>
          <Text style={styles.overdueCardTitle}>
            📅 {billingStatus?.overdueMonths ?? overdue.length} mensualidades vencidas
          </Text>

          <View style={styles.overdueMonths}>
            {overdue.length > 0
              ? overdue.map((inv: Invoice) => (
                  <View key={inv.id} style={styles.monthRow}>
                    <Text style={styles.monthLabel}>{formatMonth(inv.month)}</Text>
                    <Text style={styles.monthAmount}>{formatCLP(inv.amountCLP)}</Text>
                  </View>
                ))
              : /* Fallback para cuando no hay datos aún */
                null}
          </View>

          <View style={styles.divider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalAmount}>
              {formatCLP(billingStatus?.totalOwedCLP ?? 0)}
            </Text>
            <Text style={styles.totalLabel}> CLP · total adeudado</Text>
          </View>

          <View style={styles.divider} />

          {billingStatus?.firstOverdueDate && (
            <Text style={styles.overdueDate}>
              ⏰ Primera mora: {formatDate(billingStatus.firstOverdueDate)} · hace{' '}
              {billingStatus.daysOverdue} día{billingStatus.daysOverdue !== 1 ? 's' : ''}
            </Text>
          )}
        </View>

        {/* Acciones de pago */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btnPrimary, paying && styles.btnDisabled]}
            onPress={handlePay}
            activeOpacity={0.85}
            disabled={paying}
          >
            <Text style={styles.btnPrimaryText}>
              {paying ? 'Procesando...' : '💳 Pagar ahora y reactivar'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnOutline}
            onPress={handleOpenFamilySheet}
            activeOpacity={0.8}
          >
            <Text style={styles.btnOutlineText}>👥 Avisar a mi familiar</Text>
          </TouchableOpacity>

          <Text style={styles.helpLink}>
            ¿Tienes problemas para pagar?{' '}
            <Text style={styles.helpLinkBold}>soporte@stopbet.cl</Text>
          </Text>
        </View>

        {/* Divisor de emergencia */}
        <View style={styles.emDivider}>
          <View style={styles.emDividerLine} />
          <Text style={styles.emDividerText}>🆘 Emergencia</Text>
          <View style={styles.emDividerLine} />
        </View>

        {/* Tarjeta de pánico — siempre accesible */}
        <View style={styles.panicCard}>
          <Text style={styles.panicCardLead}>
            Aunque tu cuenta esté suspendida, siempre puedes usar:
          </Text>
          <TouchableOpacity
            style={styles.panicButton}
            onPress={handlePanic}
            activeOpacity={0.85}
            accessibilityLabel="Botón de pánico"
            accessibilityRole="button"
          >
            <Text style={styles.panicButtonEmoji}>🆘</Text>
          </TouchableOpacity>
          <Text style={styles.panicButtonLabel}>BOTÓN DE PÁNICO</Text>
          <Text style={styles.panicFoot}>❤️ Tu padrino siempre estará disponible</Text>
        </View>
      </ScrollView>

      {/* ── Bottom sheet: Avisar a familiar ── */}
      <Modal
        visible={familySheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFamilySheetOpen(false)}
      >
        <TouchableOpacity
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={() => setFamilySheetOpen(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            <View style={styles.sheetGrip} />
            <Text style={styles.sheetTitle}>Avisar a un familiar</Text>
            <Text style={styles.sheetSub}>
              Comparte un enlace de pago seguro para que un familiar pueda reactivar tu cuenta por ti.
            </Text>

            {/* Familiar de apoyo (placeholder) */}
            <View style={styles.famRow}>
              <View style={styles.famAvatar}>
                <Text style={styles.famAvatarText}>P</Text>
              </View>
              <View style={styles.famInfo}>
                <Text style={styles.famName}>Patricia Soto</Text>
                <Text style={styles.famRel}>Madre · familiar de apoyo</Text>
              </View>
              <Text style={{ fontSize: 20 }}>✅</Text>
            </View>

            {/* Enlace de pago */}
            {familyLink && (
              <View style={styles.linkBox}>
                <Text style={styles.linkBoxText}>🔗 {familyLink}</Text>
              </View>
            )}

            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={handleShareFamilyLink}
                activeOpacity={0.85}
              >
                <Text style={styles.btnPrimaryText}>📤 Compartir enlace de pago</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnOutline}
                onPress={() => setFamilySheetOpen(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.btnOutlineText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

/* ── Estilos ─────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  /* Suspended state */
  safeSuspended: { flex: 1, backgroundColor: Colors.amber50 },

  suspBanner: {
    backgroundColor: Colors.amber50,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 11,
    paddingHorizontal: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 7,
  },
  suspBannerText: { fontWeight: '600', fontSize: 13, color: Colors.accent },

  scroll: { flex: 1, backgroundColor: Colors.bg },
  scrollContent: { padding: 22, paddingBottom: 48, gap: 22 },

  centerBlock: { alignItems: 'center', paddingHorizontal: 8 },
  lockBadge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.amber50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
  },
  lockEmoji: { fontSize: 44 },
  mainTitle: {
    fontWeight: '700',
    fontSize: 26,
    color: Colors.fg1,
    textAlign: 'center',
    marginTop: 22,
    lineHeight: 32,
    letterSpacing: -0.3,
  },
  mainSub: {
    fontSize: 15,
    color: Colors.fg2,
    textAlign: 'center',
    lineHeight: 23,
    marginTop: 8,
    paddingHorizontal: 6,
  },

  /* Overdue card */
  overdueCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: Colors.accent,
    padding: 18,
    shadowColor: Colors.shadowMedium,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  overdueCardTitle: { fontWeight: '600', fontSize: 16, color: Colors.accent },
  overdueMonths: { marginTop: 10, gap: 0 },
  monthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 0,
  },
  monthLabel: { fontSize: 13.5, color: Colors.fg2 },
  monthAmount: { fontSize: 13.5, fontWeight: '600', color: Colors.fg1 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 14 },
  totalRow: { flexDirection: 'row', alignItems: 'baseline' },
  totalAmount: { fontWeight: '700', fontSize: 24, color: Colors.fg1, letterSpacing: -0.3 },
  totalLabel: { fontSize: 13, color: Colors.fg2, fontWeight: '600' },
  overdueDate: { fontSize: 13, color: Colors.danger, fontWeight: '600' },

  /* Actions */
  actions: { gap: 12 },
  helpLink: { fontSize: 12, color: Colors.fg2, textAlign: 'center' },
  helpLinkBold: { color: Colors.primary, fontWeight: '600' },

  /* Emergency divider */
  emDivider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emDividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  emDividerText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    color: Colors.danger,
    textTransform: 'uppercase',
  },

  /* Panic card */
  panicCard: {
    backgroundColor: '#FFF5F5',
    borderWidth: 2,
    borderColor: Colors.danger,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    paddingBottom: 20,
  },
  panicCardLead: { fontSize: 13, color: Colors.fg2, lineHeight: 20, textAlign: 'center' },
  panicButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    marginBottom: 10,
    shadowColor: Colors.danger,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  panicButtonEmoji: { fontSize: 30 },
  panicButtonLabel: {
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 1,
    color: Colors.danger,
    textTransform: 'uppercase',
  },
  panicFoot: { fontSize: 12, color: Colors.danger, marginTop: 8 },

  /* Bottom sheet */
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(30,45,44,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    paddingBottom: 28,
  },
  sheetGrip: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: { fontWeight: '700', fontSize: 19, color: Colors.fg1 },
  sheetSub: { fontSize: 13.5, color: Colors.fg2, lineHeight: 20, marginTop: 6 },
  famRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 12,
    marginTop: 16,
    marginBottom: 16,
  },
  famAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.teal400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  famAvatarText: { fontWeight: '700', fontSize: 16, color: Colors.white },
  famInfo: { flex: 1 },
  famName: { fontWeight: '700', fontSize: 15, color: Colors.fg1 },
  famRel: { fontSize: 12, color: Colors.fg2, marginTop: 2 },
  linkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAF5F3',
    borderRadius: 12,
    padding: 11,
    marginBottom: 16,
    gap: 10,
  },
  linkBoxText: { fontSize: 12.5, color: Colors.primary, flex: 1 },
  sheetActions: { gap: 10 },

  /* Buttons */
  btnPrimary: {
    backgroundColor: Colors.primary,
    borderRadius: 9999,
    paddingVertical: 15,
    alignItems: 'center',
  },
  btnPrimaryText: { color: Colors.white, fontWeight: '700', fontSize: 16 },
  btnOutline: {
    borderRadius: 9999,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
    backgroundColor: 'transparent',
  },
  btnOutlineText: { color: Colors.primary, fontWeight: '700', fontSize: 16 },
  btnDisabled: { opacity: 0.6 },

  /* Reactivated state */
  safeReactivated: { flex: 1, backgroundColor: '#F0FAF5' },
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
    backgroundColor: Colors.sage500,
  },
  checkBadge: {
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: Colors.sage50,
    borderWidth: 5,
    borderColor: Colors.sage500,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.sage500,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 8,
  },
  checkEmoji: { fontSize: 52 },
  reactivatedTitle: {
    fontWeight: '700',
    fontSize: 28,
    color: Colors.fg1,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  reactivatedSub: {
    fontSize: 15,
    color: Colors.fg2,
    textAlign: 'center',
    lineHeight: 23,
    marginTop: 8,
  },
  nextPaymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  nextPaymentLabel: { fontSize: 12, color: Colors.fg2 },
  nextPaymentText: { fontSize: 12, color: Colors.fg2 },
  nextPaymentVal: { fontWeight: '700', fontSize: 14, color: Colors.fg1 },
});
