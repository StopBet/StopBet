import React, { useCallback, useMemo, useState } from 'react';
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
import type {
  AuthUser,
  CommunityPost,
  DirectMessage,
  QuotedMessage,
} from '@stopbet/shared-types';
import type { AppStackParamList } from '../navigation/types';
import { Icon } from '../components/Icon';
import { Touchable } from '../components/Touchable';
import {
  ChatMessage,
  CitaEnComposer,
  díaDelMensaje,
  díasDistintos,
  initial,
} from '../components/ChatMessage';
import {
  ComposerDeChat,
  DiálogoDeReporte,
  EncabezadoDeChat,
  MenuDeMensaje,
  type OpciónDeMenú,
  useMargenInferior,
} from '../components/ChatSheets';
import type { Palette } from '../constants/colors';
import { useColors, useStyles } from '../context/ThemeContext';
import { Fonts } from '../constants/typography';
import { api } from '../services/api';
import { abrirStreamDeMensajes } from '../services/communityStream';
import { useToast } from '../context/ToastContext';
import { useCurrentUser } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import { ROLE_LABEL } from '../utils/roles';
import { newRequestId, withRetry } from '../utils/retry';
import { avisarFalla, estadoDe } from '../utils/avisarFalla';

const POR_PÁGINA = 30;
const LARGO_DE_CITA = 120;

type Props = NativeStackScreenProps<AppStackParamList, 'DirectChat'>;

/**
 * Una conversación uno a uno con alguien de la sede.
 *
 * Es privada: el equipo clínico no la lee. Lo único que llega a moderación es un mensaje que
 * alguien reporte (decisión del PO del 30-09). Por eso el menú ofrece reportar y bloquear, que
 * en el grupo cubre la mirada de toda la sede y acá no hay nadie más mirando.
 */
