import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
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
import { Icon } from '../components/Icon';
import { Colors } from '../constants/colors';
import { api } from '../services/api';

// Ajustar cuando se conecte la autenticación real
const TEMP_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEMP_SEDE = 'Santiago';

const REACTION_EMOJIS: ReactionEmoji[] = ['💪', '❤️', '🤗'];

const ROLE_LABEL: Record<UserRole, string> = {
  patient: 'Paciente',
  psychologist: 'Psicólogo',
  sponsor: 'Padrino',
  family: 'Familiar',
};

// Caché en memoria de lo último cargado, para mostrarlo sin conexión (CA4).
// Persiste mientras la app sigue viva; sobrevive a navegar entre pantallas.
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

  // Respuestas: expansión y cache por post
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [repliesByPost, setRepliesByPost] = useState<Record<string, CommunityReply[]>>({});
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});

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
    } catch (err) {
      // Sin conexión: caemos al último contenido cacheado (CA4)
      setOffline(true);
      setAnnouncements(offlineCache.announcements);
      setPosts(offlineCache.posts);
      // No exponemos datos del paciente en logs
      console.error('[CommunityScreen] load error', (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Asistencia a eventos ───────────────────────────────────────────────
  const handleToggleAttendance = async (announcementId: string) => {
    try {
      const { attends } = await api.toggleAttendance(TEMP_USER_ID, announcementId);
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === announcementId ? { ...a, userAttends: attends } : a)),
      );
    } catch {
      Alert.alert('Sin conexión', 'No se pudo actualizar tu asistencia. Inténtalo de nuevo.');
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
    } catch {
      Alert.alert('Sin conexión', 'No se pudo registrar tu reacción.');
    }
  };

  // ── Publicar en el foro ────────────────────────────────────────────────
  const handlePost = async () => {
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);
    try {
      const created = await api.createForumPost(TEMP_USER_ID, TEMP_SEDE, body);
      setPosts((prev) => [created, ...prev]);
      setDraft('');
    } catch {
      Alert.alert('Sin conexión', 'No se pudo publicar tu mensaje. Inténtalo de nuevo.');
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
    try {
      const created = await api.createReply(TEMP_USER_ID, postId, body);
      setRepliesByPost((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] ?? []), created],
      }));
      setReplyDraft((prev) => ({ ...prev, [postId]: '' }));
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, replyCount: p.replyCount + 1 } : p)),
      );
    } catch {
      Alert.alert('Sin conexión', 'No se pudo enviar tu respuesta.');
    }
  };

  // ── Reportar ───────────────────────────────────────────────────────────
  const handleReport = (postId: string) => {
    Alert.alert(
      'Reportar publicación',
      '¿Quieres reportar este mensaje al equipo clínico? Si recibe varios reportes será revisado.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Reportar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.reportPost(TEMP_USER_ID, postId);
              Alert.alert('Gracias', 'El equipo clínico revisará esta publicación.');
            } catch {
              Alert.alert('Sin conexión', 'No se pudo enviar el reporte.');
            }
          },
        },
      ],
    );
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

      {offline && (
        <View style={styles.offlineBanner}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="triangle-alert" size={14} color={Colors.accent} />
            <Text style={styles.offlineText}>Sin conexión · Solo lectura</Text>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior="padding"
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 120}
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
                      onReport={() => handleReport(p.id)}
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

      <BottomNav active="community" onTabPress={handleTabPress} onPanicPress={() => navigation.navigate('Panic')} />
    </SafeAreaView>
  );
}

// ── Subcomponentes ─────────────────────────────────────────────────────────

function EmptyState({ iconName, title, text }: { iconName: string; title: string; text: string }) {
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
  onReport,
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
  onReport: () => void;
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
        <TouchableOpacity onPress={onReport} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
              <Text style={styles.reactEmoji}>{emoji}</Text>
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

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 14,
    backgroundColor: Colors.primary,
    gap: 12,
  },
  headerMeta: { flex: 1, minWidth: 0 },
  headerTitle: { fontWeight: '700', fontSize: 20, color: Colors.white },
  headerSub: { fontSize: 14, color: Colors.teal400, marginTop: 3 },
  panicBtn: {
    backgroundColor: Colors.danger,
    borderRadius: 9999,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  panicBtnText: { color: Colors.white, fontWeight: '700', fontSize: 12 },

  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: { flex: 1, alignItems: 'center', paddingTop: 14, paddingBottom: 12 },
  tabText: { fontWeight: '600', fontSize: 14, color: Colors.fg2 },
  tabTextActive: { color: Colors.primary, fontWeight: '700' },
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
  offlineText: { color: Colors.accent, fontWeight: '700', fontSize: 13 },

  loader: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },

  scroll: { flex: 1, backgroundColor: Colors.bg },
  scrollContent: { padding: 12, paddingBottom: 120, gap: 12 },

  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  emptyTitle: { fontWeight: '700', fontSize: 18, color: Colors.ink900, marginBottom: 8 },
  emptyText: { fontSize: 14, color: Colors.fg2, textAlign: 'center', lineHeight: 21 },

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
  pinFlag: { fontSize: 11, fontWeight: '600', color: Colors.fg2 },
  pinHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pinTitle: { fontWeight: '700', fontSize: 15, color: Colors.primary, marginTop: 11 },
  pinBody: { fontSize: 15, color: Colors.ink900, lineHeight: 22, marginTop: 6 },
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
  annDate: { fontSize: 12, color: Colors.fg2, fontWeight: '600' },
  attendBtn: {
    backgroundColor: Colors.sage50,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  attendBtnOn: { backgroundColor: Colors.primary },
  attendBtnText: { fontWeight: '700', fontSize: 13, color: Colors.primary },
  attendBtnTextOn: { color: Colors.white },

  // Avatares y autores
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: Colors.white, fontWeight: '700', fontSize: 16 },
  authorName: { fontWeight: '600', fontSize: 14, color: Colors.ink900 },
  authorMeta: { fontSize: 12, color: Colors.fg2, marginTop: 1 },
  roleChip: {
    backgroundColor: Colors.sage50,
    borderRadius: 9999,
    paddingHorizontal: 11,
    paddingVertical: 4,
  },
  roleChipAdmin: { backgroundColor: Colors.amber50 },
  roleChipText: { fontWeight: '700', fontSize: 12, color: Colors.primary },
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
  msgBody: { fontSize: 15, color: Colors.ink900, lineHeight: 22, paddingTop: 10 },

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
  reactEmoji: { fontSize: 14 },
  reactCount: { fontSize: 12, fontWeight: '600', color: Colors.ink900 },
  replyLink: { fontSize: 12, fontWeight: '600', color: Colors.primary, paddingVertical: 5 },

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
  avatarSmLetter: { color: Colors.white, fontWeight: '700', fontSize: 12 },
  replyName: { fontWeight: '600', fontSize: 13, color: Colors.ink900 },
  replyTime: { fontSize: 11, color: Colors.fg2 },
  replyBody: { fontSize: 13, color: Colors.ink900, lineHeight: 20, marginTop: 5, marginLeft: 36 },

  replyComposer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginLeft: 10,
    marginTop: 8,
  },
  replyInput: {
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
  replySendText: { color: Colors.white, fontWeight: '700', fontSize: 13 },

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
  readonlyNoteText: { fontSize: 12.5, color: Colors.fg2 },
});
