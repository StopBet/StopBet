import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { MaterialTopTabScreenProps } from '@react-navigation/material-top-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CommunityPost, DirectConversationSummary } from '@stopbet/shared-types';
import type { AppStackParamList, MainTabsParamList } from '../navigation/types';
import { Icon, type IconName } from '../components/Icon';
import { initial } from '../components/ChatMessage';
import type { Palette } from '../constants/colors';
import { useColors, useStyles } from '../context/ThemeContext';
import { Fonts } from '../constants/typography';
import { api } from '../services/api';
import { isNetworkError } from '../services/checkInQueue';
import { guardarEnCaché, leerDeCaché } from '../services/communityCache';
import { abrirStreamDeComunidad, abrirStreamDeMensajes } from '../services/communityStream';
import { devFlags } from '../store/devFlags';
import { Touchable } from '../components/Touchable';
import { useUserId, useCurrentUser } from '../context/AuthContext';
import { ROLE_LABEL } from '../utils/roles';
import { withRetry } from '../utils/retry';
import { avisarFalla } from '../utils/avisarFalla';
import { logInfo, logError } from '../utils/log';

type Tab = 'announcements' | 'chats';

/** Lo que muestra la fila fija del grupo: el último mensaje de la sede. */
interface VistaDelGrupo {
  autor: string;
  propio: boolean;
  texto: string;
  createdAt: string;
}

// Vive en el navegador de pestañas, pero también navega al stack de arriba (las
// conversaciones, el buscador), así que necesita los dos juegos de props.
type Props = CompositeScreenProps<
  MaterialTopTabScreenProps<MainTabsParamList, 'Community'>,
  NativeStackScreenProps<AppStackParamList>
>;

/**
 * Comunidad: el tablón de **Anuncios** de la sede y la lista de **Chats**.
 *
 * Chats se parece a WhatsApp a propósito (la app la usan adultos mayores): el grupo de la
 * sede fijo arriba y, debajo, las conversaciones uno a uno que ya tienen algún mensaje, de la
 * más reciente a la más vieja. El «+» abre el buscador para escribirle a alguien nuevo
 * (decisión del PO del 30-09). Cada conversación se abre en su propia pantalla del stack.
 */
