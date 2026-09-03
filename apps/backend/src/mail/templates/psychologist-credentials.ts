import { MailMessage } from '../mail.service';

export interface PsychologistCredentials {
  to: string;
  firstName: string;
  temporaryPassword: string;
  loginUrl: string;
}

// El nombre viene del formulario del coordinador, así que llega sin sanear al cuerpo HTML.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Correo de CA24.1. Se mantiene deliberadamente sobrio —sin imágenes, sin enlaces acortados
 * y con alternativa en texto plano— porque son justo los rasgos que empujan un correo
 * transaccional a la carpeta de spam.
 */
export function psychologistCredentialsEmail(data: PsychologistCredentials): MailMessage {
  const { to, firstName, temporaryPassword, loginUrl } = data;

  const text = [
    `Hola ${firstName},`,
    '',
    'Tu cuenta de psicólogo en StopBet ya está creada. Estas son tus credenciales de acceso:',
    '',
    `  Correo: ${to}`,
    `  Contraseña temporal: ${temporaryPassword}`,
    '',
    `Ingresa en ${loginUrl} y cambia esta contraseña la primera vez que entres.`,
    '',
    'Si no esperabas este correo, avísale al coordinador que creó la cuenta.',
    '',
    '— StopBet · AJUTER',
  ].join('\n');

  const html = `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:24px;background:#f4f4e9;font-family:Helvetica,Arial,sans-serif;color:#3a3939;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <h1 style="margin:0 0 20px;font-size:20px;color:#396fb6;">Tu cuenta en StopBet está lista</h1>

      <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Hola ${escapeHtml(firstName)},</p>

      <p style="margin:0 0 20px;font-size:15px;line-height:1.5;">
        El coordinador de AJUTER creó tu cuenta de psicólogo. Estas son tus credenciales de acceso:
      </p>

      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f4f4e9;border-radius:10px;padding:16px;margin-bottom:24px;">
        <tr>
          <td style="padding:4px 12px;font-size:13px;color:#6b6a6a;">Correo</td>
        </tr>
        <tr>
          <td style="padding:0 12px 12px;font-size:15px;font-weight:bold;">${escapeHtml(to)}</td>
        </tr>
        <tr>
          <td style="padding:4px 12px;font-size:13px;color:#6b6a6a;">Contraseña temporal</td>
        </tr>
        <tr>
          <td style="padding:0 12px 4px;font-size:17px;font-weight:bold;color:#396fb6;font-family:monospace;">${escapeHtml(temporaryPassword)}</td>
        </tr>
      </table>

      <p style="margin:0 0 24px;font-size:15px;line-height:1.5;">
        <a href="${escapeHtml(loginUrl)}" style="color:#396fb6;font-weight:bold;">Ingresa al panel</a>
        y cambia esta contraseña la primera vez que entres.
      </p>

      <p style="margin:0;padding-top:20px;border-top:1px solid #e5e5da;font-size:13px;color:#6b6a6a;line-height:1.5;">
        Si no esperabas este correo, avísale al coordinador que creó la cuenta.<br />
        StopBet · AJUTER
      </p>
    </div>
  </body>
</html>`;

  return { to, subject: 'Tus credenciales de acceso a StopBet', text, html };
}
