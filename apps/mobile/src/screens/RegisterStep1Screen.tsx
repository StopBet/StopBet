import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/types';
import { TopBar } from '../components/TopBar';
import { StepperHeader } from '../components/StepperHeader';
import { FormInput } from '../components/FormInput';
import { Icon } from '../components/Icon';
import { Colors } from '../constants/colors';

type Props = NativeStackScreenProps<AuthStackParamList, 'RegisterStep1'>;

const REFERRAL_OPTIONS = [
  'Médico / Psicólogo',
  'Familiar o amigo',
  'Internet / Redes sociales',
  'Hospital o clínica',
  'Otro',
];

export function RegisterStep1Screen({ navigation, route }: Props) {
  const { institutionId } = route.params;

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [rut, setRut] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [address, setAddress] = useState('');
  const [referralSource, setReferralSource] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!firstName.trim()) errs.firstName = 'El nombre es obligatorio';
    if (!lastName.trim()) errs.lastName = 'El apellido es obligatorio';
    if (!rut.trim()) errs.rut = 'El RUT es obligatorio';
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = 'Ingresa un correo válido';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleContinue = () => {
    if (!validate()) return;
    navigation.navigate('RegisterStep2', {
      institutionId,
      basicData: { firstName, lastName, rut, email, phone, birthDate, address, referralSource },
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bg} />
      <TopBar title="Crear cuenta" stepLabel="Paso 1 de 3" onBack={() => navigation.goBack()} />
      <StepperHeader current={1} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Cuéntanos sobre ti</Text>
          <Text style={styles.subtitle}>Esta información es confidencial y solo la ve tu psicólogo.</Text>

          <FormInput label="Nombre(s)" required value={firstName} onChangeText={setFirstName}
            leadingIcon="user" placeholder="Juan" error={errors.firstName} />
          <FormInput label="Apellido(s)" required value={lastName} onChangeText={setLastName}
            leadingIcon="user" placeholder="Pérez" error={errors.lastName} />
          <FormInput label="RUT" required value={rut} onChangeText={setRut}
            leadingIcon="id-card" placeholder="12.345.678-9" error={errors.rut}
            hint="Ingresa el RUT con puntos y guión" />
          <FormInput label="Correo electrónico" value={email} onChangeText={setEmail}
            leadingIcon="mail" placeholder="tu@correo.cl"
            keyboardType="email-address" error={errors.email} />
          <FormInput label="Teléfono" value={phone} onChangeText={setPhone}
            prefix="+56" placeholder="9 8765 4321"
            keyboardType="phone-pad" />
          <FormInput label="Fecha de nacimiento" value={birthDate} onChangeText={setBirthDate}
            leadingIcon="calendar" placeholder="14/03/1992" trailingIcon="chevron-down" />
          <FormInput label="Dirección" required value={address} onChangeText={setAddress}
            leadingIcon="map-pin" placeholder="Av. Providencia 1234, depto 5" />
          <FormInput
            label="¿Cómo conociste AJUTER?"
            value={referralSource}
            onChangeText={setReferralSource}
            leadingIcon="search"
            placeholder="Médico / Psicólogo"
            trailingIcon="chevron-down"
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <TouchableOpacity activeOpacity={0.85} style={styles.btn} onPress={handleContinue}>
          <Text style={styles.btnText}>Continuar</Text>
          <Icon name="arrow-right" size={18} color={Colors.white} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  flex: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 22, paddingBottom: 16 },
  title: { fontWeight: '700', fontSize: 24, color: Colors.fg1, letterSpacing: -0.3, marginTop: 6, marginBottom: 0 },
  subtitle: { fontSize: 13, color: Colors.fg2, lineHeight: 19, marginTop: 8, marginBottom: 20 },
  footer: { paddingHorizontal: 22, paddingBottom: 26, paddingTop: 14 },
  btn: { flexDirection: 'row', gap: 8, backgroundColor: Colors.primary, borderRadius: 9999, height: 54, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontWeight: '700', fontSize: 16, color: Colors.white },
});
