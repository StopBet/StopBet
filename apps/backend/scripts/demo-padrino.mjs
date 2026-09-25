// Responde solo, como la compañera de viaje de la demo, las alertas de pánico que le lleguen.
// Existe para grabar la Hoja 4 del video de usuario (docs/video-usuario-sprint1.md) sin una
// segunda persona respondiendo por curl fuera de cámara. Corre en tu computador, no en el
// backend: cuando lo cierras, deja de responder, y producción no cambia en nada.
//
//   pnpm run demo:padrino                      # Railway, responde a los 45 s
//   pnpm run demo:padrino -- --segundos 30
//   pnpm run demo:padrino -- --local           # backend en localhost:3000
//
// El backend escala sola la alerta a la IA a los 120 s (ESCALATION_MS en panic.service.ts):
// con más de ~110 s el script llega tarde.

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};

const BASE = args.includes('--local')
  ? 'http://localhost:3000'
  : 'https://stopbetbackend-production.up.railway.app';
const EMAIL = flag('--email') ?? 'daniela.soto@stopbet.cl';
const PASSWORD = flag('--password') ?? 'Stopbet2026!';
const DELAY_S = Number(flag('--segundos') ?? 45);
const POLL_MS = 3000;

if (!Number.isFinite(DELAY_S) || DELAY_S < 0 || DELAY_S > 110) {
  console.error('--segundos debe estar entre 0 y 110 (a los 120 la alerta ya escaló a la IA).');
  process.exit(1);
}

const hora = () => new Date().toLocaleTimeString('es-CL', { hour12: false });
const log = (msg) => console.log(`[${hora()}] ${msg}`);

let token = null;
// Hora local en que se vio cada alerta por primera vez. Se usa esto y no el createdAt del
// servidor para no depender de que los relojes del computador y de Railway coincidan.
const firstSeen = new Map();
const answered = new Set();

async function login() {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`login ${res.status}: ${await res.text()}`);
  token = (await res.json()).accessToken;
}

// El token dura 15 minutos: ante un 401 se vuelve a entrar y se reintenta una vez.
async function api(path, method = 'GET') {
  if (!token) await login();
  let res = await fetch(`${BASE}${path}`, { method, headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) {
    await login();
    res = await fetch(`${BASE}${path}`, { method, headers: { Authorization: `Bearer ${token}` } });
  }
  if (!res.ok) throw new Error(`${method} ${path} ${res.status}: ${await res.text()}`);
  return res.json();
}

async function tick() {
  const pending = await api('/panic/pending');
  const now = Date.now();
  for (const alert of pending) {
    if (answered.has(alert.id)) continue;
    if (!firstSeen.has(alert.id)) {
      firstSeen.set(alert.id, now);
      log(`Alerta nueva ${alert.id.slice(0, 8)}. Respondo en ${DELAY_S} s.`);
    }
    if (now - firstSeen.get(alert.id) >= DELAY_S * 1000) {
      await api(`/panic/alerts/${alert.id}/respond`, 'POST');
      answered.add(alert.id);
      log(`Respondida ${alert.id.slice(0, 8)}. En la app aparece en máximo 5 s.`);
    }
  }
}

async function main() {
  await login();
  log(`Conectado a ${BASE} como ${EMAIL}. Esperando alertas (Ctrl+C para salir).`);
  for (;;) {
    try {
      await tick();
    } catch (err) {
      // Un corte de red no debe matar el script en plena grabación: se reintenta en el
      // siguiente ciclo.
      log(`Error, reintento en ${POLL_MS / 1000} s: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main().catch((err) => {
  console.error(`No se pudo iniciar: ${err.message}`);
  process.exit(1);
});