export function DirectChatScreen({ navigation, route }: Props) {
  const { userId: otherId, name } = route.params;
  const user = useCurrentUser();
  const meId = user?.id ?? '';
  const c = useColors();
  const styles = useStyles(makeStyles);
  const { showToast } = useToast();
  const { showDialog } = useDialog();
  const margenInferior = useMargenInferior();

  const [mensajes, setMensajes] = useState<DirectMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [nombre, setNombre] = useState(name);
  const [rol, setRol] = useState<string | null>(null);
  const [bloqueado, setBloqueado] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [cargandoMás, setCargandoMás] = useState(false);

  const [borrador, setBorrador] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [citando, setCitando] = useState<QuotedMessage | null>(null);
  const [pendiente, setPendiente] = useState<{ id: string; body: string } | null>(null);
  const [fallidos, setFallidos] = useState<Record<string, boolean>>({});

  const [menú, setMenú] = useState<DirectMessage | null>(null);
  const [reportarId, setReportarId] = useState<string | null>(null);

  const marcarLeído = useCallback(() => {
    // Si falla, la lista de chats sigue mostrando el contador: no vale la pena avisar.
    api.markDirectRead(otherId).catch(() => {});
  }, [otherId]);

  const cargar = useCallback(async () => {
    try {
      const hilo = await api.getDirectThread(otherId, 1, POR_PÁGINA);
      // Lo que todavía viaja o no salió no se pierde al recargar. Son los únicos sin
      // conversación: se arman en el teléfono antes de que el servidor responda.
      setMensajes((prev) => [...prev.filter((m) => !m.conversationId), ...hilo.data]);
      setTotal(hilo.total);
      setNombre(hilo.other.name);
      setRol(hilo.other.role === 'sponsor' ? ROLE_LABEL.sponsor : null);
      setBloqueado(hilo.blockedByMe);
      setError(false);
      if (hilo.data.length) marcarLeído();
    } catch {
      setError(true);
    } finally {
      setCargando(false);
    }
  }, [otherId, marcarLeído]);

  useFocusEffect(useCallback(() => { void cargar(); }, [cargar]));

  // En vivo mientras la conversación está a la vista.
  useFocusEffect(
    useCallback(
      () =>
        abrirStreamDeMensajes((evento) => {
          if (evento.kind === 'message' && evento.otherId === otherId) {
            // Lo propio lo trae la respuesta del envío. El eco suele llegar antes que ella y,
            // si se agregara, el mensaje salía dos veces un instante y el total se contaba doble.
            if (evento.message.senderId === meId) return;
            setMensajes((prev) =>
              prev.some((m) => m.id === evento.message.id) ? prev : [evento.message, ...prev],
            );
            setTotal((n) => n + 1);
            // Llegó con la conversación abierta: ya está leído.
            marcarLeído();
          } else if (evento.kind === 'deleted') {
            setMensajes((prev) => prev.filter((m) => m.id !== evento.messageId));
          }
        }),
      [otherId, meId, marcarLeído],
    ),
  );

  const cargarMásAntiguos = useCallback(async () => {
    const confirmados = mensajes.filter((m) => m.conversationId).length;
    if (cargandoMás || error || confirmados === 0 || confirmados >= total) return;
    setCargandoMás(true);
    try {
      const página = Math.floor(confirmados / POR_PÁGINA) + 1;
      const siguiente = await api.getDirectThread(otherId, página, POR_PÁGINA);
      setMensajes((prev) => {
        const vistos = new Set(prev.map((m) => m.id));
        return [...prev, ...siguiente.data.filter((m) => !vistos.has(m.id))];
      });
      setTotal(siguiente.total);
    } catch {
      // Silencioso: es historial viejo.
    } finally {
      setCargandoMás(false);
    }
  }, [cargandoMás, error, mensajes, otherId, total]);

  const enviar = async () => {
    const body = borrador.trim();
    if (!body || enviando || bloqueado) return;
    // Misma clave mientras el texto no cambie: el reintento no duplica el mensaje.
    const requestId = pendiente?.body === body ? pendiente.id : newRequestId();
    setPendiente({ id: requestId, body });
    setEnviando(true);

    const citado = citando;
    setMensajes((prev) => [enCamino(requestId, body, user, citado), ...prev]);
    setBorrador('');
    setCitando(null);

    try {
      const creado = await withRetry(() => api.sendDirectMessage(otherId, body, requestId, citado?.id));
      setMensajes((prev) => {
        const sinProvisorio = prev.filter((m) => m.id !== requestId);
        if (sinProvisorio.some((m) => m.id === creado.id)) return sinProvisorio;
        return [creado, ...sinProvisorio];
      });
      setTotal((n) => n + 1);
      setPendiente(null);
      setFallidos(({ [requestId]: _d, ...resto }) => resto);
    } catch (err) {
      setFallidos((prev) => ({ ...prev, [requestId]: true }));
      // 403: hay un bloqueo. El backend no dice de qué lado, a propósito.
      if (estadoDe(err) === 403) {
        showToast('No puedes enviarle mensajes a esta persona.', 'error');
      } else {
        avisarFalla('enviar tu mensaje', err);
      }
    } finally {
      setEnviando(false);
    }
  };

  const reintentar = useCallback((m: DirectMessage) => {
    setMensajes((prev) => prev.filter((x) => x.id !== m.id));
    setBorrador(m.body);
    setCitando(m.replyTo);
    setFallidos(({ [m.id]: _d, ...resto }) => resto);
  }, []);

  const eliminar = (m: DirectMessage) => {
    showDialog({
      title: 'Eliminar mensaje',
      message: `Se borra para ti y para ${nombre}. No podrás deshacerlo.`,
      actions: [
        {
          label: 'Eliminar',
          tone: 'danger',
          onPress: async () => {
            try {
              await api.deleteDirectMessage(m.id);
              setMensajes((prev) => prev.filter((x) => x.id !== m.id));
            } catch (err) {
              avisarFalla('eliminar tu mensaje', err);
            }
          },
        },
        { label: 'Cancelar', tone: 'cancel' },
      ],
    });
  };

  const enviarReporte = async (motivo: string) => {
    if (!reportarId) return false;
    try {
      await withRetry(() => api.reportDirectMessage(reportarId, motivo));
      // Igual que en el grupo: lo reportado deja de verse para quien lo reportó.
      setMensajes((prev) => prev.filter((m) => m.id !== reportarId));
      showToast('Gracias. El equipo clínico revisará ese mensaje, no la conversación.');
      return true;
    } catch (err) {
      avisarFalla('enviar el reporte', err);
      return false;
    }
  };

  const alternarBloqueo = () => {
    if (bloqueado) {
      showDialog({
        title: `Desbloquear a ${nombre}`,
        message: 'Podrán volver a escribirse.',
        actions: [
          {
            label: 'Desbloquear',
            onPress: async () => {
              try {
                await api.unblockUser(otherId);
                setBloqueado(false);
              } catch (err) {
                avisarFalla('desbloquear', err);
              }
            },
          },
          { label: 'Cancelar', tone: 'cancel' },
        ],
      });
      return;
    }
    showDialog({
      title: `Bloquear a ${nombre}`,
      message:
        'No podrá escribirte ni tú a esa persona. No se le avisa. ' +
        'Si te está incomodando, también puedes reportar sus mensajes al equipo clínico.',
      actions: [
        {
          label: 'Bloquear',
          tone: 'danger',
          onPress: async () => {
            try {
              await api.blockUser(otherId);
              setBloqueado(true);
              showToast(`Bloqueaste a ${nombre}.`);
            } catch (err) {
              avisarFalla('bloquear', err);
            }
          },
        },
        { label: 'Cancelar', tone: 'cancel' },
      ],
    });
  };

  // `ChatMessage` pinta publicaciones del foro; un mensaje directo se le pasa con esa forma.
  // Memorizado por mensaje para que `React.memo` de la burbuja siga funcionando.
  const comoPublicación = useMemo(() => {
    const caché = new Map<string, CommunityPost>();
    return (m: DirectMessage): CommunityPost => {
      let p = caché.get(m.id);
      if (!p || p.body !== m.body) {
        p = aPublicación(m);
        caché.set(m.id, p);
      }
      return p;
    };
  }, []);

  const opcionesDelMenú = (m: DirectMessage): OpciónDeMenú[] => [
    { label: 'Responder', icon: 'message-circle', onPress: () => setCitando(citaDe(m)) },
    m.senderId === meId
      ? { label: 'Eliminar mensaje', icon: 'trash-2', tone: 'danger', onPress: () => eliminar(m) }
      : { label: 'Reportar mensaje', icon: 'flag', onPress: () => setReportarId(m.id) },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={c.primary} />
      <EncabezadoDeChat
        título={nombre}
        subtítulo={rol ?? undefined}
        avatar={initial(nombre)}
        onVolver={() => navigation.goBack()}
        onMenú={() =>
          showDialog({
            title: nombre,
            actions: [
              {
                label: bloqueado ? 'Desbloquear' : 'Bloquear',
                tone: bloqueado ? undefined : 'danger',
                onPress: alternarBloqueo,
              },
              { label: 'Cancelar', tone: 'cancel' },
            ],
          })
        }
      />

      <KeyboardAvoidingView
        style={[styles.flex, styles.fondo]}
        // `height` también en Android, como el asistente: en Android 16 la app se dibuja de
          // borde a borde y `adjustResize` ya no achica la ventana, así que sin esto el campo
          // de texto quedaba debajo del teclado.
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {cargando ? (
          <View style={styles.centro}>
            <ActivityIndicator size="large" color={c.primaryText} />
          </View>
        ) : error && mensajes.length === 0 ? (
          <View style={styles.centro}>
            <Text style={styles.errorTexto}>No pudimos cargar la conversación.</Text>
            <Touchable style={styles.errorBoton} onPress={cargar} accessibilityRole="button">
              <Text style={styles.errorBotonTexto}>Reintentar</Text>
            </Touchable>
          </View>
        ) : (
          <FlatList
            style={styles.flex}
            contentContainerStyle={styles.lista}
            showsVerticalScrollIndicator={false}
            data={mensajes}
            inverted={mensajes.length > 0}
            keyExtractor={(m) => m.id}
            initialNumToRender={12}
            maxToRenderPerBatch={10}
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
                <Icon name="lock" size={22} color={c.fg2} />
                <Text style={styles.vacíoTexto}>
                  Esta conversación es solo entre {nombre} y tú. El equipo clínico no la lee; si
                  reportas un mensaje, ve solo ese mensaje.
                </Text>
              </View>
            }
            renderItem={({ item: m, index }) => (
              <ChatMessage
                post={comoPublicación(m)}
                isOwn={m.senderId === meId}
                sinAutor
                enviando={m.id === pendiente?.id && !fallidos[m.id]}
                falló={!!fallidos[m.id]}
                showAuthor={mensajes[index + 1]?.senderId !== m.senderId}
                díaEncima={
                  !mensajes[index + 1] || díasDistintos(mensajes[index + 1].createdAt, m.createdAt)
                    ? díaDelMensaje(m.createdAt)
                    : null
                }
                disabled={false}
                onResponder={() => setCitando(citaDe(m))}
                onReintentar={() => reintentar(m)}
                onMenuPress={() => setMenú(m)}
              />
            )}
          />
        )}

        {bloqueado ? (
          <View style={[styles.bloqueado, { paddingBottom: 16 + margenInferior }]}>
            <Icon name="ban" size={16} color={c.fg2} />
            <Text style={styles.bloqueadoTexto}>
              Bloqueaste a {nombre}. Para volver a escribirse, desbloquea desde el menú ⋮.
            </Text>
          </View>
        ) : (
          <>
            {citando ? <CitaEnComposer cita={citando} onQuitar={() => setCitando(null)} /> : null}
            <ComposerDeChat
              valor={borrador}
              onCambio={setBorrador}
              onEnviar={enviar}
              apagado={false}
              ocupado={enviando}
              placeholder="Escribe un mensaje…"
              etiqueta={`Mensaje para ${nombre}`}
            />
          </>
        )}
      </KeyboardAvoidingView>

      <MenuDeMensaje
        visible={menú !== null}
        opciones={menú ? opcionesDelMenú(menú) : []}
        onClose={() => setMenú(null)}
      />

      <DiálogoDeReporte
        visible={reportarId !== null}
        título="Reportar mensaje"
        texto={
          'Cuéntanos por qué lo reportas. El equipo clínico verá solo este mensaje, ' +
          'no el resto de la conversación.'
        }
        onEnviar={enviarReporte}
        onClose={() => setReportarId(null)}
      />
    </SafeAreaView>
  );
}

