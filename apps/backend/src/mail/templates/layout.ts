// El nombre y los demás datos llegan de formularios: nunca pasan sin escapar al HTML.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Carcasa común de los correos de StopBet: mismo fondo crema, tarjeta blanca y pie que el
 * correo de credenciales del psicólogo. Sigue sobria a propósito —sin imágenes ni enlaces
 * acortados— porque son los rasgos que empujan un correo transaccional a spam.
 */
export function emailLayout(title: string, bodyHtml: string, footerNote: string): string {
  return `<!doctype html>
<html lang="es">
  <head><meta charset="utf-8" /></head>
  <body style="margin:0;padding:24px;background:#f4f4e9;font-family:Helvetica,Arial,sans-serif;color:#3a3939;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <h1 style="margin:0 0 20px;font-size:20px;color:#396fb6;">${escapeHtml(title)}</h1>
${bodyHtml}
      <p style="margin:0;padding-top:20px;border-top:1px solid #e5e5da;font-size:13px;color:#6b6a6a;line-height:1.5;">
        ${escapeHtml(footerNote)}<br />
        StopBet · AJUTER
      </p>
    </div>
  </body>
</html>`;
}

export function paragraph(html: string): string {
  return `      <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">${html}</p>`;
}
