// Validador de RUT chileno (módulo 11). Usado por HdU06 (registro de pacientes)
// y HdU24 (creación de psicólogos).

export function cleanRut(rut: string): string {
  const trimmed = rut.replace(/[.\-\s]/g, '');
  if (trimmed.length === 0) return '';
  return trimmed.slice(0, -1) + trimmed.slice(-1).toUpperCase();
}

export function isValidRut(rut: string): boolean {
  const clean = cleanRut(rut);
  if (clean.length < 2) return false;

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);

  if (!/^\d+$/.test(body)) return false;
  if (!/^[0-9K]$/.test(dv)) return false;

  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = 11 - (sum % 11);
  const expectedDv = remainder === 11 ? '0' : remainder === 10 ? 'K' : String(remainder);

  return dv === expectedDv;
}

export function formatRut(rut: string): string {
  const clean = cleanRut(rut);
  if (clean.length < 2) return clean;

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);

  let formattedBody = '';
  for (let i = 0; i < body.length; i++) {
    const posFromEnd = body.length - i;
    formattedBody += body[i];
    if (posFromEnd > 1 && (posFromEnd - 1) % 3 === 0) {
      formattedBody += '.';
    }
  }

  return `${formattedBody}-${dv}`;
}
