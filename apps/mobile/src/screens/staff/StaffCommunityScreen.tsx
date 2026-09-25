import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CommunityPost } from '@stopbet/shared-types';
import { Icon } from '../../components/Icon';
import { Touchable } from '../../components/Touchable';
import { SedeSelector } from '../../components/SedeSelector';
import type { StaffStackParamList } from '../../navigation/types';
import type { Palette } from '../../constants/colors';
import { useColors, useStyles } from '../../context/ThemeContext';
import { Fonts } from '../../constants/typography';
import { useToast } from '../../context/ToastContext';
import { useDialog } from '../../context/DialogContext';
import { useSede } from '../../context/SedeContext';
import { useUserId } from '../../context/AuthContext';
import { api, type FlaggedPost } from '../../services/api';
import { isNetworkError } from '../../services/checkInQueue';
import { fechaHora, timeAgo } from '../../utils/staff';
import { abrirStreamDeComunidad } from '../../services/communityStream';
import { ChatMessage, díaDelMensaje, díasDistintos } from '../../components/ChatMessage';
import { useCargaFresca } from '../../hooks/useCargaFresca';

type Pestaña = 'anuncios' | 'foro' | 'reportadas';

// Igual que en el chat del paciente: la primera página, y las de más atrás al llegar arriba.
const POSTS_POR_PÁGINA = 20;

