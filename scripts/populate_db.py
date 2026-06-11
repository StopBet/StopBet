"""
StopBet - Script de población de base de datos
Crea datos de prueba realistas para desarrollo local.
Idempotente: se puede correr múltiples veces sin duplicar datos.

Requisitos: pip install psycopg2-binary
Uso:        python scripts/populate_db.py
"""

import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

import psycopg2
from psycopg2.extras import execute_values
from datetime import date, datetime, timedelta
import uuid
import os
import sys

# ── Conexión ──────────────────────────────────────────────────────────────────

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:password@localhost:5432/stopbet"
)

try:
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    cur = conn.cursor()
    print("✓ Conectado a la base de datos")
except Exception as e:
    print(f"✗ No se pudo conectar: {e}")
    sys.exit(1)


def uid():
    return str(uuid.uuid4())


def days_ago(n):
    return date.today() - timedelta(days=n)


def days_from_now(n):
    return date.today() + timedelta(days=n)


def dt_ago(days, hours=0):
    return datetime.now() - timedelta(days=days, hours=hours)


# ── IDs fijos para relaciones ─────────────────────────────────────────────────

DEMO_USER_ID      = "11111111-1111-1111-1111-111111111111"  # ya existe en seed

PSYCH_1_ID        = "22222222-2222-2222-2222-222222222222"
PSYCH_2_ID        = "33333333-3333-3333-3333-333333333333"
SPONSOR_1_ID      = "44444444-4444-4444-4444-444444444444"
FAMILY_1_ID       = "55555555-5555-5555-5555-555555555555"
PATIENT_2_ID      = "66666666-6666-6666-6666-666666666666"
PATIENT_3_ID      = "77777777-7777-7777-7777-777777777777"
PATIENT_4_ID      = "88888888-8888-8888-8888-888888888888"
PATIENT_5_ID      = "99999999-9999-9999-9999-999999999999"

SEDE_STGO_ID      = "aaaa0001-0000-0000-0000-000000000000"
SEDE_ONLINE_ID    = "aaaa0002-0000-0000-0000-000000000000"
SEDE_VINA_ID      = "aaaa0003-0000-0000-0000-000000000000"


# ── 1. Sedes ──────────────────────────────────────────────────────────────────

print("\n→ Creando sedes...")
cur.execute("""
    INSERT INTO sedes (id, name, address, "activeGroups", type, "isActive")
    VALUES
        (%s, 'AJUTER Santiago Centro', 'Av. Providencia 1234, Santiago', 4, 'presential', true),
        (%s, 'AJUTER Online', 'Plataforma Virtual', 6, 'online', true),
        (%s, 'AJUTER Viña del Mar', 'Av. Libertad 567, Viña del Mar', 2, 'presential', true)
    ON CONFLICT (id) DO NOTHING
""", (SEDE_STGO_ID, SEDE_ONLINE_ID, SEDE_VINA_ID))
print("  ✓ 3 sedes")


# ── 2. Usuarios ───────────────────────────────────────────────────────────────

print("\n→ Creando usuarios...")

# Actualizar el usuario demo con sedeId (si no tiene)
cur.execute("""
    UPDATE users SET "sedeId" = %s
    WHERE id = %s AND "sedeId" IS NULL
""", (SEDE_STGO_ID, DEMO_USER_ID))

users = [
    # (id, email, role, firstName, lastName, onboardingStatus, daysStreak, sedeId)
    (PSYCH_1_ID,   "sofia.reyes@ajuter.cl",      "psychologist", "Sofía",    "Reyes Mora",     "complete", 0,  SEDE_STGO_ID),
    (PSYCH_2_ID,   "martin.vidal@ajuter.cl",     "psychologist", "Martín",   "Vidal Torres",   "complete", 0,  SEDE_ONLINE_ID),
    (SPONSOR_1_ID, "pedro.lagos@gmail.com",       "sponsor",      "Pedro",    "Lagos Silva",    "complete", 120, SEDE_STGO_ID),
    (FAMILY_1_ID,  "ana.demo@gmail.com",          "family",       "Ana",      "González Demo",  "complete", 0,  SEDE_STGO_ID),
    (PATIENT_2_ID, "roberto.mendez@gmail.com",    "patient",      "Roberto",  "Méndez Araya",   "complete", 12, SEDE_STGO_ID),
    (PATIENT_3_ID, "lucia.vargas@gmail.com",      "patient",      "Lucía",    "Vargas Pinto",   "complete", 3,  SEDE_ONLINE_ID),
    (PATIENT_4_ID, "jorge.silva@gmail.com",       "patient",      "Jorge",    "Silva Muñoz",    "payment_pending", 0, SEDE_VINA_ID),
    (PATIENT_5_ID, "camila.rojas@gmail.com",      "patient",      "Camila",   "Rojas Castro",   "approval_pending", 0, SEDE_STGO_ID),
]

