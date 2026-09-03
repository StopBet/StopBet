import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type {
  CommunityPost,
  CommunityReply,
  ReactionEmoji,
  ReactionSummary,
  UserRole,
} from '@stopbet/shared-types';
import type { AppStackParamList } from '../navigation/types';
import { BottomNav } from '../components/BottomNav';
import { Icon, type IconName } from '../components/Icon';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/typography';
import { api } from '../services/api';
import { isNetworkError } from '../services/checkInQueue';
import { readCommunity, saveCommunity } from '../services/offlineStore';
import { devFlags } from '../store/devFlags';

// Ajustar cuando se conecte la autenticación real
const TEMP_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEMP_SEDE = 'Santiago';

const REACTION_EMOJIS: ReactionEmoji[] = ['💪', '❤️', '🤗'];

const REACTION_ICON_MAP: Record<ReactionEmoji, IconName> = {
  '💪': 'hand-heart',
  '❤️': 'heart',
  '🤗': 'smile',
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

type Props = NativeStackScreenProps<AppStackParamList, 'Community'>;

export function CommunityScreen({ navigation, route }: Props) {
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
      const { attends } = await api.toggleAttendance(TEMP_USER_ID, announcementId);
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
        ? await api.addReaction(TEMP_USER_ID, post.id, emoji)
        : await api.removeReaction(TEMP_USER_ID, post.id, emoji);
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
      const created = await api.createForumPost(TEMP_USER_ID, TEMP_SEDE, body, requestId);
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
      const created = await api.createReply(TEMP_USER_ID, postId, body, requestId);
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
      await api.reportPost(TEMP_USER_ID, reportPostId, reason);
      // CA5.3: el backend ya deja de devolvérselo a quien reportó, pero
      // la pantalla carga una sola vez y el post seguía a la vista hasta
      // salir y volver. Se quita del feed apenas se confirma.
      setPosts((prev) => prev.filter((p) => p.id !== reportPostId));
      setAnnouncements((prev) => prev.filter((p) => p.id !== reportPostId));
      setReportPostId(null);
      Alert.alert('Gracias', 'El equipo clínico revisará esta publicación.');
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

  const handleMenuPress = (post: CommunityPost) => {
    if (post.authorId === TEMP_USER_ID) handleDelete(post.id);
    else handleReport(post.id);
  };

  const handleTabPress = (navTab: 'home' | 'community' | 'achievements' | 'profile') => {
    if (navTab === 'home') navigation.navigate('Home');
    else if (navTab === 'achievements') navigation.navigate('Achievements');
    else if (navTab === 'profile') navigation.navigate('Profile');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerMeta}>
          <Text style={styles.headerTitle}>Comunidad</Text>
          <Text style={styles.headerSub}>Sede {TEMP_SEDE}</Text>
        </View>
        <TouchableOpacity
          style={styles.panicBtn}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Panic')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Icon name="siren" size={14} color={Colors.white} />
            <Text style={styles.panicBtnText}>Pánico</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity style={styles.tab} onPress={() => setTab('announcements')} activeOpacity={0.7}>
          <Text style={[styles.tabText, tab === 'announcements' && styles.tabTextActive]}>
            Anuncios
          </Text>
          {tab === 'announcements' && <View style={styles.tabUnderline} />}
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab} onPress={() => setTab('forum')} activeOpacity={0.7}>
          <Text style={[styles.tabText, tab === 'forum' && styles.tabTextActive]}>Foro</Text>
          {tab === 'forum' && <View style={styles.tabUnderline} />}
        </TouchableOpacity>
      </View>

      {/* El modo simulado producía un banner idéntico al de una caída real, así que
          no había forma de saber si la app estaba rota o si el flag quedó encendido. */}
      {(offline || devFlags.simulateOffline) && (
        <View style={styles.offlineBanner}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="triangle-alert" size={14} color={Colors.accent} />
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
          <ActivityIndicator size="large" color={Colors.primary} />
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
                  <Icon name="lock" size={13} color={Colors.fg2} />
                  <Text style={styles.readonlyNoteText}>Solo el equipo puede publicar en Anuncios</Text>
                </View>
              </View>
            </ScrollView>
          ) : (
            <>
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                {posts.length === 0 ? (
                  <EmptyState
                    iconName="message-circle"
                    title="Sé el primero en escribir"
                    text="Comparte cómo te sientes o anima a quienes están en el mismo camino."
                  />
                ) : (
                  posts.map((p) => (
                    <PostCard
                      key={p.id}
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
                  ))
                )}
              </ScrollView>

              {/* Composer */}
              <View style={[styles.composer, offline && styles.composerOff]}>
                <TextInput
                  style={styles.composerInput}
                  placeholder={offline ? 'Necesitas conexión para publicar' : 'Escribe un mensaje de apoyo…'}
                  placeholderTextColor={Colors.fg2}
                  value={draft}
                  onChangeText={setDraft}
                  editable={!offline}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.sendBtn, (offline || !draft.trim()) && styles.sendBtnDisabled]}
                  onPress={handlePost}
                  disabled={offline || !draft.trim() || posting}
                  activeOpacity={0.85}
                >
                  {posting ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <Icon name="send" size={18} color={Colors.white} />
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </KeyboardAvoidingView>
      )}

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
              placeholder="Motivo del reporte…"
              placeholderTextColor={Colors.fg2}
              value={reportReason}
              onChangeText={setReportReason}
              multiline
              maxLength={500}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setReportPostId(null)}
                disabled={reportSending}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmit, (!reportReason.trim() || reportSending) && styles.modalSubmitDisabled]}
                onPress={submitReport}
                disabled={!reportReason.trim() || reportSending}
              >
                {reportSending
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <Text style={styles.modalSubmitText}>Reportar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <BottomNav active="community" onTabPress={handleTabPress} onPanicPress={() => navigation.navigate('Panic')} />
    </SafeAreaView>
  );
}

