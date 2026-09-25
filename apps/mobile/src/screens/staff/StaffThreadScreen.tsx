import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CommunityPost } from '@stopbet/shared-types';
import { Icon } from '../../components/Icon';
import { Touchable } from '../../components/Touchable';
import {
  ChatMessage,
  CitaEnComposer,
  citaDe,
  díaDelMensaje,
  díasDistintos,
} from '../../components/ChatMessage';
import type { Palette } from '../../constants/colors';
import { useColors, useStyles } from '../../context/ThemeContext';
import { Fonts } from '../../constants/typography';
import { useToast } from '../../context/ToastContext';
import { useDialog } from '../../context/DialogContext';
import { useUserId } from '../../context/AuthContext';
import { api } from '../../services/api';
import { isNetworkError } from '../../services/checkInQueue';
import { ROLE_LABEL } from '../../utils/roles';
import { newRequestId, withRetry } from '../../utils/retry';
import type { StaffStackParamList } from '../../navigation/types';
import { logWarn } from '../../utils/log';

const LARGO_MÁXIMO = 1000;

type Props = NativeStackScreenProps<StaffStackParamList, 'StaffThread'>;

/**
 * Responder a un mensaje del chat de la sede, con el mismo aspecto que el chat del paciente:
 * el mensaje citado arriba, lo que ya le respondieron debajo y la cita sobre el composer.
 *
 * Es una pantalla del stack y no un composer dentro de la pestaña Comunidad, por lo mismo
 * que `NewAnnouncementScreen`: Comunidad vive en un pager y con `adjustResize` el teclado
 * lo rearma en la primera página, así que la respuesta se perdía a medio escribir.
 *
 * Lo que el psicólogo escribe acá entra al chat de la sede como una respuesta más, firmada
 * con su nombre y su rol. No hay moderación en esta pantalla: eliminar sigue estando solo
 * en la pestaña «Reportadas», sobre lo que alguien denunció.
 */
