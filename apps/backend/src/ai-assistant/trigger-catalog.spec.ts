import { classifyTrigger, isTriggerCategory } from './trigger-catalog';

describe('classifyTrigger', () => {
  it.each([
    ['me pagaron el sueldo y quiero apostarlo', 'money'],
    ['hoy me llegó el finiquito', 'money'],
    ['me salió un anuncio de un casino con un bono', 'temptation'],
    ['esta noche juega Chile el partido', 'sports'],
    ['tengo mucha ansiedad', 'emotions'],
    ['me siento sola y aburrida', 'loneliness'],
    ['pelee con mi pareja', 'family'],
    ['mi jefe me reto en la pega', 'work'],
  ])('«%s» → %s', (texto, categoria) => {
    expect(classifyTrigger(texto)).toBe(categoria);
  });

  it('no distingue tildes ni mayúsculas', () => {
    expect(classifyTrigger('DISCUSIÓN con mi FAMILIA')).toBe('family');
  });

  it('un saludo cae en other', () => {
    expect(classifyTrigger('hola, gracias')).toBe('other');
    expect(classifyTrigger('')).toBe('other');
  });

  it('gana la categoría con más coincidencias', () => {
    expect(classifyTrigger('el partido, la liga y el mundial, y algo de plata')).toBe('sports');
  });

  it('con empate gana la primera del catálogo', () => {
    // una coincidencia de dinero y una de trabajo: dinero va antes
    expect(classifyTrigger('plata del trabajo')).toBe('money');
  });
});

describe('isTriggerCategory', () => {
  it('acepta solo valores del catálogo', () => {
    expect(isTriggerCategory('money')).toBe(true);
    expect(isTriggerCategory('dinero')).toBe(false);
    expect(isTriggerCategory(null)).toBe(false);
  });
});