for u in users:
    cur.execute("""
        INSERT INTO users (
            id, email, "passwordHash", role, "firstName", "lastName",
            "onboardingStatus", "accountStatus", "daysStreak", "sedeId", "createdAt", "updatedAt"
        ) VALUES (
            %s, %s, '$2b$10$placeholder_hash_for_dev_only', %s, %s, %s,
            %s, 'active', %s, %s, NOW(), NOW()
        )
        ON CONFLICT (id) DO NOTHING
    """, (u[0], u[1], u[2], u[3], u[4], u[5], u[6], u[7]))

print(f"  ✓ {len(users)} usuarios adicionales")


# ── 3. Solicitudes de registro ────────────────────────────────────────────────

print("\n→ Creando solicitudes de registro...")

registrations = [
    (uid(), DEMO_USER_ID,  SEDE_STGO_ID,   "approved", PSYCH_1_ID, dt_ago(50)),
    (uid(), PATIENT_2_ID,  SEDE_STGO_ID,   "approved", PSYCH_1_ID, dt_ago(20)),
    (uid(), PATIENT_3_ID,  SEDE_ONLINE_ID, "approved", PSYCH_2_ID, dt_ago(10)),
    (uid(), PATIENT_4_ID,  SEDE_VINA_ID,   "approved", PSYCH_1_ID, dt_ago(5)),
    (uid(), PATIENT_5_ID,  SEDE_STGO_ID,   "pending",  None,       dt_ago(1)),
]

for r in registrations:
    cur.execute("""
        INSERT INTO registration_requests (
            id, "userId", "sedeId", "institutionId", status,
            "reviewedBy", "reviewedAt", "createdAt"
        ) VALUES (%s, %s, %s, 'AJUTER', %s, %s, %s, %s)
        ON CONFLICT DO NOTHING
    """, (r[0], r[1], r[2], r[3], r[4], r[4] and dt_ago(int((datetime.now() - r[5]).days) - 1), r[5]))

print(f"  ✓ {len(registrations)} solicitudes")


# ── 4. Suscripciones e invoices ───────────────────────────────────────────────

print("\n→ Creando suscripciones e invoices...")

subs = [
    (DEMO_USER_ID,  "active",    "webpay",   days_from_now(15)),
    (PATIENT_2_ID,  "active",    "card",     days_from_now(8)),
    (PATIENT_3_ID,  "active",    "transfer", days_from_now(20)),
    (PATIENT_4_ID,  "pending",   "webpay",   None),
    (PATIENT_5_ID,  "pending",   "card",     None),
    (SPONSOR_1_ID,  "cancelled", "card",     None),
]

sub_ids = {}
for s in subs:
    sid = uid()
    sub_ids[s[0]] = sid
    cur.execute("""
        INSERT INTO subscriptions (
            id, "userId", plan, "amountCLP", "paymentMethod", status, "expiresAt", "createdAt"
        ) VALUES (%s, %s, 'AJUTER_MENSUAL', 30000, %s, %s, %s, NOW())
        ON CONFLICT DO NOTHING
    """, (sid, s[0], s[2], s[1], s[3]))

# Invoices para los activos
invoices_data = []
for patient_id in [DEMO_USER_ID, PATIENT_2_ID, PATIENT_3_ID]:
    for i, month_offset in enumerate(range(3, 0, -1)):
        invoice_date = date.today().replace(day=1) - timedelta(days=30 * month_offset)
        month_str = invoice_date.strftime("%Y-%m")
        status = "paid"
        paid_at = datetime(invoice_date.year, invoice_date.month, 15)
        invoices_data.append((uid(), patient_id, month_str, 30000, status,
                               invoice_date + timedelta(days=30), paid_at))

# Mes actual como pending para el demo
current_month = date.today().strftime("%Y-%m")
invoices_data.append((uid(), DEMO_USER_ID, current_month, 30000, "pending",
                       date.today().replace(day=28), None))
invoices_data.append((uid(), PATIENT_4_ID, current_month, 30000, "overdue",
                       days_ago(5), None))

