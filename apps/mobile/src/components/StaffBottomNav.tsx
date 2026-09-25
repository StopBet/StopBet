import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Palette } from '../constants/colors';
import { useColors, useStyles } from '../context/ThemeContext';
import { Fonts } from '../constants/typography';
import { Icon, type IconName } from './Icon';
import { Touchable } from './Touchable';

export type StaffTab = 'summary' | 'community' | 'profile';

const TABS: { id: StaffTab; icon: IconName; label: string }[] = [
  { id: 'summary',   icon: 'chart-column',   label: 'Resumen'   },
  { id: 'community', icon: 'message-circle', label: 'Comunidad' },
  { id: 'profile',   icon: 'user',           label: 'Perfil'    },
];

interface Props {
  active: StaffTab;
  onTabPress: (tab: StaffTab) => void;
  alertasSinAtender: number;
}

/**
 * La barra del equipo clínico. Es la del paciente sin el botón SOS: `POST /panic/alerts`
 * crea una alerta a nombre de quien la toca, así que en la sesión de un psicólogo ese
 * botón no significa nada y puede generar una crisis falsa.
 */
export function StaffBottomNav({ active, onTabPress, alertasSinAtender }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const { bottom } = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(bottom, 12) }]} accessibilityRole="tablist">
      {TABS.map((tab) => {
        const isActive = active === tab.id;
        const conAviso = tab.id === 'summary' && alertasSinAtender > 0;
        return (
          <Touchable
            key={tab.id}
            onPress={() => onTabPress(tab.id)}
            style={styles.tab}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityLabel={
              conAviso
                ? `${tab.label}, ${alertasSinAtender} alerta${alertasSinAtender === 1 ? '' : 's'} sin atender`
                : tab.label
            }
            accessibilityState={{ selected: isActive }}
          >
            <View>
              <Icon name={tab.icon} size={24} color={isActive ? c.primary : c.fg2} />
              {conAviso ? (
                <View style={styles.punto}>
                  <Text style={styles.puntoTexto}>
                    {alertasSinAtender > 9 ? '9+' : alertasSinAtender}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
          </Touchable>
        );
      })}
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    backgroundColor: c.bg,
    borderTopWidth: 1,
    borderTopColor: c.border,
    paddingHorizontal: 8,
    paddingTop: 10,
  },
  tab: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 4, minHeight: 48 },
  tabLabel: { fontFamily: Fonts.bodyBold, fontSize: 12, color: c.fg2 },
  tabLabelActive: { fontFamily: Fonts.bodyBold, color: c.primaryText },
  punto: {
    position: 'absolute',
    top: -5,
    right: -12,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: c.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  puntoTexto: { fontFamily: Fonts.bodyBold, fontSize: 11, color: c.white },
});
