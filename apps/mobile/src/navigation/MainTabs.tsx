import React from 'react';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import type { MaterialTopTabBarProps } from '@react-navigation/material-top-tabs';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomNav, type NavTab } from '../components/BottomNav';
import { HomeScreen } from '../screens/HomeScreen';
import { CommunityScreen } from '../screens/CommunityScreen';
import { AchievementsScreen } from '../screens/AchievementsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import type { AppStackParamList, MainTabsParamList } from './types';

const Tabs = createMaterialTopTabNavigator<MainTabsParamList>();

// El orden manda el gesto: deslizar hacia la izquierda avanza en esta lista.
// Pánico queda fuera a propósito - a la pantalla de crisis se entra apretando,
// nunca por un deslizamiento accidental.
const TAB_ORDER: NavTab[] = ['home', 'community', 'achievements', 'profile'];
const ROUTE_BY_TAB: Record<NavTab, keyof MainTabsParamList> = {
  home: 'Home',
  community: 'Community',
  achievements: 'Achievements',
  profile: 'Profile',
};

/**
 * La barra inferior vivía repetida dentro de las cuatro pantallas, cada una con su
 * propio `handleTabPress`. Ahora la dibuja el navegador una sola vez y las pantallas
 * solo se ocupan de su contenido.
 */
function TabBar({ state, navigation }: MaterialTopTabBarProps) {
  const stack = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const active = TAB_ORDER[state.index] ?? 'home';

  return (
    <BottomNav
      active={active}
      onTabPress={(tab) => navigation.navigate(ROUTE_BY_TAB[tab])}
      onPanicPress={() => stack.navigate('Panic')}
    />
  );
}

export function MainTabs() {
  return (
    <Tabs.Navigator
      tabBarPosition="bottom"
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        // Sin esto, entrar a Comunidad o Logros los deja montados para siempre y el
        // check-in de Inicio no se vuelve a consultar al volver.
        lazy: true,
      }}
    >
      <Tabs.Screen name="Home" component={HomeScreen} />
      <Tabs.Screen name="Community" component={CommunityScreen} />
      <Tabs.Screen name="Achievements" component={AchievementsScreen} />
      <Tabs.Screen name="Profile" component={ProfileScreen} />
    </Tabs.Navigator>
  );
}