for inv in invoices_data:
    cur.execute("""
        INSERT INTO invoices (id, "userId", month, "amountCLP", status, "dueDate", "paidAt", "createdAt")
        VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
        ON CONFLICT DO NOTHING
    """, inv)

print(f"  ✓ {len(subs)} suscripciones, {len(invoices_data)} invoices")


# ── 5. Períodos de abstinencia y badges ───────────────────────────────────────

print("\n→ Creando períodos de abstinencia y badges...")

# Actualizar el período del demo con attemptNumber correcto
cur.execute("""
    UPDATE abstinence_periods SET "attemptNumber" = 1
    WHERE "userId" = %s
""", (DEMO_USER_ID,))

periods = []
badges  = []

# Roberto: 12 días, intento 2
rob_period = uid()
periods.append((rob_period, PATIENT_2_ID, days_ago(12), None, 2))
badges.append((uid(), PATIENT_2_ID, rob_period, 1,  days_ago(11)))
badges.append((uid(), PATIENT_2_ID, rob_period, 3,  days_ago(9)))
badges.append((uid(), PATIENT_2_ID, rob_period, 7,  days_ago(5)))

# Lucía: 3 días, intento 1
luc_period = uid()
periods.append((luc_period, PATIENT_3_ID, days_ago(3), None, 1))
badges.append((uid(), PATIENT_3_ID, luc_period, 1, days_ago(2)))
badges.append((uid(), PATIENT_3_ID, luc_period, 3, days_ago(0)))

# Demo user ya tiene su periodo, agregarle badges que le corresponden (45 días)
cur.execute("SELECT id FROM abstinence_periods WHERE \"userId\" = %s LIMIT 1", (DEMO_USER_ID,))
row = cur.fetchone()
if row:
    demo_period = row[0]
    for milestone in [1, 3, 7, 14, 21, 30, 45]:
        badges.append((uid(), DEMO_USER_ID, demo_period, milestone, days_ago(45 - milestone)))

for p in periods:
    cur.execute("""
        INSERT INTO abstinence_periods (id, "userId", "startDate", "endDate", "attemptNumber", "createdAt")
        VALUES (%s, %s, %s, %s, %s, NOW())
        ON CONFLICT DO NOTHING
    """, p)

for b in badges:
    cur.execute("""
        INSERT INTO earned_badges (id, "userId", "periodId", milestone, "earnedAt", "sharedToCommunity", "createdAt")
        VALUES (%s, %s, %s, %s, %s, false, NOW())
        ON CONFLICT DO NOTHING
    """, b)

print(f"  ✓ {len(periods)} períodos, {len(badges)} badges")


# ── 6. Check-ins ──────────────────────────────────────────────────────────────

print("\n→ Creando check-ins...")

emotions = ["tired", "anxious", "angry", "lonely", "good"]
checkins = []

# Demo: últimos 20 días
for i in range(20):
    emotion = emotions[i % len(emotions)]
    checkins.append((uid(), DEMO_USER_ID, days_ago(i), emotion))

# Roberto: últimos 10 días
for i in range(10):
    emotion = emotions[(i + 2) % len(emotions)]
    checkins.append((uid(), PATIENT_2_ID, days_ago(i), emotion))

# Lucía: últimos 3 días
for i in range(3):
    checkins.append((uid(), PATIENT_3_ID, days_ago(i), emotions[i]))

for c in checkins:
    cur.execute("""
        INSERT INTO check_ins (id, "userId", date, emotion, "createdAt")
        VALUES (%s, %s, %s, %s, NOW())
        ON CONFLICT ("userId", date) DO NOTHING
    """, c)

print(f"  ✓ {len(checkins)} check-ins")


# ── 7. Posts comunitarios ─────────────────────────────────────────────────────

print("\n→ Creando posts comunitarios...")

post_ids = [uid() for _ in range(6)]

