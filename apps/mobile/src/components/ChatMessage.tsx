import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { CommunityPost, QuotedMessage, ReactionEmoji, ReactionSummary } from '@stopbet/shared-types';
import { Icon, type IconName } from './Icon';
import { Touchable } from './Touchable';
import type { Palette } from '../constants/colors';
import { useColors, useStyles } from '../context/ThemeContext';
import { Fonts } from '../constants/typography';
import { ROLE_LABEL, esEquipoClínico } from '../utils/roles';
import { badgeDe } from '../constants/badges';

// La burbuja del chat de la comunidad, compartida por la vista del paciente
// (`CommunityScreen`) y la del equipo clínico (`StaffCommunityScreen`, `StaffThreadScreen`).
// Vivía dentro de CommunityScreen y el psicólogo veía el mismo chat como una lista de
// tarjetas de foro: dos maneras de leer la misma conversación.

// La "mano con corazón" no se lee como fuerza y la carita no se lee como abrazo
export const REACTION_ICON_MAP: Record<ReactionEmoji, IconName> = {
  '💪': 'flame',
  '❤️': 'heart',
  '🤗': 'hand-heart',
};

// TalkBack lee el ícono como nada y el contador suelto como "2": cada reacción necesita nombre
export const REACTION_NAME: Record<ReactionEmoji, string> = {
  '💪': 'Fuerza',
  '❤️': 'Cariño',
  '🤗': 'Abrazo',
};

