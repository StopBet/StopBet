import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import type { CrisisSignal, CrisisSuggestion, SponsorInfo } from '@stopbet/shared-types';
import type { Palette } from '../constants/colors';
import { useColors, useStyles } from '../context/ThemeContext';
import { Fonts } from '../constants/typography';
import { Icon, type IconName } from './Icon';
import { Touchable } from './Touchable';

const CRISIS_LINE = '*4141';

interface Props {
  crisis: CrisisSignal;
  /** Padrino guardado en el dispositivo; sin él no se puede prometer un contacto directo. */
  sponsor: SponsorInfo | null;
  onPanic: () => void;
  onOpenSupportNetwork: () => void;
}

const LABELS: Record<CrisisSuggestion, { text: string; icon: IconName }> = {
  panic_button: { text: 'Activar botón de pánico', icon: 'siren' },
  contact_sponsor: { text: 'Contactar a mi compañero de viaje', icon: 'user' },
  crisis_line: { text: `Llamar a ${CRISIS_LINE}`, icon: 'phone' },
};

export function CrisisCard({ crisis, sponsor, onPanic, onOpenSupportNetwork }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  // "Contactar a mi padrino" abría la pantalla de pánico: en una crisis, prometer
  // contacto y entregar navegación es la diferencia entre llamar y perder el impulso.
  const canCallSponsor = Boolean(sponsor?.phone);

  const labelFor = (s: CrisisSuggestion): { text: string; icon: IconName } => {
    if (s !== 'contact_sponsor') return LABELS[s];
    return canCallSponsor
      ? { text: `Llamar a ${sponsor!.firstName}`, icon: 'phone' }
      : { text: 'Ver mi red de apoyo', icon: 'user' };
  };

  const handle = (s: CrisisSuggestion) => {
    if (s === 'panic_button') return onPanic();
    if (s === 'contact_sponsor') {
      if (canCallSponsor) {
        Linking.openURL(`tel:${sponsor!.phone}`).catch(() => {});
        return;
      }
      return onOpenSupportNetwork();
    }
    Linking.openURL(`tel:${CRISIS_LINE}`).catch(() => {});
  };

  return (
    <View style={styles.card} accessibilityLiveRegion="polite">
      <View style={styles.header}>
        <Icon name="triangle-alert" size={18} color={c.dangerText} />
        <Text style={styles.title} accessibilityRole="header">
          {crisis.sustained ? 'Llevas un rato difícil' : 'Estoy aquí contigo'}
        </Text>
      </View>
      <Text style={styles.body}>
        No tienes que pasar este momento solo. Puedes buscar ayuda ahora mismo:
      </Text>
      {crisis.suggestions.map((s) => {
        const { text, icon } = labelFor(s);
        return (
          <Touchable key={s} style={styles.action} onPress={() => handle(s)} accessibilityRole="button">
            <Icon name={icon} size={16} color={c.dangerText} />
            <Text style={styles.actionText}>{text}</Text>
          </Touchable>
        );
      })}
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  card: {
    backgroundColor: c.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.danger,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  title: { fontFamily: Fonts.bodyBold, fontSize: 15, color: c.dangerText },
  body: { fontFamily: Fonts.body, fontSize: 14, color: c.fg2, marginBottom: 12, lineHeight: 20 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: c.dangerSurface,
    marginBottom: 6,
  },
  actionText: { fontFamily: Fonts.bodyBold, fontSize: 14, color: c.fg1 },
});