posts = [
    (post_ids[0], PSYCH_1_ID, "announcement", SEDE_STGO_ID,
     "Sesión grupal presencial — Jueves 19:00",
     "Este jueves a las 19:00 hrs tendremos nuestra sesión grupal mensual en la sede Santiago Centro. "
     "Se trabajará el tema 'Manejo de impulsos en situaciones sociales'. ¡Los esperamos!",
     datetime.now() + timedelta(days=4)),
    (post_ids[1], PSYCH_2_ID, "announcement", SEDE_ONLINE_ID,
     "Taller virtual: Herramientas de mindfulness",
     "Nuevo taller online el próximo lunes a las 18:30. Aprenderemos técnicas de atención plena "
     "aplicadas al control de impulsos. Inscripción por este medio.",
     datetime.now() + timedelta(days=7)),
    (post_ids[2], DEMO_USER_ID, "forum_post", SEDE_STGO_ID,
     None,
     "Hoy cumplo 45 días. Hubo momentos muy difíciles pero seguí adelante. "
     "Para los que recién empiezan: un día a la vez, de verdad funciona.",
     None),
    (post_ids[3], PATIENT_2_ID, "forum_post", SEDE_STGO_ID,
     None,
     "¿Alguien tiene recomendaciones para manejar la ansiedad los fines de semana? "
     "Es cuando más difícil se me hace.",
     None),
    (post_ids[4], SPONSOR_1_ID, "forum_post", SEDE_STGO_ID,
     None,
     "Llevan 120 días de racha. No es fácil llegar hasta acá. "
     "Si necesitan hablar, estoy disponible.",
     None),
    (post_ids[5], PSYCH_1_ID, "announcement", SEDE_STGO_ID,
     "Recordatorio: evaluaciones mensuales",
     "Este mes corresponde la evaluación de seguimiento. Los citaremos por separado. "
     "Por favor confirmen asistencia.",
     None),
]

for p in posts:
    cur.execute("""
        INSERT INTO community_posts (
            id, "authorId", type, sede, title, body, "eventDate",
            "reportCount", "createdAt", "updatedAt"
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, 0, NOW() - interval '2 days', NOW())
        ON CONFLICT DO NOTHING
    """, p)

# Reacciones
reactions = [
    (uid(), post_ids[2], PATIENT_2_ID, '💪'),
    (uid(), post_ids[2], SPONSOR_1_ID, '❤️'),
    (uid(), post_ids[2], PSYCH_1_ID,   '🤗'),
    (uid(), post_ids[2], PATIENT_3_ID, '💪'),
    (uid(), post_ids[4], DEMO_USER_ID, '❤️'),
    (uid(), post_ids[4], PATIENT_2_ID, '💪'),
    (uid(), post_ids[3], DEMO_USER_ID, '🤗'),
]

for r in reactions:
    cur.execute("""
        INSERT INTO post_reactions (id, "postId", "authorId", emoji, "createdAt")
        VALUES (%s, %s, %s, %s, NOW())
        ON CONFLICT ("postId", "authorId", emoji) DO NOTHING
    """, r)

# Respuestas
replies = [
    (uid(), post_ids[2], PSYCH_1_ID,
     "¡Felicitaciones Carlos! Tu esfuerzo y constancia son un ejemplo para todos. Seguimos juntos."),
    (uid(), post_ids[2], SPONSOR_1_ID,
     "Qué orgullo. Yo también pasé por eso. 45 días es un logro enorme."),
    (uid(), post_ids[3], PSYCH_1_ID,
     "Roberto, podemos trabajar eso en la sesión del jueves. "
     "También te recomiendo la técnica 5-4-3-2-1 cuando sientas el impulso."),
    (uid(), post_ids[3], DEMO_USER_ID,
     "A mí me ayudó mucho tener el teléfono de Pedro (sponsor) guardado y llamarle apenas siento el impulso."),
]

for r in replies:
    cur.execute("""
        INSERT INTO post_replies (id, "postId", "authorId", body, "createdAt")
        VALUES (%s, %s, %s, %s, NOW())
        ON CONFLICT DO NOTHING
    """, r)

# Confirmaciones de asistencia a anuncios
for patient_id in [DEMO_USER_ID, PATIENT_2_ID, PATIENT_3_ID]:
    cur.execute("""
        INSERT INTO attendance_confirmations (id, "postId", "userId", "createdAt")
        VALUES (%s, %s, %s, NOW())
        ON CONFLICT ("postId", "userId") DO NOTHING
    """, (uid(), post_ids[0], patient_id))

print(f"  ✓ {len(posts)} posts, {len(reactions)} reacciones, {len(replies)} respuestas")


# ── 8. Notificaciones ─────────────────────────────────────────────────────────

print("\n→ Creando notificaciones...")