export function StaffCommunityScreen() {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const navigation = useNavigation<NativeStackNavigationProp<StaffStackParamList>>();
  const userId = useUserId();
  const { sede, cargando: cargandoSede } = useSede();
  const { showToast } = useToast();
  const { showDialog } = useDialog();

  const [pestaña, setPestaña] = useState<Pestaña>('anuncios');
  const [anuncios, setAnuncios] = useState<CommunityPost[]>([]);
  const [foro, setForo] = useState<CommunityPost[]>([]);
  const [totalForo, setTotalForo] = useState(0);
  const [cargandoMás, setCargandoMás] = useState(false);
  const [reportadas, setReportadas] = useState<FlaggedPost[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState(false);

  const cargar = useCallback(async (esRefresco = false) => {
    if (!sede || !userId) return;
    if (esRefresco) setRefrescando(true);
    try {
      const [a, f, r] = await Promise.all([
        api.getAnnouncements(userId, sede.name),
        api.getForumPosts(userId, sede.name, 1, POSTS_POR_PÁGINA),
        api.getFlaggedPosts(sede.name),
      ]);
      setAnuncios(a);
      setForo(f.data);
      setTotalForo(f.total);
      setReportadas(r);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, [sede, userId]);

  // Volver a la pestaña no vuelve a pedir las tres listas si acaban de cargarse; el gesto
  // de tirar para actualizar sí, porque ahí lo pide el psicólogo.
  const cargarSiHaceFalta = useCargaFresca(cargar);

  useEffect(() => { void cargarSiHaceFalta(); }, [cargarSiHaceFalta]);

  useFocusEffect(useCallback(() => { void cargarSiHaceFalta(); }, [cargarSiHaceFalta]));

  /** Trae mensajes más antiguos al llegar arriba, como en el chat del paciente. */
  const cargarMásAntiguos = useCallback(async () => {
    if (!sede || !userId || cargandoMás || foro.length === 0 || foro.length >= totalForo) return;
    setCargandoMás(true);
    try {
      const página = Math.floor(foro.length / POSTS_POR_PÁGINA) + 1;
      const siguiente = await api.getForumPosts(userId, sede.name, página, POSTS_POR_PÁGINA);
      setForo((prev) => {
        const vistos = new Set(prev.map((p) => p.id));
        return [...prev, ...siguiente.data.filter((p) => !vistos.has(p.id))];
      });
      setTotalForo(siguiente.total);
    } catch {
      // Es historial: si falla, se intenta de nuevo al volver a llegar arriba.
    } finally {
      setCargandoMás(false);
    }
  }, [cargandoMás, foro.length, totalForo, sede, userId]);

  // Los mensajes llegan solos mientras el chat está a la vista, igual que al paciente. Solo
  // con esta pestaña abierta: el psicólogo pasa la mayor parte del tiempo en las otras dos.
  useFocusEffect(
    useCallback(() => {
      if (!sede || pestaña !== 'foro') return;
      return abrirStreamDeComunidad(sede.name, (evento) => {
        if (evento.kind !== 'post') return;
        const llegado = evento.post;
        setForo((prev) => (prev.some((p) => p.id === llegado.id) ? prev : [llegado, ...prev]));
        setTotalForo((n) => n + 1);
      });
    }, [sede, pestaña]),
  );

  const responder = useCallback(
    (post: CommunityPost) => navigation.navigate('StaffThread', { post }),
    [navigation],
  );

  // El menú de la burbuja, como en el chat del paciente: toque largo o «···». El equipo
  // clínico no reacciona y no borra desde acá (eso es de «Reportadas»), así que solo responde.
  const abrirMenú = useCallback(
    (post: CommunityPost) => {
      showDialog({
        title: `Mensaje de ${post.authorName}`,
        actions: [
          { label: 'Responder', onPress: () => responder(post) },
          { label: 'Cancelar', tone: 'cancel' },
        ],
      });
    },
    [responder, showDialog],
  );

  const renderMensaje = useCallback(
    ({ item: p, index }: { item: CommunityPost; index: number }) => (
      <ChatMessage
        post={p}
        isOwn={p.authorId === userId}
        enviando={false}
        falló={false}
        // La lista llega de la más nueva a la más vieja y se pinta invertida, así que la de
        // arriba en pantalla es index + 1.
        showAuthor={foro[index + 1]?.authorId !== p.authorId}
        díaEncima={
          !foro[index + 1] || díasDistintos(foro[index + 1].createdAt, p.createdAt)
            ? díaDelMensaje(p.createdAt)
            : null
        }
        disabled={false}
        onResponder={() => responder(p)}
        onReintentar={() => {}}
        onMenuPress={() => abrirMenú(p)}
      />
    ),
    [foro, userId, responder, abrirMenú],
  );

  const eliminar = (post: FlaggedPost) => {
    showDialog({
      title: 'Eliminar esta publicación',
      message:
        'Desaparece del chat para toda la sede y no se puede recuperar. ' +
        'Quien la escribió no recibe aviso.',
      actions: [
        {
          label: 'Eliminar',
          tone: 'danger',
          onPress: async () => {
            // Optimista: la lista de moderación es corta y volver a consultarla deja la
            // publicación a la vista un segundo más, que es justo lo que se quiso sacar
            setReportadas((prev) => prev.filter((p) => p.id !== post.id));
            try {
              await api.deletePost(userId ?? '', post.id);
              showToast('Publicación eliminada.');
            } catch (err) {
              setReportadas((prev) => [post, ...prev]);
              showToast(
                isNetworkError(err)
                  ? 'Sin conexión: no se eliminó. Sigue publicada.'
                  : 'No pudimos eliminarla. Sigue publicada.',
                'error',
              );
            }
          },
        },
        { label: 'Cancelar', tone: 'cancel' },
      ],
    });
  };

  const renderItem = useCallback(
    ({ item }: { item: CommunityPost | FlaggedPost }) => {
      if (pestaña === 'anuncios') return <Anuncio post={item as CommunityPost} />;
      return <Reportada post={item as FlaggedPost} onEliminar={() => eliminar(item as FlaggedPost)} />;
    },
    // `eliminar` se recrea en cada render, pero solo abre un diálogo con el post que recibe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pestaña],
  );

  if (cargandoSede || cargando) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centro}>
          <ActivityIndicator size="large" color={c.primaryText} />
        </View>
      </SafeAreaView>
    );
  }

  if (!sede) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centro}>
          <Text style={styles.sinSede}>
            Tu cuenta no tiene una sede asignada, así que no hay comunidad que mostrar.
            El coordinador puede asignarte una desde el panel web.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Anuncios y Reportadas comparten la lista; el chat tiene la suya porque va invertida.
  const datos: Array<CommunityPost | FlaggedPost> = pestaña === 'anuncios' ? anuncios : reportadas;

  const vacío =
    pestaña === 'anuncios' ? (
      <View style={styles.vacíoCaja}>
        <Icon name="megaphone" size={28} color={c.fg2} />
        <Text style={styles.vacíoTitulo}>Todavía no hay anuncios</Text>
        <Text style={styles.vacíoTexto}>
          Lo que publiques acá lo ve toda la comunidad de {sede.name}.
        </Text>
      </View>
    ) : pestaña === 'foro' ? (
      <View style={styles.vacíoCaja}>
        <Icon name="message-circle" size={28} color={c.fg2} />
        <Text style={styles.vacíoTitulo}>El chat está en silencio</Text>
        <Text style={styles.vacíoTexto}>Nadie ha publicado en {sede.name} todavía.</Text>
      </View>
    ) : (
      <View style={styles.vacíoCaja}>
        <Icon name="shield-check" size={28} color={c.greenText} />
        <Text style={styles.vacíoTitulo}>Nada que revisar</Text>
        <Text style={styles.vacíoTexto}>
          Ninguna publicación de {sede.name} tiene reportes pendientes.
        </Text>
      </View>
    );

  const errorCaja = (
    <View style={styles.errorCaja}>
      <Text style={styles.errorTexto}>
        No pudimos actualizar la comunidad. Lo que ves puede estar desactualizado.
      </Text>
      <Touchable style={styles.errorBoton} onPress={() => cargarSiHaceFalta({ forzar: true, esRefresco: true })} accessibilityRole="button">
        <Text style={styles.errorBotonTexto}>Reintentar</Text>
      </Touchable>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={c.primary} />

      <View style={styles.header}>
        <Text style={styles.titulo}>Comunidad</Text>
        <SedeSelector />
      </View>

      <View style={styles.pestañas} accessibilityRole="tablist">
        {([
          { id: 'anuncios' as const, label: 'Anuncios', n: anuncios.length },
          { id: 'foro' as const, label: 'Chat', n: foro.length },
          { id: 'reportadas' as const, label: 'Reportadas', n: reportadas.length },
        ]).map((p) => {
          const activa = pestaña === p.id;
          return (
            <Touchable
              key={p.id}
              style={[styles.pestaña, activa && styles.pestañaActiva]}
              onPress={() => setPestaña(p.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: activa }}
              accessibilityLabel={`${p.label}, ${p.n}`}
            >
              <Text style={[styles.pestañaTexto, activa && styles.pestañaTextoActivo]}>
                {p.label}
              </Text>
              {p.n > 0 ? (
                <View style={[styles.contador, p.id === 'reportadas' && styles.contadorAlerta]}>
                  <Text style={[styles.contadorTexto, p.id === 'reportadas' && styles.contadorTextoAlerta]}>
                    {p.n}
                  </Text>
                </View>
              ) : null}
            </Touchable>
          );
        })}
      </View>

      {pestaña === 'foro' ? (
        <>
          {error ? <View style={styles.errorChat}>{errorCaja}</View> : null}
          {/* El mismo chat que ve el paciente: burbujas, hora exacta, separador de día y
              mensajes seguidos pegados. Antes eran tarjetas de foro con «hace 3 h» y un
              contador de respuestas, y el psicólogo leía otra cosa que sus pacientes. */}
          <FlatList
            style={styles.scroll}
            contentContainerStyle={styles.chatContenido}
            showsVerticalScrollIndicator={false}
            data={foro}
            inverted={foro.length > 0}
            keyExtractor={(p) => p.id}
            renderItem={renderMensaje}
            initialNumToRender={6}
            maxToRenderPerBatch={8}
            windowSize={11}
            removeClippedSubviews
            onEndReached={cargarMásAntiguos}
            onEndReachedThreshold={0.4}
            ListFooterComponent={
              cargandoMás ? <ActivityIndicator size="small" color={c.primary} style={styles.cargandoMás} /> : null
            }
            ListEmptyComponent={vacío}
          />
          {/* No hay composer en la pestaña: escribir sobre el pager lo rearma y se perdía lo
              escrito (ver StaffThreadScreen). Se responde citando, como en WhatsApp. */}
          <View style={styles.pieChat}>
            <Icon name="message-circle" size={16} color={c.fg2} />
            <Text style={styles.pieChatTexto}>
              Para responder, mantén pulsado un mensaje o toca «···».
            </Text>
          </View>
        </>
      ) : (
        // Anuncios y Reportadas: una sola lista virtualizada. Con un `ScrollView` se montaban
        // todas las filas aunque se vieran cinco.
        <FlatList
          style={styles.scroll}
          contentContainerStyle={styles.contenido}
          showsVerticalScrollIndicator={false}
          data={datos}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={11}
          removeClippedSubviews
          refreshControl={
            <RefreshControl refreshing={refrescando} onRefresh={() => cargarSiHaceFalta({ forzar: true, esRefresco: true })}
              colors={[c.primary]} tintColor={c.primary} />
          }
          ListHeaderComponent={error ? errorCaja : null}
          ListEmptyComponent={vacío}
        />
      )}

      {pestaña === 'anuncios' ? (
        <View style={styles.pie}>
          <Touchable
            style={styles.publicar}
            onPress={() => navigation.navigate('NewAnnouncement', { sedeNombre: sede.name })}
            rippleColor="rgba(255,255,255,0.28)"
            accessibilityRole="button"
          >
            <Icon name="megaphone" size={18} color={c.white} />
            <Text style={styles.publicarTexto}>Publicar un anuncio</Text>
          </Touchable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

// ── Filas ───────────────────────────────────────────────────────────────────
// Memorizadas: la pantalla se vuelve a renderizar con cada sondeo y cada cambio de pestaña,
// y sin esto se repintaban todas las filas montadas aunque su contenido fuera el mismo.

const Anuncio = React.memo(function Anuncio({ post }: { post: CommunityPost }) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.anuncio}>
      <View style={styles.anuncioHeader}>
        <Icon name="megaphone" size={16} color={c.primaryText} />
        <Text style={styles.anuncioAutor} numberOfLines={1}>{post.authorName}</Text>
        <Text style={styles.anuncioFecha}>{timeAgo(post.createdAt)}</Text>
      </View>
      {post.title ? <Text style={styles.anuncioTitulo}>{post.title}</Text> : null}
      <Text style={styles.anuncioCuerpo}>{post.body}</Text>
      {post.eventDate ? (
        <View style={styles.evento}>
          <Icon name="calendar" size={14} color={c.greenText} />
          <Text style={styles.eventoTexto}>{fechaHora(post.eventDate)}</Text>
        </View>
      ) : null}
    </View>
  );
});

