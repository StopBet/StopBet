import React, { useState } from 'react';
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
import { FormInput } from '../components/FormInput';
import { Colors } from '../constants/colors';
import { api } from '../services/api';

type Props = NativeStackScreenProps<AuthStackParamList, 'Payment'>;

const PAYMENT_METHODS: { id: PaymentMethod; icon: string; label: string }[] = [
  { id: 'card',     icon: '💳', label: 'Tarjeta de crédito/débito' },
  { id: 'webpay',   icon: '📱', label: 'Webpay Plus' },
  { id: 'transfer', icon: '🏦', label: 'Transferencia bancaria' },
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
  const [method, setMethod] = useState<PaymentMethod>('card');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardName, setCardName] = useState('');
  const [paying, setPaying] = useState(false);

  const handlePay = async () => {
    if (method === 'card') {
      if (!cardNumber || !expiry || !cvv || !cardName) {
        Alert.alert('Campos incompletos', 'Completa todos los campos de la tarjeta.');
        return;
      }
    }

    setPaying(true);
    try {
      await api.createSubscription({ userId, paymentMethod: method });
      // Ir al Home de la app — en la navegación real se cambia al AppStack
      Alert.alert(
        '¡Cuenta activada!',
        'Tu pago fue procesado correctamente. Bienvenido a StopBet · AJUTER.',
        [{ text: 'Ir al inicio', onPress: () => navigation.navigate('Welcome') }],
      );
    } catch (err: any) {
      Alert.alert('Error en el pago', 'No se pudo procesar el pago. Inténtalo de nuevo.');
    } finally {
      setPaying(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bg} />
      <TopBar title="Crear cuenta" stepLabel="Paso 3 de 3" onBack={() => navigation.goBack()} />
      <StepperHeader current={3} />

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
              <Text style={styles.planFeatCheck}>✓</Text>
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
                style={[styles.methodCard, sel && styles.methodCardSel]}
              >
                <View style={[styles.methodIcon, sel && styles.methodIconSel]}>
                  <Text style={styles.methodEmoji}>{m.icon}</Text>
                </View>
                <Text style={styles.methodLabel}>{m.label}</Text>
                <View style={[styles.radio, sel && styles.radioSel]}>
                  {sel && <View style={styles.radioDot} />}
                </View>
              </TouchableOpacity>

              {/* Campos de tarjeta inline */}
              {m.id === 'card' && sel && (
                <View style={styles.cardFields}>
                  <FormInput label="Número de tarjeta" value={cardNumber} onChangeText={setCardNumber}
                    placeholder="0000  0000  0000  0000" keyboardType="number-pad" />
                  <View style={styles.rowFields}>
                    <View style={styles.halfField}>
                      <FormInput label="Vencimiento" value={expiry} onChangeText={setExpiry}
                        placeholder="MM / AA" keyboardType="number-pad" />
                    </View>
                    <View style={styles.halfField}>
                      <FormInput label="CVV" value={cvv} onChangeText={setCvv}
                        placeholder="•••" keyboardType="number-pad" secureTextEntry />
                    </View>
                  </View>
                  <FormInput label="Nombre en la tarjeta" value={cardName} onChangeText={setCardName}
                    placeholder="Nombre y apellido" />
                </View>
              )}
            </React.Fragment>
          );
        })}

        <View style={styles.secureNote}>
          <Text style={styles.secureIcon}>🔒</Text>
          <Text style={styles.secureText}>Pago seguro · TLS 1.2+</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.btn, paying && styles.btnDisabled]}
          onPress={handlePay}
          disabled={paying}
        >
          {paying ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.btnText}>🔒 Pagar $30.000 y continuar</Text>
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
  title: { fontWeight: '700', fontSize: 24, color: Colors.fg1, letterSpacing: -0.3, marginTop: 6 },
  subtitle: { fontSize: 13, color: Colors.fg2, lineHeight: 19, marginTop: 8, marginBottom: 20 },

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
  planLogoText: { fontWeight: '800', fontSize: 17, color: Colors.white, letterSpacing: 0.5 },
  planName: { textAlign: 'center', fontWeight: '600', fontSize: 16, color: Colors.ink900 },
  planPrice: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6, marginVertical: 8 },
  planAmt: { fontWeight: '800', fontSize: 40, color: Colors.primary, letterSpacing: -0.8 },
  planPer: { fontSize: 18, color: Colors.fg2 },
  planSep: { height: 1, backgroundColor: Colors.border, marginBottom: 16 },
  planFeat: { flexDirection: 'row', gap: 10, marginBottom: 11 },
  planFeatCheck: { fontSize: 16, color: Colors.sage500, width: 18 },
  planFeatText: { flex: 1, fontSize: 14, color: Colors.ink900, lineHeight: 20 },
  planRenew: { fontSize: 11, fontStyle: 'italic', color: Colors.fg2, lineHeight: 16, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: Colors.border },

  methodsTitle: { fontWeight: '700', fontSize: 15, color: Colors.ink900, marginBottom: 12, marginTop: 4 },
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
  methodCardSel: { borderColor: Colors.primary, backgroundColor: '#EAF3F2' },
  methodIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  methodIconSel: { backgroundColor: Colors.white },
  methodEmoji: { fontSize: 20 },
  methodLabel: { flex: 1, fontWeight: '600', fontSize: 15, color: Colors.ink900 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  radioSel: { borderColor: Colors.primary },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: Colors.primary },

  cardFields: { marginBottom: 4, paddingHorizontal: 2 },
  rowFields: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1 },

  secureNote: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 16, marginBottom: 2 },
  secureIcon: { fontSize: 13 },
  secureText: { fontSize: 11, color: Colors.fg2 },

  footer: { paddingHorizontal: 22, paddingBottom: 26, paddingTop: 14 },
  btn: { backgroundColor: Colors.primary, borderRadius: 9999, height: 54, alignItems: 'center', justifyContent: 'center' },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontWeight: '700', fontSize: 16, color: Colors.white },
});
