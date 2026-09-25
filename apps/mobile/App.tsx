import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AppStackParamList, AuthStackParamList } from './src/navigation/types';
import { AuthContext, type LoginError } from './src/context/AuthContext';
import type { AuthUser } from '@stopbet/shared-types';
import { api, resetRelapseDetection } from './src/services/api';
import { session } from './src/services/session';
import { isNetworkError } from './src/services/checkInQueue';
import { podarCachésDeOtrasCuentas } from './src/services/offlineStore';
import { ToastProvider } from './src/context/ToastContext';
import { DialogProvider } from './src/context/DialogContext';
import { ThemeProvider } from './src/context/ThemeContext';

// Auth screens
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { SelectInstitutionScreen } from './src/screens/SelectInstitutionScreen';
import { RegisterStep1Screen } from './src/screens/RegisterStep1Screen';
import { RegisterIntakeScreen } from './src/screens/RegisterIntakeScreen';
import { RegisterStep2Screen } from './src/screens/RegisterStep2Screen';
import { RequestSentScreen } from './src/screens/RequestSentScreen';
import { PaymentScreen } from './src/screens/PaymentScreen';

// App screens
import { AssistantScreen } from './src/screens/AssistantScreen';
import { NotificationsScreen } from './src/screens/NotificationsScreen';
import { MainTabs } from './src/navigation/MainTabs';
import { PanicScreen } from './src/screens/PanicScreen';
import { SuspendedAccountScreen } from './src/screens/SuspendedAccountScreen';

// Equipo clínico
import { StaffTabs } from './src/navigation/StaffTabs';

// Quién puede entrar por el teléfono. El familiar queda fuera porque su portal es una app
// web aparte, sin ninguna pantalla acá. El **coordinador** también queda fuera, y no por
// criterio de producto: el backend no lo atiende. `GET /psychologists/:id` responde 404
// para él - filtra por `role: 'psychologist'` - así que se queda sin sedes, y
// `assertPsychologist` le cierra la moderación con 403. Entraría a una app rota. Para
// sumarlo hay que arreglar esos dos endpoints primero.
const ROLES_EN_LA_APP: AuthUser['role'][] = ['patient', 'psychologist'];

function esEquipoClínico(rol: AuthUser['role']): boolean {
  return rol === 'psychologist';
}

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{
      headerShown: false,
      animation: 'slide_from_right',
      animationDuration: 280,
    }}>
      <AuthStack.Screen name="Welcome" component={WelcomeScreen} />
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="SelectInstitution" component={SelectInstitutionScreen} />
      <AuthStack.Screen name="RegisterStep1" component={RegisterStep1Screen} />
      <AuthStack.Screen name="RegisterIntake" component={RegisterIntakeScreen} />
      <AuthStack.Screen name="RegisterStep2" component={RegisterStep2Screen} />
      <AuthStack.Screen name="RequestSent" component={RequestSentScreen} />
      <AuthStack.Screen name="Payment" component={PaymentScreen} />
    </AuthStack.Navigator>
  );
}

function AppNavigator() {
  return (
    <AppStack.Navigator screenOptions={{
      headerShown: false,
      animation: 'fade',
      animationDuration: 220,
    }}>
      {/* Las cuatro secciones de la barra viven acá dentro para poder cambiarse
          deslizando; el asistente, el pánico y la cuenta suspendida siguen siendo
          pantallas del stack, encima de las pestañas. */}
      <AppStack.Screen name="MainTabs" component={MainTabs} />
      <AppStack.Screen name="Notifications" component={NotificationsScreen} />
      <AppStack.Screen name="Assistant" component={AssistantScreen} />
      <AppStack.Screen name="Panic" component={PanicScreen} options={{ animation: 'slide_from_bottom', animationDuration: 320 }} />
      <AppStack.Screen name="SuspendedAccount" component={SuspendedAccountScreen} />
    </AppStack.Navigator>
  );
}

export default function App() {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  // Hasta que se lee la sesión guardada no se sabe qué navegador mostrar. Sin esto, quien
  // ya tenía sesión veía Bienvenida por un instante antes de saltar a Inicio.
  const [cargandoSesion, setCargandoSesion] = React.useState(true);

  React.useEffect(() => {
    session.load().then((guardado) => {
      setUser(guardado);
      setCargandoSesion(false);
    });
    // El cliente HTTP avisa acá cuando el refresh token dejó de servir
    session.onSessionExpired(() => setUser(null));
  }, []);

  const signIn = React.useCallback(async (email: string, password: string): Promise<LoginError | null> => {
    try {
      // Estado de módulo del cliente: es del paciente anterior
      resetRelapseDetection();
      const data = await api.login(email, password);
      // El backend no filtra por rol en /auth/login: la web decide en su pantalla de
      // acceso y acá hacemos lo mismo. En el teléfono entran el paciente y el equipo
      // clínico, cada uno a su app; el familiar sigue siendo solo del portal web.
      if (!ROLES_EN_LA_APP.includes(data.user.role)) {
        await api.logout();
        return 'rol';
      }
      // Lo que quedó guardado de otra cuenta en este teléfono ya no lo va a leer nadie.
      void podarCachésDeOtrasCuentas(data.user.id);
      setUser(data.user);
      return null;
    } catch (err) {
      const msg = (err as Error).message ?? '';
      if (isNetworkError(err)) return 'red';
      // `request()` lanza "<status> <cuerpo>"
      if (msg.startsWith('403')) return 'suspendida';
      if (msg.startsWith('401')) return 'credenciales';
      return 'red';
    }
  }, []);

  const signOut = React.useCallback(() => {
    void api.logout();
    resetRelapseDetection();
    setUser(null);
  }, []);

  return (
    // Hasta ahora no había SafeAreaProvider propio: los insets venían del que monta
    // React Navigation dentro de cada navegador. El aviso pasajero vive por fuera, así
    // que necesita uno en la raíz.
    <SafeAreaProvider>
      {/* El tema va lo más arriba posible: el aviso pasajero y las pantallas lo leen */}
      <ThemeProvider>
        <AuthContext.Provider value={{ user, signIn, signOut }}>
          <ToastProvider>
            <DialogProvider>
              <NavigationContainer>
                {cargandoSesion ? null
                  : !user ? <AuthNavigator />
                  : esEquipoClínico(user.role) ? <StaffTabs />
                  : <AppNavigator />}
              </NavigationContainer>
            </DialogProvider>
          </ToastProvider>
        </AuthContext.Provider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
