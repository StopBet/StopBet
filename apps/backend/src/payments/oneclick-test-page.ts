// Página mínima para recorrer el sandbox de Webpay Oneclick (SPIKE 2 CA6) en un navegador.
//
// Vive en el backend y no en la web porque así es del mismo origen que la API (sin CORS), no
// toca las pantallas de nadie y funciona igual en local que en Railway. Solo se sirve con
// ENABLE_DEV_TOOLS=true. Helmet ya tiene la CSP desactivada (main.ts), así que el script inline corre.
//
// Es un .ts y no un .html para que `nest build` lo incluya sin configurar assets. El script no usa
// plantillas de texto con `${}` a propósito: este archivo ya es una.
export const ONECLICK_TEST_PAGE = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Webpay Oneclick · sandbox</title>
<style>
  :root { --bg:#f4f4e9; --card:#fff; --fg:#3a3939; --fg2:#6b6a6a; --primary:#396fb6; --border:#e2e2d6; --ok:#5b7324; --warn:#8a5a12; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--fg); font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif; }
  main { max-width:880px; margin:0 auto; padding:24px 16px 64px; display:flex; flex-direction:column; gap:16px; }
  h1 { margin:0; font-size:26px; }
  h2 { margin:0 0 8px; font-size:16px; }
  .aviso { background:#fbf3e2; color:var(--warn); border:1px solid var(--warn); border-radius:12px; padding:10px 14px; font-size:13.5px; }
  .card { background:var(--card); border:1px solid var(--border); border-radius:14px; padding:16px 18px; }
  .card p { margin:0 0 10px; color:var(--fg2); font-size:13.5px; }
  .row { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
  input { font:inherit; padding:8px 10px; border:1.5px solid var(--border); border-radius:10px; min-width:0; flex:1 1 180px; }
  button { font:inherit; font-weight:600; padding:9px 16px; border:0; border-radius:999px; background:var(--primary); color:#fff; cursor:pointer; }
  button.sec { background:transparent; color:var(--primary); border:1.5px solid var(--primary); }
  button:disabled { opacity:.45; cursor:not-allowed; }
  #sesion { font-weight:600; }
  #resultado { font-weight:600; margin-bottom:8px; }
  pre { margin:0; background:#1e2128; color:#e8e8e8; border-radius:12px; padding:12px 14px; font:12.5px/1.5 ui-monospace,Consolas,monospace; overflow:auto; max-height:420px; white-space:pre-wrap; word-break:break-word; }
</style>
</head>
<body>
<main>
  <h1>Webpay Oneclick · sandbox</h1>
  <div class="aviso">Ambiente de <strong>integración</strong> de Transbank: no se cobra dinero real. Tarjeta aprobada: VISA 4051 8856 0044 6623, CVV 123, cualquier vencimiento. En el banco: RUT 11.111.111-1, clave 123. Rechazada: Mastercard 5186 0595 5959 0568.</div>

  <section class="card">
    <h2>0. Sesión</h2>
    <p>Paciente para inscribir y cobrar; coordinación para el cobro automático y para consultar a Transbank.</p>
    <div class="row">
      <input id="email" type="email" placeholder="correo" autocomplete="username">
      <input id="password" type="password" placeholder="clave" autocomplete="current-password" value="Stopbet2026!">
      <button id="entrar">Entrar</button>
    </div>
    <div class="row" style="margin-top:8px">
      <button class="sec" data-email="demo@stopbet.cl">Paciente: Carlos Demo</button>
      <button class="sec" data-email="sofia.reyes@ajuter.cl">Coordinación: Sofía Reyes</button>
      <span id="sesion">Sin sesión</span>
    </div>
  </section>

  <section class="card">
    <h2>1. Inscribir la tarjeta (paciente)</h2>
    <p>Abre el formulario de Transbank. Al terminar vuelves a esta página con el resultado.</p>
    <div id="resultado"></div>
    <div class="row">
      <button id="inscribir">Inscribir tarjeta</button>
      <button class="sec" id="verTarjeta">Ver mi tarjeta</button>
      <button class="sec" id="eliminarTarjeta">Eliminar tarjeta</button>
    </div>
  </section>

  <section class="card">
    <h2>2. Cobro 1: el paciente paga (paciente)</h2>
    <p>Cobra la cuota más antigua sin pagar. Lo pide el paciente.</p>
    <div class="row">
      <button id="cobro1">Pagar mensualidad</button>
      <button class="sec" id="verCobros">Ver mis cobros</button>
    </div>
  </section>

  <section class="card">
    <h2>3. Cobro 2: automático, sin el paciente (coordinación)</h2>
    <p>El backend cobra las cuotas que vencen hasta la fecha elegida, sin que el paciente haga nada. Es lo que haría el cron diario.</p>
    <div class="row">
      <input id="asOf" type="date">
      <button id="cobro2">Cobrar cuotas vencidas</button>
    </div>
  </section>

  <section class="card">
    <h2>4. Qué dice Transbank (coordinación)</h2>
    <p>Consulta a Transbank el estado de un cobro. Es la evidencia de que el resultado no es nuestro.</p>
    <div class="row">
      <input id="chargeId" placeholder="id del cobro">
      <button id="estado">Consultar a Transbank</button>
    </div>
  </section>

  <section class="card">
    <h2>Respuestas</h2>
    <pre id="log">Sin movimientos todavía.</pre>
  </section>
</main>
<script>
(function () {
  var KEY = 'sb-pago-prueba';
  var log = document.getElementById('log');
  var sesion = document.getElementById('sesion');
  var state = { token: null, role: null, email: null };
  try { state = JSON.parse(sessionStorage.getItem(KEY)) || state; } catch (e) {}

  function $(id) { return document.getElementById(id); }
  function stamp() { return new Date().toLocaleTimeString('es-CL'); }
  function write(title, data) {
    var text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    var first = log.textContent === 'Sin movimientos todavía.';
    log.textContent = '[' + stamp() + '] ' + title + '\\n' + text + (first ? '' : '\\n\\n' + log.textContent);
  }
  function paintSession() {
    sesion.textContent = state.token ? state.email + ' (' + state.role + ')' : 'Sin sesión';
  }

  async function call(method, path, body) {
    var headers = { 'Content-Type': 'application/json' };
    if (state.token) headers.Authorization = 'Bearer ' + state.token;
    var res = await fetch(path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined });
    var text = await res.text();
    var json = null;
    try { json = text ? JSON.parse(text) : null; } catch (e) { json = text; }
    write(method + ' ' + path + ' → ' + res.status, json === null ? '(sin contenido)' : json);
    return { status: res.status, json: json };
  }

  async function login() {
    var email = $('email').value.trim();
    var res = await call('POST', '/auth/login', { email: email, password: $('password').value });
    if (res.status === 200 || res.status === 201) {
      state = { token: res.json.accessToken, role: res.json.user.role, email: email };
      sessionStorage.setItem(KEY, JSON.stringify(state));
      // No se deja la respuesta del login a la vista: trae los tokens.
      log.textContent = '[' + stamp() + '] Sesión iniciada como ' + email + ' (' + state.role + ')';
    }
    paintSession();
  }

  document.querySelectorAll('button[data-email]').forEach(function (b) {
    b.addEventListener('click', function () { $('email').value = b.getAttribute('data-email'); login(); });
  });
  $('entrar').addEventListener('click', login);

  $('inscribir').addEventListener('click', async function () {
    var res = await call('POST', '/payments/oneclick/inscriptions');
    if (res.status !== 201) return;
    // Transbank espera un POST del navegador con el campo TBK_TOKEN.
    var form = document.createElement('form');
    form.method = 'POST';
    form.action = res.json.urlWebpay;
    var field = document.createElement('input');
    field.type = 'hidden';
    field.name = 'TBK_TOKEN';
    field.value = res.json.token;
    form.appendChild(field);
    document.body.appendChild(form);
    form.submit();
  });
  $('verTarjeta').addEventListener('click', function () { call('GET', '/payments/oneclick/inscription'); });
  $('eliminarTarjeta').addEventListener('click', function () { call('DELETE', '/payments/oneclick/inscription'); });

  $('cobro1').addEventListener('click', async function () {
    var res = await call('POST', '/payments/oneclick/charges', {});
    if (res.json && res.json.id) $('chargeId').value = res.json.id;
  });
  $('verCobros').addEventListener('click', function () { call('GET', '/payments/oneclick/charges'); });

  $('cobro2').addEventListener('click', async function () {
    var body = $('asOf').value ? { asOf: $('asOf').value } : {};
    var res = await call('POST', '/payments/oneclick/charges/run-due', body);
    var first = Array.isArray(res.json) && res.json.find(function (r) { return r.chargeId; });
    if (first) $('chargeId').value = first.chargeId;
  });

  $('estado').addEventListener('click', function () {
    var id = $('chargeId').value.trim();
    if (id) call('GET', '/payments/oneclick/charges/' + encodeURIComponent(id) + '/transbank-status');
  });

  var outcome = new URLSearchParams(location.search).get('inscripcion');
  var mensajes = {
    ok: 'Tarjeta inscrita. Ya puedes cobrar.',
    rechazada: 'Transbank rechazó la tarjeta. No quedó inscrita.',
    anulada: 'Anulaste la inscripción en el formulario de Transbank.',
    error: 'No pudimos cerrar la inscripción. Vuelve a intentarlo.'
  };
  if (outcome) {
    $('resultado').textContent = mensajes[outcome] || outcome;
    history.replaceState(null, '', location.pathname);
    if (state.token && outcome === 'ok') call('GET', '/payments/oneclick/inscription');
  }
  paintSession();
})();
</script>
</body>
</html>
`;
