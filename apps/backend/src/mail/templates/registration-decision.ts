import { MailMessage } from '../mail.service';
import { emailLayout, escapeHtml, paragraph } from './layout';

const FOOTER = 'Recibes este correo porque solicitaste ingresar al programa de AJUTER en StopBet.';

interface DecisionBase {
  to: string;
  firstName: string;
}

export interface RegistrationApprovedData extends DecisionBase {
  psychologistName: string;
  /**
   * Enlace de un solo uso para crear la contraseña. Todavía no existe esa historia: mientras
   * falte, el correo avisa que llegará más adelante en vez de enlazar a una página muerta.
   */
  activationUrl?: string;
}

export interface RegistrationRejectedData extends DecisionBase {
  /** Canal de AJUTER para el paciente (`AJUTER_CONTACTO`). Sin él no se inventa ninguno. */
  contact?: string;
}

export function registrationApprovedEmail(data: RegistrationApprovedData): MailMessage {
  const { to, firstName, psychologistName, activationUrl } = data;

  const siguiente = activationUrl
    ? `Para entrar a la aplicación, crea tu contraseña en este enlace: ${activationUrl}`
    : 'En un próximo mensaje recibirás el enlace para crear tu contraseña y entrar a la aplicación.';

  const text = [
    `Hola ${firstName},`,
    '',
    'El equipo de AJUTER aprobó tu solicitud de ingreso. Te damos la bienvenida.',
    '',
    `Tu psicólogo o psicóloga asignado es ${psychologistName}.`,
    '',
    siguiente,
    'Después, inicia sesión en la aplicación de StopBet y realiza el pago mensual para dejar tu cuenta activa.',
    '',
    '— StopBet · AJUTER',
  ].join('\n');

  const paso = activationUrl
    ? `Para entrar a la aplicación, <a href="${escapeHtml(activationUrl)}" style="color:#396fb6;font-weight:bold;">crea tu contraseña aquí</a>.`
    : 'En un próximo mensaje recibirás el enlace para crear tu contraseña y entrar a la aplicación.';

  const html = emailLayout(
    'Tu solicitud fue aprobada',
    [
      paragraph(`Hola ${escapeHtml(firstName)},`),
      paragraph('El equipo de AJUTER aprobó tu solicitud de ingreso. Te damos la bienvenida.'),
      `      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f4f4e9;border-radius:10px;padding:16px;margin-bottom:20px;">
        <tr><td style="padding:4px 12px;font-size:13px;color:#6b6a6a;">Tu psicólogo o psicóloga asignado</td></tr>
        <tr><td style="padding:0 12px 4px;font-size:17px;font-weight:bold;color:#396fb6;">${escapeHtml(psychologistName)}</td></tr>
      </table>`,
      paragraph(paso),
      paragraph(
        'Después, inicia sesión en la aplicación de StopBet y realiza el pago mensual para dejar tu cuenta activa.',
      ),
    ].join('\n'),
    FOOTER,
  );

  return { to, subject: 'Tu solicitud de ingreso fue aprobada', text, html };
}

export function registrationRejectedEmail(data: RegistrationRejectedData): MailMessage {
  const { to, firstName, contact } = data;

  const contacto = `Si quieres conocer más detalles o volver a intentarlo, comunícate con AJUTER${
    contact ? ` en ${contact}` : ''
  }.`;

  const text = [
    `Hola ${firstName},`,
    '',
    'Revisamos tu solicitud de ingreso y por ahora no pudimos aprobarla.',
    '',
    contacto,
    'Si en la conversación se acuerda revisarla otra vez, la reabriremos y te avisaremos.',
    '',
    '— StopBet · AJUTER',
  ].join('\n');

  const html = emailLayout(
    'Sobre tu solicitud de ingreso',
    [
      paragraph(`Hola ${escapeHtml(firstName)},`),
      paragraph('Revisamos tu solicitud de ingreso y por ahora no pudimos aprobarla.'),
      paragraph(escapeHtml(contacto)),
      paragraph(
        'Si en la conversación se acuerda revisarla otra vez, la reabriremos y te avisaremos.',
      ),
    ].join('\n'),
    FOOTER,
  );

  return { to, subject: 'Sobre tu solicitud de ingreso a StopBet', text, html };
}

export function registrationReopenedEmail(data: DecisionBase): MailMessage {
  const { to, firstName } = data;

  const text = [
    `Hola ${firstName},`,
    '',
    'AJUTER reabrió tu solicitud de ingreso: volvió a revisión.',
    '',
    'No tienes que hacer nada. Te avisaremos por este mismo medio cuando haya una respuesta.',
    '',
    '— StopBet · AJUTER',
  ].join('\n');

  const html = emailLayout(
    'Tu solicitud volvió a revisión',
    [
      paragraph(`Hola ${escapeHtml(firstName)},`),
      paragraph('AJUTER reabrió tu solicitud de ingreso: volvió a revisión.'),
      paragraph(
        'No tienes que hacer nada. Te avisaremos por este mismo medio cuando haya una respuesta.',
      ),
    ].join('\n'),
    FOOTER,
  );

  return { to, subject: 'Tu solicitud de ingreso volvió a revisión', text, html };
}
