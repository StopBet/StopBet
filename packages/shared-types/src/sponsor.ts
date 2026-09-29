// HdU20/HdU21: designación y asignación de padrinos.
//
// El rol de padrino no está en `UserRole` porque se suma al de paciente en vez de
// reemplazarlo — ver `sponsor-designation.entity.ts` en el backend.

/** CA21.2 y CA20.2: alguien que aparece en una lista para elegir. */
export interface SponsorCandidate {
  id: string;
  firstName: string;
  lastName: string;
  sedeId: string | null;
}

/** CA21.1: la designación con su autoría clínica, para auditoría. */
export interface SponsorDesignationDto {
  id: string;
  patientId: string;
  patientName: string;
  designatedBy: string;
  designatedByName: string;
  designatedAt: string;
  isActive: boolean;
  revokedAt: string | null;
}

/**
 * CA21.3: un compañero de viaje con cuántas personas acompaña hoy.
 *
 * La carga viaja junto al listado a propósito: si la pantalla no la supiera, el psicólogo
 * se enteraría de que no puede revocar recién al apretar el botón y recibir un 409.
 */
export interface SponsorWithLoad {
  id: string;
  firstName: string;
  lastName: string;
  designatedByName: string;
  designatedAt: string;
  assignedPatients: number;
}
