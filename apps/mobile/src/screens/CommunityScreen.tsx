import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { MaterialTopTabScreenProps } from '@react-navigation/material-top-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type {
  AuthUser,
  CommunityPost,
  QuotedMessage,
  ReactionEmoji,
  ReactionSummary,
} from '@stopbet/shared-types';
import type { AppStackParamList, MainTabsParamList } from '../navigation/types';
import { Icon, type IconName } from '../components/Icon';
import type { Palette } from '../constants/colors';
import { useColors, useStyles } from '../context/ThemeContext';
import { Fonts } from '../constants/typography';
import { api } from '../services/api';
import { isNetworkError } from '../services/checkInQueue';
import { readCommunity, saveCommunity } from '../services/offlineStore';
import { abrirStreamDeComunidad } from '../services/communityStream';
import { devFlags } from '../store/devFlags';
import { toast, useToast } from '../context/ToastContext';
import { Touchable } from '../components/Touchable';
import { useCurrentUser, useUserId } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import { ROLE_LABEL, esEquipoClínico } from '../utils/roles';
import { badgeDe } from '../constants/badges';
import { newRequestId, withRetry } from '../utils/retry';
import { logInfo, logWarn, logError } from '../utils/log';

const REACTION_EMOJIS: ReactionEmoji[] = ['💪', '❤️', '🤗'];

// Igual que el valor por omisión del backend: la primera página y cada tanda siguiente.
const POSTS_POR_PÁGINA = 20;

// La "mano con corazón" no se lee como fuerza y la carita no se lee como abrazo
const REACTION_ICON_MAP: Record<ReactionEmoji, IconName> = {
  '💪': 'flame',
  '❤️': 'heart',
  '🤗': 'hand-heart',
};

// TalkBack lee el ícono como nada y el contador suelto como "2": cada reacción necesita nombre
const REACTION_NAME: Record<ReactionEmoji, string> = {
  '💪': 'Fuerza',
  '❤️': 'Cariño',
  '🤗': 'Abrazo',
};

// Caché en memoria de lo último cargado, para mostrarlo sin conexión (CA4).
// Sobrevive a navegar entre pantallas, pero no al reinicio de la app: para eso
// se respalda en disco con saveCommunity/readCommunity.
const offlineCache: {
  userId: string | null;
  announcements: CommunityPost[];
  posts: CommunityPost[];
} = {
  // Sin el id, al cambiar de cuenta el foro de la sede anterior se mostraba como propio
  userId: null,
  announcements: [],
  posts: [],
};

type Tab = 'announcements' | 'forum';

// Vive en el navegador de pestañas, pero también navega al stack de arriba
// (asistente, pánico), así que necesita los dos juegos de props.
type Props = CompositeScreenProps<
  MaterialTopTabScreenProps<MainTabsParamList, 'Community'>,
  NativeStackScreenProps<AppStackParamList>
>;

