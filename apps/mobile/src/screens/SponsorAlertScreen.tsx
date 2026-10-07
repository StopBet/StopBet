import React, { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AccompaniedPatient } from '@stopbet/shared-types';
import { Icon } from '../components/Icon';
import { Touchable } from '../components/Touchable';
import type { AppStackParamList } from '../navigation/types';
import type { Palette } from '../constants/colors';
import { Fonts } from '../constants/typography';
import { useColors, useStyles } from '../context/ThemeContext';
import { useUserId } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useAcompanados } from '../hooks/useAcompanados';
import { api } from '../services/api';
import { formatPhone } from '../utils/phone';
import { haceCuanto } from '../utils/tiempo';

type Props = NativeStackScreenProps<AppStackParamList, 'SponsorAlert'>;

const SONDEO_MS = 5_000;

/**
 * La pantalla de quien fue designado compañero de viaje: responder la alerta de una persona a
 * la que acompaña y devolverle la llamada, y ver a quién acompaña.
 *
 * Es otra pantalla y no el botón SOS a propósito: ahí la alerta es la que uno mismo lanzó, con
 * su cuenta regresiva y su «cancelar». Mostrarle al compañero la alerta de otro con esos
 * controles hacía que pareciera suya.
 *
 * De la persona solo se ve el nombre y el teléfono, para llamar. Nunca su racha, sus check-ins
 * ni su ficha.
 */
