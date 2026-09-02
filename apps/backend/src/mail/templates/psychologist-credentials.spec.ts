import { psychologistCredentialsEmail } from './psychologist-credentials';

const base = {
  to: 'fernanda.fuentes@ajuter.cl',
  firstName: 'Fernanda',
  temporaryPassword: 'Ab3-xY7_pQ9z',
  loginUrl: 'https://panel.stopbet.cl',
};

describe('psychologistCredentialsEmail', () => {
  it('lleva las credenciales y el enlace en las dos versiones del cuerpo', () => {
    const mail = psychologistCredentialsEmail(base);

    for (const cuerpo of [mail.text, mail.html]) {
      expect(cuerpo).toContain(base.temporaryPassword);
      expect(cuerpo).toContain(base.to);
      expect(cuerpo).toContain(base.loginUrl);
      expect(cuerpo).toContain('Fernanda');
    }
    expect(mail.to).toBe(base.to);
    expect(mail.subject).toBeTruthy();
  });

  // Sin alternativa en texto plano el correo puntúa peor en los filtros de spam, que es
  // justo el problema que este envío no puede permitirse.
  it('nunca sale solo-HTML', () => {
    const mail = psychologistCredentialsEmail(base);
    expect(mail.text.length).toBeGreaterThan(0);
    expect(mail.text).not.toContain('<');
  });

  // El nombre lo escribe el coordinador en un formulario: llega sin sanear hasta el HTML.
  it('escapa el nombre para que no inyecte marcado', () => {
    const mail = psychologistCredentialsEmail({
      ...base,
      firstName: '<script>alert(1)</script>',
    });

    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
  });
});
