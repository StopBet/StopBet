// S.3 — excluye nombre y RUT del texto antes de enviarlo al LLM.
// Este archivo lo conecta Matías Barraza en ai-assistant.service.ts.

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function sanitizePii(
  text: string,
  user?: { firstName?: string; lastName?: string },
): string {
  // RUT chileno: 12.345.678-9 o 12345678-9 (dígito verificador k/K incluido)
  let sanitized = text.replace(/\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/gi, '[RUT OMITIDO]');

  if (user?.firstName?.trim()) {
    sanitized = sanitized.replace(
      new RegExp(escapeRegex(user.firstName.trim()), 'gi'),
      '[NOMBRE OMITIDO]',
    );
  }
  if (user?.lastName?.trim()) {
    sanitized = sanitized.replace(
      new RegExp(escapeRegex(user.lastName.trim()), 'gi'),
      '[NOMBRE OMITIDO]',
    );
  }

  return sanitized;
}
