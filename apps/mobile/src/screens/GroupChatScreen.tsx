import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthUser, CommunityPost, QuotedMessage, ReactionEmoji } from '@stopbet/shared-types';
import type { AppStackParamList } from '../navigation/types';
import { Icon } from '../components/Icon';
import {
  ChatMessage,
  CitaEnComposer,
  citaDe,
  díaDelMensaje,
  díasDistintos,
} from '../components/ChatMessage';
import {
  ComposerDeChat,
  DiálogoDeReporte,
  EncabezadoDeChat,
  MenuDeMensaje,
} from '../components/ChatSheets';
import type { Palette } from '../constants/colors';
import { useColors, useStyles } from '../context/ThemeContext';
import { Fonts } from '../constants/typography';
import { api } from '../services/api';
import { isNetworkError } from '../services/checkInQueue';
import { guardarEnCaché, leerDeCaché } from '../services/communityCache';
import { abrirStreamDeComunidad } from '../services/communityStream';
import { devFlags } from '../store/devFlags';
import { useToast } from '../context/ToastContext';
import { useCurrentUser, useUserId } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import { newRequestId, withRetry } from '../utils/retry';
import { avisarFalla } from '../utils/avisarFalla';
import { logError, logInfo } from '../utils/log';

// Igual que el valor por omisión del backend: la primera página y cada tanda siguiente.
const POSTS_POR_PÁGINA = 20;

type Props = NativeStackScreenProps<AppStackParamList, 'GroupChat'>;

/**
 * El chat de toda la sede. Vivía dentro de la pestaña Comunidad; desde que Comunidad es una
 * lista de chats (grupo fijo arriba y los mensajes directos debajo, como WhatsApp) se abre
 * como cualquier otra conversación, en el stack.
 */
