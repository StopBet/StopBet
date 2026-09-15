import React, { useContext, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
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
import type { Palette } from '../constants/colors';
import { useTheme, useColors, useStyles } from '../context/ThemeContext';
import { Fonts } from '../constants/typography';
import { AuthContext, type LoginError } from '../context/AuthContext';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

type FormState = 'idle' | 'loading' | 'error';

// El backend distingue credenciales incorrectas (401) de cuenta suspendida (403). Decir
// "correo o contraseña incorrectos" cuando el problema es la mensualidad manda al paciente
// a probar claves que sí son correctas.
const MENSAJES: Record<LoginError, string> = {
  credenciales: 'Correo o contraseña incorrectos',
  suspendida:
    'Tu cuenta está suspendida por mensualidades pendientes. Escribe a contacto@ajuter.cl para reactivarla.',
  rol: 'Esta app es para pacientes. Si eres del equipo clínico, entra por el panel web.',
  red: 'No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.',
};

export function LoginScreen({ navigation }: Props) {
  const { isDark } = useTheme();
  const c = useColors();
  const styles = useStyles(makeStyles);
  const { signIn } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formState, setFormState] = useState<FormState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  // El teclado no pasaba del correo a la contraseña ni enviaba: había que salir del
  // teclado y tocar el botón para cada paso.
  const passwordRef = useRef<TextInput>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0;

  const handleLogin = async () => {
    if (!canSubmit || formState === 'loading') return;
    setFormState('loading');
    const error = await signIn(email.trim(), password);
    if (!error) return; // el cambio de navegador lo hace App.tsx al haber sesión
    setErrorMsg(MENSAJES[error]);
    setFormState('error');
  };

  const isLoading = formState === 'loading';
  const isError = formState === 'error';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={c.bg} />
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
            <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12} accessibilityRole="button">
              <Icon name="arrow-left" size={18} color={c.primaryText} />
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
            <Text style={styles.cardSubtitle}>Ingresa con tus credenciales</Text>

            {/* Campo correo */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Correo</Text>
              <View style={[styles.inputRow, isError && styles.inputRowError]}>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  accessibilityLabel="Correo electrónico"
                  // "tucorreo@ajuter.cl" hacía creer que el paciente tiene correo de AJUTER
                  placeholder="tu@correo.cl"
                  placeholderTextColor={c.fg2}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  editable={!isLoading}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  submitBehavior="submit"
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
                  accessibilityLabel="Contraseña"
                  placeholder="Tu contraseña"
                  placeholderTextColor={c.fg2}
                  ref={passwordRef}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password"
                  editable={!isLoading}
                  returnKeyType="go"
                  onSubmitEditing={handleLogin}
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
                    color={c.fg2}
                  />
                </Pressable>
              </View>
            </View>

            {/* Botón principal */}
            <Pressable
              style={[styles.btnPrimary, (!canSubmit || isLoading) && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={!canSubmit || isLoading}
              accessibilityRole="button"
              accessibilityLabel="Iniciar sesión"
              accessibilityState={{ busy: isLoading }}
            >
              {isLoading
                ? <ActivityIndicator color={c.white} size="small" />
                : <Text style={styles.btnPrimaryText}>Iniciar sesión</Text>
              }
            </Pressable>

            {/* Banner error */}
            {isError && (
              <View style={styles.errorBanner} accessibilityLiveRegion="polite">
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}

            {/* No hacía nada: todavía no existe recuperación de clave, así que escribe a soporte */}
            <Pressable
              style={styles.forgotBtn}
              accessibilityRole="button"
              onPress={() => Linking.openURL('mailto:soporte@stopbet.cl?subject=Recuperar%20contrase%C3%B1a')}
            >
              <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
            </Pressable>
          </View>

          {/* El acceso con huella todavía no existe: el botón no hacía nada y se quitó */}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: c.bg,
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
    minHeight: 48,
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: 15,
    fontFamily: Fonts.bodyBold,
    color: c.primaryText,
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
    color: c.fg2,
    marginTop: 10,
    textAlign: 'center',
  },
  card: {
    backgroundColor: c.surface,
    borderRadius: 20,
    padding: 24,
    shadowColor: c.shadowMedium,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 22,
    fontFamily: Fonts.headingBold,
    color: c.ink900,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: c.fg2,
    marginBottom: 22,
  },
  field: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: Fonts.bodyBold,
    color: c.fg1,
    marginBottom: 7,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: c.border,
    paddingHorizontal: 14,
    backgroundColor: c.surface,
  },
  inputRowError: {
    borderColor: c.danger,
    shadowColor: c.danger,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 0,
  },
  input: {
    fontFamily: Fonts.body,
    flex: 1,
    fontSize: 15,
    color: c.ink900,
    paddingVertical: 0,
    // todo el alto de la caja es tocable, no solo la línea de texto
    alignSelf: 'stretch',
    textAlignVertical: 'center',
  },
  eyeBtn: {
    paddingLeft: 10,
    minWidth: 44,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    height: 52,
    borderRadius: 9999,
    backgroundColor: c.primary,
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
    color: c.white,
  },
  errorBanner: {
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: c.dangerSurface,
    borderWidth: 1,
    borderColor: 'rgba(184,50,50,0.22)',
    padding: 12,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 13,
    fontFamily: Fonts.bodyBold,
    color: c.dangerText,
  },
  forgotBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    minHeight: 48,
  },
  forgotText: {
    fontSize: 13.5,
    fontFamily: Fonts.bodyBold,
    color: c.primaryText,
  },
});
