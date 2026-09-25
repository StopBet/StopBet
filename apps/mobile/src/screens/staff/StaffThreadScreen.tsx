import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import type { Palette } from '../../constants/colors';
import { useColors, useStyles } from '../../context/ThemeContext';
import { Fonts } from '../../constants/typography';
import { useToast } from '../../context/ToastContext';
import { useUserId } from '../../context/AuthContext';
import { api } from '../../services/api';
import { isNetworkError } from '../../services/checkInQueue';
import { timeAgo } from '../../utils/staff';
import { ROLE_LABEL, esEquipoClínico } from '../../utils/roles';
import { newRequestId, withRetry } from '../../utils/retry';
import type { StaffStackParamList } from '../../navigation/types';
import { logWarn } from '../../utils/log';

const LARGO_MÁXIMO = 1000;

type Props = NativeStackScreenProps<StaffStackParamList, 'StaffThread'>;

/**
 * Es una pantalla del stack y no un composer dentro de la pestaña Comunidad, por lo mismo
 * que `NewAnnouncementScreen`: Comunidad vive en un pager y con `adjustResize` el teclado
 * lo rearma en la primera página, así que la respuesta se perdía a medio escribir.
 *
 * Lo que el psicólogo escribe acá entra al foro de la sede como una respuesta más, firmada
 * con su nombre y su rol. No hay moderación en esta pantalla: eliminar sigue estando solo
 * en la pestaña «Reportadas», sobre lo que alguien denunció.
 */
export function StaffThreadScreen({ navigation, route }: Props) {
  const { post } = route.params;
  const c = useColors();
  const styles = useStyles(makeStyles);
  const { showToast } = useToast();
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
      showToast('Tu respuesta ya está en el chat.');
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
          accessibilityLabel="Volver a Comunidad"
        >
          <Icon name="chevron-left" size={24} color={c.white} />
        </Touchable>
        <Text style={styles.titulo}>Conversación</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Virtualizada: un hilo activo puede tener decenas de respuestas y el composer
            está fuera de la lista, así que el teclado no la remonta. */}
        <FlatList
          style={styles.scroll}
          contentContainerStyle={styles.contenido}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          data={respuestas ?? []}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => <Respuesta respuesta={item} />}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={9}
          removeClippedSubviews
          ListHeaderComponent={
            <>
              <View style={styles.publicación}>
                <View style={styles.autorFila}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarLetra}>{inicial(post.authorName)}</Text>
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.autorNombre} numberOfLines={1}>{post.authorName}</Text>
                    <Text style={styles.autorRol}>
                      {ROLE_LABEL[post.authorRole]} · {timeAgo(post.createdAt)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.cuerpo}>{post.body}</Text>
              </View>

              {error ? (
                <View style={styles.errorCaja}>
                  <Text style={styles.errorTexto}>
                    No pudimos cargar las respuestas. Lo que ves puede estar incompleto.
                  </Text>
                  <Touchable style={styles.errorBoton} onPress={cargar} accessibilityRole="button">
                    <Text style={styles.errorBotonTexto}>Reintentar</Text>
                  </Touchable>
                </View>
              ) : null}
            </>
          }
          ListEmptyComponent={
            respuestas === null ? (
              <ActivityIndicator size="small" color={c.primaryText} style={styles.cargando} />
            ) : (
              <Text style={styles.sinRespuestas}>
                Todavía nadie responde. Si escribes, te lee toda la comunidad de la sede.
              </Text>
            )
          }
        />

        <View style={styles.pie}>
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
              rippleColor="rgba(255,255,255,0.28)"
              accessibilityRole="button"
              accessibilityLabel="Enviar la respuesta"
              accessibilityState={{ disabled: !puedeEnviar }}
            >
              {enviando ? (
                <ActivityIndicator size="small" color={c.white} />
              ) : (
                <Icon name="send" size={18} color={c.white} />
              )}
            </Touchable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const Respuesta = React.memo(function Respuesta({ respuesta }: { respuesta: CommunityPost }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.respuesta}>
      <View style={styles.respuestaHeader}>
        <Text style={styles.respuestaNombre} numberOfLines={1}>{respuesta.authorName}</Text>
        {esEquipoClínico(respuesta.authorRole) ? (
          <View style={styles.chipEquipo}>
            <Text style={styles.chipEquipoTexto}>{ROLE_LABEL[respuesta.authorRole]}</Text>
          </View>
        ) : null}
        <Text style={styles.respuestaFecha}>{timeAgo(respuesta.createdAt)}</Text>
      </View>
      <Text style={styles.respuestaCuerpo}>{respuesta.body}</Text>
    </View>
  );
});