// ── Subcomponentes ─────────────────────────────────────────────────────────

function EmptyState({ iconName, title, text }: { iconName: IconName; title: string; text: string }) {
  return (
    <View style={styles.emptyCard}>
      <Icon name={iconName} size={44} color={Colors.fg2} />
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
  const isPsychologist = announcement.authorRole === 'psychologist';
  return (
    <View style={styles.pinCard}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 }}>
        <Icon name="bell" size={12} color={Colors.fg2} />
        <Text style={styles.pinFlag}>Equipo clínico · Sede {announcement.sede}</Text>
      </View>
      <View style={styles.pinHead}>
        <View style={[styles.avatar, { backgroundColor: isPsychologist ? Colors.primary : Colors.accent }]}>
          <Text style={styles.avatarLetter}>{initial(announcement.authorName)}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.authorName}>{announcement.authorName}</Text>
          <Text style={styles.authorMeta}>
            {ROLE_LABEL[announcement.authorRole]} · {timeAgo(announcement.createdAt)}
          </Text>
        </View>
        <View style={[styles.roleChip, !isPsychologist && styles.roleChipAdmin]}>
          <Text style={[styles.roleChipText, !isPsychologist && styles.roleChipTextAdmin]}>
            {isPsychologist ? 'Psicólogo' : 'Admin'}
          </Text>
        </View>
      </View>
      {!!announcement.title && <Text style={styles.pinTitle}>{announcement.title}</Text>}
      <Text style={styles.pinBody}>{announcement.body}</Text>
      {!!announcement.eventDate && (
        <View style={styles.annCta}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Icon name="calendar" size={12} color={Colors.fg2} />
            <Text style={styles.annDate}>{formatEventDate(announcement.eventDate)}</Text>
          </View>
          <TouchableOpacity
            style={[styles.attendBtn, announcement.userAttends && styles.attendBtnOn]}
            onPress={onToggleAttendance}
            disabled={disabled}
            activeOpacity={0.85}
          >
            {announcement.userAttends ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Icon name="check" size={14} color={Colors.white} />
                <Text style={[styles.attendBtnText, styles.attendBtnTextOn]}>Asistiré</Text>
              </View>
            ) : (
              <Text style={styles.attendBtnText}>Confirmar asistencia</Text>
            )}
          </TouchableOpacity>
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
  const summaryFor = (emoji: ReactionEmoji): ReactionSummary =>
    post.reactions.find((r) => r.emoji === emoji) ?? { emoji, count: 0, userReacted: false };

  return (
    <View style={styles.msgCard}>
      <View style={styles.msgHead}>
        <View style={[styles.avatar, { backgroundColor: Colors.teal400 }]}>
          <Text style={styles.avatarLetter}>{initial(post.authorName)}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.authorName}>{post.authorName}</Text>
          <Text style={styles.authorMeta}>{timeAgo(post.createdAt)}</Text>
        </View>
        <TouchableOpacity onPress={onMenuPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="ellipsis" size={20} color={Colors.fg2} />
        </TouchableOpacity>
      </View>

      <Text style={styles.msgBody}>{post.body}</Text>

      {/* Reacciones */}
      <View style={styles.reactRow}>
        {REACTION_EMOJIS.map((emoji) => {
          const s = summaryFor(emoji);
          return (
            <TouchableOpacity
              key={emoji}
              style={[styles.reactChip, s.userReacted && styles.reactChipOn]}
              onPress={() => onReact(emoji)}
              disabled={disabled}
              activeOpacity={0.7}
            >
              <Icon name={REACTION_ICON_MAP[emoji]} size={14} color={s.userReacted ? Colors.primary : Colors.fg2} />
              {s.count > 0 && <Text style={styles.reactCount}>{s.count}</Text>}
            </TouchableOpacity>
          );
        })}
        <View style={styles.flex} />
        <TouchableOpacity onPress={onToggleReplies} activeOpacity={0.7}>
          <Text style={styles.replyLink}>
            {post.replyCount > 0 ? `${post.replyCount} respuestas` : 'Responder'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Respuestas */}
      {expanded && (
        <View style={styles.repliesWrap}>
          {replies === undefined ? (
            <ActivityIndicator size="small" color={Colors.primary} style={styles.replyLoader} />
          ) : (
            replies.map((r) => (
              <View key={r.id} style={styles.reply}>
                <View style={styles.replyHead}>
                  <View style={[styles.avatarSm, { backgroundColor: Colors.sage500 }]}>
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
                placeholder="Escribe una respuesta…"
                placeholderTextColor={Colors.fg2}
                value={replyDraft}
                onChangeText={onChangeReplyDraft}
                multiline
              />
              <TouchableOpacity
                style={[styles.replySendBtn, !replyDraft.trim() && styles.sendBtnDisabled]}
                onPress={onSendReply}
                disabled={!replyDraft.trim()}
                activeOpacity={0.85}
              >
                <Text style={styles.replySendText}>Enviar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

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
    Alert.alert(
      'Modo sin conexión simulado',
      `No se intentó ${action}: tienes activado "Simular sin conexión" en Perfil → ` +
        'Herramientas de prueba. Apágalo para volver a la normalidad.',
    );
    return;
  }

  if (isNetworkError(err)) {
    Alert.alert('Sin conexión', `No se pudo ${action}. Revisa tu conexión e inténtalo de nuevo.`);
    return;
  }

  // `request()` lanza "<status> <cuerpo>" ante una respuesta no OK.
  const status = parseInt((err as Error)?.message ?? '', 10);
  Alert.alert(
    'No se pudo completar',
    Number.isFinite(status)
      ? `No se pudo ${action}. El servidor respondió ${status}.`
      : `No se pudo ${action}. Inténtalo de nuevo.`,
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
  return d.toLocaleDateString('es-CL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.primary },
  flex: { flex: 1 },
  kav: { backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: Colors.primary,
    gap: 12,
  },
  headerMeta: { flex: 1, minWidth: 0 },
  headerTitle: { fontFamily: Fonts.headingBold, fontSize: 20, color: Colors.white },
  headerSub: { fontFamily: Fonts.body, fontSize: 14, color: Colors.teal400, marginTop: 3 },
  panicBtn: {
    backgroundColor: Colors.danger,
    borderRadius: 9999,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  panicBtnText: { fontFamily: Fonts.bodyBold, color: Colors.white, fontSize: 12 },

  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: { flex: 1, alignItems: 'center', paddingTop: 14, paddingBottom: 12 },
  tabText: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.fg2 },
  tabTextActive: { fontFamily: Fonts.bodyBold, color: Colors.primary },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    height: 2,
    width: '60%',
    backgroundColor: Colors.primary,
  },

  offlineBanner: {
    backgroundColor: Colors.amber50,
    borderBottomWidth: 1,
    borderBottomColor: Colors.accent,
    paddingVertical: 11,
    paddingHorizontal: 18,
  },
  offlineText: { fontFamily: Fonts.bodyBold, color: Colors.accent, fontSize: 13 },

  loader: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },

  scroll: { flex: 1, backgroundColor: Colors.bg },
  scrollContent: { padding: 12, paddingBottom: 24, gap: 12 },

  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  emptyTitle: { fontFamily: Fonts.headingBold, fontSize: 18, color: Colors.ink900, marginBottom: 8 },
  emptyText: { fontFamily: Fonts.body, fontSize: 14, color: Colors.fg2, textAlign: 'center', lineHeight: 21 },

  // Anuncios
  pinCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderTopWidth: 3,
    borderTopColor: Colors.primary,
    padding: 14,
    shadowColor: Colors.shadowSoft,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  pinFlag: { fontFamily: Fonts.bodyBold, fontSize: 11, color: Colors.fg2 },
  pinHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pinTitle: { fontFamily: Fonts.bodyBold, fontSize: 15, color: Colors.primary, marginTop: 11 },
  pinBody: { fontFamily: Fonts.body, fontSize: 15, color: Colors.ink900, lineHeight: 22, marginTop: 6 },
  annCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 10,
    flexWrap: 'wrap',
  },
  annDate: { fontFamily: Fonts.bodyBold, fontSize: 12, color: Colors.fg2 },
  attendBtn: {
    backgroundColor: Colors.sage50,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  attendBtnOn: { backgroundColor: Colors.primary },
  attendBtnText: { fontFamily: Fonts.bodyBold, fontSize: 13, color: Colors.primary },
  attendBtnTextOn: { color: Colors.white },

  // Avatares y autores
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontFamily: Fonts.bodyBold, color: Colors.white, fontSize: 16 },
  authorName: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.ink900 },
  authorMeta: { fontFamily: Fonts.body, fontSize: 12, color: Colors.fg2, marginTop: 1 },
  roleChip: {
    backgroundColor: Colors.sage50,
    borderRadius: 9999,
    paddingHorizontal: 11,
    paddingVertical: 4,
  },
  roleChipAdmin: { backgroundColor: Colors.amber50 },
  roleChipText: { fontFamily: Fonts.bodyBold, fontSize: 12, color: Colors.primary },
  roleChipTextAdmin: { color: Colors.accent },

  // Foro
  msgCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    shadowColor: Colors.shadowSoft,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  msgHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  msgBody: { fontFamily: Fonts.body, fontSize: 15, color: Colors.ink900, lineHeight: 22, paddingTop: 10 },

  reactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 9,
    marginTop: 10,
  },
  reactChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 9999,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  reactChipOn: { backgroundColor: Colors.sage50, borderColor: Colors.primary },
  reactCount: { fontFamily: Fonts.bodyBold, fontSize: 12, color: Colors.ink900 },
  replyLink: { fontFamily: Fonts.bodyBold, fontSize: 12, color: Colors.primary, paddingVertical: 5 },

  // Respuestas
  repliesWrap: { marginTop: 8 },
  replyLoader: { alignSelf: 'flex-start', marginLeft: 12, marginVertical: 6 },
  reply: {
    marginLeft: 10,
    paddingLeft: 12,
    paddingVertical: 8,
    borderLeftWidth: 2,
    borderLeftColor: Colors.border,
  },
  replyHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatarSm: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarSmLetter: { fontFamily: Fonts.bodyBold, color: Colors.white, fontSize: 12 },
  replyName: { fontFamily: Fonts.bodyBold, fontSize: 13, color: Colors.ink900 },
  replyTime: { fontFamily: Fonts.body, fontSize: 11, color: Colors.fg2 },
  replyBody: { fontFamily: Fonts.body, fontSize: 13, color: Colors.ink900, lineHeight: 20, marginTop: 5, marginLeft: 36 },

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
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: Colors.ink900,
    maxHeight: 90,
  },
  replySendBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  replySendText: { fontFamily: Fonts.bodyBold, color: Colors.white, fontSize: 13 },

  // Composer foro
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  composerOff: { opacity: 0.7 },
  composerInput: {
    fontFamily: Fonts.body,
    flex: 1,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 11,
    fontSize: 14,
    color: Colors.ink900,
    maxHeight: 110,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: Colors.border },

  readonlyNote: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  readonlyNoteText: { fontFamily: Fonts.body, fontSize: 12.5, color: Colors.fg2 },

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
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 20,
    gap: 12,
  },
  modalTitle: { fontFamily: Fonts.headingBold, fontSize: 18, color: Colors.ink900 },
  modalText: { fontFamily: Fonts.body, fontSize: 14, color: Colors.fg2, lineHeight: 20 },
  modalInput: {
    fontFamily: Fonts.body,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.ink900,
    backgroundColor: Colors.bg,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  modalCancel: { paddingHorizontal: 18, paddingVertical: 11 },
  modalCancelText: { fontFamily: Fonts.bodyMedium, fontSize: 14, color: Colors.fg2 },
  modalSubmit: {
    backgroundColor: Colors.danger,
    borderRadius: 9999,
    paddingHorizontal: 22,
    paddingVertical: 11,
    minWidth: 110,
    alignItems: 'center',
  },
  modalSubmitDisabled: { backgroundColor: Colors.border },
  modalSubmitText: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.white },
});