notifications = [
    (uid(), DEMO_USER_ID,  "success", "¡45 días de racha!",
     "Alcanzaste el hito de 45 días sin apuestas. Tu dedicación es admirable.", True),
    (uid(), DEMO_USER_ID,  "info",    "Sesión grupal este jueves",
     "Recordatorio: sesión presencial el jueves 19:00 en sede Santiago Centro.", False),
    (uid(), DEMO_USER_ID,  "warning", "Pago pendiente",
     "Tu cuota de este mes aún no ha sido procesada. Regulariza antes del día 28.", False),
    (uid(), PATIENT_2_ID,  "success", "¡7 días cumplidos!",
     "Una semana completa. Estás construyendo un hábito poderoso.", True),
    (uid(), PATIENT_2_ID,  "info",    "Nuevo mensaje en el foro",
     "La psicóloga Sofía respondió tu pregunta sobre los fines de semana.", False),
    (uid(), PATIENT_3_ID,  "success", "¡Primer día completado!",
     "El primer paso es el más valioso. Mañana es el segundo.", True),
    (uid(), PATIENT_4_ID,  "warning", "Suscripción pendiente",
     "Para acceder a todos los módulos necesitas activar tu suscripción.", False),
    (uid(), PATIENT_4_ID,  "danger",  "Factura vencida",
     "Tu factura de este mes está vencida. Contáctanos para regularizar.", False),
]

for n in notifications:
    cur.execute("""
        INSERT INTO notifications (id, "userId", type, title, body, read, "createdAt")
        VALUES (%s, %s, %s, %s, %s, %s, NOW())
        ON CONFLICT DO NOTHING
    """, n)

print(f"  ✓ {len(notifications)} notificaciones")


# ── 9. Sponsor assignments y panic alerts ─────────────────────────────────────

print("\n→ Creando asignaciones de sponsor y alertas de pánico...")

assignments = [
    (uid(), DEMO_USER_ID,  SPONSOR_1_ID, True),
    (uid(), PATIENT_2_ID,  SPONSOR_1_ID, True),
]

for a in assignments:
    cur.execute("""
        INSERT INTO sponsor_assignments (id, "patientId", "sponsorId", "isActive", "createdAt")
        VALUES (%s, %s, %s, %s, NOW())
        ON CONFLICT DO NOTHING
    """, a)

# Una alerta respondida (histórica) y una cancelada
alerts = [
    (uid(), DEMO_USER_ID, str(SPONSOR_1_ID), "responded",
     dt_ago(20), dt_ago(20, hours=-1), None, None),
    (uid(), PATIENT_2_ID, str(SPONSOR_1_ID), "cancelled",
     dt_ago(5),  None, None, dt_ago(5, hours=-1)),
]

for al in alerts:
    cur.execute("""
        INSERT INTO panic_alerts (
            id, "patientId", "sponsorId", status, "createdAt",
            "respondedAt", "escalatedAt", "cancelledAt",
            "communityNotified", "updatedAt"
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, false, NOW())
        ON CONFLICT DO NOTHING
    """, al)

print(f"  ✓ {len(assignments)} asignaciones, {len(alerts)} alertas")


# ── 10. Sesiones AI y summaries ───────────────────────────────────────────────

print("\n→ Creando sesiones de AI y summaries...")

sessions = [
    (uid(), DEMO_USER_ID,  "closed", dt_ago(10), dt_ago(10, hours=-1)),
    (uid(), DEMO_USER_ID,  "closed", dt_ago(5),  dt_ago(5,  hours=-1)),
    (uid(), PATIENT_2_ID,  "closed", dt_ago(3),  dt_ago(3,  hours=-1)),
]

summaries = [
    ("anxious",  "impulso antes de dormir", "breathing",   "medium", 18,
     "Logró calmarse con respiración 4-7-8. Reconoció el gatillo nocturno."),
    ("lonely",   "aislamiento fin de semana", "grounding", "medium", 12,
     "Identificó soledad como detonante principal. Se practicó grounding 5-4-3-2-1."),
    ("anxious",  "discusión familiar",       "postponement","high",  25,
     "Momento de alto riesgo. Aplicó postergación 30 min y contactó a su sponsor."),
]

for i, s in enumerate(sessions):
    cur.execute("""
        INSERT INTO ai_sessions (
            id, "userId", status, "previousContext",
            "startedAt", "lastActivityAt", "closedAt"
        ) VALUES (%s, %s, %s, NULL, %s, %s, %s)
        ON CONFLICT DO NOTHING
    """, (s[0], s[1], s[2], s[3], s[4], s[4]))

    sm = summaries[i]
    cur.execute("""
        INSERT INTO ai_session_summaries (
            id, "sessionId", "userId", mood, "techniqueUsed",
            trigger, "riskLevel", "durationMinutes", "progressNote", "createdAt"
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
        ON CONFLICT DO NOTHING
    """, (uid(), s[0], s[1], sm[0], sm[1], sm[2], sm[3], sm[4], sm[5]))

