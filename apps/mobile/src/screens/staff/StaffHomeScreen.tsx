import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Icon, type IconName } from '../../components/Icon';
import { Touchable } from '../../components/Touchable';
import { SedeSelector } from '../../components/SedeSelector';
import { PatientSheet } from './PatientSheet';
import type { Palette } from '../../constants/colors';
import { useColors, useStyles } from '../../context/ThemeContext';
import { Fonts } from '../../constants/typography';
import { useCurrentUser } from '../../context/AuthContext';
import { useSede } from '../../context/SedeContext';
import { api, type StaffAlert, type StaffPatient, type StaffPendingRequest } from '../../services/api';
import { isNetworkError } from '../../services/checkInQueue';
import {
  ALERT_STATUS,
  alertasPorPaciente,
  enRiesgo,
  EMOTION_EMOJI,
  hora,
  iniciales,
  isToday,
  mismaSede,
  needsAttention,
  nombreCompleto,
  timeAgo,
} from '../../utils/staff';

// La web recarga cada 15 s porque está abierta en un escritorio. En un teléfono eso es
// batería y datos móviles; acá se refresca al volver a la pestaña, cada minuto mientras
// se mira, y cuando el psicólogo tira hacia abajo.
const REFRESH_MS = 60_000;

// Un día de pruebas deja doce alertas y la lista empujaba a los pacientes fuera de la
// pantalla. Las que importan van arriba; el resto se cuenta.
const MAX_ALERTAS = 5;

