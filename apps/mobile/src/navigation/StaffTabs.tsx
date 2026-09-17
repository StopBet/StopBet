import React from 'react';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import type { MaterialTopTabBarProps } from '@react-navigation/material-top-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StaffBottomNav, type StaffTab } from '../components/StaffBottomNav';
import { StaffHomeScreen } from '../screens/staff/StaffHomeScreen';
import { StaffCommunityScreen } from '../screens/staff/StaffCommunityScreen';
import { StaffProfileScreen } from '../screens/staff/StaffProfileScreen';
import { NewAnnouncementScreen } from '../screens/staff/NewAnnouncementScreen';
import { SedeProvider } from '../context/SedeContext';
import { api } from '../services/api';
import { isToday, needsAttention } from '../utils/staff';
import type { StaffStackParamList, StaffTabsParamList } from './types';

const Tabs = createMaterialTopTabNavigator<StaffTabsParamList>();
const Stack = createNativeStackNavigator<StaffStackParamList>();

// El orden manda el gesto: deslizar hacia la izquierda avanza en esta lista.
const TAB_ORDER: StaffTab[] = ['summary', 'community', 'profile'];
const ROUTE_BY_TAB: Record<StaffTab, keyof StaffTabsParamList> = {
  summary: 'Summary',
  community: 'StaffCommunity',
  profile: 'StaffProfile',
};

const REFRESH_MS = 60_000;

function TabBar({ state, navigation }: MaterialTopTabBarProps) {
  const active = TAB_ORDER[state.index] ?? 'summary';
  const [sinAtender, setSinAtender] = React.useState(0);

  // El contador vive en la barra y no en la pantalla de Resumen: si viviera ahí, un
  // psicólogo que se queda en Comunidad no se enteraría de una alerta nueva.
  React.useEffect(() => {
    let vivo = true;
    const contar = () => {
      api.getStaffAlerts()
        .then((alertas) => {
          if (!vivo) return;
          setSinAtender(alertas.filter((a) => isToday(a.createdAt) && needsAttention(a.status)).length);
        })
        // El número es un aviso, no la pantalla: si falla, se queda con el último
        .catch(() => {});
    };
    contar();
    const id = setInterval(contar, REFRESH_MS);
    return () => { vivo = false; clearInterval(id); };
  }, []);

  return (
    <StaffBottomNav
      active={active}
      alertasSinAtender={sinAtender}
      onTabPress={(tab) => navigation.navigate(ROUTE_BY_TAB[tab])}
    />
  );
}

function StaffPager() {
  return (
    <Tabs.Navigator
      tabBarPosition="bottom"
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ lazy: true }}
    >
      <Tabs.Screen name="Summary" component={StaffHomeScreen} />
      <Tabs.Screen name="StaffCommunity" component={StaffCommunityScreen} />
      <Tabs.Screen name="StaffProfile" component={StaffProfileScreen} />
    </Tabs.Navigator>
  );
}

/**
 * La app del equipo clínico: un resumen para mirar rápido y la comunidad de la sede.
 * No monta el stack del paciente - pánico, asistente, check-in - porque nada de eso
 * significa algo en la sesión de un psicólogo.
 */
export function StaffTabs() {
  return (
    <SedeProvider>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="StaffTabs" component={StaffPager} />
        <Stack.Screen name="NewAnnouncement" component={NewAnnouncementScreen} />
      </Stack.Navigator>
    </SedeProvider>
  );
}