export function CommunityScreen({ navigation, route }: Props) {
  const userId = useUserId();
  const user = useCurrentUser();
  const sede = user?.sedeId ?? '';
  const c = useColors();
  const styles = useStyles(makeStyles);
  const [tab, setTab] = useState<Tab>(route.params?.initialTab ?? 'announcements');
  const [announcements, setAnnouncements] = useState<CommunityPost[]>([]);
  const [grupo, setGrupo] = useState<VistaDelGrupo | null>(null);
  const [chats, setChats] = useState<DirectConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [offline, setOffline] = useState(false);

  const vistaDe = useCallback(
    (p: CommunityPost | undefined): VistaDelGrupo | null =>
      p
        ? {
            autor: p.authorName.split(' ')[0] ?? p.authorName,
            propio: p.authorId === userId,
            texto: p.achievementDays ? '🏅 Compartió un logro' : p.body,
            createdAt: p.createdAt,
          }
        : null,
    [userId],
  );

  const load = useCallback(async () => {
    try {
      const [anns, último, conversaciones] = await Promise.all([
        api.getAnnouncements(userId, sede),
        // Solo el último mensaje: es lo que se ve en la fila del grupo.
        api.getForumPosts(userId, sede, 1, 1),
        api.getDirectConversations(),
      ]);
      setAnnouncements(anns);
      setGrupo(vistaDe(último.data[0]));
      setChats(conversaciones);
      setOffline(false);
      guardarEnCaché(userId, { announcements: anns });
    } catch (err) {
      // Sin conexión: se cae a lo último guardado (CA4). Los mensajes directos no se guardan
      // en el teléfono: son conversaciones privadas y el teléfono puede ser compartido.
      setOffline(true);
      const guardado = await leerDeCaché(userId);
      setAnnouncements(guardado.announcements);
      setGrupo(vistaDe(guardado.posts[0]));
      if (isNetworkError(err)) {
        logInfo('[CommunityScreen] sin conexión al cargar');
      } else {
        logError('[CommunityScreen] load error', (err as Error).message);
      }
    } finally {
      setLoading(false);
      setRefrescando(false);
    }
  }, [sede, userId, vistaDe]);

  // Volver de una conversación tiene que traer la lista al día (lo leído, lo último enviado).
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  // `navigate` sobre una pantalla ya montada actualiza los params pero no vuelve a correr el
  // `useState` inicial. El parámetro se consume para no reimponer la pestaña al volver.
  const requestedTab = route.params?.initialTab;
  useEffect(() => {
    if (!requestedTab) return;
    setTab(requestedTab);
    navigation.setParams({ initialTab: undefined });
  }, [requestedTab, navigation]);

  /**
   * La lista se mueve sola mientras está a la vista, como en WhatsApp: lo que se escribe en
   * el grupo cambia su fila y un mensaje directo sube su conversación arriba con el contador.
   * Solo con la pestaña Chats abierta: fuera de ahí es batería a cambio de nada.
   */
  useFocusEffect(
    useCallback(() => {
      if (tab !== 'chats' || !sede || offline) return;
      const cerrarGrupo = abrirStreamDeComunidad(sede, (evento) => {
        if (evento.kind === 'post') setGrupo(vistaDe(evento.post));
      });
      const cerrarDirectos = abrirStreamDeMensajes((evento) => {
        if (evento.kind !== 'message') {
          // Un borrado puede cambiar la vista previa: se pide la lista de nuevo.
          if (evento.kind === 'deleted') void api.getDirectConversations().then(setChats).catch(() => {});
          return;
        }
        setChats((prev) => {
          const actual = prev.find((ch) => ch.other.id === evento.otherId);
          // Una conversación nueva trae datos que el evento no tiene (nombre, rol):
          // se pide la lista completa.
          if (!actual) {
            void api.getDirectConversations().then(setChats).catch(() => {});
            return prev;
          }
          const propio = evento.message.senderId === userId;
          const actualizada: DirectConversationSummary = {
            ...actual,
            lastMessage: {
              body: evento.message.body,
              senderId: evento.message.senderId,
              createdAt: evento.message.createdAt,
            },
            unreadCount: propio ? actual.unreadCount : actual.unreadCount + 1,
          };
          return [actualizada, ...prev.filter((ch) => ch.id !== actual.id)];
        });
      });
      return () => {
        cerrarGrupo();
        cerrarDirectos();
      };
    }, [tab, sede, offline, userId, vistaDe]),
  );

  const handleToggleAttendance = async (announcementId: string) => {
    try {
      const { attends } = await withRetry(() => api.toggleAttendance(userId, announcementId));
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === announcementId ? { ...a, userAttends: attends } : a)),
      );
    } catch (err) {
      avisarFalla('actualizar tu asistencia', err);
    }
  };

  const noLeídos = chats.reduce((n, ch) => n + ch.unreadCount, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={c.primary} />

      <View style={styles.header}>
        <View style={styles.headerMeta}>
          <Text style={styles.headerTitle}>Comunidad</Text>
          <Text style={styles.headerSub}>Sede {sede}</Text>
        </View>
        {/* Acá había una segunda entrada al pánico: el SOS de la barra de abajo está
            en esta misma pantalla, más grande y en el mismo lugar de siempre. */}
      </View>

      <View style={styles.tabs} accessibilityRole="tablist">
        <Touchable
          style={styles.tab}
          onPress={() => setTab('announcements')}
          activeOpacity={0.7}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'announcements' }}
        >
          <Text style={[styles.tabText, tab === 'announcements' && styles.tabTextActive]}>
            Anuncios
          </Text>
          {tab === 'announcements' && <View style={styles.tabUnderline} />}
        </Touchable>
        <Touchable
          style={styles.tab}
          onPress={() => setTab('chats')}
          activeOpacity={0.7}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'chats' }}
          accessibilityLabel={noLeídos ? `Chats, ${noLeídos} sin leer` : 'Chats'}
        >
          <View style={styles.tabConContador}>
            <Text style={[styles.tabText, tab === 'chats' && styles.tabTextActive]}>Chats</Text>
            {noLeídos > 0 ? (
              <View style={styles.contador}>
                <Text style={styles.contadorTexto}>{noLeídos > 99 ? '99+' : noLeídos}</Text>
              </View>
            ) : null}
          </View>
          {tab === 'chats' && <View style={styles.tabUnderline} />}
        </Touchable>
      </View>

      {/* El modo simulado producía un banner idéntico al de una caída real, así que
          no había forma de saber si la app estaba rota o si el flag quedó encendido. */}
      {(offline || devFlags.simulateOffline) && (
        <View style={styles.offlineBanner}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="triangle-alert" size={14} color={c.accent} />
            <Text style={styles.offlineText}>
              {devFlags.simulateOffline
                ? 'Modo sin conexión SIMULADO · actívalo o apágalo en Perfil'
                : 'Sin conexión · Solo lectura'}
            </Text>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={c.primaryText} />
        </View>
      ) : tab === 'announcements' ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {announcements.length === 0 ? (
            <EmptyState
              iconName="megaphone"
              title="Sin anuncios"
              text="Acá verás los avisos y eventos de tu sede."
            />
          ) : (
            announcements.map((a) => (
              <AnnouncementCard
                key={a.id}
                announcement={a}
                disabled={offline}
                onToggleAttendance={() => handleToggleAttendance(a.id)}
              />
            ))
          )}
          <View style={styles.readonlyNote}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="lock" size={13} color={c.fg2} />
              <Text style={styles.readonlyNoteText}>Solo el equipo puede publicar en Anuncios</Text>
            </View>
          </View>
        </ScrollView>
      ) : (
        <View style={styles.chatsWrap}>
          <FlatList
            style={styles.scroll}
            contentContainerStyle={styles.chatsContent}
            data={chats}
            keyExtractor={(ch) => ch.id}
            refreshControl={
              <RefreshControl
                refreshing={refrescando}
                onRefresh={() => {
                  setRefrescando(true);
                  void load();
                }}
                colors={[c.primary]}
              />
            }
            ListHeaderComponent={
              <FilaDelGrupo
                sede={sede}
                vista={grupo}
                onPress={() => navigation.navigate('GroupChat')}
              />
            }
            ListEmptyComponent={
              <Text style={styles.sinChats}>
                {offline
                  ? 'Tus conversaciones aparecen al volver la conexión.'
                  : 'Para escribirle a alguien de tu sede en privado, toca el botón +.'}
              </Text>
            }
            renderItem={({ item }) => (
              <FilaDeChat
                chat={item}
                propio={item.lastMessage.senderId === userId}
                onPress={() =>
                  navigation.navigate('DirectChat', { userId: item.other.id, name: item.other.name })
                }
              />
            )}
          />
          {/* El «+» flota sobre la lista, como el de WhatsApp. Sin conexión no hay a quién
              buscar, así que no se ofrece. */}
          {!offline ? (
            <Touchable
              style={styles.fab}
              onPress={() => navigation.navigate('NewDirectMessage')}
              rippleColor="rgba(255,255,255,0.28)"
              accessibilityRole="button"
              accessibilityLabel="Nuevo mensaje: buscar a alguien de tu sede"
            >
              <Icon name="plus" size={26} color={c.white} />
            </Touchable>
          ) : null}
        </View>
      )}
    </SafeAreaView>
  );
}