export function StaffHomeScreen() {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const usuario = useCurrentUser();
  const { sede, sedes, cargando: cargandoSede, falló: sedeFalló, reintentar: reintentarSede } = useSede();

  const [pacientes, setPacientes] = useState<StaffPatient[]>([]);
  const [alertas, setAlertas] = useState<StaffAlert[]>([]);
  const [solicitudes, setSolicitudes] = useState<StaffPendingRequest[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<'red' | 'permiso' | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState<StaffPatient | null>(null);

  const cargar = useCallback(async (esRefresco = false) => {
    if (esRefresco) setRefrescando(true);
    try {
      // En paralelo: son tres endpoints independientes y el psicólogo mira una pantalla
      // que no sirve a medias.
      const [p, a, s] = await Promise.all([
        api.getStaffPatients(),
        api.getStaffAlerts(),
        api.getStaffPendingRequests(),
      ]);
      setPacientes(p);
      setAlertas(a);
      setSolicitudes(s);
      setError(null);
    } catch (err) {
      // Un 403 acá no es un problema de red: es una cuenta sin permiso para esta vista.
      // Decir "revisa tu conexión" mandaría a buscar el problema donde no está.
      if (isNetworkError(err)) setError('red');
      else if ((err as Error).message?.startsWith('403')) setError('permiso');
      else setError('red');
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  useFocusEffect(
    useCallback(() => {
      void cargar();
      const id = setInterval(() => { void cargar(); }, REFRESH_MS);
      return () => clearInterval(id);
    }, [cargar]),
  );

  // ── Derivaciones, con el mismo criterio que el Resumen de la web ───────────
  const deSede = useCallback(
    <T extends { sedeId: string | null }>(items: T[]): T[] =>
      sede ? items.filter((i) => mismaSede(i.sedeId, sede)) : items,
    [sede],
  );

  const porPaciente = useMemo(() => alertasPorPaciente(alertas), [alertas]);

  const misPacientes = useMemo(
    () => deSede(pacientes).filter((p) => p.accountStatus === 'active'),
    [pacientes, deSede],
  );

  const alertasHoy = useMemo(
    () => deSede(alertas)
      .filter((a) => isToday(a.createdAt))
      .sort((x, y) => {
        // Lo que espera respuesta va arriba, aunque sea más antiguo: un día con muchas
        // alertas cerradas dejaba la única sin atender al fondo de la lista.
        const ux = needsAttention(x.status);
        const uy = needsAttention(y.status);
        if (ux !== uy) return ux ? -1 : 1;
        return +new Date(y.createdAt) - +new Date(x.createdAt);
      }),
    [alertas, deSede],
  );

  const sinAtender = alertasHoy.filter((a) => needsAttention(a.status));

  const solicitudesSede = useMemo(
    () => (sede ? solicitudes.filter((s) => mismaSede(s.sedeId, sede)) : solicitudes),
    [solicitudes, sede],
  );

  const promedio = misPacientes.length
    ? Math.round(misPacientes.reduce((s, p) => s + p.daysStreak, 0) / misPacientes.length)
    : 0;

  const listados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const conRiesgo = misPacientes.map((p) => ({ p, riesgo: enRiesgo(p, porPaciente) }));
    // Quien está en riesgo va arriba: es lo que el psicólogo abrió la app para ver
    conRiesgo.sort((a, b) => {
      if (a.riesgo !== b.riesgo) return a.riesgo ? -1 : 1;
      return a.p.daysStreak - b.p.daysStreak;
    });
    return q
      ? conRiesgo.filter(({ p }) => nombreCompleto(p).toLowerCase().includes(q))
      : conRiesgo;
  }, [misPacientes, porPaciente, busqueda]);

  const Cifra = ({ icon, label, valor, sub, alerta }: {
    icon: IconName; label: string; valor: number; sub: string; alerta?: boolean;
  }) => (
    <View
      style={[styles.cifra, alerta && styles.cifraAlerta]}
      accessible
      accessibilityLabel={`${label}: ${valor}. ${sub}`}
    >
      <Icon name={icon} size={18} color={alerta ? c.dangerText : c.primaryText} />
      <Text style={[styles.cifraValor, alerta && styles.cifraValorAlerta]}>{valor}</Text>
      <Text style={styles.cifraLabel}>{label}</Text>
      <Text style={styles.cifraSub}>{sub}</Text>
    </View>
  );

  if (cargando || cargandoSede) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centro}>
          <ActivityIndicator size="large" color={c.primaryText} />
          <Text style={styles.cargandoTexto}>Cargando tu resumen…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={c.primary} />

      <View style={styles.header}>
        <Text style={styles.saludo} numberOfLines={1}>
          Hola, {usuario?.firstName ?? 'equipo'}
        </Text>
        <Text style={styles.subtitulo}>Vista rápida · el panel completo está en la web</Text>
        <SedeSelector />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.contenido}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={() => cargar(true)}
            colors={[c.primary]}
            tintColor={c.primary}
          />
        }
      >
        {error ? (
          <View style={styles.errorCaja}>
            <Text style={styles.errorTexto}>
              {error === 'permiso'
                ? 'Esta cuenta no tiene permiso para ver el resumen clínico. Si crees que es un error, escríbele al coordinador de tu sede.'
                : 'No pudimos actualizar el resumen. Lo que ves puede estar desactualizado.'}
            </Text>
            {error === 'red' ? (
              <Touchable style={styles.errorBoton} onPress={() => cargar(true)} accessibilityRole="button">
                <Text style={styles.errorBotonTexto}>Reintentar</Text>
              </Touchable>
            ) : null}
          </View>
        ) : null}

        {/* Sin sede el resumen no está filtrado y hay que decirlo: si no, un psicólogo de
            Santiago cuenta a los pacientes de Viña como suyos sin enterarse. */}
        {!sede && !cargandoSede ? (
          <View style={styles.avisoSede}>
            <Icon name="map-pin" size={16} color={c.fg1} />
            <View style={styles.avisoSedeCuerpo}>
              <Text style={styles.avisoSedeTexto}>
                {sedeFalló
                  ? 'No pudimos leer tus sedes, así que el resumen muestra todas juntas.'
                  : sedes.length === 0
                    ? 'Tu cuenta no tiene una sede asignada: el resumen muestra todas juntas. El coordinador puede asignarte una desde el panel web.'
                    : 'El resumen muestra todas tus sedes juntas.'}
              </Text>
              {sedeFalló ? (
                <Touchable style={styles.avisoSedeBoton} onPress={reintentarSede} accessibilityRole="button">
                  <Text style={styles.avisoSedeBotonTexto}>Reintentar</Text>
                </Touchable>
              ) : null}
            </View>
          </View>
        ) : null}

        <View style={styles.cifras}>
          <Cifra icon="users" label="Pacientes activos" valor={misPacientes.length}
            sub={sede ? 'en esta sede' : 'en todas tus sedes'} />
          <Cifra icon="clipboard-list" label="Solicitudes" valor={solicitudesSede.length}
            sub="esperando aprobación" />
          <Cifra icon="triangle-alert" label="Alertas hoy" valor={alertasHoy.length}
            sub="botones de pánico" alerta={sinAtender.length > 0} />
          <Cifra icon="trophy" label="Promedio" valor={promedio} sub="días sin apostar" />
        </View>

        {/* En la web las alertas van en la columna de al lado. En un teléfono no hay
            columna de al lado: si no van primero, quedan bajo el scroll. */}
        <View style={styles.bloque}>
          <View style={styles.bloqueHeader}>
            <Icon name="siren" size={18} color={c.dangerText} />
            <Text style={styles.bloqueTitulo}>Alertas de pánico · hoy</Text>
          </View>

          {alertasHoy.length === 0 ? (
            <Text style={styles.vacio}>Sin alertas hoy.</Text>
          ) : (
            alertasHoy.slice(0, MAX_ALERTAS).map((a) => {
              const estado = ALERT_STATUS[a.status];
              const paciente = pacientes.find((p) => p.id === a.patientId);
              return (
                <Touchable
                  key={a.id}
                  style={styles.alerta}
                  activeOpacity={0.85}
                  disabled={!paciente}
                  onPress={() => paciente && setAbierto(paciente)}
                  accessibilityRole="button"
                  accessibilityLabel={`${a.patientName}, ${estado.label}, ${timeAgo(a.createdAt)}`}
                >
                  <View style={[styles.punto, estado.needsAttention && styles.puntoAlerta]} />
                  <View style={styles.alertaCuerpo}>
                    <Text style={styles.alertaNombre} numberOfLines={1}>{a.patientName}</Text>
                    <Text style={[styles.alertaEstado, estado.needsAttention && styles.alertaEstadoUrgente]}>
                      {estado.label}
                    </Text>
                  </View>
                  <View style={styles.alertaHora}>
                    <Text style={styles.alertaHoraTexto}>{hora(a.createdAt)}</Text>
                    <Text style={styles.alertaRel}>{timeAgo(a.createdAt)}</Text>
                  </View>
                </Touchable>
              );
            })
          )}
          {alertasHoy.length > MAX_ALERTAS ? (
            <Text style={styles.masAlertas}>
              Y {alertasHoy.length - MAX_ALERTAS} más de hoy. El historial completo está en la web.
            </Text>
          ) : null}
        </View>

        <View style={styles.bloque}>
          <View style={styles.bloqueHeader}>
            <Icon name="users" size={18} color={c.primaryText} />
            <Text style={styles.bloqueTitulo}>Pacientes</Text>
            <Text style={styles.bloqueContador}>{listados.length}</Text>
          </View>

          <View style={styles.buscador}>
            <Icon name="search" size={16} color={c.fg2} />
            <TextInput
              style={styles.buscadorInput}
              value={busqueda}
              onChangeText={setBusqueda}
              placeholder="Buscar por nombre"
              placeholderTextColor={c.fg2}
              accessibilityLabel="Buscar paciente por nombre"
              returnKeyType="search"
            />
            {busqueda ? (
              <Touchable onPress={() => setBusqueda('')} borderless accessibilityRole="button"
                accessibilityLabel="Borrar la búsqueda" style={styles.limpiar}>
                <Icon name="x" size={16} color={c.fg2} />
              </Touchable>
            ) : null}
          </View>

          {listados.length === 0 ? (
            <Text style={styles.vacio}>
              {busqueda ? 'Ningún paciente con ese nombre.' : 'Todavía no hay pacientes en esta sede.'}
            </Text>
          ) : (
            listados.map(({ p, riesgo }) => (
              <Touchable
                key={p.id}
                style={styles.paciente}
                activeOpacity={0.85}
                onPress={() => setAbierto(p)}
                accessibilityRole="button"
                accessibilityLabel={
                  `${nombreCompleto(p)}. ${p.daysStreak} días sin apostar.` +
                  `${riesgo ? ' En riesgo, con una alerta sin responder.' : ''} Ver ficha`
                }
              >
                <View style={[styles.avatar, riesgo && styles.avatarRiesgo]}>
                  <Text style={[styles.avatarTexto, riesgo && styles.avatarTextoRiesgo]}>
                    {iniciales(p)}
                  </Text>
                </View>
                <View style={styles.pacienteCuerpo}>
                  <Text style={styles.pacienteNombre} numberOfLines={1}>{nombreCompleto(p)}</Text>
                  <Text style={styles.pacienteMeta} numberOfLines={1}>
                    {p.daysStreak} {p.daysStreak === 1 ? 'día' : 'días'}
                    {p.lastCheckIn
                      ? ` · ${EMOTION_EMOJI[p.lastCheckIn.emotion] ?? ''} ${timeAgo(p.lastCheckIn.date).toLowerCase()}`
                      : ' · sin check-in'}
                  </Text>
                </View>
                {riesgo ? (
                  <View style={styles.tagRiesgo}>
                    <Text style={styles.tagRiesgoTexto}>En riesgo</Text>
                  </View>
                ) : null}
                <Icon name="chevron-right" size={18} color={c.fg2} />
              </Touchable>
            ))
          )}
        </View>

        {/* Lo que esta vista deliberadamente no hace. Sin decirlo, el psicólogo busca el
            botón de aprobar donde no está y cree que la app está a medio hacer. */}
        <View style={styles.nota}>
          <Icon name="lightbulb" size={16} color={c.primaryText} />
          <Text style={styles.notaTexto}>
            Desde el teléfono esto es solo para mirar. Aprobar solicitudes, registrar recaídas y
            generar informes se hace en el panel web.
          </Text>
        </View>
      </ScrollView>

      {abierto ? (
        <PatientSheet
          paciente={abierto}
          alertas={porPaciente[abierto.id] ?? []}
          onClose={() => setAbierto(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  cargandoTexto: { fontFamily: Fonts.body, fontSize: 14, color: c.fg2 },

  header: { backgroundColor: c.primary, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 16, gap: 4 },
  saludo: { fontFamily: Fonts.headingBold, fontSize: 24, color: c.white, letterSpacing: -0.3 },
  subtitulo: { fontFamily: Fonts.body, fontSize: 13, color: c.onPrimaryMuted, marginBottom: 8 },

  scroll: { flex: 1 },
  contenido: { padding: 16, paddingBottom: 28, gap: 14 },

  cifras: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cifra: {
    flexGrow: 1, flexBasis: '46%',
    backgroundColor: c.surface,
    borderWidth: 1, borderColor: c.border,
    borderRadius: 16, padding: 14, gap: 2,
  },
  cifraAlerta: { borderColor: c.dangerBorder, backgroundColor: c.dangerSurface },
  cifraValor: { fontFamily: Fonts.headingBold, fontSize: 28, color: c.fg1, letterSpacing: -0.5 },
  cifraValorAlerta: { color: c.dangerText },
  cifraLabel: { fontFamily: Fonts.bodyBold, fontSize: 13, color: c.fg1 },
  cifraSub: { fontFamily: Fonts.body, fontSize: 11, color: c.fg2 },

  bloque: {
    backgroundColor: c.surface,
    borderWidth: 1, borderColor: c.border,
    borderRadius: 16, padding: 14, gap: 4,
  },
  bloqueHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  bloqueTitulo: { fontFamily: Fonts.headingBold, fontSize: 16, color: c.fg1, flex: 1 },
  bloqueContador: { fontFamily: Fonts.bodyBold, fontSize: 13, color: c.fg2 },
  vacio: { fontFamily: Fonts.body, fontSize: 13, color: c.fg2, paddingVertical: 10 },

  alerta: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    minHeight: 56, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: c.border,
  },
  punto: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.fg2 },
  puntoAlerta: { backgroundColor: c.danger },
  alertaCuerpo: { flex: 1 },
  alertaNombre: { fontFamily: Fonts.bodyBold, fontSize: 15, color: c.fg1 },
  alertaEstado: { fontFamily: Fonts.body, fontSize: 12, color: c.fg2 },
  alertaEstadoUrgente: { fontFamily: Fonts.bodyBold, color: c.dangerText },
  alertaHora: { alignItems: 'flex-end' },
  alertaHoraTexto: { fontFamily: Fonts.bodyBold, fontSize: 13, color: c.fg1 },
  alertaRel: { fontFamily: Fonts.body, fontSize: 11, color: c.fg2 },
  masAlertas: { fontFamily: Fonts.body, fontSize: 12, color: c.fg2, paddingTop: 10, lineHeight: 18 },

  buscador: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: c.bg, borderWidth: 1, borderColor: c.border,
    borderRadius: 12, paddingHorizontal: 12, minHeight: 48, marginBottom: 4,
  },
  buscadorInput: { flex: 1, fontFamily: Fonts.body, fontSize: 15, color: c.fg1, paddingVertical: 10 },
  limpiar: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  paciente: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    minHeight: 60, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: c.border,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: c.infoSurface, alignItems: 'center', justifyContent: 'center',
  },
  avatarRiesgo: { backgroundColor: c.dangerSurface },
  avatarTexto: { fontFamily: Fonts.bodyBold, fontSize: 14, color: c.primaryText },
  avatarTextoRiesgo: { color: c.dangerText },
  pacienteCuerpo: { flex: 1 },
  pacienteNombre: { fontFamily: Fonts.bodyBold, fontSize: 15, color: c.fg1 },
  pacienteMeta: { fontFamily: Fonts.body, fontSize: 12, color: c.fg2, marginTop: 1 },
  tagRiesgo: {
    backgroundColor: c.dangerSurface, borderRadius: 9999,
    paddingHorizontal: 9, paddingVertical: 3,
  },
  tagRiesgoTexto: { fontFamily: Fonts.bodyBold, fontSize: 11, color: c.dangerText },

  avisoSede: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: c.amber50, borderWidth: 1, borderColor: c.infoBorder,
    borderRadius: 14, padding: 13,
  },
  avisoSedeCuerpo: { flex: 1, gap: 10, alignItems: 'flex-start' },
  avisoSedeTexto: { fontFamily: Fonts.body, fontSize: 13, color: c.fg1, lineHeight: 19 },
  avisoSedeBoton: {
    minHeight: 44, justifyContent: 'center', paddingHorizontal: 16,
    borderRadius: 9999, borderWidth: 1.5, borderColor: c.primary,
  },
  avisoSedeBotonTexto: { fontFamily: Fonts.bodyBold, fontSize: 14, color: c.primaryText },

  nota: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: c.infoSurface, borderWidth: 1, borderColor: c.infoBorder,
    borderRadius: 14, padding: 13,
  },
  notaTexto: { flex: 1, fontFamily: Fonts.body, fontSize: 13, color: c.fg1, lineHeight: 19 },

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
