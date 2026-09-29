import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { PatientFamilyRequest } from '@stopbet/shared-types';
import type { Palette } from '../constants/colors';
import { Fonts } from '../constants/typography';
import { useColors, useStyles } from '../context/ThemeContext';
import { useDialog } from '../context/DialogContext';
import { useToast } from '../context/ToastContext';
import { useUserId } from '../context/AuthContext';
import { api } from '../services/api';
import { logWarn } from '../utils/log';
import { Icon } from './Icon';
import { Touchable } from './Touchable';

// HDU 23 CA4 — alguien dijo ser familiar del paciente y el equipo clínico quiere saber si es
// cierto antes de darle acceso. Vive en el Inicio y no se va hasta que el psicólogo decide:
// el push es discreto a propósito (no nombra a nadie) y esta tarjeta es la que explica.
// Carga sus propios datos para no sumarle otra llamada al `load()` del Inicio.
export function FamilyRequestCards() {
  const userId = useUserId();
  const [requests, setRequests] = useState<PatientFamilyRequest[]>([]);

  const cargar = useCallback(async () => {
    try {
      setRequests(await api.getFamilyRequests(userId));
    } catch (err) {
      // Sin red o sin respuesta: la tarjeta simplemente no aparece y se reintenta al volver.
      logWarn('[FamilyRequestCards] no se pudieron cargar', (err as Error).message);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => { void cargar(); }, [cargar]));

  if (requests.length === 0) return null;
  return (
    <View style={{ paddingHorizontal: 16, gap: 10 }}>
      {requests.map((r) => (
        <FamilyRequestCard key={r.id} request={r} onAnswered={cargar} />
      ))}
    </View>
  );
}

function FamilyRequestCard({
  request,
  onAnswered,
}: {
  request: PatientFamilyRequest;
  onAnswered: () => Promise<void>;
}) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const userId = useUserId();
  const { showDialog } = useDialog();
  const { showToast } = useToast();
  const [sending, setSending] = useState(false);
  const [changing, setChanging] = useState(false);

  const responder = async (accept: boolean) => {
    setSending(true);
    try {
      await api.answerFamilyRequest(userId, request.id, accept);
      setChanging(false);
      await onAnswered();
    } catch {
      showToast('No pudimos enviar tu respuesta. Revisa tu conexión e inténtalo de nuevo.', 'error');
    } finally {
      setSending(false);
    }
  };

  // Un "no" deja al familiar sin acceso: se confirma antes, porque la app la usan adultos
  // mayores y un toque equivocado no debería costarle eso a nadie.
  const decirQueNo = () =>
    showDialog({
      title: '¿No es tu familiar?',
      message: `El equipo clínico no podrá darle acceso a ${request.familyName}. Puedes cambiar tu respuesta mientras revisan la solicitud.`,
      actions: [
        { label: 'Sí, no es mi familiar', tone: 'danger', onPress: () => void responder(false) },
        { label: 'Volver', tone: 'cancel' },
      ],
    });

  const answered = request.patientResponse !== null && !changing;

  return (
    <View style={styles.card} accessible={false}>
      <View style={styles.head}>
        <Icon name="users" size={18} color={c.primaryText} />
        <Text style={styles.title} accessibilityRole="header">
          Solicitud de vínculo familiar
        </Text>
      </View>

      <Text style={styles.body}>
        <Text style={styles.strong}>{request.familyName}</Text> ({request.familyEmail}) dice ser tu
        familiar y pidió acompañarte en StopBet: ver las sesiones grupales de tu sede y tus cuotas.
        Nunca verá tus check-ins, tus conversaciones ni tu ficha.
      </Text>

      {answered ? (
        <View style={styles.answered}>
          <Icon
            name={request.patientResponse === 'accepted' ? 'circle-check' : 'x'}
            size={16}
            color={request.patientResponse === 'accepted' ? c.greenText : c.dangerText}
          />
          <Text style={styles.answeredText}>
            {request.patientResponse === 'accepted'
              ? 'Respondiste que sí es tu familiar. El equipo clínico hará la confirmación final.'
              : 'Respondiste que no es tu familiar. El equipo clínico no le dará acceso.'}
          </Text>
          <Touchable onPress={() => setChanging(true)} accessibilityRole="button" style={styles.linkBtn}>
            <Text style={styles.linkText}>Cambiar respuesta</Text>
          </Touchable>
        </View>
      ) : (
        <>
          <Text style={styles.question}>¿Es tu familiar?</Text>
          <View style={styles.actions}>
            <Touchable
              style={[styles.primary, sending && styles.disabled]}
              onPress={() => void responder(true)}
              disabled={sending}
              accessibilityRole="button"
              accessibilityLabel={`Sí, ${request.familyName} es mi familiar`}
            >
              <Text style={styles.primaryText}>Sí, es mi familiar</Text>
            </Touchable>
            <Touchable
              style={[styles.ghost, sending && styles.disabled]}
              onPress={decirQueNo}
              disabled={sending}
              accessibilityRole="button"
              accessibilityLabel={`No, ${request.familyName} no es mi familiar`}
            >
              <Text style={styles.ghostText}>No lo es</Text>
            </Touchable>
          </View>
        </>
      )}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 16,
      gap: 10,
      borderWidth: 1.5,
      borderColor: c.primary,
    },
    head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { fontFamily: Fonts.headingBold, fontSize: 15, color: c.ink900 },
    body: { fontFamily: Fonts.body, fontSize: 14, color: c.fg1, lineHeight: 20 },
    strong: { fontFamily: Fonts.bodyBold },
    question: { fontFamily: Fonts.bodyBold, fontSize: 15, color: c.fg1 },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
    primary: {
      minHeight: 48,
      justifyContent: 'center',
      paddingHorizontal: 18,
      borderRadius: 9999,
      backgroundColor: c.primary,
    },
    primaryText: { fontFamily: Fonts.bodyBold, fontSize: 14, color: c.white },
    ghost: {
      minHeight: 48,
      justifyContent: 'center',
      paddingHorizontal: 18,
      borderRadius: 9999,
      borderWidth: 1.5,
      borderColor: c.border,
    },
    ghostText: { fontFamily: Fonts.bodyBold, fontSize: 14, color: c.fg1 },
    disabled: { opacity: 0.55 },
    answered: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    answeredText: { fontFamily: Fonts.body, fontSize: 13, color: c.fg1, flex: 1, minWidth: 180, lineHeight: 18 },
    linkBtn: { minHeight: 44, justifyContent: 'center' },
    linkText: { fontFamily: Fonts.bodyBold, fontSize: 13, color: c.primaryText, textDecorationLine: 'underline' },
  });
