import React, { useState } from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/types';
import { TopBar } from '../components/TopBar';
import { Icon } from '../components/Icon';
import type { Palette } from '../constants/colors';
import { useTheme, useColors, useStyles } from '../context/ThemeContext';
import { Fonts } from '../constants/typography';
import { Touchable } from '../components/Touchable';

const INSTITUTION_ID = 'AJUTER';

type Props = NativeStackScreenProps<AuthStackParamList, 'SelectInstitution'>;

export function SelectInstitutionScreen({ navigation }: Props) {
  const { isDark } = useTheme();
  const c = useColors();
  const styles = useStyles(makeStyles);
  const [selected, setSelected] = useState<string>(INSTITUTION_ID);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={c.bg} />

      <TopBar title="Crear cuenta" onBack={() => navigation.goBack()} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Selecciona tu institución</Text>
        <Text style={styles.subtitle}>
          Elige el centro al que perteneces para conectarte con su equipo clínico y su comunidad.
        </Text>

        {/* AJUTER — seleccionada */}
        <Touchable
          activeOpacity={0.85}
          onPress={() => setSelected(INSTITUTION_ID)}
          accessibilityRole="radio"
          accessibilityState={{ checked: selected === INSTITUTION_ID }}
          style={[styles.card, selected === INSTITUTION_ID && styles.cardSelected]}
        >
          <View style={[styles.logo, selected === INSTITUTION_ID && styles.logoSelected]}>
            <Text style={styles.logoText}>AJUTER</Text>
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardName}>AJUTER</Text>
            <Text style={styles.cardAddr}>Asociación de Jugadores en Terapia y Rehabilitación</Text>
            <View style={styles.metaPill}>
              <Icon name="map-pin" size={12} color={c.primaryText} />
              <Text style={styles.metaText}>3 sedes · Chile</Text>
            </View>
          </View>
          {selected === INSTITUTION_ID && (
            <Icon name="check" size={20} color={c.primaryText} />
          )}
        </Touchable>

        {/* Próximamente */}
        <View style={[styles.card, styles.cardSoon]}>
          <View style={[styles.logo, styles.logoSoon]}>
            <Text style={styles.logoTextSoon}>+</Text>
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardNameSoon}>Más instituciones</Text>
            <Text style={styles.cardAddr}>Pronto podrás elegir entre más centros aliados.</Text>
            <View style={[styles.metaPill, styles.metaSoon]}>
              <Icon name="clock" size={12} color={c.fg2} />
              <Text style={styles.metaTextSoon}>Próximamente</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Touchable
      rippleColor="rgba(255,255,255,0.28)"
          activeOpacity={0.85}
          style={[styles.btn, !selected && styles.btnDisabled]}
          onPress={() =>
            selected && navigation.navigate('RegisterStep1', { institutionId: selected })
          }
          disabled={!selected}
          accessibilityRole="button"
        >
          <Text style={styles.btnText}>Continuar</Text>
          <Icon name="arrow-right" size={18} color={c.white} />
        </Touchable>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 22, paddingBottom: 16 },
  title: { fontFamily: Fonts.headingBold, fontSize: 24, color: c.fg1, letterSpacing: -0.3, marginTop: 6 },
  subtitle: { fontFamily: Fonts.body, fontSize: 13, color: c.fg2, lineHeight: 19, marginTop: 8, marginBottom: 20 },

  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: c.surface,
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: 16,
    padding: 15,
    marginBottom: 12,
    gap: 13,
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: c.primary,
    backgroundColor: c.infoSurface,
    padding: 14,
  },
  cardSoon: {
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },

  logo: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoSelected: { backgroundColor: c.primary },
  logoSoon: { backgroundColor: c.bg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.border },
  logoText: { fontFamily: Fonts.bodyBold, fontSize: 12, color: c.white, letterSpacing: 0.5 },
  logoTextSoon: { fontFamily: Fonts.heading, fontSize: 20, color: c.fg2 },

  cardBody: { flex: 1 },
  cardName: { fontFamily: Fonts.headingBold, fontSize: 16, color: c.ink900 },
  cardNameSoon: { fontFamily: Fonts.headingBold, fontSize: 16, color: c.fg2 },
  cardAddr: { fontFamily: Fonts.body, fontSize: 13, color: c.fg2, marginTop: 1 },

  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: c.sage50,
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 8,
  },
  metaSoon: { backgroundColor: c.bg },
  metaText: { fontFamily: Fonts.bodyBold, fontSize: 12, color: c.greenText },
  metaTextSoon: { fontFamily: Fonts.bodyBold, fontSize: 12, color: c.fg2 },

  footer: { paddingHorizontal: 22, paddingBottom: 26, paddingTop: 14 },
  btn: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: c.primary,
    borderRadius: 9999,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontFamily: Fonts.bodyBold, fontSize: 16, color: c.white },
});
