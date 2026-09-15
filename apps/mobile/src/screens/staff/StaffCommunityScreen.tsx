import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
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

type Pestaña = 'anuncios' | 'reportadas';

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
  const [reportadas, setReportadas] = useState<FlaggedPost[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState(false);

  const cargar = useCallback(async (esRefresco = false) => {
    if (!sede || !userId) return;
    if (esRefresco) setRefrescando(true);
    try {
      const [a, r] = await Promise.all([
        api.getAnnouncements(userId, sede.name),
        api.getFlaggedPosts(sede.name),
      ]);
      setAnuncios(a);
      setReportadas(r);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, [sede, userId]);

  useEffect(() => { void cargar(); }, [cargar]);

  useFocusEffect(useCallback(() => { void cargar(); }, [cargar]));

  const eliminar = (post: FlaggedPost) => {
    showDialog({
      title: 'Eliminar esta publicación',
      message:
        'Desaparece del foro para toda la sede y no se puede recuperar. ' +
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

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.contenido}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refrescando} onRefresh={() => cargar(true)}
            colors={[c.primary]} tintColor={c.primary} />
        }
      >
        {error ? (
          <View style={styles.errorCaja}>
            <Text style={styles.errorTexto}>
              No pudimos actualizar la comunidad. Lo que ves puede estar desactualizado.
            </Text>
            <Touchable style={styles.errorBoton} onPress={() => cargar(true)} accessibilityRole="button">
              <Text style={styles.errorBotonTexto}>Reintentar</Text>
            </Touchable>
          </View>
        ) : null}

        {pestaña === 'anuncios' ? (
          anuncios.length === 0 ? (
            <View style={styles.vacíoCaja}>
              <Icon name="megaphone" size={28} color={c.fg2} />
              <Text style={styles.vacíoTitulo}>Todavía no hay anuncios</Text>
              <Text style={styles.vacíoTexto}>
                Lo que publiques acá lo ve toda la comunidad de {sede.name}.
              </Text>
            </View>
          ) : (
            anuncios.map((a) => (
              <View key={a.id} style={styles.anuncio}>
                <View style={styles.anuncioHeader}>
                  <Icon name="megaphone" size={16} color={c.primaryText} />
                  <Text style={styles.anuncioAutor} numberOfLines={1}>{a.authorName}</Text>
                  <Text style={styles.anuncioFecha}>{timeAgo(a.createdAt)}</Text>
                </View>
                {a.title ? <Text style={styles.anuncioTitulo}>{a.title}</Text> : null}
                <Text style={styles.anuncioCuerpo}>{a.body}</Text>
                {a.eventDate ? (
                  <View style={styles.evento}>
                    <Icon name="calendar" size={14} color={c.greenText} />
                    <Text style={styles.eventoTexto}>{fechaHora(a.eventDate)}</Text>
                  </View>
                ) : null}
              </View>
            ))
          )
        ) : reportadas.length === 0 ? (
          <View style={styles.vacíoCaja}>
            <Icon name="shield-check" size={28} color={c.greenText} />
            <Text style={styles.vacíoTitulo}>Nada que revisar</Text>
            <Text style={styles.vacíoTexto}>
              Ninguna publicación de {sede.name} tiene reportes pendientes.
            </Text>
          </View>
        ) : (
          reportadas.map((p) => (
            <View key={p.id} style={styles.reportada}>
              <View style={styles.reportadaHeader}>
                <Icon name="flag" size={15} color={c.dangerText} />
                <Text style={styles.reportadaReportes}>
                  {p.reportCount} {p.reportCount === 1 ? 'reporte' : 'reportes'}
                </Text>
                <Text style={styles.reportadaFecha}>{timeAgo(p.createdAt)}</Text>
              </View>
              <Text style={styles.reportadaAutor}>{p.authorName ?? 'Autor desconocido'}</Text>
              <Text style={styles.reportadaCuerpo}>{p.body ?? '(sin texto)'}</Text>
              <View style={styles.reportadaAcciones}>
                <Touchable
                  style={styles.botónEliminar}
                  onPress={() => eliminar(p)}
                  accessibilityRole="button"
                  accessibilityLabel={`Eliminar la publicación de ${p.authorName ?? 'autor desconocido'}`}
                >
                  <Icon name="trash-2" size={16} color={c.dangerText} />
                  <Text style={styles.botónEliminarTexto}>Eliminar</Text>
                </Touchable>
                <Text style={styles.dejarNota}>Si está bien, déjala como está.</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

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
