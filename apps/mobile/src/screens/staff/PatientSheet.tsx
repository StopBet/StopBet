import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { Touchable } from '../../components/Touchable';
import type { Palette } from '../../constants/colors';
import { useColors, useStyles } from '../../context/ThemeContext';
import { Fonts } from '../../constants/typography';
import type { StaffAlert, StaffPatient } from '../../services/api';
import {
  ALERT_STATUS,
  EMOTION_EMOJI,
  EMOTION_LABEL,
  fechaHora,
  iniciales,
  needsAttention,
  nombreCompleto,
  timeAgo,
} from '../../utils/staff';

const DÍAS_DE_EVOLUCIÓN = 14;

interface Props {
  paciente: StaffPatient;
  alertas: StaffAlert[];
  onClose: () => void;
}

/**
 * La ficha del paciente, de solo lectura. Es el equivalente en teléfono del cajón lateral
 * del panel web, sin sus acciones: registrar una recaída o generar un informe son
 * decisiones clínicas que no se toman de pie en el metro.
 */
export function PatientSheet({ paciente, alertas, onClose }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const { bottom } = useSafeAreaInsets();

  const riesgo = alertas.some((a) => needsAttention(a.status));
  const nombre = nombreCompleto(paciente);
  // Vienen de más reciente a más antiguo; para leer una evolución se necesita al revés.
  // El backend manda 28 días: en un teléfono son cuatro filas de emojis y hay que
  // desplazarse para llegar a las alertas, que es lo urgente. Dos semanas alcanzan
  // para ver una tendencia; el mes completo está en el panel web.
  const evolución = [...paciente.recentCheckIns].slice(0, DÍAS_DE_EVOLUCIÓN).reverse();

  const Dato = ({ label, valor }: { label: string; valor: string }) => (
    <View style={styles.dato}>
      <Text style={styles.datoLabel}>{label}</Text>
      <Text style={styles.datoValor} numberOfLines={2}>{valor}</Text>
    </View>
  );

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.velo}>
        <View style={[styles.hoja, { paddingBottom: Math.max(bottom, 16) }]}>
          <View style={styles.agarre} />

          <View style={styles.header}>
            <View style={[styles.avatar, riesgo && styles.avatarRiesgo]}>
              <Text style={[styles.avatarTexto, riesgo && styles.avatarTextoRiesgo]}>
                {iniciales(paciente)}
              </Text>
            </View>
            <View style={styles.headerCuerpo}>
              <Text style={styles.nombre} numberOfLines={2}>{nombre}</Text>
              <Text style={[styles.estado, riesgo && styles.estadoRiesgo]}>
                {riesgo ? 'En riesgo · alerta sin responder' : 'Sin alertas abiertas'}
              </Text>
            </View>
            <Touchable
              onPress={onClose}
              style={styles.cerrar}
              accessibilityRole="button"
              accessibilityLabel="Cerrar la ficha"
            >
              <Icon name="x" size={22} color={c.fg1} />
            </Touchable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.contenido}>
            <View style={styles.cifras}>
              <View style={styles.cifra}>
                <Text style={styles.cifraValor}>{paciente.daysStreak}</Text>
                <Text style={styles.cifraLabel}>días sin apostar</Text>
              </View>
              <View style={styles.cifra}>
                <Text style={styles.cifraValor}>{alertas.length}</Text>
                <Text style={styles.cifraLabel}>
                  {alertas.length === 1 ? 'alerta en total' : 'alertas en total'}
                </Text>
              </View>
              <View style={styles.cifra}>
                <Text style={styles.cifraValorEmoji}>
                  {paciente.lastCheckIn ? (EMOTION_EMOJI[paciente.lastCheckIn.emotion] ?? '-') : '-'}
                </Text>
                <Text style={styles.cifraLabel}>
                  {paciente.lastCheckIn ? timeAgo(paciente.lastCheckIn.date).toLowerCase() : 'sin check-in'}
                </Text>
              </View>
            </View>

            <Text style={styles.seccion}>
              Cómo ha estado{evolución.length ? ` · últimos ${evolución.length} check-in${evolución.length === 1 ? '' : 's'}` : ''}
            </Text>
            {evolución.length === 0 ? (
              <Text style={styles.vacio}>Todavía no ha registrado cómo se siente.</Text>
            ) : (
              <View style={styles.evolución}>
                {evolución.map((ch, i) => (
                  <View
                    key={`${ch.date}-${i}`}
                    style={styles.díaCheck}
                    accessible
                    accessibilityLabel={
                      `${new Date(ch.date).toLocaleDateString('es-CL', { day: 'numeric', month: 'long' })}: ` +
                      `${EMOTION_LABEL[ch.emotion as keyof typeof EMOTION_LABEL] ?? ch.emotion}`
                    }
                  >
                    <Text style={styles.díaEmoji}>{EMOTION_EMOJI[ch.emotion] ?? '·'}</Text>
                    <Text style={styles.díaFecha}>
                      {new Date(ch.date).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <Text style={styles.seccion}>Alertas de pánico</Text>
            {alertas.length === 0 ? (
              <Text style={styles.vacio}>Nunca ha activado el botón de pánico.</Text>
            ) : (
              alertas.slice(0, 10).map((a) => {
                const estado = ALERT_STATUS[a.status];
                return (
                  <View key={a.id} style={styles.alerta}>
                    <View style={[styles.punto, estado.needsAttention && styles.puntoAlerta]} />
                    <View style={styles.alertaCuerpo}>
                      <Text style={[styles.alertaEstado, estado.needsAttention && styles.alertaEstadoUrgente]}>
                        {estado.label}
                      </Text>
                      <Text style={styles.alertaFecha}>{fechaHora(a.createdAt)}</Text>
                    </View>
                    <Text style={styles.alertaRel}>{timeAgo(a.createdAt)}</Text>
                  </View>
                );
              })
            )}
            {alertas.length > 10 ? (
              <Text style={styles.masAlertas}>
                Se muestran las 10 más recientes de {alertas.length}. El historial completo está en la web.
              </Text>
            ) : null}

            <Text style={styles.seccion}>Datos</Text>
            <Dato label="Correo" valor={paciente.email} />
            <Dato
              label="En el programa desde"
              valor={new Date(paciente.createdAt).toLocaleDateString('es-CL', {
                day: 'numeric', month: 'long', year: 'numeric',
              })}
            />
            <Dato
              label="Estado de la cuenta"
              valor={paciente.accountStatus === 'active' ? 'Activa' : 'Suspendida'}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  velo: { flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' },
  hoja: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 10,
    maxHeight: '88%',
  },
  agarre: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: c.border, alignSelf: 'center', marginBottom: 14,
  },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 14 },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: c.infoSurface, alignItems: 'center', justifyContent: 'center',
  },
  avatarRiesgo: { backgroundColor: c.dangerSurface },
  avatarTexto: { fontFamily: Fonts.bodyBold, fontSize: 17, color: c.primaryText },
  avatarTextoRiesgo: { color: c.dangerText },
  headerCuerpo: { flex: 1 },
  nombre: { fontFamily: Fonts.headingBold, fontSize: 20, color: c.fg1, letterSpacing: -0.3 },
  estado: { fontFamily: Fonts.body, fontSize: 12, color: c.fg2, marginTop: 2 },
  estadoRiesgo: { fontFamily: Fonts.bodyBold, color: c.dangerText },
  cerrar: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },

  contenido: { paddingBottom: 20 },
  cifras: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  cifra: {
    flex: 1, backgroundColor: c.bg, borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 10, alignItems: 'center', gap: 2,
  },
  cifraValor: { fontFamily: Fonts.headingBold, fontSize: 24, color: c.fg1 },
  cifraValorEmoji: { fontSize: 24, lineHeight: 30 },
  cifraLabel: { fontFamily: Fonts.body, fontSize: 11, color: c.fg2, textAlign: 'center' },

  seccion: {
    fontFamily: Fonts.headingBold, fontSize: 15, color: c.fg1,
    marginTop: 18, marginBottom: 8,
  },
  vacio: { fontFamily: Fonts.body, fontSize: 13, color: c.fg2 },

  evolución: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  díaCheck: {
    alignItems: 'center', gap: 2,
    backgroundColor: c.bg, borderRadius: 12,
    paddingVertical: 8, paddingHorizontal: 10, minWidth: 54,
  },
  díaEmoji: { fontSize: 20, lineHeight: 26 },
  díaFecha: { fontFamily: Fonts.body, fontSize: 10, color: c.fg2 },

  alerta: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 9, borderTopWidth: 1, borderTopColor: c.border,
  },
  punto: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.fg2 },
  puntoAlerta: { backgroundColor: c.danger },
  alertaCuerpo: { flex: 1 },
  alertaEstado: { fontFamily: Fonts.body, fontSize: 14, color: c.fg1 },
  alertaEstadoUrgente: { fontFamily: Fonts.bodyBold, color: c.dangerText },
  alertaFecha: { fontFamily: Fonts.body, fontSize: 11, color: c.fg2, marginTop: 1 },
  alertaRel: { fontFamily: Fonts.body, fontSize: 11, color: c.fg2 },
  masAlertas: { fontFamily: Fonts.body, fontSize: 12, color: c.fg2, marginTop: 10, lineHeight: 18 },

  dato: { paddingVertical: 9, borderTopWidth: 1, borderTopColor: c.border },
  datoLabel: { fontFamily: Fonts.body, fontSize: 11, color: c.fg2 },
  datoValor: { fontFamily: Fonts.bodyBold, fontSize: 14, color: c.fg1, marginTop: 2 },
});
