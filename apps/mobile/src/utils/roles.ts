import type { UserRole } from '@stopbet/shared-types';

/**
 * El rol en pantalla, en el vocabulario de AJUTER: el programa dice «compañero de viaje»,
 * no «padrino». El rol en base de datos y en los tipos sigue siendo `sponsor`.
 */
export const ROLE_LABEL: Record<UserRole, string> = {
  patient: 'Paciente',
  psychologist: 'Psicólogo',
  sponsor: 'Compañero de viaje',
  family: 'Familiar',
  coordinator: 'Coordinador',
};

/**
 * En el foro conviene distinguir quién escribe desde el equipo clínico: una respuesta del
 * psicólogo no se lee igual que la de un par, y sin la etiqueta es un nombre más.
 */
export function esEquipoClínico(role: UserRole): boolean {
  return role === 'psychologist' || role === 'coordinator';
}