print(f"  ✓ {len(sessions)} sesiones AI con summaries")


# ── 11. Evolución anímica ────────────────────────────────────────────────────

print("\n→ Actualizando días de abstinencia y check-ins para evolución anímica...")

# Días random para cada paciente (UPDATE el período abierto existente)
target_days = {
    PATIENT_2_ID: 27,   # Roberto
    PATIENT_3_ID: 52,   # Lucía
    PATIENT_4_ID: 18,   # Jorge
    PATIENT_5_ID: 35,   # Camila
}

for patient_id, n in target_days.items():
    cur.execute("""
        UPDATE abstinence_periods
        SET "startDate" = %s
        WHERE "userId" = %s AND "endDate" IS NULL
    """, (days_ago(n), patient_id))
    if cur.rowcount == 0:
        # Sin período abierto → crear uno
        cur.execute("""
            INSERT INTO abstinence_periods
                (id, "userId", "startDate", "endDate", "attemptNumber", "createdAt")
            VALUES (%s, %s, %s, NULL, 1, NOW())
            ON CONFLICT DO NOTHING
        """, (uid(), patient_id, days_ago(n)))

# Patrones de emociones (28 días, índice 0 = más antiguo, -1 = hoy)
# Roberto: empieza mal, mejora progresivamente
PATTERN_ROBERTO = [
    "anxious","angry","lonely","anxious","tired","anxious","tired",
    "tired","good","tired","tired","good","tired","good",
    "good","tired","good","good","tired","good","good",
    "good","good","good","good","tired","good","good",
]
# Lucía: estable, consistentemente positiva
PATTERN_LUCIA = [
    "good","good","tired","good","good","good","good",
    "tired","good","good","good","good","tired","good",
    "good","good","good","good","tired","good","good",
    "good","good","good","good","good","tired","good",
]
# Jorge: muchos bajos al inicio, mejora en las últimas semanas
PATTERN_JORGE = [
    "angry","angry","anxious","lonely","anxious","angry","anxious",
    "lonely","anxious","anxious","tired","tired","anxious","tired",
    "good","tired","good","tired","good","good","tired",
    "good","good","good","good","tired","good","good",
]
# Camila: generalmente positiva, con algunos bajones puntuales
PATTERN_CAMILA = [
    "tired","good","good","good","anxious","good","good",
    "tired","good","good","good","good","good","tired",
    "good","good","good","anxious","good","good","good",
    "good","tired","good","good","good","good","good",
]

patterns = {
    PATIENT_2_ID: PATTERN_ROBERTO,
    PATIENT_3_ID: PATTERN_LUCIA,
    PATIENT_4_ID: PATTERN_JORGE,
    PATIENT_5_ID: PATTERN_CAMILA,
}

mood_checkins = []
for patient_id, pattern in patterns.items():
    length = len(pattern)
    for i, emotion in enumerate(pattern):
        days_back = length - 1 - i   # i=0 → más antiguo
        mood_checkins.append((uid(), patient_id, days_ago(days_back), emotion))

for c in mood_checkins:
    cur.execute("""
        INSERT INTO check_ins (id, "userId", date, emotion, "createdAt")
        VALUES (%s, %s, %s, %s, NOW())
        ON CONFLICT ("userId", date) DO NOTHING
    """, c)

print(f"  ✓ días actualizados, {len(mood_checkins)} check-ins insertados")


# ── Commit ────────────────────────────────────────────────────────────────────

conn.commit()
cur.close()
conn.close()

print("\n✅ Población completada exitosamente")
print("\nUsuarios disponibles:")
print("  demo@stopbet.cl          → Carlos Demo (patient, 45 días racha)")
print("  roberto.mendez@gmail.com → Roberto Méndez (patient, 12 días racha)")
print("  lucia.vargas@gmail.com   → Lucía Vargas (patient, 3 días racha)")
print("  jorge.silva@gmail.com    → Jorge Silva (patient, pago pendiente)")
print("  camila.rojas@gmail.com   → Camila Rojas (patient, aprobación pendiente)")
print("  sofia.reyes@ajuter.cl    → Sofía Reyes (psychologist)")
print("  martin.vidal@ajuter.cl   → Martín Vidal (psychologist)")
print("  pedro.lagos@gmail.com    → Pedro Lagos (sponsor)")
print("  ana.demo@gmail.com       → Ana González (family)")
