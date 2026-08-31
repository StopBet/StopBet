import React from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { CrisisSignal, CrisisSuggestion } from '@stopbet/shared-types';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/typography';
import { Icon, type IconName } from './Icon';

const CRISIS_LINE = '*4141';

interface Props {
  crisis: CrisisSignal;
  onPanic: () => void;
  onContactSponsor: () => void;
}

const LABELS: Record<CrisisSuggestion, { text: string; icon: IconName }> = {
  panic_button: { text: 'Activar botón de pánico', icon: 'siren' },
  contact_sponsor: { text: 'Contactar a mi padrino', icon: 'user' },
  crisis_line: { text: `Llamar a ${CRISIS_LINE}`, icon: 'phone' },
};

export function CrisisCard({ crisis, onPanic, onContactSponsor }: Props) {
  const handle = (s: CrisisSuggestion) => {
    if (s === 'panic_button') return onPanic();
    if (s === 'contact_sponsor') return onContactSponsor();
    Linking.openURL(`tel:${CRISIS_LINE}`).catch(() => {});
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Icon name="triangle-alert" size={18} color={Colors.danger} />
        <Text style={styles.title}>
          {crisis.sustained ? 'Llevas un rato difícil' : 'Estoy aquí contigo'}
        </Text>
      </View>
      <Text style={styles.body}>
        No tienes que pasar este momento solo. Puedes buscar ayuda ahora mismo:
      </Text>
      {crisis.suggestions.map((s) => (
        <TouchableOpacity key={s} style={styles.action} onPress={() => handle(s)}>
          <Icon name={LABELS[s].icon} size={16} color={Colors.danger} />
          <Text style={styles.actionText}>{LABELS[s].text}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.danger,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  title: { fontFamily: Fonts.bodyBold, fontSize: 15, color: Colors.danger },
  body: { fontFamily: Fonts.body, fontSize: 14, color: Colors.fg2, marginBottom: 12, lineHeight: 20 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#FBF0F0',
    marginBottom: 6,
  },
  actionText: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.fg1 },
});