// ── Subcomponentes ─────────────────────────────────────────────────────────

/** El grupo de la sede, fijo arriba de la lista. */
function FilaDelGrupo({
  sede,
  vista,
  onPress,
}: {
  sede: string;
  vista: VistaDelGrupo | null;
  onPress: () => void;
}) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const previa = vista ? `${vista.propio ? 'Tú' : vista.autor}: ${vista.texto}` : 'Sé el primero en escribir';
  return (
    <Touchable
      style={[styles.fila, styles.filaGrupo]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Chat de toda la sede ${sede}, fijado. ${previa}`}
    >
      <View style={[styles.avatarFila, styles.avatarGrupo]}>
        <Icon name="users" size={22} color={c.white} />
      </View>
      <View style={styles.filaCuerpo}>
        <View style={styles.filaArriba}>
          <Text style={styles.filaNombre} numberOfLines={1}>Comunidad {sede}</Text>
          {vista ? <Text style={styles.filaHora}>{horaEnLista(vista.createdAt)}</Text> : null}
        </View>
        <View style={styles.filaAbajo}>
          <Text style={styles.filaPrevia} numberOfLines={1}>{previa}</Text>
          <Icon name="pin" size={15} color={c.fg2} />
        </View>
      </View>
    </Touchable>
  );
}

const FilaDeChat = React.memo(function FilaDeChat({
  chat,
  propio,
  onPress,
}: {
  chat: DirectConversationSummary;
  propio: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const sinLeer = chat.unreadCount > 0;
  const previa = `${propio ? 'Tú: ' : ''}${chat.lastMessage.body}`;
  const rol = chat.other.role === 'sponsor' ? ROLE_LABEL.sponsor : null;
  return (
    <Touchable
      style={styles.fila}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        `${chat.other.name}${rol ? `, ${rol}` : ''}. ${previa}.` +
        (sinLeer ? ` ${chat.unreadCount} sin leer.` : '') +
        (chat.blockedByMe ? ' Bloqueado.' : '')
      }
    >
      <View style={styles.avatarFila}>
        <Text style={styles.avatarLetra}>{initial(chat.other.name)}</Text>
      </View>
      <View style={styles.filaCuerpo}>
        <View style={styles.filaArriba}>
          <Text style={styles.filaNombre} numberOfLines={1}>{chat.other.name}</Text>
          <Text style={[styles.filaHora, sinLeer && styles.filaHoraSinLeer]}>
            {horaEnLista(chat.lastMessage.createdAt)}
          </Text>
        </View>
        <View style={styles.filaAbajo}>
          {chat.blockedByMe ? <Icon name="ban" size={14} color={c.fg2} /> : null}
          <Text style={[styles.filaPrevia, sinLeer && styles.filaPreviaSinLeer]} numberOfLines={1}>
            {previa}
          </Text>
          {sinLeer ? (
            <View style={styles.contador}>
              <Text style={styles.contadorTexto}>{chat.unreadCount > 99 ? '99+' : chat.unreadCount}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Touchable>
  );
  // `onPress` se ignora a propósito, como en `ChatMessage`: la lista lo recrea en cada render y
  // solo abre la conversación de esta misma fila, que cambia solo si cambia `chat`.
}, (a, b) => a.chat === b.chat && a.propio === b.propio);

function EmptyState({ iconName, title, text }: { iconName: IconName; title: string; text: string }) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.emptyCard}>
      <Icon name={iconName} size={44} color={c.fg2} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function AnnouncementCard({
  announcement,
  disabled,
  onToggleAttendance,
}: {
  announcement: CommunityPost;
  disabled: boolean;
  onToggleAttendance: () => void;
}) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const isPsychologist = announcement.authorRole === 'psychologist';
  // La sesión de junio seguía pidiendo "Confirmar asistencia" en septiembre
  const eventPassed =
    !!announcement.eventDate && new Date(announcement.eventDate).getTime() < Date.now();
  return (
    <View style={styles.pinCard}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 }}>
        <Icon name="bell" size={12} color={c.fg2} />
        <Text style={styles.pinFlag}>Equipo clínico · Sede {announcement.sede}</Text>
      </View>
      <View style={styles.pinHead}>
        <View style={[styles.avatar, { backgroundColor: isPsychologist ? c.primary : c.accent }]}>
          <Text style={styles.avatarLetter}>{initial(announcement.authorName)}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.authorName}>{announcement.authorName}</Text>
          <Text style={styles.authorMeta}>
            {ROLE_LABEL[announcement.authorRole]} · {timeAgo(announcement.createdAt)}
          </Text>
        </View>
        <View style={[styles.roleChip, !isPsychologist && styles.roleChipAdmin]}>
          {/* Decía "Admin": el paciente ve a un coordinador de AJUTER, no a un administrador */}
          <Text style={[styles.roleChipText, !isPsychologist && styles.roleChipTextAdmin]}>
            {ROLE_LABEL[announcement.authorRole]}
          </Text>
        </View>
      </View>
      {!!announcement.title && <Text style={styles.pinTitle}>{announcement.title}</Text>}
      <Text style={styles.pinBody}>{announcement.body}</Text>
      {!!announcement.eventDate && (
        <View style={styles.annCta}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Icon name="calendar" size={12} color={c.fg2} />
            <Text style={styles.annDate}>{formatEventDate(announcement.eventDate)}</Text>
          </View>
          {eventPassed ? (
            <View style={styles.finishedChip}>
              <Text style={styles.finishedText}>
                {announcement.userAttends ? 'Finalizado · asististe' : 'Finalizado'}
              </Text>
            </View>
          ) : (
            <Touchable
      rippleColor="rgba(255,255,255,0.28)"
              style={[styles.attendBtn, announcement.userAttends && styles.attendBtnOn]}
              onPress={onToggleAttendance}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ selected: !!announcement.userAttends }}
              hitSlop={{ top: 7, bottom: 7 }}
              activeOpacity={0.85}
            >
              {announcement.userAttends ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Icon name="check" size={14} color={c.white} />
                  <Text style={[styles.attendBtnText, styles.attendBtnTextOn]}>Asistiré</Text>
                </View>
              ) : (
                <Text style={styles.attendBtnText}>Confirmar asistencia</Text>
              )}
            </Touchable>
          )}
        </View>
      )}
    </View>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * La hora en la lista de chats, como la muestra WhatsApp: la hora si es de hoy, «Ayer» y,
 * más atrás, la fecha corta. En 24 h, igual que dentro de las burbujas.
 */
function horaEnLista(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';
  const hoy = new Date();
  const ayer = new Date(hoy);
  ayer.setDate(hoy.getDate() - 1);
  if (fecha.toDateString() === hoy.toDateString()) {
    return fecha.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  if (fecha.toDateString() === ayer.toDateString()) return 'Ayer';
  return fecha.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Cuánto hace, para los **anuncios**. El tablón de la sede no es una conversación: ahí
 * importa si algo es de hoy o de la semana pasada, no la hora exacta.
 */
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMin = Math.floor((Date.now() - then) / 60000);
  if (diffMin < 1) return 'ahora';
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return 'hace 1 día';
  return `hace ${diffD} días`;
}

function formatEventDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  // "jue 12 jun" al lado de un cuerpo que dice "miércoles" hace dudar de la fecha;
  // el día completo deja claro cuál manda
  return d.toLocaleDateString('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.primary },
  flex: { flex: 1 },
  chatsWrap: { flex: 1, backgroundColor: c.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: c.primary,
    gap: 12,
  },
  headerMeta: { flex: 1, minWidth: 0 },
  headerTitle: { fontFamily: Fonts.headingBold, fontSize: 20, color: c.white },
  headerSub: { fontFamily: Fonts.body, fontSize: 14, color: c.onPrimaryMuted, marginTop: 3 },

  tabs: {
    flexDirection: 'row',
    backgroundColor: c.surface,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  tab: { flex: 1, alignItems: 'center', paddingTop: 14, paddingBottom: 12, minHeight: 48 },
  tabConContador: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabText: { fontFamily: Fonts.bodyBold, fontSize: 14, color: c.fg2 },
  tabTextActive: { fontFamily: Fonts.bodyBold, color: c.primaryText },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    height: 2,
    width: '60%',
    backgroundColor: c.primary,
  },

  offlineBanner: {
    backgroundColor: c.amber50,
    borderBottomWidth: 1,
    borderBottomColor: c.accent,
    paddingVertical: 11,
    paddingHorizontal: 18,
  },
  offlineText: { fontFamily: Fonts.bodyBold, color: c.primaryText, fontSize: 13 },

  loader: { flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' },

  scroll: { flex: 1, backgroundColor: c.bg },
  scrollContent: { padding: 12, paddingBottom: 24, gap: 12 },
  // Aire abajo para que el «+» no tape la última conversación.
  chatsContent: { paddingBottom: 96 },

  emptyCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  emptyTitle: { fontFamily: Fonts.headingBold, fontSize: 18, color: c.ink900, marginBottom: 8 },
  emptyText: { fontFamily: Fonts.body, fontSize: 14, color: c.fg2, textAlign: 'center', lineHeight: 21 },

  // Lista de chats
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    minHeight: 76,
    backgroundColor: c.surface,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  // El grupo se separa del resto: es el chat de todos, no una conversación más.
  filaGrupo: { borderBottomWidth: 6, borderBottomColor: c.bg },
  avatarFila: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: c.teal400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarGrupo: { backgroundColor: c.primary },
  avatarLetra: { fontFamily: Fonts.bodyBold, fontSize: 19, color: c.white },
  filaCuerpo: { flex: 1, minWidth: 0, gap: 4, paddingVertical: 12 },
  filaArriba: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filaNombre: { flex: 1, fontFamily: Fonts.bodyBold, fontSize: 16, color: c.ink900 },
  filaHora: { fontFamily: Fonts.body, fontSize: 12.5, color: c.fg2 },
  filaHoraSinLeer: { fontFamily: Fonts.bodyBold, color: c.primaryText },
  filaAbajo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  filaPrevia: { flex: 1, fontFamily: Fonts.body, fontSize: 14, color: c.fg2 },
  filaPreviaSinLeer: { fontFamily: Fonts.bodyBold, color: c.fg1 },
  contador: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contadorTexto: { fontFamily: Fonts.bodyBold, fontSize: 12, color: c.white },
  sinChats: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: c.fg2,
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: 32,
    paddingTop: 28,
  },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 18,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: c.shadowSoft,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 5,
  },

  // Anuncios
  pinCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    borderTopWidth: 3,
    borderTopColor: c.primary,
    padding: 14,
    shadowColor: c.shadowSoft,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  pinFlag: { fontFamily: Fonts.bodyBold, fontSize: 12, color: c.fg2 },
  pinHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pinTitle: { fontFamily: Fonts.bodyBold, fontSize: 15, color: c.primaryText, marginTop: 11 },
  pinBody: { fontFamily: Fonts.body, fontSize: 15, color: c.ink900, lineHeight: 22, marginTop: 6 },
  annCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: c.border,
    gap: 10,
    flexWrap: 'wrap',
  },
  annDate: { fontFamily: Fonts.bodyBold, fontSize: 12, color: c.fg2 },
  attendBtn: {
    backgroundColor: c.sage50,
    borderWidth: 1.5,
    borderColor: c.primary,
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  attendBtnOn: { backgroundColor: c.primary },
  attendBtnText: { fontFamily: Fonts.bodyBold, fontSize: 13, color: c.primaryText },
  attendBtnTextOn: { color: c.white },
  finishedChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9999,
    backgroundColor: c.bg,
    borderWidth: 1,
    borderColor: c.border,
  },
  finishedText: { fontFamily: Fonts.bodyBold, fontSize: 12.5, color: c.fg2 },

  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontFamily: Fonts.bodyBold, color: c.white, fontSize: 16 },
  authorName: { fontFamily: Fonts.bodyBold, fontSize: 14, color: c.ink900 },
  authorMeta: { fontFamily: Fonts.body, fontSize: 12, color: c.fg2, marginTop: 1 },
  roleChip: {
    backgroundColor: c.sage50,
    borderRadius: 9999,
    paddingHorizontal: 11,
    paddingVertical: 4,
  },
  roleChipAdmin: { backgroundColor: c.amber50 },
  roleChipText: { fontFamily: Fonts.bodyBold, fontSize: 12, color: c.primaryText },
  roleChipTextAdmin: { color: c.fg1 },
  flex1: { flex: 1 },

  readonlyNote: { alignItems: 'center', paddingVertical: 14 },
  readonlyNoteText: { fontFamily: Fonts.body, fontSize: 12.5, color: c.fg2 },
});
