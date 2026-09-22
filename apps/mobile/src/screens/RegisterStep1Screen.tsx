import React, { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  Platform,
  ScrollView,
  type LayoutChangeEvent,
  StatusBar,
  StyleSheet,
  Text,
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
import type { Palette } from '../constants/colors';
import { useTheme, useColors, useStyles } from '../context/ThemeContext';
import { Fonts } from '../constants/typography';
import { Touchable } from '../components/Touchable';

type Props = NativeStackScreenProps<AuthStackParamList, 'RegisterStep1'>;

const REFERRAL_OPTIONS = [
  'Médico / Psicólogo',
  'Familiar o amigo',
  'Internet / Redes sociales',
  'Hospital o clínica',
  'Otro',
];

export function RegisterStep1Screen({ navigation, route }: Props) {
  const { isDark } = useTheme();
  const c = useColors();
  const styles = useStyles(makeStyles);
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
  // Con el formulario vacío, 'El nombre es obligatorio' quedaba sobre el borde superior:
  // el paciente tocaba Continuar y no pasaba nada visible. Se guarda el alto de cada campo
  // para poder desplazar hasta el primero con error.
  const scrollRef = useRef<ScrollView>(null);
  const fieldY = useRef<Record<string, number>>({});
  const trackY = (name: string) => (e: LayoutChangeEvent) => {
    fieldY.current[name] = e.nativeEvent.layout.y;
  };

  const validate = (): Record<string, string> => {
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
    return errs;
  };

  // El orden importa: hay que ir al primero que el paciente encuentra bajando
  const FIELD_ORDER = ['firstName', 'lastName', 'rut', 'email', 'phone', 'birthDate'];

  const handleContinue = () => {
    const errs = validate();
    const firstError = FIELD_ORDER.find((f) => errs[f]);
    if (firstError) {
      const y = fieldY.current[firstError];
      if (y !== undefined) {
        scrollRef.current?.scrollTo({ y: Math.max(y - 16, 0), animated: true });
      }
      return;
    }
    const isoBirthDate = birthDate.trim() ? chileanDateToIso(birthDate) ?? '' : '';
    navigation.navigate('RegisterIntake', {
      institutionId,
      basicData: { firstName, lastName, rut, email, phone, birthDate: isoBirthDate, address, referralSource },
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={c.bg} />
      <TopBar title="Crear cuenta" onBack={() => navigation.goBack()} />
      <StepperHeader current={1} labels={['Datos', 'Tu juego', 'Sede']} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Cuéntanos sobre ti</Text>
          <Text style={styles.subtitle}>Esta información es confidencial y solo la ve tu psicólogo.</Text>

          {/* El costo aparecía recién en "Solicitud enviada", después de entregar RUT y correo */}
          <View style={styles.planCard}>
            <View style={styles.planHead}>
              <Icon name="id-card" size={16} color={c.primaryText} />
              <Text style={styles.planTitle}>Antes de empezar</Text>
            </View>
            <Text style={styles.planBody}>
              El plan de StopBet cuesta{' '}
              <Text style={styles.planAmount}>$30.000 al mes</Text>. Primero un psicólogo revisa
              tu solicitud (24 a 48 horas) y el pago se coordina después con tu sede: registrarte
              no te cobra nada.
            </Text>
          </View>

          <View onLayout={trackY('firstName')}>
            <FormInput label="Nombre(s)" required value={firstName} onChangeText={setFirstName}
              leadingIcon="user" placeholder="Juan" error={errors.firstName} />
          </View>
          <View onLayout={trackY('lastName')}>
            <FormInput label="Apellido(s)" required value={lastName} onChangeText={setLastName}
              leadingIcon="user" placeholder="Pérez" error={errors.lastName} />
          </View>
          {/* "numbers-and-punctuation" era solo iOS: en Android nunca se aplicó - caía al
              teclado de texto - y en iOS dejaba fuera la K del dígito verificador. Probado
              en un Galaxy A31 (teclado Samsung, texto predictivo activado): autoCorrect
              solo no bastó, ese teclado lo ignora y seguía duplicando. "visible-password"
              sí frena la composición porque Android trata cualquier campo de contraseña
              como no editable por el teclado predictivo, y de paso deja escribir la K. */}
          <View onLayout={trackY('rut')}>
            <FormInput label="RUT" required value={rut}
              onChangeText={t => setRut(formatRut(t))}
              leadingIcon="id-card" placeholder="12.345.678-9" error={errors.rut}
              keyboardType="visible-password" autoCorrect={false} maxLength={12}
              hint="Se completan los puntos y el guión automáticamente" />
          </View>
          <View onLayout={trackY('email')}>
            <FormInput label="Correo electrónico" required value={email} onChangeText={setEmail}
              leadingIcon="mail" placeholder="tu@correo.cl"
              keyboardType="email-address" error={errors.email} />
          </View>
          <View onLayout={trackY('phone')}>
            <FormInput label="Teléfono" value={phone}
              onChangeText={t => setPhone(t.replace(/\D/g, ''))}
              prefix="+56" placeholder="9 8765 4321" error={errors.phone}
              keyboardType="phone-pad" maxLength={9} />
          </View>
          <View onLayout={trackY('birthDate')}>
            <FormInput label="Fecha de nacimiento" value={birthDate} onChangeText={setBirthDate}
              leadingIcon="calendar" placeholder="Selecciona tu fecha" trailingIcon="chevron-down"
              error={errors.birthDate} onPress={() => setShowDate(true)} />
          </View>
          <View onLayout={trackY('address')}>
            {/* Era obligatoria y sin explicación, en una app de ludopatía. El backend
                siempre la tuvo como opcional (`address?` en submit-registration.dto). */}
            <FormInput label="Dirección" value={address} onChangeText={setAddress}
              leadingIcon="map-pin" placeholder="Av. Providencia 1234, depto 5"
              hint="Opcional. Sirve para sugerirte la sede más cercana." />
          </View>
          <FormInput
            label="¿Cómo nos conociste?"
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
        <Touchable
      rippleColor="rgba(255,255,255,0.28)" activeOpacity={0.85} style={styles.btn} onPress={handleContinue} accessibilityRole="button">
          <Text style={styles.btnText}>Continuar</Text>
          <Icon name="arrow-right" size={18} color={c.white} />
        </Touchable>
      </View>

      <BirthDatePicker
        visible={showDate}
        value={birthDate}
        onSelect={setBirthDate}
        onClose={() => setShowDate(false)}
      />

      <Modal visible={showReferral} transparent animationType="fade"
        onRequestClose={() => setShowReferral(false)}>
        {/* accessible={false}: si no, TalkBack agrupa toda la hoja en un solo elemento y no llega a las opciones */}
        <Pressable style={styles.backdrop} onPress={() => setShowReferral(false)} accessible={false}>
          <Pressable style={styles.sheet} accessible={false}>
            <Text style={styles.sheetTitle}>¿Cómo nos conociste?</Text>
            {REFERRAL_OPTIONS.map(opt => (
              <Touchable key={opt} style={styles.sheetRow} activeOpacity={0.7}
                accessibilityRole="radio"
                accessibilityState={{ checked: referralSource === opt }}
                onPress={() => { setReferralSource(opt); setShowReferral(false); }}>
                <Text style={styles.sheetText}>{opt}</Text>
                {referralSource === opt && (
                  <Icon name="check" size={18} color={c.primaryText} />
                )}
              </Touchable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  flex: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 22, paddingBottom: 16 },
  title: { fontFamily: Fonts.headingBold, fontSize: 24, color: c.fg1, letterSpacing: -0.3, marginTop: 6, marginBottom: 0 },
  subtitle: { fontFamily: Fonts.body, fontSize: 13, color: c.fg2, lineHeight: 19, marginTop: 8, marginBottom: 20 },
  footer: { paddingHorizontal: 22, paddingBottom: 26, paddingTop: 14 },
  backdrop: { flex: 1, backgroundColor: c.overlay, justifyContent: 'center', paddingHorizontal: 28 },
  sheet: { backgroundColor: c.surface, borderRadius: 18, paddingVertical: 8 },
  sheetTitle: { fontFamily: Fonts.bodyBold, fontSize: 15, color: c.fg1, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 8 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14 },
  sheetText: { fontFamily: Fonts.body, fontSize: 15, color: c.fg1 },
  btn: { flexDirection: 'row', gap: 8, backgroundColor: c.primary, borderRadius: 9999, height: 54, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: Fonts.bodyBold, fontSize: 16, color: c.white },
  planCard: {
    backgroundColor: c.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.border,
    padding: 14,
    marginBottom: 22,
    gap: 8,
  },
  planHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  planTitle: { fontFamily: Fonts.bodyBold, fontSize: 14, color: c.ink900 },
  planBody: { fontFamily: Fonts.body, fontSize: 13.5, color: c.fg1, lineHeight: 20 },
  planAmount: { fontFamily: Fonts.bodyBold, color: c.primaryText },

});
