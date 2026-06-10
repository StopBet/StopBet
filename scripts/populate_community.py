"""
StopBet - Script de población de comunidad
Agrega 5 avisos (announcements) y 15 mensajes de foro.
Idempotente: ON CONFLICT DO NOTHING.

Uso: python scripts/populate_community.py
"""

import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

import psycopg2
from datetime import datetime, timedelta
import uuid
import os

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

def dt_ago(days=0, hours=0, minutes=0):
    return datetime.now() - timedelta(days=days, hours=hours, minutes=minutes)


# ── IDs fijos ─────────────────────────────────────────────────────────────────

DEMO_USER_ID = "11111111-1111-1111-1111-111111111111"
PSYCH_1_ID   = "22222222-2222-2222-2222-222222222222"   # Sofía Reyes (Santiago)
PSYCH_2_ID   = "33333333-3333-3333-3333-333333333333"   # Martín Vidal (Online)
SPONSOR_1_ID = "44444444-4444-4444-4444-444444444444"   # Pedro Lagos
PATIENT_2_ID = "66666666-6666-6666-6666-666666666666"   # Roberto Méndez
PATIENT_3_ID = "77777777-7777-7777-7777-777777777777"   # Lucía Vargas

SEDE_STGO_ID   = "Santiago"
SEDE_ONLINE_ID = "Online"
SEDE_VINA_ID   = "Viña del Mar"


# ── 5 Avisos (announcements) ──────────────────────────────────────────────────

print("\n→ Creando avisos...")

announcements = [
    (uid(), PSYCH_1_ID, "announcement", SEDE_STGO_ID,
     "Taller: Manejo del estrés y los gatillos",
     "Este viernes a las 18:30 realizaremos un taller práctico sobre identificación y manejo "
     "de gatillos emocionales. Trabajaremos con situaciones reales del día a día. "
     "Cupos limitados a 12 personas — confirmación obligatoria por este medio.",
     datetime.now() + timedelta(days=3), dt_ago(days=4)),

    (uid(), PSYCH_1_ID, "announcement", SEDE_STGO_ID,
     "Reunión familiar abierta — Sábado 14 jun, 11:00",
     "Invitamos a los familiares y redes de apoyo a la reunión mensual de familiares. "
     "El objetivo es compartir herramientas para acompañar el proceso desde casa. "
     "No se requiere inscripción previa. Sede Santiago Centro, sala 3.",
     datetime.now() + timedelta(days=4), dt_ago(days=2)),

    (uid(), PSYCH_2_ID, "announcement", SEDE_ONLINE_ID,
     "Nuevo recurso: Guía de autocuidado para momentos difíciles",
     "Hemos publicado una guía práctica de autocuidado disponible en la sección de recursos. "
     "Incluye técnicas de respiración, grounding 5-4-3-2-1, y el protocolo de postergación de 30 minutos. "
     "Descárgala desde la app y tenla a mano para cuando más la necesites.",
     None, dt_ago(days=3)),

    (uid(), PSYCH_2_ID, "announcement", SEDE_ONLINE_ID,
     "Sesión online de cierre de mes — Jueves 19:00",
     "El último jueves de cada mes realizamos una sesión grupal de cierre donde revisamos "
     "los logros del período, compartimos aprendizajes y fijamos intenciones para el mes siguiente. "
     "Esta semana: Jueves 12 jun, 19:00 hrs. Enlace de conexión en el perfil.",
     datetime.now() + timedelta(days=2), dt_ago(days=1)),

    (uid(), PSYCH_1_ID, "announcement", SEDE_STGO_ID,
     "Recordatorio: evaluaciones de seguimiento trimestral",
     "Durante las próximas dos semanas realizaremos las evaluaciones de seguimiento trimestral. "
     "Los citaremos individualmente por mensaje privado. Por favor confirmen su disponibilidad. "
     "Las evaluaciones son confidenciales y duran aproximadamente 45 minutos.",
     None, dt_ago(hours=6)),
]

for a in announcements:
    cur.execute("""
        INSERT INTO community_posts (
            id, "authorId", type, sede, title, body, "eventDate",
            "reportCount", "createdAt", "updatedAt"
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, 0, %s, %s)
        ON CONFLICT DO NOTHING
    """, (a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[7]))

print(f"  ✓ {len(announcements)} avisos")


# ── 15 Mensajes de foro (forum_post) ─────────────────────────────────────────

print("\n→ Creando mensajes de foro...")