export function SponsorAlertScreen({ navigation }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const userId = useUserId();
  const { showToast } = useToast();
  const { data, error, recargar } = useAcompanados(SONDEO_MS);
  const [respondiendo, setRespondiendo] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);

  const llamar = async (paciente: AccompaniedPatient) => {
    if (!paciente.phone) return;
    try {
      await Linking.openURL(`tel:${paciente.phone}`);
    } catch {
      showToast(`No pudimos abrir el teléfono. Su número es ${formatPhone(paciente.phone)}.`, 'error');
    }
  };

  // Responder primero y llamar después: así quien pidió ayuda ve «respondió» en su pantalla
  // antes de que le suene el teléfono, y la alerta no sigue corriendo hacia el asistente.
  const responder = async (paciente: AccompaniedPatient, conLlamada: boolean) => {
    const alerta = paciente.recentAlert;
    if (!alerta) return;
    setRespondiendo(paciente.id);
    try {
      await api.respondToPanicAlert(userId, alerta.id);
    } catch {
      // Pudo haber escalado o cancelarse justo antes: recargar muestra lo que pasó de verdad.
      showToast('No pudimos avisar que la viste. Revisa tu conexión.', 'error');
      await recargar();
      setRespondiendo(null);
      return;
    }
    setRespondiendo(null);
    await recargar();
    if (conLlamada) await llamar(paciente);
  };

  const refrescar = async () => {
    setRefrescando(true);
    await recargar();
    setRefrescando(false);
  };

  const pacientes = data?.patients ?? [];

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
          <Text style={styles.titulo} accessibilityRole="header">Compañero de viaje</Text>
          <Text style={styles.subtitulo}>
            {pacientes.length === 0
              ? 'Todavía no acompañas a nadie'
              : pacientes.length === 1
              ? 'Acompañas a 1 persona'
              : `Acompañas a ${pacientes.length} personas`}
          </Text>
        </View>
      </View>

      {data === null && !error ? (
        <View style={styles.centro}>
          <ActivityIndicator size="large" color={c.primaryText} />
        </View>
      ) : data === null ? (
        <View style={styles.centro}>
          <Text style={styles.vacioTitulo}>No pudimos cargar tus datos</Text>
          <Text style={styles.vacioTexto}>Revisa tu conexión e inténtalo de nuevo.</Text>
          <Touchable style={styles.reintentar} onPress={refrescar} accessibilityRole="button">
            <Text style={styles.reintentarTexto}>Reintentar</Text>
          </Touchable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.contenido}
          refreshControl={
            <RefreshControl
              refreshing={refrescando}
              onRefresh={refrescar}
              colors={[c.primary]}
              tintColor={c.primary}
            />
          }
        >
          {error && (
            <Text style={styles.aviso}>
              Sin conexión. Puede que falte algo de lo más reciente.
            </Text>
          )}

          {pacientes.length === 0 ? (
            <View style={styles.vacio}>
              <Icon name="handshake" size={28} color={c.fg2} />
              <Text style={styles.vacioTitulo}>Aún no tienes a nadie asignado</Text>
              <Text style={styles.vacioTexto}>
                Tu psicólogo te asignará a una persona. Cuando ella pida ayuda, te va a llegar un
                aviso y desde acá podrás responder y llamarla.
              </Text>
            </View>
          ) : (
            pacientes.map((p) => (
              <PersonaCard
                key={p.id}
                paciente={p}
                ocupado={respondiendo === p.id}
                onResponder={(conLlamada) => void responder(p, conLlamada)}
                onLlamar={() => void llamar(p)}
              />
            ))
          )}

          <Text style={styles.privacidad}>
            Solo ves el nombre y el teléfono de las personas que acompañas. Su progreso y sus
            conversaciones son privados.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function PersonaCard({
  paciente,
  ocupado,
  onResponder,
  onLlamar,
}: {
  paciente: AccompaniedPatient;
  ocupado: boolean;
  onResponder: (conLlamada: boolean) => void;
  onLlamar: () => void;
}) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const alerta = paciente.recentAlert;
  const nombre = paciente.firstName;
  const completo = `${paciente.firstName} ${paciente.lastName}`;
  const pendiente = alerta?.status === 'pending';

  const estado = (() => {
    switch (alerta?.status) {
      case 'pending':
        return { icono: 'siren' as const, color: c.dangerText, texto: `${completo} necesita contención ahora` };
      case 'responded':
        return { icono: 'circle-check' as const, color: c.greenText, texto: `Estás atendiendo a ${nombre}` };
      case 'escalated':
        return {
          icono: 'clock' as const,
          color: c.fg2,
          texto: `La alerta de ${nombre} pasó al asistente y al equipo clínico`,
        };
      case 'cancelled':
        return { icono: 'circle-check' as const, color: c.fg2, texto: `${nombre} canceló su alerta` };
      default:
        return null;
    }
  })();

  return (
    <View style={[styles.card, pendiente && styles.cardUrgente]}>
      <View style={styles.cardCabecera}>
        <View style={[styles.avatar, pendiente && styles.avatarUrgente]}>
          <Text style={[styles.avatarTexto, pendiente && { color: c.white }]}>
            {paciente.firstName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.nombre}>{completo}</Text>
          {paciente.phone ? (
            <Text style={styles.telefono}>{formatPhone(paciente.phone)}</Text>
          ) : (
            <Text style={styles.telefono}>Sin teléfono registrado</Text>
          )}
        </View>
      </View>

      {estado && alerta && (
        <View style={styles.estado} accessibilityLiveRegion={pendiente ? 'assertive' : 'polite'}>
          <Icon name={estado.icono} size={18} color={estado.color} />
          <View style={styles.flex}>
            <Text style={[styles.estadoTexto, { color: pendiente ? c.dangerText : c.ink900 }]}>
              {estado.texto}
            </Text>
            <Text style={styles.estadoHora}>{haceCuanto(alerta.createdAt)}</Text>
          </View>
        </View>
      )}

      {pendiente ? (
        <>
          <Text style={styles.ayuda}>
            Si no respondes en unos minutos, la alerta pasa al asistente y al equipo clínico.
          </Text>
          {paciente.phone ? (
            <Touchable
              style={[styles.btnUrgente, ocupado && styles.deshabilitado]}
              onPress={() => onResponder(true)}
              disabled={ocupado}
              rippleColor="rgba(255,255,255,0.28)"
              accessibilityRole="button"
              accessibilityLabel={`Responder y llamar a ${nombre}`}
            >
              <Icon name="phone" size={18} color={c.white} />
              <Text style={styles.btnUrgenteTexto}>Responder y llamar a {nombre}</Text>
            </Touchable>
          ) : null}
          <Touchable
            style={[styles.btnSecundario, ocupado && styles.deshabilitado]}
            onPress={() => onResponder(false)}
            disabled={ocupado}
            accessibilityRole="button"
            accessibilityLabel={`Avisar a ${nombre} que viste su alerta`}
          >
            <Text style={styles.btnSecundarioTexto}>
              {ocupado ? 'Enviando…' : 'Avisar que la vi'}
            </Text>
          </Touchable>
          {!paciente.phone && (
            <Text style={styles.ayuda}>
              No tenemos el teléfono de {nombre}: contáctalo por otro medio.
            </Text>
          )}
        </>
      ) : paciente.phone ? (
        <Touchable
          style={styles.btnSecundario}
          onPress={onLlamar}
          accessibilityRole="button"
          accessibilityLabel={`Llamar a ${nombre}`}
        >
          <Icon name="phone" size={16} color={c.primaryText} />
          <Text style={styles.btnSecundarioTexto}>Llamar a {nombre}</Text>
        </Touchable>
      ) : null}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    flex: { flex: 1 },
    centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },

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

    contenido: { padding: 16, gap: 12, paddingBottom: 32 },
    aviso: { fontFamily: Fonts.body, fontSize: 13, color: c.fg2, lineHeight: 19 },
    privacidad: {
      fontFamily: Fonts.body,
      fontSize: 12,
      color: c.fg2,
      lineHeight: 18,
      textAlign: 'center',
      paddingHorizontal: 8,
      marginTop: 4,
    },

    vacio: { alignItems: 'center', gap: 8, paddingVertical: 48, paddingHorizontal: 24 },
    vacioTitulo: { fontFamily: Fonts.headingBold, fontSize: 17, color: c.fg1, textAlign: 'center' },
    vacioTexto: { fontFamily: Fonts.body, fontSize: 14, color: c.fg2, textAlign: 'center', lineHeight: 21 },
    reintentar: {
      minHeight: 48,
      justifyContent: 'center',
      paddingHorizontal: 24,
      borderRadius: 9999,
      backgroundColor: c.primary,
      marginTop: 8,
    },
    reintentarTexto: { fontFamily: Fonts.bodyBold, fontSize: 14, color: c.white },

    card: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 16,
      gap: 12,
      borderWidth: 1.5,
      borderColor: c.border,
    },
    cardUrgente: { borderColor: c.danger, backgroundColor: c.dangerSurface },
    cardCabecera: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.infoSurface,
    },
    avatarUrgente: { backgroundColor: c.danger },
    avatarTexto: { fontFamily: Fonts.headingBold, fontSize: 18, color: c.primaryText },
    nombre: { fontFamily: Fonts.headingBold, fontSize: 17, color: c.ink900 },
    telefono: { fontFamily: Fonts.body, fontSize: 14, color: c.fg2, marginTop: 1 },

    estado: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    estadoTexto: { fontFamily: Fonts.bodyBold, fontSize: 15, lineHeight: 21 },
    estadoHora: { fontFamily: Fonts.body, fontSize: 13, color: c.fg2, marginTop: 1 },
    ayuda: { fontFamily: Fonts.body, fontSize: 13, color: c.fg2, lineHeight: 19 },

    btnUrgente: {
      minHeight: 54,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingHorizontal: 16,
      borderRadius: 9999,
      backgroundColor: c.danger,
    },
    btnUrgenteTexto: { fontFamily: Fonts.bodyBold, fontSize: 16, color: c.white },
    btnSecundario: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 16,
      borderRadius: 9999,
      borderWidth: 1.5,
      borderColor: c.border,
    },
    btnSecundarioTexto: { fontFamily: Fonts.bodyBold, fontSize: 15, color: c.primaryText },
    deshabilitado: { opacity: 0.55 },
  });
