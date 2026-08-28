# Avisos al equipo

Bitácora de cambios que **obligan a hacer algo distinto después de pullear**, o que cambian
un comportamiento visible lo bastante como para que alguien lo confunda con un bug.

**Esto no es el manual de setup.** Cómo se levanta el proyecto está en `README.md`, en
"Comandos frecuentes" de `CLAUDE.md` y en `apps/mobile/README.md`. Acá va solo lo que
cambió y a quién le pega, para que nadie pierda una tarde buscando el problema donde no
está.

## Cómo se usa

- Entradas **nuevas arriba**, con fecha y el PR que las trae.
- Si un cambio no le pide nada a nadie, **no va**. Esto sirve mientras se pueda leer entero
  en un minuto.
- Cuando una entrada deja de aplicar (el paso se automatizó, el flujo se revirtió), muévela
  a "Histórico" al final con una línea de qué la cerró. No la borres: alguien que pullea
  después de dos semanas necesita entender por qué su repo estaba raro.
- El archivo es de todos. Editarlo no necesita permiso de nadie.

---

## 2026-08-28 — PR #56 · Registro de pacientes (HU-06) y cuentas de psicólogo (HU-24)

### Hay que compilar `shared-types` antes de levantar mobile

**A quién le pega:** a quien levante **solo Metro**, sin arrancar el backend.

**Qué hacer**, una vez después de pullear, desde la raíz:

```bash
pnpm --filter @stopbet/shared-types build
```

**Por qué:** `apps/mobile` ahora importa **funciones** de `@stopbet/shared-types` (el
validador de RUT y el de fechas), no solo tipos. Hasta este PR todos los imports del
paquete en mobile eran `import type` y babel los borraba al compilar, así que Metro nunca
necesitó el `dist/` — y `dist/` está en `.gitignore`, o sea que **no viene en el pull**.

**Si no lo haces:**
- Con un `dist/` viejo (lo normal si ya levantaste el backend alguna vez), la app arranca
  bien y revienta con `formatRut is not a function` **al primer carácter que escribas en el
  campo RUT** del registro. Buscar eso en el código de la pantalla no lleva a ninguna parte.
- Con un `dist/` ausente (clon nuevo, o borraste `node_modules`), Metro no resuelve el
  módulo y **falla el bundle entero**: pantalla roja al arrancar.

**Si siempre partes por `pnpm run backend`, no tienes que hacer nada**: ese script ya
compila `shared-types` antes de arrancar, igual que `pnpm run seed` y `build:backend`. En CI
ya está resuelto (`backend-ci.yml` y `mobile-preview.yml` lo compilan explícitamente).

**Pendiente:** `scripts/android-run.ps1` lanza Metro con `npx react-native start` directo
(línea 194), saltándose el script `start` de `apps/mobile/package.json`. Mientras no se le
agregue el build ahí, este paso es manual.

### La app mobile ahora arranca en Welcome, no en Home

**A quién le pega:** a todos los que iteren en pantallas de mobile.

Antes `App.tsx` forzaba `isSignedIn = true` y la app abría directo en Home. Eso dejaba el
stack de autenticación entero inalcanzable, y sin él no había forma de llegar al formulario
de registro (HU-06). Ahora arranca sin sesión: Welcome → Iniciar sesión → Home.

**Cualquier correo y clave no vacíos entran**, igual que antes: el login todavía no valida
contra `POST /auth/login`, sigue en modo demo con `TEMP_USER_ID`. Son dos toques más por
arranque, no un bloqueo.

### Solicitudes ahora filtra por sede

**A quién le pega:** a quien pruebe el flujo de aprobación en el dashboard.

`GET /registration/pending` devolvía **todas** las solicitudes a cualquiera. Ahora un
psicólogo ve solo las de sus sedes, y aprobar una de otra sede responde 403. El coordinador
sigue viendo todas — es un rol administrativo, y si filtrara también, una sede sin
psicólogos no tendría quién le apruebe nada.

**Ojo con el seed:** todos los psicólogos de `pnpm run seed` son de `'Santiago'`. Si
registras un paciente de prueba en Viña, Concepción u Online, **no le va a aparecer a ningún
psicólogo** — entra solo con la cuenta de coordinador. La lista vacía es el comportamiento
correcto, no un bug.

### `approve` / `reject` ya no aceptan `x-user-id`

**A quién le pega:** a quien tenga guardado un Postman o un script contra esos endpoints.

`PATCH /registration/:id/approve` y `/reject` ahora exigen `Authorization: Bearer` y rol
`psychologist` o `coordinator`. Antes cualquiera que supiera la URL podía aprobar una
solicitud inventando el `x-user-id` del revisor. El dashboard web ya va migrado en este
mismo PR; lo que se rompe son las llamadas hechas a mano.

`POST /registration/submit` y `GET /registration/status/:id` **siguen abiertos**, que es lo
que usa la app del paciente para registrarse sin cuenta.

---

## Histórico

_(Vacío por ahora. Acá van las entradas que dejaron de aplicar, con la línea de qué las cerró.)_