function ChatMessageBase({
  post,
  isOwn,
  showAuthor,
  díaEncima,
  disabled,
  enviando,
  falló,
  onReact,
  onResponder,
  onReintentar,
  onMenuPress,
}: {
  post: CommunityPost;
  isOwn: boolean;
  showAuthor: boolean;
  /** El día que va rotulado encima, cuando este mensaje abre una jornada. */
  díaEncima: string | null;
  disabled: boolean;
  /** Todavía viaja al servidor. */
  enviando: boolean;
  /** No salió: se puede tocar para reintentar. */
  falló: boolean;
  /** Sin esto los chips de reacción se muestran pero no se pueden tocar (vista del equipo clínico). */
  onReact?: (emoji: ReactionEmoji) => void;
  onResponder: () => void;
  onReintentar: () => void;
  onMenuPress: () => void;
}) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const summaryFor = (emoji: ReactionEmoji): ReactionSummary =>
    post.reactions.find((r) => r.emoji === emoji) ?? { emoji, count: 0, userReacted: false };
  // Lo que escribe el equipo clínico no se lee igual que lo de un par. Sin marca propia,
  // los adultos mayores lo confundían con otro paciente: lleva la misma señal que los
  // anuncios (azul de marca y el rol a la vista) y el nombre en cada burbuja, no solo en
  // la primera de la tanda.
  const deEquipo = !isOwn && esEquipoClínico(post.authorRole);

  return (
    <View style={[
      isOwn ? styles.msgBlockOwn : styles.msgBlockOther,
      // Los mensajes seguidos de la misma persona van pegados, como en WhatsApp; el aire
      // solo separa a un hablante del siguiente.
      showAuthor ? styles.msgBlockSuelto : styles.msgBlockSeguido,
    ]}>
      {díaEncima ? (
        <View style={styles.separadorDía}>
          <Text style={styles.separadorDíaTexto}>{díaEncima}</Text>
        </View>
      ) : null}
      <View style={[styles.bubbleRow, isOwn ? styles.msgRowOwn : styles.msgRowOther]}>
        {/* El avatar solo acompaña al primero de una tanda; en el resto va un hueco
            del mismo ancho para que las burbujas queden alineadas entre sí. */}
        {!isOwn && (
          showAuthor ? (
            <View style={[styles.avatarSm, { backgroundColor: deEquipo ? c.primary : c.teal400 }]}>
              <Text style={styles.avatarSmLetter}>{initial(post.authorName)}</Text>
            </View>
          ) : (
            <View style={styles.avatarSpacer} />
          )
        )}

        <View style={[styles.bubbleCol, isOwn ? styles.bubbleColOwn : styles.bubbleColOther]}>
        {/* El toque largo abre el menú, como en un chat; el botón "···" se queda
            porque un gesto invisible no lo encuentra TalkBack ni quien no lo sabe.
            Si el mensaje no salió, el toque simple reintenta: es lo que ofrece el pie
            de la burbuja, y esperar un toque largo para eso sería una trampa. */}
        <Touchable
          onPress={falló ? onReintentar : undefined}
          onLongPress={onMenuPress}
          delayLongPress={300}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel={
            falló
              ? `Tu mensaje no se envió. Toca para reintentar.`
              : `Mensaje de ${isOwn ? 'tu autoría' : post.authorName}${
                  deEquipo ? `, ${ROLE_LABEL[post.authorRole]}` : ''
                }. Mantén pulsado para ver opciones.`
          }
        >
          <View
            style={[
              styles.bubble,
              isOwn ? styles.bubbleOwn : styles.bubbleOther,
              showAuthor && (isOwn ? styles.bubbleOwnFirst : styles.bubbleOtherFirst),
              deEquipo && styles.bubbleEquipo,
            ]}
          >
            {deEquipo ? (
              <View style={styles.bubbleAuthorRow}>
                <Text style={[styles.bubbleAuthor, styles.bubbleAuthorEnFila]} numberOfLines={1}>
                  {post.authorName}
                </Text>
                <View style={styles.chipEquipo}>
                  <Text style={styles.chipEquipoTexto}>{ROLE_LABEL[post.authorRole]}</Text>
                </View>
              </View>
            ) : !isOwn && showAuthor ? (
              <Text style={styles.bubbleAuthor}>{post.authorName}</Text>
            ) : null}

            {/* Lo citado, arriba del mensaje: sin esto una respuesta suelta no se entiende,
                porque en una conversación plana el original puede quedar lejos. */}
            {post.replyTo ? (
              <View style={[styles.cita, isOwn && styles.citaPropia]}>
                <Text style={[styles.citaAutor, isOwn && styles.citaAutorPropia]} numberOfLines={1}>
                  {post.replyTo.authorName}
                </Text>
                <Text style={[styles.citaCuerpo, isOwn && styles.citaCuerpoPropia]} numberOfLines={2}>
                  {post.replyTo.body}
                </Text>
              </View>
            ) : null}

            {/* Un logro no es un mensaje más: es lo que la comunidad celebra, y perdido
                entre el resto del chat pasaba de largo. */}
            {post.achievementDays ? (
              <View style={[styles.logro, isOwn && styles.logroPropio]}>
                {/* El ícono de la insignia que se celebra, el mismo que se ve en la
                    colección: con la medalla para todos, los hitos se confundían entre sí. */}
                <View style={[styles.logroMedalla, isOwn && styles.logroMedallaPropia]}>
                  <Icon
                    name={badgeDe(post.achievementDays)?.icon ?? 'medal'}
                    size={22}
                    color={isOwn ? c.white : c.greenText}
                  />
                </View>
                <View style={styles.logroTextos}>
                  <Text style={[styles.logroDias, isOwn && styles.logroDiasPropio]}>
                    {post.achievementDays} {post.achievementDays === 1 ? 'día' : 'días'} sin apostar
                  </Text>
                  <Text style={[styles.logroTexto, isOwn && styles.logroTextoPropio]}>
                    {badgeDe(post.achievementDays)?.label ??
                      (isOwn ? 'Compartiste tu logro' : 'Un nuevo hito')}
                    {isOwn ? ' · lo compartiste' : ` · ${post.authorName}`}
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={[styles.bubbleBody, isOwn && styles.bubbleBodyOwn]}>{post.body}</Text>
            )}

            <View style={styles.bubbleFoot}>
              <Text style={[styles.bubbleTime, isOwn && styles.bubbleTimeOwn]}>
                {falló ? 'No se envió · toca para reintentar' : horaDelMensaje(post.createdAt)}
              </Text>
              {/* El reloj mientras viaja y el aviso si no salió: sin esto, un mensaje que
                  no llegó se ve idéntico a uno publicado. */}
              {enviando ? (
                <Icon name="clock" size={13} color={isOwn ? c.onPrimaryMuted : c.fg2} />
              ) : null}
              {falló ? (
                <Icon name="triangle-alert" size={13} color={isOwn ? c.white : c.dangerText} />
              ) : null}
              <Touchable
                onPress={onMenuPress}
                hitSlop={14}
                accessibilityRole="button"
                accessibilityLabel="Opciones del mensaje"
              >
                <Icon name="ellipsis" size={16} color={isOwn ? c.onPrimaryMuted : c.fg2} />
              </Touchable>
            </View>
          </View>
        </Touchable>
        </View>
      </View>

      {/* Solo lo que ya reaccionó alguien. Los botones para reaccionar y responder viven
          en el menú de la burbuja: tenerlos siempre a la vista llenaba la pantalla de
          controles grises y dejaba cuatro mensajes por pantalla. */}
      {post.reactions.some((r) => r.count > 0) ? (
        <View style={[styles.afterBubble, isOwn ? styles.afterBubbleOwn : styles.afterBubbleOther]}>
          <View style={[styles.reactRow, isOwn && styles.reactRowOwn]}>
            {post.reactions
              .filter((r) => r.count > 0)
              .map((r) => (
                <Touchable
                  key={r.emoji}
                  style={[styles.reactChip, r.userReacted && styles.reactChipOn]}
                  onPress={onReact ? () => onReact(r.emoji) : undefined}
                  disabled={disabled || !onReact}
                  hitSlop={{ top: 11, bottom: 11, left: 5, right: 5 }}
                  accessibilityRole="button"
                  accessibilityLabel={`${REACTION_NAME[r.emoji]}, ${r.count} ${r.count === 1 ? 'reacción' : 'reacciones'}`}
                  accessibilityState={{ selected: !!r.userReacted, disabled: disabled || !onReact }}
                  activeOpacity={0.7}
                >
                  <Icon
                    name={REACTION_ICON_MAP[r.emoji]}
                    size={14}
                    color={r.userReacted ? c.primary : c.fg2}
                  />
                  <Text style={styles.reactCount}>{r.count}</Text>
                </Touchable>
              ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Sin esto, cada mensaje que entra repinta todas las burbujas montadas: la pantalla recrea
 * los cinco callbacks en cada render y `React.memo` por defecto los compara por referencia.
 *
 * El comparador mira solo los datos y **ignora las funciones a propósito**. Es seguro porque
 * cada callback solo lee lo de SU mensaje: si cambian sus reacciones o su estado de envío,
 * alguna de estas props cambia y la burbuja se vuelve a dibujar con los callbacks frescos.
 * Lo que ya no la despierta es lo que le pasa a las demás.
 */
export const ChatMessage = React.memo(
  ChatMessageBase,
  (a, b) =>
    a.post === b.post &&
    a.isOwn === b.isOwn &&
    a.showAuthor === b.showAuthor &&
    a.disabled === b.disabled &&
    a.enviando === b.enviando &&
    a.falló === b.falló &&
    a.díaEncima === b.díaEncima,
);

/** A quién se está respondiendo, encima del composer, como al citar en WhatsApp. */
export function CitaEnComposer({ cita, onQuitar }: { cita: QuotedMessage; onQuitar?: () => void }) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.citaComposer}>
      <View style={styles.citaComposerBarra} />
      <View style={styles.flex1}>
        <Text style={styles.citaComposerAutor} numberOfLines={1}>
          Respondiendo a {cita.authorName}
        </Text>
        <Text style={styles.citaComposerCuerpo} numberOfLines={1}>
          {cita.body}
        </Text>
      </View>
      {onQuitar ? (
        <Touchable
          onPress={onQuitar}
          hitSlop={12}
          borderless
          accessibilityRole="button"
          accessibilityLabel="Dejar de responder a este mensaje"
        >
          <Icon name="x" size={18} color={c.fg2} />
        </Touchable>
      ) : null}
    </View>
  );
}

/** Lo que va en la cita: el comienzo del mensaje, no el mensaje entero. */
export function citaDe(post: CommunityPost): QuotedMessage {
  return {
    id: post.id,
    authorName: post.authorName,
    body: post.body.length > 120 ? `${post.body.slice(0, 120).trimEnd()}…` : post.body,
  };
}

export function initial(name: string): string {
  return (name?.trim().charAt(0) || '?').toUpperCase();
}

/**
 * La hora del mensaje, como en WhatsApp.
 *
 * Antes decía "hace 3 h". Para quien usa WhatsApp todos los días (y la app la van a usar
 * adultos mayores) la hora exacta es el formato conocido, y además responde la pregunta que
 * uno se hace mirando un mensaje: a qué hora lo escribió.
 */
export function horaDelMensaje(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';
  // 24 horas: en Chile es lo habitual y ocupa la mitad que «1:10 p. m.», que en una
  // burbuja angosta empujaba el texto a una línea más.
  return fecha.toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** El día del mensaje, para el separador: «Hoy», «Ayer» o la fecha. */
export function díaDelMensaje(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';
  const hoy = new Date();
  const ayer = new Date(hoy);
  ayer.setDate(hoy.getDate() - 1);
  const mismoDía = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (mismoDía(fecha, hoy)) return 'Hoy';
  if (mismoDía(fecha, ayer)) return 'Ayer';
  return fecha.toLocaleDateString('es-CL', { day: 'numeric', month: 'long' });
}

/** Si dos mensajes son de días distintos, entre ellos va un separador. */
export function díasDistintos(a: string, b: string): boolean {
  return new Date(a).toDateString() !== new Date(b).toDateString();
}

const makeStyles = (c: Palette) => StyleSheet.create({

  // Foro
  // ── Foro estilo chat ──────────────────────────────────────────────────
  msgBlockOwn: { alignItems: 'flex-end' },
  msgBlockOther: { alignItems: 'flex-start' },
  msgBlockSuelto: { marginTop: 10 },
  msgBlockSeguido: { marginTop: 2 },

  // El rótulo del día, centrado y discreto, como el de cualquier chat
  separadorDía: {
    alignSelf: 'center',
    backgroundColor: c.surface,
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 5,
    // El rótulo necesita aire propio: pegado a la burbuja de abajo parecía parte de ese
    // mensaje en vez de separar las dos jornadas.
    marginTop: 18,
    marginBottom: 16,
  },
  separadorDíaTexto: { fontFamily: Fonts.bodyBold, fontSize: 12, color: c.fg2 },

  // El avatar se alinea con la burbuja, no con la columna entera: si no, quedaba
  // a la altura de las reacciones y parecía pertenecer al mensaje de arriba.
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: '100%' },
  msgRowOwn: { justifyContent: 'flex-end' },
  msgRowOther: { justifyContent: 'flex-start' },

  // Reacciones y respuestas cuelgan de la burbuja, sangradas para calzar con ella
  afterBubble: { width: '86%' },
  afterBubbleOwn: { alignItems: 'flex-end' },
  afterBubbleOther: { alignItems: 'flex-start', paddingLeft: 36 },

  // Mantiene alineadas las burbujas de una misma tanda, donde no va el avatar
  avatarSpacer: { width: 28 },

  // 82% deja ver que hay un lado libre, que es lo que hace legible de quién es
  // cada mensaje antes de leer el nombre.
  bubbleCol: { maxWidth: '76%' },
  bubbleColOwn: { alignItems: 'flex-end' },
  bubbleColOther: { alignItems: 'flex-start' },

  bubble: {
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingTop: 9,
    paddingBottom: 6,
    shadowColor: c.shadowSoft,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 3,
    elevation: 1,
  },
  bubbleOwn: { backgroundColor: c.primary },
  bubbleOther: { backgroundColor: c.surface },
  // La esquina recta marca el inicio de la tanda, como la "cola" de un chat
  bubbleOwnFirst: { borderTopRightRadius: 4 },
  bubbleOtherFirst: { borderTopLeftRadius: 4 },
  // El equipo clínico: el mismo azul que marca los anuncios, como franja y como fondo
  bubbleEquipo: {
    backgroundColor: c.infoSurface,
    borderLeftWidth: 4,
    borderLeftColor: c.primary,
  },
  bubbleAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  bubbleAuthorEnFila: { marginBottom: 0, flexShrink: 1 },
  chipEquipo: {
    backgroundColor: c.primary,
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  chipEquipoTexto: { fontFamily: Fonts.bodyBold, fontSize: 11.5, color: c.white },

  // La tarjeta del logro: medalla, los días grandes y una línea de contexto. Va dentro de
  // la burbuja para que conserve su sitio en la conversación y sus reacciones.
  logro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: c.sage50,
    borderWidth: 1,
    borderColor: c.sage500,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginVertical: 2,
  },
  logroPropio: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderColor: 'rgba(255,255,255,0.45)',
  },
  logroMedalla: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logroMedallaPropia: { backgroundColor: 'rgba(255,255,255,0.22)' },
  // Sin ancho propio: la columna de la burbuja se ajusta al contenido, y un `flex: 1` acá
  // colapsaba la tarjeta a una tira vertical.
  logroTextos: { flexShrink: 1 },
  logroDias: { fontFamily: Fonts.headingBold, fontSize: 17, color: c.greenText },
  logroDiasPropio: { color: c.white },
  logroTexto: { fontFamily: Fonts.body, fontSize: 12.5, color: c.fg2, marginTop: 1 },
  logroTextoPropio: { color: c.onPrimaryMuted },

  // La cita dentro de la burbuja: una barra al costado y el texto apagado, para que se lea
  // como contexto y no como el mensaje.
  cita: {
    borderLeftWidth: 3,
    borderLeftColor: c.primary,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 6,
    gap: 1,
  },
  citaPropia: {
    borderLeftColor: c.white,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  citaAutor: { fontFamily: Fonts.bodyBold, fontSize: 12, color: c.primaryText },
  citaAutorPropia: { color: c.white },
  citaCuerpo: { fontFamily: Fonts.body, fontSize: 12, color: c.fg2, lineHeight: 17 },
  citaCuerpoPropia: { color: c.onPrimaryMuted },

  citaComposer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: c.surface,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  citaComposerBarra: { width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: c.primary },
  citaComposerAutor: { fontFamily: Fonts.bodyBold, fontSize: 12.5, color: c.primaryText },
  citaComposerCuerpo: { fontFamily: Fonts.body, fontSize: 12.5, color: c.fg2 },

  bubbleAuthor: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    color: c.primaryText,
    marginBottom: 3,
  },
  bubbleBody: { fontFamily: Fonts.body, fontSize: 15, color: c.ink900, lineHeight: 21 },
  // Blanco sobre el azul de marca: 5,09:1
  bubbleBodyOwn: { color: c.white },

  bubbleFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 3,
  },
  bubbleTime: { fontFamily: Fonts.body, fontSize: 11, color: c.fg2 },
  // onPrimaryMuted sobre el azul: 4,57:1 (el azul claro daría 2,56:1)
  bubbleTimeOwn: { color: c.onPrimaryMuted },

  reactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  reactRowOwn: { justifyContent: 'flex-end' },
  reactChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 9999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  // Con una reacción encima sí toma cuerpo: es el estado que hay que distinguir
  reactChipOn: { backgroundColor: c.sage50, borderColor: c.primary },
  reactCount: { fontFamily: Fonts.bodyBold, fontSize: 12, color: c.ink900 },
  avatarSm: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarSmLetter: { fontFamily: Fonts.bodyBold, color: c.white, fontSize: 12 },

  flex1: { flex: 1 },
});