function inicial(nombre: string): string {
  return (nombre?.trim().charAt(0) || '?').toUpperCase();
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  flex: { flex: 1 },

  header: {
    backgroundColor: c.primary, flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingTop: 14, paddingBottom: 14,
  },
  volver: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontFamily: Fonts.headingBold, fontSize: 20, color: c.white, letterSpacing: -0.3 },

  scroll: { flex: 1 },
  contenido: { padding: 16, paddingBottom: 20, gap: 12 },

  publicación: {
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
    borderRadius: 16, padding: 14, gap: 10,
  },
  autorFila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: c.teal400,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarLetra: { fontFamily: Fonts.bodyBold, fontSize: 15, color: c.white },
  autorNombre: { fontFamily: Fonts.bodyBold, fontSize: 15, color: c.fg1 },
  autorRol: { fontFamily: Fonts.body, fontSize: 12, color: c.fg2 },
  cuerpo: { fontFamily: Fonts.body, fontSize: 15, color: c.fg1, lineHeight: 22 },

  cargando: { paddingVertical: 20 },
  sinRespuestas: {
    fontFamily: Fonts.body, fontSize: 13, color: c.fg2,
    textAlign: 'center', lineHeight: 20, paddingHorizontal: 16, paddingVertical: 24,
  },

  respuesta: {
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
    borderRadius: 14, padding: 12, gap: 5, marginLeft: 16,
  },
  respuestaHeader: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  respuestaNombre: { flexShrink: 1, fontFamily: Fonts.bodyBold, fontSize: 13, color: c.fg1 },
  chipEquipo: {
    backgroundColor: c.infoSurface, borderRadius: 9999,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  chipEquipoTexto: { fontFamily: Fonts.bodyBold, fontSize: 11, color: c.primaryText },
  respuestaFecha: { flex: 1, textAlign: 'right', fontFamily: Fonts.body, fontSize: 11, color: c.fg2 },
  respuestaCuerpo: { fontFamily: Fonts.body, fontSize: 14, color: c.fg1, lineHeight: 21 },

  errorCaja: {
    backgroundColor: c.dangerSurface, borderWidth: 1, borderColor: c.dangerBorder,
    borderRadius: 14, padding: 13, gap: 10, alignItems: 'flex-start',
  },
  errorTexto: { fontFamily: Fonts.body, fontSize: 13, color: c.fg1, lineHeight: 19 },
  errorBoton: {
    minHeight: 44, justifyContent: 'center', paddingHorizontal: 16,
    borderRadius: 9999, borderWidth: 1.5, borderColor: c.dangerText,
  },
  errorBotonTexto: { fontFamily: Fonts.bodyBold, fontSize: 14, color: c.dangerText },

  pie: {
    borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.bg,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, gap: 8,
  },
  avisoVisible: { fontFamily: Fonts.body, fontSize: 12, color: c.fg2, lineHeight: 18 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  input: {
    flex: 1, minHeight: 48, maxHeight: 120,
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 20,
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12,
    fontFamily: Fonts.body, fontSize: 15, color: c.fg1,
  },
  enviar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: c.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  enviarApagado: { opacity: 0.45 },
});
