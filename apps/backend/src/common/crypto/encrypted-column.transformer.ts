import { ValueTransformer } from 'typeorm';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // longitud recomendada de IV para GCM

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY no está configurada — requerida para cifrar datos sensibles');
  }
  const buffer = Buffer.from(key, 'hex');
  if (buffer.length !== 32) {
    throw new Error('ENCRYPTION_KEY debe ser una cadena hexadecimal de 64 caracteres (32 bytes)');
  }
  return buffer;
}

// Column transformer de TypeORM: cifra al escribir, descifra al leer.
// Formato almacenado: "iv:authTag:ciphertext" (los tres en hex).
// Datos escritos antes de habilitar este transformer (RUT en texto plano, sin ':')
// se devuelven tal cual en vez de fallar el parseo — evita romper datos de desarrollo
// previos a este cambio; se re-cifran solos la próxima vez que se guarden.
export const encryptedColumnTransformer: ValueTransformer = {
  to(value: string | null): string | null {
    if (value === null || value === undefined) return value;

    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
  },

  from(value: string | null): string | null {
    if (value === null || value === undefined) return value;

    const parts = value.split(':');
    if (parts.length !== 3) return value; // dato legado en texto plano

    const [ivHex, authTagHex, dataHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const data = Buffer.from(dataHex, 'hex');

    const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);

    return decrypted.toString('utf8');
  },
};
