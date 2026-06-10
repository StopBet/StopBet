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

export type AppStackParamList = {
  Home: undefined;
  Assistant: undefined;
  Community: undefined;
  Achievements: undefined;
  Profile: undefined;
  Panic: undefined;
  SuspendedAccount: undefined;
};
