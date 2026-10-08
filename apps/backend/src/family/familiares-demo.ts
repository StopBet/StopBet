// Cuentas de familiar que se crean a mano durante la demo de las HDU 22 y 23, siguiendo la guía de
// criterios (artefacto «Cuentas de prueba HDU 22-23»). La guía trae dos juegos de datos fijos; cada
// cuenta solo se puede registrar una vez, así que después de una demo hay que borrarlas para que la
// misma guía vuelva a servir. Si cambian los correos de la guía, cambian acá.

export const JUEGOS_DEMO = [1, 2] as const;
export type JuegoDemo = (typeof JUEGOS_DEMO)[number];

export function correosDeJuego(juego: JuegoDemo): string[] {
  return [
    `familiar.uno.juego${juego}@correo.cl`,
    `familiar.dos.juego${juego}@correo.cl`,
    `familiar.tres.juego${juego}@correo.cl`,
    // El CA3 de la HDU 22 lo usa para provocar «ya existe una cuenta»: no debería llegar a crearse,
    // pero si alguien se equivoca de datos en la demo, también se limpia.
    `intento.repetido.juego${juego}@correo.cl`,
  ];
}

/**
 * De los usuarios encontrados, los que de verdad se pueden borrar: rol familiar y uno de los
 * correos de la guía. Lo demás se ignora aunque el correo coincida, porque un paciente o un
 * psicólogo nunca debería caer en una limpieza de demo.
 */
export function seleccionarBorrables<T extends { email: string; role: string }>(
  usuarios: T[],
  correos: string[],
): T[] {
  const permitidos = new Set(correos.map((c) => c.toLowerCase()));
  return usuarios.filter((u) => u.role === 'family' && permitidos.has(u.email.trim().toLowerCase()));
}
