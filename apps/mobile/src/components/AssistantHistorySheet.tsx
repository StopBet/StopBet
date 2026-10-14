import React, { useEffect, useState } from 'react';
import { FlatList, Modal, StyleSheet, Text, View } from 'react-native';
import type { AiSessionHistoryItem, TechniqueType, TriggerCategory } from '@stopbet/shared-types';
import type { Palette } from '../constants/colors';
import { useColors, useStyles } from '../context/ThemeContext';
import { useUserId } from '../context/AuthContext';
import { Fonts } from '../constants/typography';
import { api } from '../services/api';
import { Icon } from './Icon';
import { Touchable } from './Touchable';

const CATEGORY: Record<TriggerCategory, string> = {
  money: 'Dinero', temptation: 'Publicidad o tentación', sports: 'Deporte',
  emotions: 'Emociones difíciles', loneliness: 'Soledad o aburrimiento',
  family: 'Familia o pareja', work: 'Trabajo', other: 'Otro motivo',
};
const TECHNIQUE: Record<TechniqueType, string> = {
  breathing: 'Respiración 4-7-8', grounding: 'Grounding 5-4-3-2-1', postponement: 'Postergar el impulso',
};
const FEEDBACK = { yes: 'Te ayudó', somewhat: 'Te ayudó un poco', no: 'No te ayudó' } as const;
const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function fecha(iso: string, min: number): string {
  const d = new Date(iso);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} · ${Math.max(1, min)} min`;
}

type Estado = 'cargando' | 'error' | 'listo';

export function AssistantHistorySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const userId = useUserId();
  const [items, setItems] = useState<AiSessionHistoryItem[]>([]);
  const [estado, setEstado] = useState<Estado>('cargando');

  useEffect(() => {
    if (!visible) return;
    let vigente = true;
    setEstado('cargando');
    api.getAiSummaries(userId)
      .then((data) => { if (vigente) { setItems(data); setEstado('listo'); } })
      .catch(() => { if (vigente) setEstado('error'); });
    return () => { vigente = false; };
  }, [visible, userId]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">Tus conversaciones</Text>
            <Touchable onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar historial" style={styles.close}>
              <Icon name="x" size={20} color={c.fg2} />
            </Touchable>
          </View>
          <Text style={styles.sub}>Solo tú y tu psicólogo pueden ver este historial.</Text>
          {estado === 'cargando' && <Text style={styles.empty} accessibilityLiveRegion="polite">Cargando…</Text>}
          {estado === 'error' && (
            <Text style={styles.empty} accessibilityLiveRegion="polite">
              No pudimos cargar tu historial. Revisa tu conexión e inténtalo de nuevo.
            </Text>
          )}
          {estado === 'listo' && (
            <FlatList
              data={items}
              keyExtractor={(i) => i.id}
              ListEmptyComponent={<Text style={styles.empty}>Todavía no tienes conversaciones guardadas.</Text>}
              renderItem={({ item }) => (
                <View style={styles.card}>
                  <Text style={styles.date}>{fecha(item.createdAt, item.durationMinutes)}</Text>
                  {item.triggerCategory && <Text style={styles.line}>Motivo: {CATEGORY[item.triggerCategory]}</Text>}
                  {item.technique && <Text style={styles.line}>Técnica: {TECHNIQUE[item.technique]}</Text>}
                  {item.patientFeedback && <Text style={styles.feedback}>{FEEDBACK[item.patientFeedback]}</Text>}
                </View>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(30,45,44,0.55)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '80%', backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: Fonts.headingBold, fontSize: 20, color: c.ink900 },
  close: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  sub: { fontFamily: Fonts.body, fontSize: 13, color: c.fg2, marginTop: 4, marginBottom: 12 },
  empty: { fontFamily: Fonts.body, fontSize: 14, color: c.fg2, textAlign: 'center', paddingVertical: 24 },
  card: { backgroundColor: c.infoSurface, borderRadius: 12, padding: 14, marginBottom: 10 },
  date: { fontFamily: Fonts.bodyBold, fontSize: 14, color: c.ink900 },
  line: { fontFamily: Fonts.body, fontSize: 13.5, color: c.fg2, marginTop: 4 },
  feedback: { fontFamily: Fonts.bodyBold, fontSize: 13.5, color: c.primaryText, marginTop: 6 },
});
