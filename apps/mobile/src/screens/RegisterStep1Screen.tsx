import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
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
import { chileanDateToIso, formatRut, isValidRut } from '@stopbet/shared-types';
import type { AuthStackParamList } from '../navigation/types';
import { TopBar } from '../components/TopBar';
import { StepperHeader } from '../components/StepperHeader';
import { FormInput } from '../components/FormInput';
import { BirthDatePicker } from '../components/BirthDatePicker';
import { Icon } from '../components/Icon';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/typography';

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
  const [showReferral, setShowReferral] = useState(false);
  const [showDate, setShowDate] = useState(false);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!firstName.trim()) errs.firstName = 'El nombre es obligatorio';
    if (!lastName.trim()) errs.lastName = 'El apellido es obligatorio';
    if (!rut.trim()) {
      errs.rut = 'El RUT es obligatorio';
    } else if (!isValidRut(rut)) {
      errs.rut = 'El RUT ingresado no es válido';
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = 'Ingresa un correo válido';
    }
    if (!address.trim()) errs.address = 'La dirección es obligatoria';
    // El telefono es opcional, pero si viene tiene que ser un movil chileno: 9 y 8 digitos.
    if (phone.trim() && !/^9\d{8}$/.test(phone.replace(/\D/g, ''))) {
      errs.phone = 'Debe ser un móvil chileno: 9 seguido de 8 dígitos';
    }
    if (birthDate.trim() && !chileanDateToIso(birthDate)) {
      // Distinguir formato de fecha inexistente: con 31/02/1990 el formato está bien y
      // decir "usa DD/MM/AAAA" manda al paciente a corregir algo que ya estaba correcto.
      errs.birthDate = /^\d{2}\/\d{2}\/\d{4}$/.test(birthDate)
        ? 'Esa fecha no existe. Revisa el día y el mes'
        : 'Ingresa la fecha en formato DD/MM/AAAA';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleContinue = () => {
    if (!validate()) return;
    const isoBirthDate = birthDate.trim() ? chileanDateToIso(birthDate) ?? '' : '';
    navigation.navigate('RegisterStep2', {
      institutionId,
      basicData: { firstName, lastName, rut, email, phone, birthDate: isoBirthDate, address, referralSource },
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
          <FormInput label="RUT" required value={rut}
            onChangeText={t => setRut(formatRut(t))}
            leadingIcon="id-card" placeholder="12.345.678-9" error={errors.rut}
            keyboardType="numbers-and-punctuation" maxLength={12}
            hint="Se completan los puntos y el guión automáticamente" />
          <FormInput label="Correo electrónico" required value={email} onChangeText={setEmail}
            leadingIcon="mail" placeholder="tu@correo.cl"
            keyboardType="email-address" error={errors.email} />
          <FormInput label="Teléfono" value={phone}
            onChangeText={t => setPhone(t.replace(/\D/g, ''))}
            prefix="+56" placeholder="9 8765 4321" error={errors.phone}
            keyboardType="phone-pad" maxLength={9} />
          <FormInput label="Fecha de nacimiento" value={birthDate} onChangeText={setBirthDate}
            leadingIcon="calendar" placeholder="Selecciona tu fecha" trailingIcon="chevron-down"
            error={errors.birthDate} onPress={() => setShowDate(true)} />
          <FormInput label="Dirección" required value={address} onChangeText={setAddress}
            leadingIcon="map-pin" placeholder="Av. Providencia 1234, depto 5" error={errors.address} />
          <FormInput
            label="¿Cómo conociste AJUTER?"
            value={referralSource}
            onChangeText={setReferralSource}
            leadingIcon="search"
            placeholder="Selecciona una opción"
            trailingIcon="chevron-down"
            onPress={() => setShowReferral(true)}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <TouchableOpacity activeOpacity={0.85} style={styles.btn} onPress={handleContinue}>
          <Text style={styles.btnText}>Continuar</Text>
          <Icon name="arrow-right" size={18} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <BirthDatePicker
        visible={showDate}
        value={birthDate}
        onSelect={setBirthDate}
        onClose={() => setShowDate(false)}
      />

      <Modal visible={showReferral} transparent animationType="fade"
        onRequestClose={() => setShowReferral(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowReferral(false)}>
          <Pressable style={styles.sheet}>
            <Text style={styles.sheetTitle}>¿Cómo conociste AJUTER?</Text>
            {REFERRAL_OPTIONS.map(opt => (
              <TouchableOpacity key={opt} style={styles.sheetRow} activeOpacity={0.7}
                onPress={() => { setReferralSource(opt); setShowReferral(false); }}>
                <Text style={styles.sheetText}>{opt}</Text>
                {referralSource === opt && (
                  <Icon name="check" size={18} color={Colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  flex: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 22, paddingBottom: 16 },
  title: { fontFamily: Fonts.headingBold, fontSize: 24, color: Colors.fg1, letterSpacing: -0.3, marginTop: 6, marginBottom: 0 },
  subtitle: { fontFamily: Fonts.body, fontSize: 13, color: Colors.fg2, lineHeight: 19, marginTop: 8, marginBottom: 20 },
  footer: { paddingHorizontal: 22, paddingBottom: 26, paddingTop: 14 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', paddingHorizontal: 28 },
  sheet: { backgroundColor: Colors.surface, borderRadius: 18, paddingVertical: 8 },
  sheetTitle: { fontFamily: Fonts.bodyBold, fontSize: 15, color: Colors.fg1, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 8 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14 },
  sheetText: { fontFamily: Fonts.body, fontSize: 15, color: Colors.fg1 },
  btn: { flexDirection: 'row', gap: 8, backgroundColor: Colors.primary, borderRadius: 9999, height: 54, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: Fonts.bodyBold, fontSize: 16, color: Colors.white },
});