forum_posts = [
    # 1 - Carlos comparte un logro
    (uid(), DEMO_USER_ID, "forum_post", SEDE_STGO_ID, None,
     "Esta semana tuve una situación muy difícil: me llegó una invitación al casino de un amigo. "
     "Hace unos meses hubiera ido sin pensarlo. Esta vez le dije que no, fui a caminar y llamé a mi padrino. "
     "No sé si suena como mucho, pero para mí fue enorme.",
     dt_ago(days=1, hours=3)),

    # 2 - Roberto pregunta sobre estrategias nocturnas
    (uid(), PATIENT_2_ID, "forum_post", SEDE_STGO_ID, None,
     "Pregunta para el grupo: ¿qué hacen cuando el impulso llega de noche, cuando no pueden llamar a nadie? "
     "A mí me pasa entre las 23:00 y la 1:00. Es el momento más difícil.",
     dt_ago(days=1, hours=1)),

    # 3 - Lucía comparte su primer semana
    (uid(), PATIENT_3_ID, "forum_post", SEDE_ONLINE_ID, None,
     "Hoy terminé mi primera semana completa. Sé que son solo 7 días, pero en mi caso son los 7 días más difíciles "
     "que he vivido en mucho tiempo. A los que llevan semanas o meses: ¿cómo fue para ustedes el primer mes?",
     dt_ago(days=0, hours=8)),

    # 4 - Pedro (sponsor) responde a Carlos
    (uid(), SPONSOR_1_ID, "forum_post", SEDE_STGO_ID, None,
     "Carlos, lo que describes es exactamente lo que se llama 'resistir el primer impulso'. "
     "Es la habilidad más importante que vas a desarrollar. El hecho de que hayas llamado es un logro enorme. "
     "Siempre que quieras hablar, ya sabes.",
     dt_ago(days=1, hours=0, minutes=30)),

    # 5 - Respuesta de Carlos al sponsor
    (uid(), DEMO_USER_ID, "forum_post", SEDE_STGO_ID, None,
     "Pedro, gracias. Lo que me dijiste aquella tarde realmente me quedó grabado: "
     "'el impulso siempre pasa, con o sin apostar'. Esta semana lo puse a prueba y es verdad.",
     dt_ago(hours=22)),

    # 6 - Sofía respondiendo a Roberto sobre las noches
    (uid(), PSYCH_1_ID, "forum_post", SEDE_STGO_ID, None,
     "Roberto, para los momentos nocturnos te recomiendo el protocolo de postergación: "
     "cuando llegue el impulso, dite 'lo pospongo 30 minutos'. Durante ese tiempo: sal de la cama, "
     "toma agua, escribe qué estás sintiendo. La mayoría de los impulsos ceden en menos de 20 minutos. "
     "Lo trabajamos más en detalle el jueves.",
     dt_ago(hours=20)),

    # 7 - Lucía agradeciendo el grupo
    (uid(), PATIENT_3_ID, "forum_post", SEDE_ONLINE_ID, None,
     "Acabo de leer todos los mensajes de esta semana y me di cuenta de que no estoy sola en esto. "
     "Eso en sí ya me ayuda mucho. Gracias a todos los que comparten acá.",
     dt_ago(hours=18)),

    # 8 - Roberto compartiendo un logro
    (uid(), PATIENT_2_ID, "forum_post", SEDE_STGO_ID, None,
     "12 días. Para algunos puede ser poco, para mí es un récord personal en los últimos 2 años. "
     "Esta mañana desperté y lo primero que pensé no fue en apostar. Primer día que eso pasa.",
     dt_ago(hours=14)),

    # 9 - Pedro al grupo general
    (uid(), SPONSOR_1_ID, "forum_post", SEDE_STGO_ID, None,
     "Para los que recién empiezan: el proceso no es lineal. Habrá días malos. "
     "Lo importante no es cuántas veces caes, sino cuántas veces te levantas. "
     "Yo recaí 4 veces antes de llegar a los 120 días que tengo hoy. No se rindan.",
     dt_ago(hours=12)),

    # 10 - Carlos sobre el trabajo
    (uid(), DEMO_USER_ID, "forum_post", SEDE_STGO_ID, None,
     "Un tema que no hablamos mucho: ¿cómo manejan el estrés del trabajo? "
     "A mí siempre me costó mucho ese gatillo. Cuando las cosas se ponían difíciles en la oficina, "
     "el casino era la 'válvula de escape'. Ahora busco alternativas pero no siempre funciona.",
     dt_ago(hours=10)),

    # 11 - Sofía respondiendo sobre el estrés laboral
    (uid(), PSYCH_1_ID, "forum_post", SEDE_STGO_ID, None,
     "Carlos, el estrés laboral es uno de los gatillos más comunes y más subestimados. "
     "Lo importante es identificar el momento ANTES de que llegue al pico — el cuerpo manda señales físicas "
     "antes de que la mente 'decida' algo. ¿Alguien más identifica señales físicas de sus gatillos?",
     dt_ago(hours=9)),

    # 12 - Roberto respondiendo sobre señales físicas
    (uid(), PATIENT_2_ID, "forum_post", SEDE_STGO_ID, None,
     "A mí me apretar la mandíbula. Es una señal que aprendí a reconocer hace poco. "
     "Cuando noto eso, sé que tengo que hacer algo antes de que se vuelva inmanejable.",
     dt_ago(hours=8)),

    # 13 - Martín con un aviso del grupo online
    (uid(), PSYCH_2_ID, "forum_post", SEDE_ONLINE_ID, None,
     "Para los del grupo online: el próximo lunes subiremos una grabación del taller de mindfulness. "
     "Fue muy bien evaluado por quienes participaron. Estará disponible en la sección de recursos por 2 semanas.",
     dt_ago(hours=6)),

    # 14 - Lucía compartiendo un reto superado
    (uid(), PATIENT_3_ID, "forum_post", SEDE_ONLINE_ID, None,
     "Hoy usé el asistente de la app por primera vez cuando sentí el impulso. "
     "Fue raro al principio hablar con una IA, pero me ayudó a pensar con más claridad. "
     "Me hizo preguntas que me hicieron entender qué estaba sintiendo realmente.",
     dt_ago(hours=4)),

    # 15 - Carlos cerrando la semana
    (uid(), DEMO_USER_ID, "forum_post", SEDE_STGO_ID, None,
     "Cerrando la semana: 56 días. "
     "Cada día que pasa me doy cuenta de que no era el dinero lo que buscaba en el casino, "
     "era escapar de algo. Ahora estoy aprendiendo a quedarme con lo que siento en vez de huir. "
     "Gracias a todos los que hacen posible este espacio.",
     dt_ago(hours=1)),
]

