import { JUEGOS_DEMO, correosDeJuego, seleccionarBorrables } from './familiares-demo';

describe('limpieza de las cuentas de familiar de la demo', () => {
  it('cada juego tiene sus cuatro correos y no se repiten entre juegos', () => {
    const todos = JUEGOS_DEMO.flatMap(correosDeJuego);
    expect(todos).toHaveLength(8);
    expect(new Set(todos).size).toBe(8);
    expect(correosDeJuego(1)).toContain('familiar.uno.juego1@correo.cl');
    expect(correosDeJuego(2)).toContain('intento.repetido.juego2@correo.cl');
  });

  it('solo borra familiares con un correo de la guía', () => {
    const usuarios = [
      { email: 'familiar.uno.juego1@correo.cl', role: 'family' },
      { email: 'FAMILIAR.DOS.JUEGO1@CORREO.CL', role: 'family' },
      { email: 'otro.familiar@correo.cl', role: 'family' },
    ];
    expect(seleccionarBorrables(usuarios, correosDeJuego(1)).map((u) => u.email)).toEqual([
      'familiar.uno.juego1@correo.cl',
      'FAMILIAR.DOS.JUEGO1@CORREO.CL',
    ]);
  });

  it('nunca borra a alguien que no es familiar, aunque el correo coincida', () => {
    const usuarios = [
      { email: 'familiar.uno.juego1@correo.cl', role: 'patient' },
      { email: 'familiar.dos.juego1@correo.cl', role: 'psychologist' },
      { email: 'familiar.tres.juego1@correo.cl', role: 'coordinator' },
    ];
    expect(seleccionarBorrables(usuarios, correosDeJuego(1))).toEqual([]);
  });

  it('no borra cuentas de otro juego si se pidió uno solo', () => {
    const usuarios = [{ email: 'familiar.uno.juego2@correo.cl', role: 'family' }];
    expect(seleccionarBorrables(usuarios, correosDeJuego(1))).toEqual([]);
  });
});
