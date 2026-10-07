import {
  registrationApprovedEmail,
  registrationRejectedEmail,
  registrationReopenedEmail,
} from './registration-decision';

const base = { to: 'ana@ejemplo.cl', firstName: 'Ana' };

describe('correos de la decisión sobre la solicitud', () => {
  // Sin alternativa en texto plano el correo puntúa peor en los filtros de spam.
  it('ninguno sale solo-HTML', () => {
    const correos = [
      registrationApprovedEmail({ ...base, psychologistName: 'Camila Soto' }),
      registrationRejectedEmail(base),
      registrationReopenedEmail(base),
    ];
    for (const mail of correos) {
      expect(mail.text.length).toBeGreaterThan(0);
      expect(mail.text).not.toContain('<');
      expect(mail.to).toBe(base.to);
      expect(mail.subject).toBeTruthy();
    }
  });

  it('el nombre y el psicólogo se escapan para que no inyecten marcado', () => {
    const mail = registrationApprovedEmail({
      ...base,
      firstName: '<script>alert(1)</script>',
      psychologistName: '<b>x</b>',
    });

    expect(mail.html).not.toContain('<script>');
    expect(mail.html).not.toContain('<b>x</b>');
    expect(mail.html).toContain('&lt;script&gt;');
  });

  it('aprobada sin enlace avisa que llegará después, en vez de enlazar a la nada', () => {
    const mail = registrationApprovedEmail({ ...base, psychologistName: 'Camila Soto' });

    expect(mail.html).not.toContain('<a ');
    expect(mail.text).toContain('próximo mensaje');
  });

  it('aprobada con enlace lo incluye en las dos versiones', () => {
    const url = 'https://app.ejemplo.cl/activar?token=abc';
    const mail = registrationApprovedEmail({
      ...base,
      psychologistName: 'Camila Soto',
      activationUrl: url,
    });

    expect(mail.text).toContain(url);
    expect(mail.html).toContain(`href="${url}"`);
  });
});