const Reportada = React.memo(function Reportada({
  post,
  onEliminar,
}: {
  post: FlaggedPost;
  onEliminar: () => void;
}) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.reportada}>
      <View style={styles.reportadaHeader}>
        <Icon name="flag" size={15} color={c.dangerText} />
        <Text style={styles.reportadaReportes}>
          {post.reportCount} {post.reportCount === 1 ? 'reporte' : 'reportes'}
        </Text>
        <Text style={styles.reportadaFecha}>{timeAgo(post.createdAt)}</Text>
      </View>
      <Text style={styles.reportadaAutor}>{post.authorName ?? 'Autor desconocido'}</Text>
      <Text style={styles.reportadaCuerpo}>{post.body ?? '(sin texto)'}</Text>
      <View style={styles.reportadaAcciones}>
        <Touchable
          style={styles.botónEliminar}
          onPress={onEliminar}
          accessibilityRole="button"
          accessibilityLabel={`Eliminar la publicación de ${post.authorName ?? 'autor desconocido'}`}
        >
          <Icon name="trash-2" size={16} color={c.dangerText} />
          <Text style={styles.botónEliminarTexto}>Eliminar</Text>
        </Touchable>
        <Text style={styles.dejarNota}>Si está bien, déjala como está.</Text>
      </View>
    </View>
  );
}, (a, b) => a.post === b.post);

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  sinSede: { fontFamily: Fonts.body, fontSize: 14, color: c.fg2, textAlign: 'center', lineHeight: 21 },

  header: { backgroundColor: c.primary, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14, gap: 6 },
  titulo: { fontFamily: Fonts.headingBold, fontSize: 24, color: c.white, letterSpacing: -0.3 },

  pestañas: { flexDirection: 'row', backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border },
  pestaña: {
    flex: 1, flexDirection: 'row', gap: 6, minHeight: 52,
    alignItems: 'center', justifyContent: 'center',
    borderBottomWidth: 3, borderBottomColor: 'transparent',
  },
  pestañaActiva: { borderBottomColor: c.primary },
  pestañaTexto: { fontFamily: Fonts.bodyBold, fontSize: 15, color: c.fg2 },
  pestañaTextoActivo: { color: c.primaryText },
  contador: { minWidth: 22, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 9999, backgroundColor: c.infoSurface },
  contadorAlerta: { backgroundColor: c.dangerSurface },
  contadorTexto: { fontFamily: Fonts.bodyBold, fontSize: 12, color: c.primaryText, textAlign: 'center' },
  contadorTextoAlerta: { color: c.dangerText },

  scroll: { flex: 1 },
  contenido: { padding: 16, paddingBottom: 24, gap: 12 },
  chatContenido: { paddingHorizontal: 12, paddingVertical: 12 },
  cargandoMás: { paddingVertical: 12 },
  errorChat: { paddingHorizontal: 16, paddingTop: 12 },
  pieChat: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface,
  },
  pieChatTexto: { flex: 1, fontFamily: Fonts.body, fontSize: 13, color: c.fg2, lineHeight: 19 },

  vacíoCaja: { alignItems: 'center', gap: 8, paddingVertical: 44, paddingHorizontal: 20 },
  vacíoTitulo: { fontFamily: Fonts.headingBold, fontSize: 17, color: c.fg1 },
  vacíoTexto: { fontFamily: Fonts.body, fontSize: 13, color: c.fg2, textAlign: 'center', lineHeight: 20 },

  anuncio: {
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
    borderRadius: 16, padding: 14, gap: 6,
  },
  anuncioHeader: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  anuncioAutor: { flex: 1, fontFamily: Fonts.bodyBold, fontSize: 13, color: c.primaryText },
  anuncioFecha: { fontFamily: Fonts.body, fontSize: 11, color: c.fg2 },
  anuncioTitulo: { fontFamily: Fonts.headingBold, fontSize: 16, color: c.fg1 },
  anuncioCuerpo: { fontFamily: Fonts.body, fontSize: 14, color: c.fg1, lineHeight: 21 },
  evento: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: c.sage50, borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 4, marginTop: 2,
  },
  eventoTexto: { fontFamily: Fonts.bodyBold, fontSize: 12, color: c.greenText },

  reportada: {
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.dangerBorder,
    borderRadius: 16, padding: 14, gap: 6,
  },
  reportadaHeader: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  reportadaReportes: { flex: 1, fontFamily: Fonts.bodyBold, fontSize: 13, color: c.dangerText },
  reportadaFecha: { fontFamily: Fonts.body, fontSize: 11, color: c.fg2 },
  reportadaAutor: { fontFamily: Fonts.bodyBold, fontSize: 14, color: c.fg1 },
  reportadaCuerpo: { fontFamily: Fonts.body, fontSize: 14, color: c.fg1, lineHeight: 21 },
  reportadaAcciones: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  botónEliminar: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    minHeight: 48, paddingHorizontal: 16,
    borderRadius: 9999, borderWidth: 1.5, borderColor: c.dangerText,
  },
  botónEliminarTexto: { fontFamily: Fonts.bodyBold, fontSize: 14, color: c.dangerText },
  dejarNota: { flex: 1, fontFamily: Fonts.body, fontSize: 12, color: c.fg2 },

  pie: {
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12,
    borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.bg,
  },
  publicar: {
    flexDirection: 'row', gap: 8, height: 52, borderRadius: 9999,
    backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center',
  },
  publicarTexto: { fontFamily: Fonts.bodyBold, fontSize: 15, color: c.white },

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
});
