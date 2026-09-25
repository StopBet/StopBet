import type { IntakeAnswers } from '@stopbet/shared-types';
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
  RegisterIntake: { institutionId: string; basicData: BasicRegistrationData };
  RegisterStep2: {
    institutionId: string;
    basicData: BasicRegistrationData;
    // Opcional: el paciente puede saltarse el cuestionario de ingreso (HdU13).
    intake?: IntakeAnswers;
  };
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

/**
 * Las tres secciones del equipo clínico. Mismo gesto de deslizar que el paciente, con
 * otro contenido: acá no hay pánico, ni check-in, ni logros.
 */
export type StaffTabsParamList = {
  Summary: undefined;
  StaffCommunity: undefined;
  StaffProfile: undefined;
};

/**
 * El redactor de anuncios va en el stack y no dentro de la pestaña: abrir el teclado sobre
 * el pager lo rearma en la primera página y remonta la pantalla, así que un modal hijo de
 * Comunidad se cerraba con el anuncio a medio escribir.
 */
export type StaffStackParamList = {
  StaffTabs: NavigatorScreenParams<StaffTabsParamList> | undefined;
  NewAnnouncement: { sedeNombre: string };
};

export type AppStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabsParamList> | undefined;
  Notifications: undefined;
  Assistant: undefined;
  Panic: undefined;
  SuspendedAccount: undefined;
};
