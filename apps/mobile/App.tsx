import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AppStackParamList, AuthStackParamList } from './src/navigation/types';
import { AuthContext } from './src/context/AuthContext';

// Auth screens
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { SelectInstitutionScreen } from './src/screens/SelectInstitutionScreen';
import { RegisterStep1Screen } from './src/screens/RegisterStep1Screen';
import { RegisterStep2Screen } from './src/screens/RegisterStep2Screen';
import { RequestSentScreen } from './src/screens/RequestSentScreen';
import { PaymentScreen } from './src/screens/PaymentScreen';

// App screens
import { HomeScreen } from './src/screens/HomeScreen';
import { AssistantScreen } from './src/screens/AssistantScreen';
import { AchievementsScreen } from './src/screens/AchievementsScreen';
import { PanicScreen } from './src/screens/PanicScreen';
import { SuspendedAccountScreen } from './src/screens/SuspendedAccountScreen';
import { CommunityScreen } from './src/screens/CommunityScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';

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
      <AppStack.Screen name="Home" component={HomeScreen} />
      <AppStack.Screen name="Assistant" component={AssistantScreen} />
      <AppStack.Screen name="Community" component={CommunityScreen} />
      <AppStack.Screen name="Achievements" component={AchievementsScreen} />
      <AppStack.Screen name="Profile" component={ProfileScreen} />
      <AppStack.Screen name="Panic" component={PanicScreen} options={{ animation: 'slide_from_bottom', animationDuration: 320 }} />
      <AppStack.Screen name="SuspendedAccount" component={SuspendedAccountScreen} />
    </AppStack.Navigator>
  );
}

export default function App() {
  // TODO(auth): reemplazar con estado real de sesión (JWT) cuando auth esté implementado
  // TODO(auth): reemplazar con false cuando auth esté implementado
  const [isSignedIn, setIsSignedIn] = React.useState(true);

  return (
    <AuthContext.Provider value={{ signIn: () => setIsSignedIn(true) }}>
      <NavigationContainer>
        {isSignedIn ? <AppNavigator /> : <AuthNavigator />}
      </NavigationContainer>
    </AuthContext.Provider>
  );
}
