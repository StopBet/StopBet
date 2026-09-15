import React, { useContext, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PaymentMethod } from '@stopbet/shared-types';
import type { AuthStackParamList } from '../navigation/types';
import { TopBar } from '../components/TopBar';
import { StepperHeader } from '../components/StepperHeader';
import { Icon, type IconName } from '../components/Icon';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/typography';
import { api } from '../services/api';
import { AuthContext } from '../context/AuthContext';

type Props = NativeStackScreenProps<AuthStackParamList, 'Payment'>;

const PAYMENT_METHODS: { id: PaymentMethod; icon: IconName; label: string }[] = [
  { id: 'card',     icon: 'credit-card', label: 'Tarjeta de crédito/débito' },
  { id: 'webpay',   icon: 'smartphone',  label: 'Webpay Plus' },
  { id: 'transfer', icon: 'landmark',    label: 'Transferencia bancaria' },
];

const PLAN_FEATURES = [
  'Asistente virtual IA 24/7',
  'Botón de pánico y red de padrinos',
  'Seguimiento de logros y progreso',
  'Comunidad de tu sede AJUTER',
  'Sesiones de seguimiento con psicólogo',
];

export function PaymentScreen({ navigation, route }: Props) {
  const { userId } = route.params;
  const { signIn } = useContext(AuthContext);
  const [method, setMethod] = useState<PaymentMethod>('card');
  const [paying, setPaying] = useState(false);

  const handlePay = async () => {
    setPaying(true);
    try {
      await api.createSubscription({ userId, paymentMethod: method });
      // Antes decía "Tu pago fue procesado correctamente" —no se cobra nada todavía— y el
      // botón llevaba a Bienvenida, así que el paciente quedaba fuera de la app recién activada.
      Alert.alert(
        'Cuenta activada',
        'Ya puedes entrar a StopBet. El cobro del plan se coordina con tu sede AJUTER.',
        [{ text: 'Entrar', onPress: signIn }],
      );
    } catch {
      Alert.alert('No se pudo activar', 'Inténtalo de nuevo en unos minutos.');
    } finally {
      setPaying(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bg} />
      <TopBar title="Crear cuenta" onBack={() => navigation.goBack()} />
      <StepperHeader current={3} labels={['Datos', 'Sede', 'Pago']} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Activa tu cuenta</Text>
        <Text style={styles.subtitle}>
          El plan mensual da acceso a todas las herramientas de acompañamiento.
        </Text>

        {/* Tarjeta del plan */}
        <View style={styles.planCard}>
          <View style={styles.planLogo}>
            <Text style={styles.planLogoText}>AJUTER</Text>
          </View>
          <Text style={styles.planName}>Plan mensual StopBet × AJUTER</Text>
          <View style={styles.planPrice}>
            <Text style={styles.planAmt}>$30.000</Text>
            <Text style={styles.planPer}>/mes</Text>
          </View>
          <View style={styles.planSep} />
          {PLAN_FEATURES.map((f) => (
            <View key={f} style={styles.planFeat}>
              <Icon name="circle-check" size={16} color={Colors.sage500} />
              <Text style={styles.planFeatText}>{f}</Text>
            </View>
          ))}
          <Text style={styles.planRenew}>
            El cobro se renueva automáticamente cada mes. Puedes cancelar contactando a AJUTER.
          </Text>
        </View>

        {/* Métodos de pago */}
        <Text style={styles.methodsTitle}>Método de pago</Text>
        {PAYMENT_METHODS.map((m) => {
          const sel = method === m.id;
          return (
            <React.Fragment key={m.id}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setMethod(m.id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: sel }}
                style={[styles.methodCard, sel && styles.methodCardSel]}
              >
                <View style={[styles.methodIcon, sel && styles.methodIconSel]}>
                  <Icon name={m.icon} size={20} color={sel ? Colors.white : Colors.primary} />
                </View>
                <Text style={styles.methodLabel}>{m.label}</Text>
                <View style={[styles.radio, sel && styles.radioSel]}>
                  {sel && <View style={styles.radioDot} />}
                </View>
              </TouchableOpacity>

            </React.Fragment>
          );
        })}

        <View style={styles.secureNote}>
          <Icon name="lock" size={14} color={Colors.fg2} />
          <Text style={styles.secureText}>
            La app no pide datos de tarjeta: el cobro se coordina con tu sede AJUTER.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.btn, paying && styles.btnDisabled]}
          onPress={handlePay}
          disabled={paying}
          accessibilityRole="button"
          accessibilityState={{ busy: paying }}
        >
          {paying ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <Icon name="circle-check" size={17} color={Colors.white} />
              <Text style={styles.btnText}>Activar mi cuenta</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 22, paddingBottom: 16 },
  title: { fontFamily: Fonts.headingBold, fontSize: 24, color: Colors.fg1, letterSpacing: -0.3, marginTop: 6 },
  subtitle: { fontFamily: Fonts.body, fontSize: 13, color: Colors.fg2, lineHeight: 19, marginTop: 8, marginBottom: 20 },

  planCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 18,
    shadowColor: Colors.shadowMedium,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  planLogo: {
    width: 80,
    height: 80,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 14,
  },
  planLogoText: { fontFamily: Fonts.headingBold, fontSize: 17, color: Colors.white, letterSpacing: 0.5 },
  planName: { fontFamily: Fonts.headingBold, textAlign: 'center', fontSize: 16, color: Colors.ink900 },
  planPrice: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6, marginVertical: 8 },
  planAmt: { fontFamily: Fonts.bodyBold, fontSize: 40, color: Colors.primary, letterSpacing: -0.8 },
  planPer: { fontFamily: Fonts.body, fontSize: 18, color: Colors.fg2 },
  planSep: { height: 1, backgroundColor: Colors.border, marginBottom: 16 },
  planFeat: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 11 },
  planFeatText: { fontFamily: Fonts.body, flex: 1, fontSize: 14, color: Colors.ink900, lineHeight: 20 },
  planRenew: { fontFamily: Fonts.body, fontSize: 12, fontStyle: 'italic', color: Colors.fg2, lineHeight: 16, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: Colors.border },

  methodsTitle: { fontFamily: Fonts.bodyBold, fontSize: 15, color: Colors.ink900, marginBottom: 12, marginTop: 4 },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  methodCardSel: { borderColor: Colors.primary, backgroundColor: Colors.infoSurface },
  methodIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  methodIconSel: { backgroundColor: Colors.white },
  methodLabel: { fontFamily: Fonts.bodyBold, flex: 1, fontSize: 15, color: Colors.ink900 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  radioSel: { borderColor: Colors.primary },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: Colors.primary },

  secureNote: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 16, marginBottom: 2 },
  secureText: { fontFamily: Fonts.body, flex: 1, fontSize: 12, color: Colors.fg2, lineHeight: 17 },

  footer: { paddingHorizontal: 22, paddingBottom: 26, paddingTop: 14 },
  btn: { flexDirection: 'row', gap: 8, backgroundColor: Colors.primary, borderRadius: 9999, height: 54, alignItems: 'center', justifyContent: 'center' },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontFamily: Fonts.bodyBold, fontSize: 16, color: Colors.white },
});