export function CommunityScreen({ navigation, route }: Props) {
  const { showDialog } = useDialog();
  const userId = useUserId();
  const user = useCurrentUser();
  const sede = user?.sedeId ?? '';
  const c = useColors();
  const styles = useStyles(makeStyles);
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>(route.params?.initialTab ?? 'announcements');
  const [announcements, setAnnouncements] = useState<CommunityPost[]>([]);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  // Composer del foro
  const [draft, setDraft] = useState(route.params?.draft ?? '');
  const [posting, setPosting] = useState(false);

  // Reporte con motivo (CA5.3)
  const [reportPostId, setReportPostId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportSending, setReportSending] = useState(false);

  // Menú de cada publicación (hoja inferior)
  const [menuPost, setMenuPost] = useState<CommunityPost | null>(null);

  // Respuestas: expansión y cache por post
  // A quién se está respondiendo. El foro es plano: responder es publicar citando.
  const [citando, setCitando] = useState<QuotedMessage | null>(null);

  // Claves de idempotencia de los envíos que todavía no confirmaron. Se guarda el
  // texto junto al id: si el paciente corrige lo que escribió antes de reintentar,
  // eso es un mensaje distinto y necesita clave nueva, o el backend le devolvería
  // el anterior.
  const [pendingPost, setPendingPost] = useState<{ id: string; body: string } | null>(null);
  // Paginación del foro: la primera página llega con `load`, las de más atrás con el scroll.
  const [totalPosts, setTotalPosts] = useState(0);
  const [cargandoMás, setCargandoMás] = useState(false);
  // Envíos que no salieron, por clave de idempotencia: se muestran con "No se envió".
  const [envíosFallidos, setEnvíosFallidos] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      const [anns, forum] = await Promise.all([
        api.getAnnouncements(userId, sede),
        api.getForumPosts(userId, sede),
      ]);
      setAnnouncements(anns);
      setPosts(forum.data);
      setTotalPosts(forum.total);
      setOffline(false);
      // Guarda lo cargado para poder mostrarlo sin conexión (CA4)
      offlineCache.userId = userId;
      offlineCache.announcements = anns;
      offlineCache.posts = forum.data;
      void saveCommunity(userId, { announcements: anns, posts: forum.data });
    } catch (err) {
      // Sin conexión: caemos al último contenido cacheado (CA4)
      setOffline(true);
      // El caché en memoria se vacía al reiniciar la app, y ahí el feed salía
      // vacío como si nadie hubiera publicado. Se completa desde disco.
      // Si el caché en memoria es de otra cuenta, no sirve: se descarta y se lee el de disco
      if (offlineCache.userId !== userId) {
        offlineCache.userId = userId;
        offlineCache.announcements = [];
        offlineCache.posts = [];
      }
      if (offlineCache.posts.length === 0 && offlineCache.announcements.length === 0) {
        const stored = await readCommunity(userId);
        if (stored) {
          offlineCache.announcements = stored.announcements;
          offlineCache.posts = stored.posts;
        }
      }
      setAnnouncements(offlineCache.announcements);
      setPosts(offlineCache.posts);
      // No exponemos datos del paciente en logs
      // Sin red es un estado esperado, no un fallo: con console.error React
      // Native levanta el LogBox encima de la pantalla.
      if (isNetworkError(err)) {
        logInfo('[CommunityScreen] sin conexión al cargar');
      } else {
        logError('[CommunityScreen] load error', (err as Error).message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // El anuncio de una insignia (CA5.2) o de una alerta de pánico (CA5.1) lo publica el
  // backend mientras el paciente navega hacia acá. Con useEffect el feed solo se cargaba
  // al montar la pantalla, así que al volver a una Comunidad ya montada el post recién
  // publicado no aparecía.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // navigate() sobre una pantalla ya montada actualiza los params pero no vuelve a
  // correr el useState inicial: sin esto, compartir la insignia abría Comunidad en
  // "Anuncios" y el foro con el logro quedaba fuera de la vista. El parámetro se
  // consume para no reimponer la pestaña al volver de otra pantalla.
  const requestedTab = route.params?.initialTab;
  useEffect(() => {
    if (!requestedTab) return;
    setTab(requestedTab);
    navigation.setParams({ initialTab: undefined });
  }, [requestedTab, navigation]);

  // ── Asistencia a eventos ───────────────────────────────────────────────
  const handleToggleAttendance = async (announcementId: string) => {
    try {
      const { attends } = await withRetry(() => api.toggleAttendance(userId, announcementId));
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === announcementId ? { ...a, userAttends: attends } : a)),
      );
    } catch (err) {
      alertFailure('actualizar tu asistencia', err);
    }
  };

  /**
   * Trae la página siguiente al llegar al final de la lista. Antes se pedían los primeros 20
   * mensajes y no había forma de ver más atrás: en un foro pasaba desapercibido, en una
   * conversación es lo primero que se busca.
   */
  const cargarMásAntiguos = useCallback(async () => {
    if (cargandoMás || offline || posts.length === 0 || posts.length >= totalPosts) return;
    setCargandoMás(true);
    try {
      const página = Math.floor(posts.length / POSTS_POR_PÁGINA) + 1;
      const siguiente = await api.getForumPosts(userId, sede, página, POSTS_POR_PÁGINA);
      setPosts((prev) => {
        const vistos = new Set(prev.map((p) => p.id));
        return [...prev, ...siguiente.data.filter((p) => !vistos.has(p.id))];
      });
      setTotalPosts(siguiente.total);
    } catch {
      // Silencioso a propósito: es contenido viejo, no algo que el paciente pidió ver ahora.
    } finally {
      setCargandoMás(false);
    }
  }, [cargandoMás, offline, posts.length, totalPosts, sede, userId]);

  /**
   * Los mensajes de los demás llegan solos mientras la pantalla está abierta. Antes había
   * que salir y volver para verlos, que es lo que separa un foro de una conversación.
   *
   * Solo con la pestaña a la vista: una conexión abierta con la app en el bolsillo es
   * batería del paciente a cambio de nada, y al volver la carga trae lo que se perdió.
   */
  useFocusEffect(
    useCallback(() => {
      if (!sede || offline) return;
      const cerrar = abrirStreamDeComunidad(sede, (evento) => {
        if (evento.kind === 'post') {
          const llegado = evento.post;
          setPosts((prev) => {
            // Lo propio ya está en la lista desde que se envió: el eco no lo duplica.
            if (prev.some((p) => p.id === llegado.id)) return prev;
            return [llegado, ...prev];
          });
          setTotalPosts((n) => n + 1);
          return;
        }
      });
      return cerrar;
    }, [sede, offline]),
  );

  // ── Reacciones ─────────────────────────────────────────────────────────
  const handleReaction = async (post: CommunityPost, emoji: ReactionEmoji) => {
    const current = post.reactions.find((r) => r.emoji === emoji);
    const reacting = !current?.userReacted;
    try {
      const { reactions } = reacting
        ? await withRetry(() => api.addReaction(userId, post.id, emoji))
        : await withRetry(() => api.removeReaction(userId, post.id, emoji));
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, reactions } : p)));
    } catch (err) {
      alertFailure('registrar tu reacción', err);
    }
  };

  // ── Publicar en el foro ────────────────────────────────────────────────
  const handlePost = async () => {
    const body = draft.trim();
    if (!body || posting) return;
    // Misma clave mientras el texto no cambie: el reintento se reconoce como el
    // mismo envío y no publica de nuevo.
    const requestId = pendingPost?.body === body ? pendingPost.id : newRequestId();
    setPendingPost({ id: requestId, body });
    setPosting(true);

    // El mensaje aparece al tiro con su reloj, como en cualquier chat: esperar la respuesta
    // del servidor con el campo ya vacío deja al paciente sin saber si se envió.
    const citado = citando;
    const enCamino = mensajeEnCamino(requestId, body, sede, user, citado);
    setPosts((prev) => [enCamino, ...prev]);
    setDraft('');
    setCitando(null);

    try {
      const created = await withRetry(() =>
        api.createForumPost(userId, sede, body, requestId, citado?.id),
      );
      // El de verdad reemplaza al provisorio, salvo que el stream ya lo haya traído.
      setPosts((prev) => {
        const sinProvisorio = prev.filter((p) => p.id !== enCamino.id);
        if (sinProvisorio.some((p) => p.id === created.id)) return sinProvisorio;
        return [created, ...sinProvisorio];
      });
      setPendingPost(null);
      setEnvíosFallidos((prev) => {
        const { [requestId]: _descartado, ...resto } = prev;
        return resto;
      });
    } catch (err) {
      // Se queda en la lista marcado como no enviado: el texto no se pierde y se puede
      // reintentar tocándolo, con la misma clave, así que no se publica dos veces.
      setEnvíosFallidos((prev) => ({ ...prev, [requestId]: true }));
      alertFailure('publicar tu mensaje', err);
    } finally {
      setPosting(false);
    }
  };

  /** Pone el mensaje sobre el composer para responderlo, como al citar en WhatsApp. */
  const citar = useCallback((post: CommunityPost) => {
    setCitando({
      id: post.id,
      authorName: post.authorName,
      body: post.body.length > 120 ? `${post.body.slice(0, 120).trimEnd()}…` : post.body,
    });
  }, []);

  /** Reintenta un mensaje que no salió, con su misma clave. */
  const reintentarEnvío = useCallback((post: CommunityPost) => {
    setPosts((prev) => prev.filter((p) => p.id !== post.id));
    setDraft(post.body);
    // Si citaba a alguien, la cita vuelve al composer con el texto.
    // Si citaba a alguien, la cita vuelve al composer junto con el texto.
    setCitando(post.replyTo ?? null);
    setEnvíosFallidos((prev) => {
      const { [post.id]: _descartado, ...resto } = prev;
      return resto;
    });
  }, []);

  // ── Respuestas ─────────────────────────────────────────────────────────
  // ── Reportar ───────────────────────────────────────────────────────────
  // CA5.3 exige indicar un motivo. Android no tiene Alert.prompt, así que el
  // motivo se pide en un modal propio en vez de un Alert.
  const handleReport = (postId: string) => {
    setReportPostId(postId);
    setReportReason('');
  };

  const submitReport = async () => {
    const reason = reportReason.trim();
    if (!reason || !reportPostId || reportSending) return;
    setReportSending(true);
    try {
      await withRetry(() => api.reportPost(userId, reportPostId, reason));
      // CA5.3: el backend ya deja de devolvérselo a quien reportó, pero
      // la pantalla carga una sola vez y el post seguía a la vista hasta
      // salir y volver. Se quita del feed apenas se confirma.
      setPosts((prev) => prev.filter((p) => p.id !== reportPostId));
      setAnnouncements((prev) => prev.filter((p) => p.id !== reportPostId));
      setReportPostId(null);
      showToast('Gracias. El equipo clínico revisará esta publicación.');
    } catch (err) {
      alertFailure('enviar el reporte', err);
    } finally {
      setReportSending(false);
    }
  };

  // ── Eliminar publicación propia ──────────────────────────────────────
  const handleDelete = (postId: string) => {
    showDialog({
      title: 'Eliminar publicación',
      message: '¿Seguro que quieres eliminarla? No podrás deshacerlo.',
      actions: [
        {
          label: 'Eliminar',
          tone: 'danger',
          onPress: async () => {
            try {
              await api.deletePost(userId, postId);
              setPosts((prev) => prev.filter((p) => p.id !== postId));
            } catch (err) {
              alertFailure('eliminar tu publicación', err);
            }
          },
        },
        { label: 'Cancelar', tone: 'cancel' },
      ],
    });
  };

  // El "···" disparaba directo Eliminar o Reportar según de quién fuera el post: mismo ícono,
  // dos acciones distintas y ninguna escrita. Ahora abre un menú con las opciones a la vista.
  const handleMenuPress = (post: CommunityPost) => {
    setMenuPost(post);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={c.primary} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerMeta}>
          <Text style={styles.headerTitle}>Comunidad</Text>
          <Text style={styles.headerSub}>Sede {sede}</Text>
        </View>
        {/* Acá había una segunda entrada al pánico: el SOS de la barra de abajo está
            en esta misma pantalla, más grande y en el mismo lugar de siempre. */}
      </View>

      {/* Tabs */}
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
          onPress={() => setTab('forum')}
          activeOpacity={0.7}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'forum' }}
        >
          <Text style={[styles.tabText, tab === 'forum' && styles.tabTextActive]}>Chat</Text>
          {tab === 'forum' && <View style={styles.tabUnderline} />}
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
      ) : (
        <KeyboardAvoidingView
          style={[styles.flex, styles.kav]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          {tab === 'announcements' ? (
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
            <>
              {/* Era un ScrollView con posts.map: en una sede activa se dibujaban
                  cientos de publicaciones de una vez, con sus respuestas. FlatList
                  monta solo lo que está a la vista. */}
              <FlatList
                style={styles.scroll}
                contentContainerStyle={styles.forumContent}
                showsVerticalScrollIndicator={false}
                data={posts}
                inverted={posts.length > 0}
                keyExtractor={(p) => p.id}
                initialNumToRender={6}
                maxToRenderPerBatch={8}
                windowSize={11}
                removeClippedSubviews
                keyboardShouldPersistTaps="handled"
                onEndReached={cargarMásAntiguos}
                onEndReachedThreshold={0.4}
                ListFooterComponent={
                  cargandoMás ? (
                    <ActivityIndicator size="small" color={c.primary} style={styles.cargandoMás} />
                  ) : null
                }
                ListEmptyComponent={
                  <EmptyState
                    iconName="message-circle"
                    title="Sé el primero en escribir"
                    text="Comparte cómo te sientes o anima a quienes están en el mismo camino."
                  />
                }
                renderItem={({ item: p, index }) => (
                  <PostCard
                    post={p}
                    isOwn={p.authorId === userId}
                    enviando={p.id === pendingPost?.id && !envíosFallidos[p.id]}
                    falló={!!envíosFallidos[p.id]}
                    // La lista llega de la más nueva a la más vieja y se pinta
                    // invertida, así que la de arriba en pantalla es index + 1.
                    showAuthor={posts[index + 1]?.authorId !== p.authorId}
                    díaEncima={
                      !posts[index + 1] ||
                      díasDistintos(posts[index + 1].createdAt, p.createdAt)
                        ? díaDelMensaje(p.createdAt)
                        : null
                    }
                    disabled={offline}
                    onReact={(emoji) => handleReaction(p, emoji)}
                    onResponder={() => citar(p)}
                    onReintentar={() => reintentarEnvío(p)}
                    onMenuPress={() => handleMenuPress(p)}
                  />
                )}
              />

              {/* A quién se está respondiendo, encima del composer */}
              {citando ? (
                <View style={styles.citaComposer}>
                  <View style={styles.citaComposerBarra} />
                  <View style={styles.flex1}>
                    <Text style={styles.citaComposerAutor} numberOfLines={1}>
                      Respondiendo a {citando.authorName}
                    </Text>
                    <Text style={styles.citaComposerCuerpo} numberOfLines={1}>
                      {citando.body}
                    </Text>
                  </View>
                  <Touchable
                    onPress={() => setCitando(null)}
                    hitSlop={12}
                    borderless
                    accessibilityRole="button"
                    accessibilityLabel="Dejar de responder a este mensaje"
                  >
                    <Icon name="x" size={18} color={c.fg2} />
                  </Touchable>
                </View>
              ) : null}

              {/* Composer */}
              <View style={[styles.composer, offline && styles.composerOff]}>
                <TextInput
                  style={styles.composerInput}
                  accessibilityLabel="Mensaje para la comunidad"
                  placeholder={offline ? 'Necesitas conexión para publicar' : 'Escribe un mensaje de apoyo…'}
                  placeholderTextColor={c.fg2}
                  value={draft}
                  onChangeText={setDraft}
                  editable={!offline}
                  multiline
                />
                <Touchable
      rippleColor="rgba(255,255,255,0.28)"
                  style={[styles.sendBtn, (offline || !draft.trim()) && styles.sendBtnDisabled]}
                  onPress={handlePost}
                  disabled={offline || !draft.trim() || posting}
                  accessibilityRole="button"
                  accessibilityLabel="Publicar mensaje"
                  accessibilityState={{ busy: posting }}
                  activeOpacity={0.85}
                >
                  {posting ? (
                    <ActivityIndicator size="small" color={c.white} />
                  ) : (
                    <Icon name="send" size={18} color={c.white} />
                  )}
                </Touchable>
              </View>
            </>
          )}
        </KeyboardAvoidingView>
      )}

      {/* Menú de la publicación: las opciones se leen antes de tocarlas */}
      <Modal
        visible={menuPost !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuPost(null)}
      >
        <Touchable
          style={styles.sheetBackdrop}
          activeOpacity={1}
          onPress={() => setMenuPost(null)}
          accessible={false}
        >
          <View style={styles.sheetCard}>
            {/* Las reacciones viven acá desde que la barra bajo cada mensaje se fue: en
                pantalla eran cuatro controles por burbuja, casi siempre sin usar, y el chat
                parecía una lista de fichas. Con toque largo o el «···» se llega igual. */}
            <View style={styles.sheetReacciones}>
              {REACTION_EMOJIS.map((emoji) => {
                const resumen = menuPost?.reactions.find((r) => r.emoji === emoji);
                return (
                  <Touchable
                    key={emoji}
                    style={[styles.sheetReaccion, resumen?.userReacted && styles.sheetReaccionOn]}
                    accessibilityRole="button"
                    accessibilityLabel={REACTION_NAME[emoji]}
                    accessibilityState={{ selected: !!resumen?.userReacted }}
                    onPress={() => {
                      const post = menuPost!;
                      setMenuPost(null);
                      void handleReaction(post, emoji);
                    }}
                  >
                    <Icon
                      name={REACTION_ICON_MAP[emoji]}
                      size={22}
                      color={resumen?.userReacted ? c.primary : c.fg1}
                    />
                    <Text style={styles.sheetReaccionTexto}>{REACTION_NAME[emoji]}</Text>
                  </Touchable>
                );
              })}
            </View>

            <Touchable
              style={styles.sheetItem}
              accessibilityRole="button"
              onPress={() => {
                const post = menuPost!;
                setMenuPost(null);
                citar(post);
              }}
            >
              <Icon name="message-circle" size={18} color={c.fg1} />
              <Text style={styles.sheetItemText}>Responder</Text>
            </Touchable>

            {menuPost?.authorId === userId ? (
              <Touchable
                style={styles.sheetItem}
                accessibilityRole="button"
                onPress={() => {
                  const id = menuPost.id;
                  setMenuPost(null);
                  handleDelete(id);
                }}
              >
                <Icon name="trash-2" size={18} color={c.dangerText} />
                <Text style={[styles.sheetItemText, { color: c.dangerText }]}>
                  Eliminar mi publicación
                </Text>
              </Touchable>
            ) : (
              <Touchable
                style={styles.sheetItem}
                accessibilityRole="button"
                onPress={() => {
                  const id = menuPost!.id;
                  setMenuPost(null);
                  handleReport(id);
                }}
              >
                <Icon name="flag" size={18} color={c.fg1} />
                <Text style={styles.sheetItemText}>Reportar publicación</Text>
              </Touchable>
            )}
            <Touchable
              style={styles.sheetItem}
              accessibilityRole="button"
              onPress={() => setMenuPost(null)}
            >
              <Icon name="x" size={18} color={c.fg2} />
              <Text style={[styles.sheetItemText, { color: c.fg2 }]}>Cancelar</Text>
            </Touchable>
          </View>
        </Touchable>
      </Modal>

      {/* CA5.3: motivo del reporte */}
      <Modal
        visible={reportPostId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setReportPostId(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reportar publicación</Text>
            <Text style={styles.modalText}>
              Cuéntanos por qué la reportas. El equipo clínico revisará tu reporte.
            </Text>
            <TextInput
              style={styles.modalInput}
              accessibilityLabel="Motivo del reporte"
              placeholder="Motivo del reporte…"
              placeholderTextColor={c.fg2}
              value={reportReason}
              onChangeText={setReportReason}
              multiline
              maxLength={500}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Touchable
                style={styles.modalCancel}
                onPress={() => setReportPostId(null)}
                accessibilityRole="button"
                disabled={reportSending}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </Touchable>
              <Touchable
      rippleColor="rgba(255,255,255,0.28)"
                style={[styles.modalSubmit, (!reportReason.trim() || reportSending) && styles.modalSubmitDisabled]}
                onPress={submitReport}
                disabled={!reportReason.trim() || reportSending}
                accessibilityRole="button"
                accessibilityLabel="Reportar"
                accessibilityState={{ busy: reportSending }}
              >
                {reportSending
                  ? <ActivityIndicator size="small" color={c.white} />
                  : <Text style={styles.modalSubmitText}>Reportar</Text>}
              </Touchable>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

// ── Subcomponentes ─────────────────────────────────────────────────────────

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

function PostCardBase({
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
  onReact: (emoji: ReactionEmoji) => void;
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
                  onPress={() => onReact(r.emoji)}
                  disabled={disabled}
                  hitSlop={{ top: 11, bottom: 11, left: 5, right: 5 }}
                  accessibilityRole="button"
                  accessibilityLabel={`${REACTION_NAME[r.emoji]}, ${r.count} ${r.count === 1 ? 'reacción' : 'reacciones'}`}
                  accessibilityState={{ selected: !!r.userReacted, disabled }}
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
const PostCard = React.memo(
  PostCardBase,
  (a, b) =>
    a.post === b.post &&
    a.isOwn === b.isOwn &&
    a.showAuthor === b.showAuthor &&
    a.disabled === b.disabled &&
    a.enviando === b.enviando &&
    a.falló === b.falló &&
    a.díaEncima === b.díaEncima,
);

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * El mensaje que se muestra mientras viaja al servidor.
 *
 * Usa la clave de idempotencia como id: así el reintento reconoce el mismo envío y, cuando
 * llega el de verdad, se sabe cuál reemplazar. `createdAt` es la hora del teléfono, que es
 * justo lo que el paciente espera ver en su propio mensaje.
 */
function mensajeEnCamino(
  requestId: string,
  body: string,
  sede: string,
  user: AuthUser | null,
  citado: QuotedMessage | null,
): CommunityPost {
  return {
    id: requestId,
    authorId: user?.id ?? '',
    authorName: user ? `${user.firstName} ${user.lastName}` : '',
    authorRole: user?.role ?? 'patient',
    type: 'forum_post',
    sede,
    title: null,
    body,
    eventDate: null,
    reportCount: 0,
    replyCount: 0,
    reactions: [],
    userAttends: false,
    replyTo: citado,
    createdAt: new Date().toISOString(),
  };
}


// Antes cada acción avisaba "Sin conexión" pasara lo que pasara: un 500 del
// servidor, el modo de prueba encendido y un corte de red real se veían igual, y
// el error no quedaba en ningún log, así que no había ni cómo diagnosticarlo.
//
// `action` se escribe en infinitivo ("enviar tu respuesta") para completar la
// frase "No se pudo ...".
function alertFailure(action: string, err: unknown) {
  // Deja rastro en logcat: el catch se lo tragaba y no quedaba nada que mirar.
  logWarn(`[Comunidad] falló ${action}:`, err);

  if (devFlags.simulateOffline) {
    toast(
      `No se intentó ${action}: tienes "Simular sin conexión" activado en Perfil.`,
      'error',
    );
    return;
  }

  if (isNetworkError(err)) {
    toast(`Sin conexión: no se pudo ${action}. Inténtalo de nuevo.`, 'error');
    return;
  }

  // `request()` lanza "<status> <cuerpo>" ante una respuesta no OK.
  const status = parseInt((err as Error)?.message ?? '', 10);
  toast(
    Number.isFinite(status)
      ? `No se pudo ${action}. El servidor respondió ${status}.`
      : `No se pudo ${action}. Inténtalo de nuevo.`,
    'error',
  );
}

function initial(name: string): string {
  return (name?.trim().charAt(0) || '?').toUpperCase();
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

/**
 * La hora del mensaje, como en WhatsApp.
 *
 * Antes decía "hace 3 h". Para quien usa WhatsApp todos los días (y la app la van a usar
 * adultos mayores) la hora exacta es el formato conocido, y además responde la pregunta que
 * uno se hace mirando un mensaje: a qué hora lo escribió.
 */
function horaDelMensaje(iso: string): string {
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
function díaDelMensaje(iso: string): string {
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
function díasDistintos(a: string, b: string): boolean {
  return new Date(a).toDateString() !== new Date(b).toDateString();
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
  kav: { backgroundColor: c.bg },

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
  // Con la lista invertida, el padding de abajo se ve arriba: va parejo.
  // El hueco chico es lo que agrupa visualmente una tanda del mismo autor.
  forumContent: { paddingHorizontal: 12, paddingVertical: 12, gap: 4 },

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

  // Avatares y autores
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

  flex1: { flex: 1 },

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
  replyLink: { fontFamily: Fonts.body, fontSize: 12, color: c.fg2, paddingVertical: 3, marginLeft: 6 },

  // Respuestas
  repliesWrap: { marginTop: 8, alignSelf: 'stretch' },
  cargandoMás: { paddingVertical: 16 },
  replyLoader: { alignSelf: 'flex-start', marginLeft: 12, marginVertical: 6 },
  reply: {
    marginLeft: 10,
    paddingLeft: 12,
    paddingVertical: 8,
    borderLeftWidth: 2,
    borderLeftColor: c.border,
  },
  replyHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatarSm: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarSmLetter: { fontFamily: Fonts.bodyBold, color: c.white, fontSize: 12 },
  replyName: { fontFamily: Fonts.bodyBold, fontSize: 13, color: c.ink900 },
  // Una respuesta del psicólogo no se lee igual que la de un par: sin la etiqueta es
  // un nombre más en el hilo.
  replyRoleChip: {
    backgroundColor: c.infoSurface, borderRadius: 9999,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  replyRoleText: { fontFamily: Fonts.bodyBold, fontSize: 10, color: c.primaryText },
  replyTime: { fontFamily: Fonts.body, fontSize: 12, color: c.fg2 },
  replyBody: { fontFamily: Fonts.body, fontSize: 13, color: c.ink900, lineHeight: 20, marginTop: 5, marginLeft: 36 },

  replyComposer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginLeft: 10,
    marginTop: 8,
  },
  replyInput: {
    fontFamily: Fonts.body,
    flex: 1,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: c.ink900,
    maxHeight: 90,
  },
  replySendBtn: {
    backgroundColor: c.primary,
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  replySendText: { fontFamily: Fonts.bodyBold, color: c.white, fontSize: 13 },

  // Composer foro
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: c.surface,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  composerOff: { opacity: 0.7 },
  composerInput: {
    fontFamily: Fonts.body,
    flex: 1,
    backgroundColor: c.bg,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 11,
    fontSize: 14,
    color: c.ink900,
    maxHeight: 110,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: c.border },

  readonlyNote: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  readonlyNoteText: { fontFamily: Fonts.body, fontSize: 12.5, color: c.fg2 },

  // Menú de la publicación
  sheetBackdrop: { flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' },
  sheetCard: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 26,
  },
  sheetTitle: { fontFamily: Fonts.headingBold, fontSize: 16, color: c.ink900, marginBottom: 6 },
  sheetReacciones: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 6,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  sheetReaccion: {
    alignItems: 'center',
    gap: 4,
    minWidth: 84,
    minHeight: 60,
    justifyContent: 'center',
    borderRadius: 14,
  },
  sheetReaccionOn: { backgroundColor: c.infoSurface },
  sheetReaccionTexto: { fontFamily: Fonts.body, fontSize: 12, color: c.fg2 },

  sheetItem: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 8 },
  sheetItemText: { fontFamily: Fonts.bodyBold, fontSize: 15, color: c.fg1 },

  // Modal de reporte (CA5.3)
  modalBackdrop: {
    flex: 1,
    backgroundColor: c.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: c.surface,
    borderRadius: 18,
    padding: 20,
    gap: 12,
  },
  modalTitle: { fontFamily: Fonts.headingBold, fontSize: 18, color: c.ink900 },
  modalText: { fontFamily: Fonts.body, fontSize: 14, color: c.fg2, lineHeight: 20 },
  modalInput: {
    fontFamily: Fonts.body,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: c.ink900,
    backgroundColor: c.bg,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  modalCancel: { paddingHorizontal: 18, paddingVertical: 11 },
  modalCancelText: { fontFamily: Fonts.bodyMedium, fontSize: 14, color: c.fg2 },
  modalSubmit: {
    backgroundColor: c.danger,
    borderRadius: 9999,
    paddingHorizontal: 22,
    paddingVertical: 11,
    minWidth: 110,
    alignItems: 'center',
  },
  modalSubmitDisabled: { backgroundColor: c.border },
  modalSubmitText: { fontFamily: Fonts.bodyBold, fontSize: 14, color: c.white },
  finishedChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9999,
    backgroundColor: c.bg,
    borderWidth: 1,
    borderColor: c.border,
  },
  finishedText: { fontFamily: Fonts.bodyBold, fontSize: 12.5, color: c.fg2 },

});
