import React, { useContext, useState } from 'react';
import {
  ActivityIndicator,
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

          {/* Marca */}
          <View style={styles.brand}>
            <View style={styles.ringOuter}>
              <View style={styles.ringMid}>
                <View style={styles.ringInner}>
                  <View style={styles.logoBadge}>
                    <Icon name="heart" size={28} color={Colors.white} />
                  </View>
                </View>
              </View>
            </View>
            <Text style={styles.logoText}>
              stop<Text style={styles.logoAccent}>bet</Text>
            </Text>
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
                  hitSlop={8}
                  style={styles.eyeBtn}
                >
                  <Text style={styles.eyeText}>{showPassword ? 'Ocultar' : 'Ver'}</Text>
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

          {/* Ir a registro */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>¿Eres nuevo? · </Text>
            <Pressable onPress={() => navigation.navigate('SelectInstitution')}>
              <Text style={styles.footerLink}>Registrarse</Text>
            </Pressable>
          </View>
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
    fontWeight: '600',
    color: Colors.primary,
  },
  brand: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 24,
  },
  ringOuter: {
    width: 152,
    height: 152,
    borderRadius: 76,
    borderWidth: 1.5,
    borderColor: 'rgba(232,136,58,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  ringMid: {
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 1.5,
    borderColor: 'rgba(232,136,58,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(232,136,58,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: -0.5,
    marginTop: 14,
  },
  logoAccent: {
    color: Colors.accent,
  },
  tagline: {
    fontSize: 14,
    color: Colors.fg2,
    marginTop: 6,
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
    fontWeight: '700',
    color: Colors.ink900,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: Colors.fg2,
    marginBottom: 22,
  },
  field: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
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
    flex: 1,
    fontSize: 15,
    color: Colors.ink900,
    paddingVertical: 0,
  },
  eyeBtn: {
    paddingLeft: 8,
  },
  eyeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.fg2,
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
    fontWeight: '700',
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
    fontWeight: '600',
    color: Colors.danger,
  },
  forgotBtn: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  forgotText: {
    fontSize: 13.5,
    fontWeight: '600',
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
    fontWeight: '600',
    color: Colors.primary,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
  },
  footerText: {
    fontSize: 14,
    color: Colors.fg2,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
});
