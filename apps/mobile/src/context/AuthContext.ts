import { createContext, useContext } from 'react';
import type { AuthUser } from '@stopbet/shared-types';

export type LoginError = 'credenciales' | 'suspendida' | 'rol' | 'red';

export interface AuthValue {
  /** Null mientras no haya sesión. Su `id` es el que usan todas las pantallas. */
  user: AuthUser | null;
  /** Devuelve null si entró; si no, el motivo, para poder decirlo en pantalla. */
  signIn: (email: string, password: string) => Promise<LoginError | null>;
  signOut: () => void;
}

export const AuthContext = createContext<AuthValue>({
  user: null,
  signIn: async () => 'red',
  signOut: () => {},
});

/**
 * El id del paciente con la sesión abierta.
 *
 * Reemplaza al `TEMP_USER_ID` que estaba fijo en siete pantallas y que hacía que toda
 * cuenta mostrara el progreso de Carlos Demo.
 */
export function useUserId(): string {
  const { user } = useContext(AuthContext);
  // Las pantallas del AppStack solo se montan con sesión abierta; si no hay usuario acá,
  // es un error de navegación y es mejor que se note en desarrollo que mandar peticiones
  // con un id vacío.
  return user?.id ?? '';
}

export function useCurrentUser(): AuthUser | null {
  return useContext(AuthContext).user;
}
