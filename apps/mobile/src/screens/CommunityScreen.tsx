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
  CommunityPost,
  CommunityReply,
  ReactionEmoji,
  ReactionSummary,
  UserRole,
} from '@stopbet/shared-types';
import type { AppStackParamList, MainTabsParamList } from '../navigation/types';
import { Icon, type IconName } from '../components/Icon';
import type { Palette } from '../constants/colors';
import { useColors, useStyles } from '../context/ThemeContext';
import { Fonts } from '../constants/typography';
import { api } from '../services/api';
import { isNetworkError } from '../services/checkInQueue';
import { readCommunity, saveCommunity } from '../services/offlineStore';
import { devFlags } from '../store/devFlags';
import { toast, useToast } from '../context/ToastContext';
import { Touchable } from '../components/Touchable';

// Ajustar cuando se conecte la autenticación real
const TEMP_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEMP_SEDE = 'Santiago';

const REACTION_EMOJIS: ReactionEmoji[] = ['💪', '❤️', '🤗'];

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

const ROLE_LABEL: Record<UserRole, string> = {
  patient: 'Paciente',
  psychologist: 'Psicólogo',
  sponsor: 'Padrino',
  family: 'Familiar',
  coordinator: 'Coordinador',
};

// Caché en memoria de lo último cargado, para mostrarlo sin conexión (CA4).
// Sobrevive a navegar entre pantallas, pero no al reinicio de la app: para eso
// se respalda en disco con saveCommunity/readCommunity.
const offlineCache: { announcements: CommunityPost[]; posts: CommunityPost[] } = {
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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [repliesByPost, setRepliesByPost] = useState<Record<string, CommunityReply[]>>({});
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});

  // Claves de idempotencia de los envíos que todavía no confirmaron. Se guarda el
  // texto junto al id: si el paciente corrige lo que escribió antes de reintentar,
  // eso es un mensaje distinto y necesita clave nueva, o el backend le devolvería
  // el anterior.
  const [pendingPost, setPendingPost] = useState<{ id: string; body: string } | null>(null);
  const [pendingReply, setPendingReply] = useState<Record<string, { id: string; body: string }>>({});

  const load = useCallback(async () => {
    try {
      const [anns, forum] = await Promise.all([
        api.getAnnouncements(TEMP_USER_ID, TEMP_SEDE),
        api.getForumPosts(TEMP_USER_ID, TEMP_SEDE),
      ]);
      setAnnouncements(anns);
      setPosts(forum.data);
      setOffline(false);
      // Guarda lo cargado para poder mostrarlo sin conexión (CA4)
      offlineCache.announcements = anns;
      offlineCache.posts = forum.data;
      void saveCommunity({ announcements: anns, posts: forum.data });
    } catch (err) {
      // Sin conexión: caemos al último contenido cacheado (CA4)
      setOffline(true);
      // El caché en memoria se vacía al reiniciar la app, y ahí el feed salía
      // vacío como si nadie hubiera publicado. Se completa desde disco.
      if (offlineCache.posts.length === 0 && offlineCache.announcements.length === 0) {
        const stored = await readCommunity();
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
        console.log('[CommunityScreen] sin conexión al cargar');
      } else {
        console.error('[CommunityScreen] load error', (err as Error).message);
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
      const { attends } = await withRetry(() => api.toggleAttendance(TEMP_USER_ID, announcementId));
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === announcementId ? { ...a, userAttends: attends } : a)),
      );
    } catch (err) {
      alertFailure('actualizar tu asistencia', err);
    }
  };

  // ── Reacciones ─────────────────────────────────────────────────────────
  const handleReaction = async (post: CommunityPost, emoji: ReactionEmoji) => {
    const current = post.reactions.find((r) => r.emoji === emoji);
    const reacting = !current?.userReacted;
    try {
      const { reactions } = reacting
        ? await withRetry(() => api.addReaction(TEMP_USER_ID, post.id, emoji))
        : await withRetry(() => api.removeReaction(TEMP_USER_ID, post.id, emoji));
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
    try {
      const created = await withRetry(() => api.createForumPost(TEMP_USER_ID, TEMP_SEDE, body, requestId));
      setPosts((prev) => [created, ...prev]);
      setDraft('');
      setPendingPost(null);
    } catch (err) {
      alertFailure('publicar tu mensaje', err);
    } finally {
      setPosting(false);
    }
  };

  // ── Respuestas ─────────────────────────────────────────────────────────
  const handleToggleReplies = async (postId: string) => {
    const willExpand = !expanded[postId];
    setExpanded((prev) => ({ ...prev, [postId]: willExpand }));
    if (willExpand && !repliesByPost[postId]) {
      try {
        const replies = await api.getReplies(TEMP_USER_ID, postId);
        setRepliesByPost((prev) => ({ ...prev, [postId]: replies }));
      } catch {
        setRepliesByPost((prev) => ({ ...prev, [postId]: [] }));
      }
    }
  };

  const handleReply = async (postId: string) => {
    const body = (replyDraft[postId] ?? '').trim();
    if (!body) return;
    const pending = pendingReply[postId];
    const requestId = pending?.body === body ? pending.id : newRequestId();
    setPendingReply((prev) => ({ ...prev, [postId]: { id: requestId, body } }));
    try {
      const created = await withRetry(() => api.createReply(TEMP_USER_ID, postId, body, requestId));
      // Si el envío anterior sí había llegado, el backend devuelve aquella misma
      // respuesta: se descarta el duplicado local en vez de mostrarla dos veces.
      setRepliesByPost((prev) => {
        const current = prev[postId] ?? [];
        if (current.some((r) => r.id === created.id)) return prev;
        return { ...prev, [postId]: [...current, created] };
      });
      setReplyDraft((prev) => ({ ...prev, [postId]: '' }));
      setPendingReply((prev) => {
        const { [postId]: _discarded, ...rest } = prev;
        return rest;
      });
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, replyCount: p.replyCount + 1 } : p)),
      );
    } catch (err) {
      alertFailure('enviar tu respuesta', err);
    }
  };

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
      await withRetry(() => api.reportPost(TEMP_USER_ID, reportPostId, reason));
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
    Alert.alert(
      'Eliminar publicación',
      '¿Seguro que quieres eliminarla? No podrás deshacerlo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deletePost(TEMP_USER_ID, postId);
              setPosts((prev) => prev.filter((p) => p.id !== postId));
            } catch (err) {
              alertFailure('eliminar tu publicación', err);
            }
          },
        },
      ],
    );
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
          <Text style={styles.headerSub}>Sede {TEMP_SEDE}</Text>
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
          <Text style={[styles.tabText, tab === 'forum' && styles.tabTextActive]}>Foro</Text>
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
                  text="Aquí verás los avisos y eventos de tu sede AJUTER."
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
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                data={posts}
                keyExtractor={(p) => p.id}
                initialNumToRender={6}
                maxToRenderPerBatch={8}
                windowSize={11}
                removeClippedSubviews
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <EmptyState
                    iconName="message-circle"
                    title="Sé el primero en escribir"
                    text="Comparte cómo te sientes o anima a quienes están en el mismo camino."
                  />
                }
                renderItem={({ item: p }) => (
                  <PostCard
                    post={p}
                    disabled={offline}
                    expanded={!!expanded[p.id]}
                    replies={repliesByPost[p.id]}
                    replyDraft={replyDraft[p.id] ?? ''}
                    onReact={(emoji) => handleReaction(p, emoji)}
                    onToggleReplies={() => handleToggleReplies(p.id)}
                    onChangeReplyDraft={(text) =>
                      setReplyDraft((prev) => ({ ...prev, [p.id]: text }))
                    }
                    onSendReply={() => handleReply(p.id)}
                    onMenuPress={() => handleMenuPress(p)}
                  />
                )}
              />

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
            <Text style={styles.sheetTitle}>Opciones de la publicación</Text>
            {menuPost?.authorId === TEMP_USER_ID ? (
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

function PostCard({
  post,
  disabled,
  expanded,
  replies,
  replyDraft,
  onReact,
  onToggleReplies,
  onChangeReplyDraft,
  onSendReply,
  onMenuPress,
}: {
  post: CommunityPost;
  disabled: boolean;
  expanded: boolean;
  replies?: CommunityReply[];
  replyDraft: string;
  onReact: (emoji: ReactionEmoji) => void;
  onToggleReplies: () => void;
  onChangeReplyDraft: (text: string) => void;
  onSendReply: () => void;
  onMenuPress: () => void;
}) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const summaryFor = (emoji: ReactionEmoji): ReactionSummary =>
    post.reactions.find((r) => r.emoji === emoji) ?? { emoji, count: 0, userReacted: false };

  return (
    <View style={styles.msgCard}>
      <View style={styles.msgHead}>
        <View style={[styles.avatar, { backgroundColor: c.teal400 }]}>
          <Text style={styles.avatarLetter}>{initial(post.authorName)}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.authorName}>{post.authorName}</Text>
          <Text style={styles.authorMeta}>{timeAgo(post.createdAt)}</Text>
        </View>
        <Touchable
          onPress={onMenuPress}
          hitSlop={14}
          accessibilityRole="button"
          accessibilityLabel="Opciones del mensaje"
        >
          <Icon name="ellipsis" size={20} color={c.fg2} />
        </Touchable>
      </View>

      <Text style={styles.msgBody}>{post.body}</Text>

      {/* Reacciones */}
      <View style={styles.reactRow}>
        {REACTION_EMOJIS.map((emoji) => {
          const s = summaryFor(emoji);
          return (
            <Touchable
              key={emoji}
              style={[styles.reactChip, s.userReacted && styles.reactChipOn]}
              onPress={() => onReact(emoji)}
              disabled={disabled}
              hitSlop={{ top: 11, bottom: 11, left: 5, right: 5 }}
              accessibilityRole="button"
              accessibilityLabel={`${REACTION_NAME[emoji]}, ${s.count} ${s.count === 1 ? 'reacción' : 'reacciones'}`}
              accessibilityState={{ selected: !!s.userReacted, disabled }}
              activeOpacity={0.7}
            >
              <Icon name={REACTION_ICON_MAP[emoji]} size={14} color={s.userReacted ? c.primary : c.fg2} />
              {s.count > 0 && <Text style={styles.reactCount}>{s.count}</Text>}
            </Touchable>
          );
        })}
        <View style={styles.flex} />
        <Touchable
          onPress={onToggleReplies}
          activeOpacity={0.7}
          hitSlop={{ top: 14, bottom: 14, left: 6, right: 6 }}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
        >
          <Text style={styles.replyLink}>
            {post.replyCount > 0 ? `${post.replyCount} respuestas` : 'Responder'}
          </Text>
        </Touchable>
      </View>

      {/* Respuestas */}
      {expanded && (
        <View style={styles.repliesWrap}>
          {replies === undefined ? (
            <ActivityIndicator size="small" color={c.primaryText} style={styles.replyLoader} />
          ) : (
            replies.map((r) => (
              <View key={r.id} style={styles.reply}>
                <View style={styles.replyHead}>
                  <View style={[styles.avatarSm, { backgroundColor: c.sage500 }]}>
                    <Text style={styles.avatarSmLetter}>{initial(r.authorName)}</Text>
                  </View>
                  <Text style={styles.replyName}>{r.authorName}</Text>
                  <Text style={styles.replyTime}>· {timeAgo(r.createdAt)}</Text>
                </View>
                <Text style={styles.replyBody}>{r.body}</Text>
              </View>
            ))
          )}

          {!disabled && (
            <View style={styles.replyComposer}>
              <TextInput
                style={styles.replyInput}
                accessibilityLabel="Tu respuesta"
                placeholder="Escribe una respuesta…"
                placeholderTextColor={c.fg2}
                value={replyDraft}
                onChangeText={onChangeReplyDraft}
                multiline
              />
              <Touchable
      rippleColor="rgba(255,255,255,0.28)"
                style={[styles.replySendBtn, !replyDraft.trim() && styles.sendBtnDisabled]}
                onPress={onSendReply}
                disabled={!replyDraft.trim()}
                accessibilityRole="button"
                activeOpacity={0.85}
              >
                <Text style={styles.replySendText}>Enviar</Text>
              </Touchable>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

// Android reutiliza conexiones de un pool. Si el servidor cerró una que quedó
// ociosa y la app manda un POST justo por ahí, la petición llega y se procesa,
// pero la respuesta se pierde: el cliente ve "Network request failed" con el
// cambio ya hecho. OkHttp reintenta solo los GET —nunca un POST, porque no sabe
// si es seguro repetirlo—, y por eso el feed carga bien y solo fallan las
// escrituras.
//
// Verificado en la tablet: `curl` al mismo endpoint responde 200 en 0,5 s
// mientras la app falla, y el reporte igual quedaba registrado.
//
// Reintentar es seguro porque estas escrituras ya son idempotentes: publicar y
// responder van con `clientRequestId`, y reportar comprueba en el backend antes
// de insertar.
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    // Da tiempo a que el pool descarte la conexión muerta antes de reintentar.
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 600));
    return fn();
  }
}

// Identifica un envío para que el backend reconozca el reintento. No es
// criptografía y no sale del par teléfono-servidor: solo tiene que ser
// irrepetible entre envíos, así que no se agrega una dependencia de UUID.
function newRequestId(): string {
  const rand = () => Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${rand()}-${rand()}`;
}

// Antes cada acción avisaba "Sin conexión" pasara lo que pasara: un 500 del
// servidor, el modo de prueba encendido y un corte de red real se veían igual, y
// el error no quedaba en ningún log, así que no había ni cómo diagnosticarlo.
//
// `action` se escribe en infinitivo ("enviar tu respuesta") para completar la
// frase "No se pudo ...".
function alertFailure(action: string, err: unknown) {
  // Deja rastro en logcat: el catch se lo tragaba y no quedaba nada que mirar.
  console.warn(`[Comunidad] falló ${action}:`, err);

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
  msgCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 14,
    shadowColor: c.shadowSoft,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  msgHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  msgBody: { fontFamily: Fonts.body, fontSize: 15, color: c.ink900, lineHeight: 22, paddingTop: 10 },

  reactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderTopWidth: 1,
    borderTopColor: c.border,
    paddingTop: 9,
    marginTop: 10,
  },
  reactChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: c.bg,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 9999,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  reactChipOn: { backgroundColor: c.sage50, borderColor: c.primary },
  reactCount: { fontFamily: Fonts.bodyBold, fontSize: 12, color: c.ink900 },
  replyLink: { fontFamily: Fonts.bodyBold, fontSize: 12, color: c.primaryText, paddingVertical: 5 },

  // Respuestas
  repliesWrap: { marginTop: 8 },
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
    backgroundColor: c.bg,
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
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheetCard: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 26,
  },
  sheetTitle: { fontFamily: Fonts.headingBold, fontSize: 16, color: c.ink900, marginBottom: 6 },
  sheetItem: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 8 },
  sheetItemText: { fontFamily: Fonts.bodyBold, fontSize: 15, color: c.fg1 },

  // Modal de reporte (CA5.3)
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
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
