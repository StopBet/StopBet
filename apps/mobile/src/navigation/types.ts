import type { NavigatorScreenParams } from '@react-navigation/native';

// Parámetros de navegación para los stacks de auth y app principal

export interface BasicRegistrationData {
  firstName: string;
  lastName: string;
  rut: string;
  email: string;
  phone: string;
  birthDate: string;
  address: string;
  referralSource: string;
}

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  SelectInstitution: undefined;
  RegisterStep1: { institutionId: string };
  RegisterStep2: { institutionId: string; basicData: BasicRegistrationData };
  RequestSent: { requestId: string; email: string };
  Payment: { userId: string; requestId: string };
};

/**
 * Las cuatro secciones de la barra inferior. Están en un navegador de pestañas y no
 * en el stack para que se pueda cambiar de sección deslizando, no solo tocando.
 */
export type MainTabsParamList = {
  Home: undefined;
  Community: { initialTab?: 'announcements' | 'forum'; draft?: string } | undefined;
  Achievements: undefined;
  Profile: undefined;
};

export type AppStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabsParamList> | undefined;
  Assistant: undefined;
  Panic: undefined;
  SuspendedAccount: undefined;
};
