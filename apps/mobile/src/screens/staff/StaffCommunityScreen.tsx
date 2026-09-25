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
import { ROLE_LABEL } from '../../utils/roles';
import { useCargaFresca } from '../../hooks/useCargaFresca';

type Pestaña = 'anuncios' | 'foro' | 'reportadas';

// El foro de una sede activa es largo y acá se mira, no se recorre entero: con la primera
// página basta para saber de qué se está hablando hoy.
const POSTS_POR_PÁGINA = 30;

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
      if (pestaña === 'foro') {
        return (
          <PublicaciónDelForo
            post={item as CommunityPost}
            onPress={() => navigation.navigate('StaffThread', { post: item as CommunityPost })}
          />
        );
      }
      return <Reportada post={item as FlaggedPost} onEliminar={() => eliminar(item as FlaggedPost)} />;
    },
    // `eliminar` se recrea en cada render, pero solo abre un diálogo con el post que recibe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pestaña, navigation],
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

  // Las tres pestañas alimentan la misma lista; cada fila se dibuja según cuál esté activa.
  const datos: Array<CommunityPost | FlaggedPost> =
    pestaña === 'anuncios' ? anuncios : pestaña === 'foro' ? foro : reportadas;

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

      {/* Una sola lista virtualizada para las tres pestañas: con un `ScrollView` se montaban
          todas las filas aunque se vieran cinco, y el foro de una sede activa no tiene techo. */}
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
        ListHeaderComponent={
          error ? (
            <View style={styles.errorCaja}>
              <Text style={styles.errorTexto}>
                No pudimos actualizar la comunidad. Lo que ves puede estar desactualizado.
              </Text>
              <Touchable style={styles.errorBoton} onPress={() => cargarSiHaceFalta({ forzar: true, esRefresco: true })} accessibilityRole="button">
                <Text style={styles.errorBotonTexto}>Reintentar</Text>
              </Touchable>
            </View>
          ) : null
        }
        ListEmptyComponent={vacío}
      />

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

const PublicaciónDelForo = React.memo(function PublicaciónDelForo({
  post,
  onPress,
}: {
  post: CommunityPost;
  onPress: () => void;
}) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const respuestas = post.replyCount === 1 ? 'respuesta' : 'respuestas';
  return (
    <Touchable
      style={styles.post}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Publicación de ${post.authorName}. ${post.replyCount} ${respuestas}. Abre la conversación para responder.`}
    >
      <View style={styles.postHeader}>
        <Text style={styles.postAutor} numberOfLines={1}>{post.authorName}</Text>
        <Text style={styles.postFecha}>{timeAgo(post.createdAt)}</Text>
      </View>
      <Text style={styles.postRol}>{ROLE_LABEL[post.authorRole]}</Text>
      <Text style={styles.postCuerpo} numberOfLines={4}>{post.body}</Text>
      <View style={styles.postPie}>
        <Icon name="message-circle" size={14} color={c.primaryText} />
        <Text style={styles.postRespuestas}>
          {post.replyCount === 0 ? 'Responder' : `${post.replyCount} ${respuestas}`}
        </Text>
      </View>
    </Touchable>
  );
}, (a, b) => a.post === b.post);

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

  post: {
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
    borderRadius: 16, padding: 14, gap: 4,
  },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  postAutor: { flex: 1, fontFamily: Fonts.bodyBold, fontSize: 14, color: c.fg1 },
  postFecha: { fontFamily: Fonts.body, fontSize: 11, color: c.fg2 },
  postRol: { fontFamily: Fonts.body, fontSize: 12, color: c.fg2 },
  postCuerpo: { fontFamily: Fonts.body, fontSize: 14, color: c.fg1, lineHeight: 21, marginTop: 4 },
  postPie: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  postRespuestas: { fontFamily: Fonts.bodyBold, fontSize: 13, color: c.primaryText },

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