export function StaffThreadScreen({ navigation, route }: Props) {
  const { post } = route.params;
  const c = useColors();
  const styles = useStyles(makeStyles);
  const { showToast } = useToast();
  const { showDialog } = useDialog();
  const userId = useUserId();

  const [respuestas, setRespuestas] = useState<CommunityPost[] | null>(null);
  const [error, setError] = useState(false);
  const [borrador, setBorrador] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Se conserva entre reintentos: si la respuesta se pierde de vuelta y el psicólogo
  // vuelve a enviar, el backend devuelve la que ya guardó en vez de publicarla dos veces.
  const envíoPendiente = useRef<{ id: string; body: string } | null>(null);

  const cargar = useCallback(async () => {
    if (!userId) return;
    try {
      setRespuestas(await api.getReplies(userId, post.id));
      setError(false);
    } catch {
      setError(true);
      setRespuestas([]);
    }
  }, [post.id, userId]);

  useEffect(() => { void cargar(); }, [cargar]);

  // El citado primero y sus respuestas debajo, de la más vieja a la más nueva, como se lee
  // una conversación.
  const mensajes = useMemo(
    () => [
      post,
      ...[...(respuestas ?? [])].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    ],
    [post, respuestas],
  );

  const enviar = async () => {
    const body = borrador.trim();
    if (!body || !userId) return;

    const pendiente = envíoPendiente.current;
    const requestId = pendiente?.body === body ? pendiente.id : newRequestId();
    envíoPendiente.current = { id: requestId, body };

    setEnviando(true);
    try {
      const creada = await withRetry(() => api.createReply(userId, post.id, body, requestId));
      setRespuestas((prev) => {
        const actuales = prev ?? [];
        // El reintento devuelve la respuesta ya guardada: se descarta el duplicado local.
        if (actuales.some((r) => r.id === creada.id)) return actuales;
        return [...actuales, creada];
      });
      setBorrador('');
      envíoPendiente.current = null;
    } catch (err) {
      logWarn('[Comunidad] falló enviar la respuesta del psicólogo:', err);
      showToast(
        isNetworkError(err)
          ? 'Sin conexión: no se envió. Tu texto sigue acá.'
          : 'No pudimos enviar tu respuesta. Tu texto sigue acá.',
        'error',
      );
    } finally {
      setEnviando(false);
    }
  };

  // Responder a una de las respuestas abre su propia conversación: en el chat, la cita
  // tiene que apuntar al mensaje que se contesta.
  const abrirMenú = useCallback(
    (mensaje: CommunityPost) => {
      if (mensaje.id === post.id) return;
      showDialog({
        title: `Mensaje de ${mensaje.authorName}`,
        actions: [
          { label: 'Responder', onPress: () => navigation.push('StaffThread', { post: mensaje }) },
          { label: 'Cancelar', tone: 'cancel' },
        ],
      });
    },
    [navigation, post.id, showDialog],
  );

  const puedeEnviar = borrador.trim().length > 0 && !enviando;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={c.primary} />

      <View style={styles.header}>
        <Touchable
          style={styles.volver}
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Volver al chat"
        >
          <Icon name="chevron-left" size={24} color={c.white} />
        </Touchable>
        <View style={styles.flex}>
          <Text style={styles.titulo} numberOfLines={1}>Responder a {post.authorName}</Text>
          <Text style={styles.subtitulo}>Chat de la sede</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={[styles.flex, styles.fondo]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Virtualizada: un mensaje activo puede tener decenas de respuestas, y el composer
            está fuera de la lista, así que el teclado no la remonta. */}
        <FlatList
          style={styles.flex}
          contentContainerStyle={styles.contenido}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          data={mensajes}
          keyExtractor={(m) => m.id}
          renderItem={({ item: m, index }) => (
            <ChatMessage
              post={m}
              isOwn={m.authorId === userId}
              enviando={false}
              falló={false}
              showAuthor={mensajes[index - 1]?.authorId !== m.authorId}
              díaEncima={
                !mensajes[index - 1] || díasDistintos(mensajes[index - 1].createdAt, m.createdAt)
                  ? díaDelMensaje(m.createdAt)
                  : null
              }
              disabled={false}
              onResponder={() => abrirMenú(m)}
              onReintentar={() => {}}
              onMenuPress={() => abrirMenú(m)}
            />
          )}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={9}
          removeClippedSubviews
          ListFooterComponent={
            respuestas === null ? (
              <ActivityIndicator size="small" color={c.primaryText} style={styles.cargando} />
            ) : error ? (
              <View style={styles.errorCaja}>
                <Text style={styles.errorTexto}>
                  No pudimos cargar las respuestas. Lo que ves puede estar incompleto.
                </Text>
                <Touchable style={styles.errorBoton} onPress={cargar} accessibilityRole="button">
                  <Text style={styles.errorBotonTexto}>Reintentar</Text>
                </Touchable>
              </View>
            ) : respuestas.length === 0 ? (
              <Text style={styles.sinRespuestas}>
                Todavía nadie responde. Si escribes, te lee toda la comunidad de la sede.
              </Text>
            ) : null
          }
        />

        <CitaEnComposer cita={citaDe(post)} />
        <Text style={styles.avisoVisible}>
          Respondes como {ROLE_LABEL.psychologist}: tu nombre y tu rol quedan a la vista de
          toda la sede.
        </Text>
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={borrador}
            onChangeText={setBorrador}
            placeholder="Escribe una respuesta…"
            placeholderTextColor={c.fg2}
            accessibilityLabel="Tu respuesta"
            maxLength={LARGO_MÁXIMO}
            multiline
            editable={!enviando}
          />
          <Touchable
            style={[styles.enviar, !puedeEnviar && styles.enviarApagado]}
            onPress={enviar}
            disabled={!puedeEnviar}
            hitSlop={4}
            rippleColor="rgba(255,255,255,0.28)"
            accessibilityRole="button"
            accessibilityLabel="Enviar la respuesta"
            accessibilityState={{ disabled: !puedeEnviar, busy: enviando }}
          >
            {enviando ? (
              <ActivityIndicator size="small" color={c.white} />
            ) : (
              <Icon name="send" size={18} color={c.white} />
            )}
          </Touchable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.primary },
  flex: { flex: 1 },
  fondo: { backgroundColor: c.bg },

  header: {
    backgroundColor: c.primary, flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingTop: 14, paddingBottom: 14,
  },
  volver: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontFamily: Fonts.headingBold, fontSize: 20, color: c.white, letterSpacing: -0.3 },
  subtitulo: { fontFamily: Fonts.body, fontSize: 12, color: c.onPrimaryMuted },

  contenido: { paddingHorizontal: 12, paddingVertical: 12 },

  cargando: { paddingVertical: 20 },
  sinRespuestas: {
    fontFamily: Fonts.body, fontSize: 13, color: c.fg2,
    textAlign: 'center', lineHeight: 20, paddingHorizontal: 16, paddingVertical: 24,
  },

  errorCaja: {
    backgroundColor: c.dangerSurface, borderWidth: 1, borderColor: c.dangerBorder,
    borderRadius: 14, padding: 13, gap: 10, alignItems: 'flex-start', marginTop: 12,
  },
  errorTexto: { fontFamily: Fonts.body, fontSize: 13, color: c.fg1, lineHeight: 19 },
  errorBoton: {
    minHeight: 44, justifyContent: 'center', paddingHorizontal: 16,
    borderRadius: 9999, borderWidth: 1.5, borderColor: c.dangerText,
  },
  errorBotonTexto: { fontFamily: Fonts.bodyBold, fontSize: 14, color: c.dangerText },

  avisoVisible: {
    fontFamily: Fonts.body, fontSize: 12, color: c.fg2, lineHeight: 18,
    paddingHorizontal: 16, paddingTop: 8, backgroundColor: c.surface,
  },
  // El mismo composer que el del chat del paciente.
  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 14,
    backgroundColor: c.surface,
  },
  input: {
    fontFamily: Fonts.body, flex: 1, backgroundColor: c.bg,
    borderWidth: 1, borderColor: c.border, borderRadius: 24,
    paddingHorizontal: 16, paddingVertical: 11, fontSize: 14, color: c.ink900, maxHeight: 110,
  },
  enviar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: c.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  enviarApagado: { backgroundColor: c.border },
});