export function GroupChatScreen({ navigation, route }: Props) {
  const { showDialog } = useDialog();
  const userId = useUserId();
  const user = useCurrentUser();
  const sede = user?.sedeId ?? '';
  const c = useColors();
  const styles = useStyles(makeStyles);
  const { showToast } = useToast();

  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  // El pánico llega con un borrador escrito: el paciente lo revisa y lo envía él.
  const [draft, setDraft] = useState(route.params?.draft ?? '');
  const [posting, setPosting] = useState(false);
  const [citando, setCitando] = useState<QuotedMessage | null>(null);
  const [menuPost, setMenuPost] = useState<CommunityPost | null>(null);
  const [reportPostId, setReportPostId] = useState<string | null>(null);

  // Claves de idempotencia de los envíos que todavía no confirmaron. Se guarda el texto junto
  // al id: si el paciente corrige lo que escribió antes de reintentar, es un mensaje distinto
  // y necesita clave nueva, o el backend le devolvería el anterior.
  const [pendingPost, setPendingPost] = useState<{ id: string; body: string } | null>(null);
  const [totalPosts, setTotalPosts] = useState(0);
  const [cargandoMás, setCargandoMás] = useState(false);
  const [envíosFallidos, setEnvíosFallidos] = useState<Record<string, boolean>>({});

  // `navigate` sobre una pantalla ya montada cambia los params pero no vuelve a correr el
  // `useState` inicial: sin esto, el borrador del pánico no aparecía si el chat ya estaba abierto.
  const borradorPedido = route.params?.draft;
  useEffect(() => {
    if (!borradorPedido) return;
    setDraft(borradorPedido);
    navigation.setParams({ draft: undefined });
  }, [borradorPedido, navigation]);

  const load = useCallback(async () => {
    try {
      const forum = await api.getForumPosts(userId, sede);
      setPosts(forum.data);
      setTotalPosts(forum.total);
      setOffline(false);
      guardarEnCaché(userId, { posts: forum.data });
    } catch (err) {
      // Sin conexión: se cae al último contenido guardado (CA4).
      setOffline(true);
      setPosts((await leerDeCaché(userId)).posts);
      // Sin red es un estado esperado, no un fallo: con console.error React Native levanta
      // el LogBox encima de la pantalla. No se exponen datos del paciente en logs.
      if (isNetworkError(err)) {
        logInfo('[GroupChat] sin conexión al cargar');
      } else {
        logError('[GroupChat] load error', (err as Error).message);
      }
    } finally {
      setLoading(false);
    }
  }, [sede, userId]);

  // El anuncio de una insignia (CA5.2) o de una alerta de pánico (CA5.1) lo publica el
  // backend mientras el paciente navega hacia acá: se recarga al enfocar, no solo al montar.
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  /**
   * Trae la página siguiente al llegar al final de la lista: en una conversación lo primero
   * que se busca es ver más atrás.
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
   * Los mensajes de los demás llegan solos mientras la pantalla está abierta. Solo con la
   * pantalla a la vista: una conexión abierta con la app en el bolsillo es batería del
   * paciente a cambio de nada, y al volver la carga trae lo que se perdió.
   */
  useFocusEffect(
    useCallback(() => {
      if (!sede || offline) return;
      return abrirStreamDeComunidad(sede, (evento) => {
        if (evento.kind !== 'post') return;
        const llegado = evento.post;
        setPosts((prev) => {
          // Lo propio ya está en la lista desde que se envió: el eco no lo duplica.
          if (prev.some((p) => p.id === llegado.id)) return prev;
          return [llegado, ...prev];
        });
        setTotalPosts((n) => n + 1);
      });
    }, [sede, offline]),
  );

  const handleReaction = async (post: CommunityPost, emoji: ReactionEmoji) => {
    const current = post.reactions.find((r) => r.emoji === emoji);
    const reacting = !current?.userReacted;
    try {
      const { reactions } = reacting
        ? await withRetry(() => api.addReaction(userId, post.id, emoji))
        : await withRetry(() => api.removeReaction(userId, post.id, emoji));
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, reactions } : p)));
    } catch (err) {
      avisarFalla('registrar tu reacción', err);
    }
  };

  const handlePost = async () => {
    const body = draft.trim();
    if (!body || posting) return;
    // Misma clave mientras el texto no cambie: el reintento se reconoce como el mismo envío.
    const requestId = pendingPost?.body === body ? pendingPost.id : newRequestId();
    setPendingPost({ id: requestId, body });
    setPosting(true);

    // El mensaje aparece al tiro con su reloj, como en cualquier chat.
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
      avisarFalla('publicar tu mensaje', err);
    } finally {
      setPosting(false);
    }
  };

  const citar = useCallback((post: CommunityPost) => {
    setCitando(citaDe(post));
  }, []);

  const reintentarEnvío = useCallback((post: CommunityPost) => {
    setPosts((prev) => prev.filter((p) => p.id !== post.id));
    setDraft(post.body);
    // Si citaba a alguien, la cita vuelve al composer junto con el texto.
    setCitando(post.replyTo ?? null);
    setEnvíosFallidos((prev) => {
      const { [post.id]: _descartado, ...resto } = prev;
      return resto;
    });
  }, []);

  const enviarReporte = async (reason: string) => {
    if (!reportPostId) return false;
    try {
      await withRetry(() => api.reportPost(userId, reportPostId, reason));
      // CA5.3: el backend deja de devolvérselo a quien reportó; se quita de la vista ya.
      setPosts((prev) => prev.filter((p) => p.id !== reportPostId));
      showToast('Gracias. El equipo clínico revisará esta publicación.');
      return true;
    } catch (err) {
      avisarFalla('enviar el reporte', err);
      return false;
    }
  };

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
              avisarFalla('eliminar tu publicación', err);
            }
          },
        },
        { label: 'Cancelar', tone: 'cancel' },
      ],
    });
  };

  const sinConexión = offline || devFlags.simulateOffline;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={c.primary} />
      <EncabezadoDeChat
        título={`Comunidad ${sede}`}
        subtítulo="Todos los de tu sede"
        avatar=""
        esGrupo
        onVolver={() => navigation.goBack()}
      />

      {/* El modo simulado producía un banner idéntico al de una caída real: se distinguen. */}
      {sinConexión && (
        <View style={styles.offlineBanner}>
          <Icon name="triangle-alert" size={14} color={c.accent} />
          <Text style={styles.offlineText}>
            {devFlags.simulateOffline
              ? 'Modo sin conexión SIMULADO · actívalo o apágalo en Perfil'
              : 'Sin conexión · Solo lectura'}
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={c.primaryText} />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={[styles.flex, styles.fondo]}
          // `height` también en Android, como el asistente: en Android 16 la app se dibuja de
          // borde a borde y `adjustResize` ya no achica la ventana, así que sin esto el campo
          // de texto quedaba debajo del teclado.
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <FlatList
            style={styles.flex}
            contentContainerStyle={styles.lista}
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
              <View style={styles.vacío}>
                <Icon name="message-circle" size={44} color={c.fg2} />
                <Text style={styles.vacíoTítulo}>Sé el primero en escribir</Text>
                <Text style={styles.vacíoTexto}>
                  Comparte cómo te sientes o anima a quienes están en el mismo camino.
                </Text>
              </View>
            }
            renderItem={({ item: p, index }) => (
              <ChatMessage
                post={p}
                isOwn={p.authorId === userId}
                enviando={p.id === pendingPost?.id && !envíosFallidos[p.id]}
                falló={!!envíosFallidos[p.id]}
                // La lista llega de la más nueva a la más vieja y se pinta invertida, así
                // que la de arriba en pantalla es index + 1.
                showAuthor={posts[index + 1]?.authorId !== p.authorId}
                díaEncima={
                  !posts[index + 1] || díasDistintos(posts[index + 1].createdAt, p.createdAt)
                    ? díaDelMensaje(p.createdAt)
                    : null
                }
                disabled={offline}
                onReact={(emoji) => handleReaction(p, emoji)}
                onResponder={() => citar(p)}
                onReintentar={() => reintentarEnvío(p)}
                onMenuPress={() => setMenuPost(p)}
              />
            )}
          />

          {citando ? <CitaEnComposer cita={citando} onQuitar={() => setCitando(null)} /> : null}
          <ComposerDeChat
            valor={draft}
            onCambio={setDraft}
            onEnviar={handlePost}
            apagado={offline}
            ocupado={posting}
            placeholder={offline ? 'Necesitas conexión para publicar' : 'Escribe un mensaje de apoyo…'}
            etiqueta="Mensaje para la comunidad"
          />
        </KeyboardAvoidingView>
      )}

      <MenuDeMensaje
        visible={menuPost !== null}
        reacciones={menuPost?.reactions}
        onReact={(emoji) => menuPost && void handleReaction(menuPost, emoji)}
        onClose={() => setMenuPost(null)}
        opciones={
          menuPost
            ? [
                { label: 'Responder', icon: 'message-circle', onPress: () => citar(menuPost) },
                menuPost.authorId === userId
                  ? {
                      label: 'Eliminar mi publicación',
                      icon: 'trash-2',
                      tone: 'danger',
                      onPress: () => handleDelete(menuPost.id),
                    }
                  : {
                      label: 'Reportar publicación',
                      icon: 'flag',
                      onPress: () => setReportPostId(menuPost.id),
                    },
              ]
            : []
        }
      />

      <DiálogoDeReporte
        visible={reportPostId !== null}
        título="Reportar publicación"
        texto="Cuéntanos por qué la reportas. El equipo clínico revisará tu reporte."
        onEnviar={enviarReporte}
        onClose={() => setReportPostId(null)}
      />
    </SafeAreaView>
  );
}

/**
 * El mensaje que se muestra mientras viaja al servidor. Usa la clave de idempotencia como id:
 * así el reintento reconoce el mismo envío y, cuando llega el de verdad, se sabe cuál
 * reemplazar.
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

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.primary },
  flex: { flex: 1 },
  fondo: { backgroundColor: c.bg },
  loader: { flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' },
  // Con la lista invertida, el padding de abajo se ve arriba: va parejo.
  lista: { paddingHorizontal: 12, paddingVertical: 12, gap: 4 },
  cargandoMás: { paddingVertical: 16 },

  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.amber50,
    borderBottomWidth: 1,
    borderBottomColor: c.accent,
    paddingVertical: 11,
    paddingHorizontal: 18,
  },
  offlineText: { fontFamily: Fonts.bodyBold, color: c.primaryText, fontSize: 13 },

  vacío: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  vacíoTítulo: { fontFamily: Fonts.headingBold, fontSize: 18, color: c.ink900 },
  vacíoTexto: { fontFamily: Fonts.body, fontSize: 14, color: c.fg2, textAlign: 'center', lineHeight: 21 },
});