for p in forum_posts:
    cur.execute("""
        INSERT INTO community_posts (
            id, "authorId", type, sede, title, body, "eventDate",
            "reportCount", "createdAt", "updatedAt"
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, 0, %s, %s)
        ON CONFLICT DO NOTHING
    """, (p[0], p[1], p[2], p[3], p[4], p[5], None, p[6], p[6]))

print(f"  ✓ {len(forum_posts)} mensajes de foro")


# ── Reacciones a los mensajes ─────────────────────────────────────────────────

print("\n→ Creando reacciones...")

# Obtener IDs de los posts recién creados (los últimos por createdAt)
cur.execute("""
    SELECT id, "authorId", type FROM community_posts
    ORDER BY "createdAt" DESC LIMIT 20
""")
recent_posts = cur.fetchall()

reactions = []
all_users = [DEMO_USER_ID, PATIENT_2_ID, PATIENT_3_ID, SPONSOR_1_ID, PSYCH_1_ID]
emojis = ['💪', '❤️', '🤗']

for i, (post_id, author_id, post_type) in enumerate(recent_posts):
    if post_type == 'forum_post':
        num_reactions = [3, 2, 4, 1, 3, 2, 3, 4, 5, 2, 3, 2, 1, 4, 5][i % 15]
        users_to_react = [u for u in all_users if u != author_id][:num_reactions]
        for j, user_id in enumerate(users_to_react):
            reactions.append((uid(), post_id, user_id, emojis[j % len(emojis)]))

for r in reactions:
    cur.execute("""
        INSERT INTO post_reactions (id, "postId", "authorId", emoji, "createdAt")
        VALUES (%s, %s, %s, %s, NOW())
        ON CONFLICT ("postId", "authorId", emoji) DO NOTHING
    """, r)

print(f"  ✓ {len(reactions)} reacciones")


# ── Commit ─────────────────────────────────────────────────────────────────────

conn.commit()
cur.close()
conn.close()

print("\n✅ Comunidad poblada exitosamente")
print(f"  → {len(announcements)} avisos nuevos")
print(f"  → {len(forum_posts)} mensajes de foro nuevos")
print(f"  → {len(reactions)} reacciones")