function citaDe(m: DirectMessage): QuotedMessage {
  return {
    id: m.id,
    authorName: m.senderName,
    body: m.body.length > LARGO_DE_CITA ? `${m.body.slice(0, LARGO_DE_CITA).trimEnd()}…` : m.body,
  };
}

function enCamino(
  requestId: string,
  body: string,
  user: AuthUser | null,
  citado: QuotedMessage | null,
): DirectMessage {
  return {
    id: requestId,
    conversationId: '',
    senderId: user?.id ?? '',
    senderName: user ? `${user.firstName} ${user.lastName}` : '',
    senderRole: user?.role ?? 'patient',
    body,
    replyTo: citado,
    createdAt: new Date().toISOString(),
  };
}

function aPublicación(m: DirectMessage): CommunityPost {
  return {
    id: m.id,
    authorId: m.senderId,
    authorName: m.senderName,
    authorRole: m.senderRole,
    type: 'forum_post',
    sede: '',
    title: null,
    body: m.body,
    eventDate: null,
    reportCount: 0,
    replyCount: 0,
    reactions: [],
    userAttends: false,
    replyTo: m.replyTo,
    createdAt: m.createdAt,
  };
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.primary },
  flex: { flex: 1 },
  fondo: { backgroundColor: c.bg },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  lista: { paddingHorizontal: 12, paddingVertical: 12, gap: 4 },
  cargandoMás: { paddingVertical: 16 },

  vacío: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: c.infoSurface,
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
  },
  vacíoTexto: { flex: 1, fontFamily: Fonts.body, fontSize: 13.5, color: c.fg1, lineHeight: 20 },

  errorTexto: { fontFamily: Fonts.body, fontSize: 14, color: c.fg1, textAlign: 'center' },
  errorBoton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: c.primaryText,
  },
  errorBotonTexto: { fontFamily: Fonts.bodyBold, fontSize: 14, color: c.primaryText },

  bloqueado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: c.surface,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  bloqueadoTexto: { flex: 1, fontFamily: Fonts.body, fontSize: 13.5, color: c.fg2, lineHeight: 19 },
});
