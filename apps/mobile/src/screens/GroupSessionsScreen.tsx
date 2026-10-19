import React, { useCallback, useEffect, useState } from 'react';
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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PatientGroupSession } from '@stopbet/shared-types';
import { Icon } from '../components/Icon';
import { Touchable } from '../components/Touchable';
import type { AppStackParamList } from '../navigation/types';
import type { Palette } from '../constants/colors';
import { useColors, useStyles } from '../context/ThemeContext';
import { Fonts } from '../constants/typography';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { isNetworkError } from '../services/checkInQueue';
import { formatSessionWhen } from '../utils/groupSessions';

type Props = NativeStackScreenProps<AppStackParamList, 'GroupSessions'>;

/**
 * HdU14 CA6 — las sesiones grupales de la sede del paciente: las de pacientes y las que
 * comparte con su familia. Responde con dos botones, como en el portal del familiar.
 *
 * La respuesta se pinta al instante y vuelve atrás si el servidor la rechaza: un 409 es que
 * otra persona tomó el último cupo mientras el paciente miraba la lista.
 */
export function GroupSessionsScreen({ navigation }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const { showToast } = useToast();

  const [sesiones, setSesiones] = useState<PatientGroupSession[] | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const [sinConexión, setSinConexión] = useState(false);
  const [guardando, setGuardando] = useState<string | null>(null);

  const cargar = useCallback(async (esRefresco = false) => {
    if (esRefresco) setRefrescando(true);
    try {
      const { sessions } = await api.getGroupSessions();
      // Solo las que todavía no empiezan: el backend también manda las de ayer.
      const ahora = Date.now();
      setSesiones(sessions.filter((s) => new Date(s.sessionDate).getTime() > ahora));
      setSinConexión(false);
    } catch {
      setSinConexión(true);
      setSesiones((prev) => prev ?? []);
    } finally {
      setRefrescando(false);
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  const responder = useCallback(async (sesion: PatientGroupSession, confirmed: boolean) => {
    if (guardando || sesion.userAttends === confirmed) return;
    const previas = sesiones ?? [];
    setGuardando(sesion.id);
    setSesiones(previas.map((s) => (s.id === sesion.id ? { ...s, userAttends: confirmed } : s)));
    try {
      await api.respondGroupSession(sesion.id, confirmed);
      showToast(confirmed ? 'Te esperamos en la sesión.' : 'Le avisamos a tu sede que no podrás ir.');
      void cargar();
    } catch (err) {
      setSesiones(previas);
      const msg = (err as Error).message ?? '';
      if (msg.startsWith('409')) {
        showToast(msg.includes('llena') ? 'La sesión se llenó. Ya no quedan cupos.' : 'Esta sesión ya ocurrió.', 'error');
        void cargar();
      } else if (isNetworkError(err)) {
        showToast('Sin conexión. Inténtalo cuando vuelvas a tener internet.', 'error');
      } else {
        showToast('No pudimos guardar tu respuesta. Inténtalo de nuevo.', 'error');
      }
    } finally {
      setGuardando(null);
    }
  }, [cargar, guardando, sesiones, showToast]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={c.primary} />

      <View style={styles.header}>
        <Touchable
          style={styles.volver}
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <Icon name="arrow-left" size={22} color={c.white} />
        </Touchable>
        <View style={styles.flex}>
          <Text style={styles.titulo} accessibilityRole="header">Sesiones grupales</Text>
          <Text style={styles.subtitulo}>De tu sede · confirma si vas a ir</Text>
        </View>
      </View>

      {sesiones === null ? (
        <View style={styles.centro}>
          <ActivityIndicator size="large" color={c.primaryText} />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.contenido}
          data={sesiones}
          keyExtractor={(s) => s.id}
          renderItem={({ item }) => (
            <SesionCard
              sesion={item}
              ocupado={guardando === item.id}
              onResponder={(confirmed) => responder(item, confirmed)}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refrescando}
              onRefresh={() => cargar(true)}
              colors={[c.primary]}
              tintColor={c.primary}
            />
          }
          ListHeaderComponent={
            sinConexión ? (
              <Text style={styles.aviso}>Sin conexión. Desliza hacia abajo para reintentar.</Text>
            ) : null
          }
          ListEmptyComponent={
            sinConexión ? null : (
              <View style={styles.vacío}>
                <Icon name="calendar" size={28} color={c.fg2} />
                <Text style={styles.vacíoTitulo}>No hay sesiones próximas</Text>
                <Text style={styles.vacíoTexto}>
                  Cuando tu sede agende una sesión grupal, va a aparecer acá.
                </Text>
              </View>
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

const SesionCard = React.memo(function SesionCard({
  sesion,
  ocupado,
  onResponder,
}: {
  sesion: PatientGroupSession;
  ocupado: boolean;
  onResponder: (confirmed: boolean) => void;
}) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  // Sin cupos y sin haber confirmado: "Asistiré" ya no se puede elegir.
  const llena = sesion.spotsLeft === 0 && sesion.userAttends !== true;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitulo}>{sesion.title}</Text>

      <View style={styles.fila}>
        <Icon name="calendar" size={15} color={c.fg2} />
        <Text style={styles.dato}>{formatSessionWhen(sesion.sessionDate)}</Text>
      </View>
      <View style={styles.fila}>
        <Icon name={sesion.isOnline ? 'message-circle' : 'map-pin'} size={15} color={c.fg2} />
        <Text style={styles.dato}>{sesion.isOnline ? 'Online' : sesion.location}</Text>
      </View>
      <View style={styles.fila}>
        <Icon name="users" size={15} color={c.fg2} />
        <Text style={styles.dato}>
          {sesion.audience === 'family' ? 'Con familiares' : 'Solo pacientes'}
          {sesion.spotsLeft !== null && sesion.spotsLeft > 0 && sesion.spotsLeft <= 5
            ? ` · ${sesion.spotsLeft === 1 ? 'queda 1 cupo' : `quedan ${sesion.spotsLeft} cupos`}`
            : ''}
        </Text>
      </View>
      {sesion.isMandatory ? (
        <Text style={styles.obligatoria}>Es parte de tu tratamiento.</Text>
      ) : null}

      <View style={styles.botones} accessibilityRole="radiogroup" accessibilityLabel={`¿Vas a ir a ${sesion.title}?`}>
        <Opcion
          texto={llena ? 'Sesión llena' : 'Asistiré'}
          icono="check"
          elegida={sesion.userAttends === true}
          deshabilitada={ocupado || llena}
          onPress={() => onResponder(true)}
        />
        <Opcion
          texto="No asistiré"
          icono="x"
          elegida={sesion.userAttends === false}
          deshabilitada={ocupado}
          onPress={() => onResponder(false)}
        />
      </View>
      {sesion.userAttends === null && !llena ? (
        <Text style={styles.pendiente}>Todavía no respondes.</Text>
      ) : null}
    </View>
  );
});

function Opcion({
  texto,
  icono,
  elegida,
  deshabilitada,
  onPress,
}: {
  texto: string;
  icono: 'check' | 'x';
  elegida: boolean;
  deshabilitada: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  return (
    <Touchable
      style={[styles.opcion, elegida && styles.opcionElegida, deshabilitada && !elegida && styles.opcionDeshabilitada]}
      onPress={onPress}
      disabled={deshabilitada}
      accessibilityRole="radio"
      accessibilityState={{ checked: elegida, disabled: deshabilitada }}
      accessibilityLabel={texto}
    >
      <Icon name={icono} size={16} color={elegida ? c.white : c.fg2} />
      <Text style={[styles.opcionTexto, elegida && styles.opcionTextoElegida]}>{texto}</Text>
    </Touchable>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  flex: { flex: 1 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    backgroundColor: c.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 14,
  },
  volver: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontFamily: Fonts.headingBold, fontSize: 22, color: c.white, letterSpacing: -0.3 },
  subtitulo: { fontFamily: Fonts.body, fontSize: 13, color: c.onPrimaryMuted },

  contenido: { padding: 16, gap: 12, paddingBottom: 24 },
  aviso: { fontFamily: Fonts.body, fontSize: 13, color: c.fg2, lineHeight: 19, marginBottom: 4 },

  card: {
    backgroundColor: c.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.border,
    padding: 16,
    gap: 6,
  },
  cardTitulo: { fontFamily: Fonts.headingBold, fontSize: 17, color: c.fg1, marginBottom: 4 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dato: { flex: 1, fontFamily: Fonts.body, fontSize: 14, color: c.fg2 },
  obligatoria: { fontFamily: Fonts.bodyBold, fontSize: 13, color: c.primaryText, marginTop: 2 },

  botones: { flexDirection: 'row', gap: 10, marginTop: 10 },
  // 48 dp de alto: la app la usan adultos mayores (criterio del PO).
  opcion: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  opcionElegida: { backgroundColor: c.primary, borderColor: c.primary },
  opcionDeshabilitada: { opacity: 0.5 },
  opcionTexto: { fontFamily: Fonts.bodyBold, fontSize: 14.5, color: c.fg1 },
  opcionTextoElegida: { color: c.white },
  pendiente: { fontFamily: Fonts.body, fontSize: 12.5, color: c.fg2, marginTop: 2 },

  vacío: { alignItems: 'center', gap: 8, paddingVertical: 56, paddingHorizontal: 24 },
  vacíoTitulo: { fontFamily: Fonts.headingBold, fontSize: 17, color: c.fg1 },
  vacíoTexto: { fontFamily: Fonts.body, fontSize: 13, color: c.fg2, textAlign: 'center', lineHeight: 20 },
});
