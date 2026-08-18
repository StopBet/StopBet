import { randomBytes } from 'crypto';
import { encryptedColumnTransformer } from './encrypted-column.transformer';

describe('encryptedColumnTransformer', () => {
  const originalKey = process.env.ENCRYPTION_KEY;

  beforeAll(() => {
    // Clave de prueba generada en runtime (32 bytes) — nunca hardcodear un hex a mano,
    // un solo caracter de menos rompe la validación de longitud de forma no obvia.
    process.env.ENCRYPTION_KEY = randomBytes(32).toString('hex');
  });

  afterAll(() => {
    process.env.ENCRYPTION_KEY = originalKey;
  });

  it('cifra y descifra de vuelta al valor original (S.6)', () => {
    const rut = '12.345.678-9';
    const stored = encryptedColumnTransformer.to(rut);
    expect(stored).not.toBe(rut);
    expect(stored).not.toContain(rut);
    expect(encryptedColumnTransformer.from(stored)).toBe(rut);
  });

  it('el ciphertext no es determinístico (IV aleatorio en cada escritura)', () => {
    const rut = '12.345.678-9';
    const first = encryptedColumnTransformer.to(rut);
    const second = encryptedColumnTransformer.to(rut);
    expect(first).not.toBe(second);
    expect(encryptedColumnTransformer.from(first)).toBe(rut);
    expect(encryptedColumnTransformer.from(second)).toBe(rut);
  });

  it('preserva null', () => {
    expect(encryptedColumnTransformer.to(null)).toBeNull();
    expect(encryptedColumnTransformer.from(null)).toBeNull();
  });

  it('devuelve texto plano legado (sin formato iv:authTag:ciphertext) tal cual', () => {
    const legacyPlaintext = '12.345.678-9';
    expect(encryptedColumnTransformer.from(legacyPlaintext)).toBe(legacyPlaintext);
  });

  it('lanza un error claro si ENCRYPTION_KEY no está configurada', () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => encryptedColumnTransformer.to('12.345.678-9')).toThrow(/ENCRYPTION_KEY/);
  });
});
