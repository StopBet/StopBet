import React, { useEffect, useState } from 'react';
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
import type { Sede } from '@stopbet/shared-types';
import type { AuthStackParamList } from '../navigation/types';
import { TopBar } from '../components/TopBar';
import { StepperHeader } from '../components/StepperHeader';
import { Colors } from '../constants/colors';
import { api } from '../services/api';

type Props = NativeStackScreenProps<AuthStackParamList, 'RegisterStep2'>;

export function RegisterStep2Screen({ navigation, route }: Props) {
  const { institutionId, basicData } = route.params;
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [selectedSedeId, setSelectedSedeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.getSedes()
      .then(setSedes)
      .catch(() => Alert.alert('Error', 'No se pudieron cargar las sedes. Verifica tu conexión.'))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async () => {
    if (!selectedSedeId) return;
    setSubmitting(true);
    try {
      const result = await api.submitRegistration({
        ...basicData,
        sedeId: selectedSedeId,
        institutionId,
      });
      navigation.navigate('RequestSent', {
        requestId: result.requestId,
        email: basicData.email,
      });
    } catch (err: any) {
      const msg =
        err?.message?.includes('409')
          ? 'Ya existe una cuenta con ese correo electrónico.'
          : 'No se pudo enviar la solicitud. Inténtalo de nuevo.';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const sedeIcon = (type: Sede['type']) => (type === 'online' ? '📱' : '📍');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bg} />
      <TopBar title="Crear cuenta" stepLabel="Paso 2 de 3" onBack={() => navigation.goBack()} />
      <StepperHeader current={2} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>¿A qué sede perteneces?</Text>
        <Text style={styles.subtitle}>
          Te conectaremos con la comunidad y el equipo clínico de tu sede.
        </Text>

        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 32 }} />
        ) : (
          sedes.map((sede) => {
            const sel = selectedSedeId === sede.id;
            return (
              <TouchableOpacity
                key={sede.id}
                activeOpacity={0.85}
                onPress={() => setSelectedSedeId(sede.id)}
                style={[styles.card, sel && styles.cardSelected]}
              >
                <View style={[styles.pin, sel && styles.pinSelected]}>
                  <Text style={styles.pinIcon}>{sedeIcon(sede.type)}</Text>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardName}>{sede.name}</Text>
                  <Text style={styles.cardAddr}>{sede.address}</Text>
                  <View style={styles.metaPill}>
                    <Text style={styles.metaText}>👥 {sede.activeGroups} grupos activos</Text>
                  </View>
                </View>
                {sel ? (
                  <Text style={styles.checkIcon}>✓</Text>
                ) : (
                  <View style={styles.radio} />
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.btn, (!selectedSedeId || submitting) && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={!selectedSedeId || submitting}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.btnText}>📤 Enviar solicitud</Text>
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

  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 15,
    marginBottom: 12,
    gap: 13,
  },
  cardSelected: { borderWidth: 2, borderColor: Colors.primary, backgroundColor: '#EAF3F2', padding: 14 },
  pin: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#EAF3F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinSelected: { backgroundColor: Colors.white },
  pinIcon: { fontSize: 20 },
  cardBody: { flex: 1 },
  cardName: { fontWeight: '700', fontSize: 16, color: Colors.ink900 },
  cardAddr: { fontSize: 13, color: Colors.fg2, marginTop: 1 },
  metaPill: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.sage50,
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 8,
  },
  metaText: { fontWeight: '600', fontSize: 11.5, color: Colors.sage500 },
  checkIcon: { fontSize: 20, color: Colors.primary, fontWeight: '800' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.border },

  footer: { paddingHorizontal: 22, paddingBottom: 26, paddingTop: 14 },
  btn: { backgroundColor: Colors.primary, borderRadius: 9999, height: 54, alignItems: 'center', justifyContent: 'center' },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontWeight: '700', fontSize: 16, color: Colors.white },
});
