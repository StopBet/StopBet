import React, { useContext, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/types';
import { Icon } from '../components/Icon';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/typography';
import { AuthContext } from '../context/AuthContext';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

type FormState = 'idle' | 'loading' | 'error';

export function LoginScreen({ navigation }: Props) {
  const { signIn } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formState, setFormState] = useState<FormState>('idle');

  const canSubmit = email.trim().length > 0 && password.length > 0;

  const handleLogin = async () => {
    if (!canSubmit || formState === 'loading') return;
    setFormState('loading');
    // TODO: POST /auth/login cuando el módulo de auth esté implementado en el backend
    // Por ahora, cualquier credencial entra en modo demo (usuario hardcodeado TEMP_USER_ID)
    await new Promise<void>(resolve => setTimeout(() => resolve(), 900));
    signIn();
  };

  const isLoading = formState === 'loading';
  const isError = formState === 'error';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bg} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Botón volver */}
          <View style={styles.headerRow}>
            <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
              <Icon name="arrow-left" size={18} color={Colors.primary} />
              <Text style={styles.backText}>Volver</Text>
            </Pressable>
          </View>

          {/* Marca — logotipo horizontal del manual, en vez de los anillos con
              un corazón genérico y la marca escrita en minúsculas. */}
          <View style={styles.brand}>
            <Image
              source={require('../assets/logo-horizontal.png')}
              style={styles.logoHorizontal}
              resizeMode="contain"
              accessibilityLabel="StopBet"
            />
            <Text style={styles.tagline}>Tu acompañamiento en el camino</Text>
          </View>

          {/* Tarjeta del formulario */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Iniciar sesión</Text>
            <Text style={styles.cardSubtitle}>Ingresa con tus credenciales de AJUTER</Text>

            {/* Campo correo */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Correo</Text>
              <View style={[styles.inputRow, isError && styles.inputRowError]}>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="tucorreo@ajuter.cl"
                  placeholderTextColor={Colors.fg2}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  editable={!isLoading}
                />
              </View>
            </View>

            {/* Campo contraseña */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Contraseña</Text>
              <View style={[styles.inputRow, isError && styles.inputRowError]}>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Tu contraseña"
                  placeholderTextColor={Colors.fg2}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password"
                  editable={!isLoading}
                />
                <Pressable
                  onPress={() => setShowPassword(s => !s)}
                  hitSlop={10}
                  style={styles.eyeBtn}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  <Icon
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color={Colors.fg2}
                  />
                </Pressable>
              </View>
            </View>

            {/* Botón principal */}
            <Pressable
              style={[styles.btnPrimary, (!canSubmit || isLoading) && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={!canSubmit || isLoading}
            >
              {isLoading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.btnPrimaryText}>Iniciar sesión</Text>
              }
            </Pressable>

            {/* Banner error */}
            {isError && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>Correo o contraseña incorrectos</Text>
              </View>
            )}

            {/* Olvidé contraseña */}
            <Pressable style={styles.forgotBtn}>
              <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
            </Pressable>
          </View>

          {/* Separador */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>o</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Biometría */}
          <Pressable style={styles.btnOutline}>
            <Text style={styles.btnOutlineText}>Iniciar con huella digital</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  headerRow: {
    paddingTop: 12,
    paddingBottom: 4,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: 15,
    fontFamily: Fonts.bodyBold,
    color: Colors.primary,
  },
  brand: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 24,
  },
  logoHorizontal: {
    width: 220,
    height: 60,
  },
  tagline: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.fg2,
    marginTop: 10,
    textAlign: 'center',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#2A2624',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 22,
    fontFamily: Fonts.headingBold,
    color: Colors.ink900,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.fg2,
    marginBottom: 22,
  },
  field: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: Fonts.bodyBold,
    color: Colors.fg1,
    marginBottom: 7,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    backgroundColor: Colors.surface,
  },
  inputRowError: {
    borderColor: Colors.danger,
    shadowColor: Colors.danger,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 0,
  },
  input: {
    fontFamily: Fonts.body,
    flex: 1,
    fontSize: 15,
    color: Colors.ink900,
    paddingVertical: 0,
  },
  eyeBtn: {
    paddingLeft: 10,
  },
  btnPrimary: {
    height: 52,
    borderRadius: 9999,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  btnDisabled: {
    opacity: 0.55,
  },
  btnPrimaryText: {
    fontSize: 16,
    fontFamily: Fonts.bodyBold,
    color: Colors.white,
  },
  errorBanner: {
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: '#F7E7E7',
    borderWidth: 1,
    borderColor: 'rgba(184,50,50,0.22)',
    padding: 12,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 13,
    fontFamily: Fonts.bodyBold,
    color: Colors.danger,
  },
  forgotBtn: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  forgotText: {
    fontSize: 13.5,
    fontFamily: Fonts.bodyBold,
    color: Colors.primary,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerLabel: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.fg2,
    paddingHorizontal: 4,
  },
  btnOutline: {
    height: 52,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutlineText: {
    fontSize: 15,
    fontFamily: Fonts.bodyBold,
    color: Colors.primary,
  },
});
