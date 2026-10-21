import React, { useRef, useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/types';
import type { Palette } from '../constants/colors';
import { Fonts } from '../constants/typography';
import { useColors, useStyles } from '../context/ThemeContext';
import { Icon } from '../components/Icon';
import { Touchable } from '../components/Touchable';
import { StopDetailSheet } from '../components/StopDetailSheet';
import {
  BADGE_STOP_COUNT,
  JourneyPath,
  daysLeftText,
  daysText,
  lastReachedIndex,
  stopAt,
  stopOffset,
} from '../components/JourneyPath';

type Props = NativeStackScreenProps<AppStackParamList, 'Journey'>;

// Paradas por delante de la última ganada. Pasados los 90 días el camino no tiene fin;
// con esto siempre hay hacia dónde subir sin dibujar paradas de años.
const STOPS_AHEAD = 4;
const PAD_CONTENT = 12;

/**
 * El camino completo de días sin apostar, como el mapa de niveles de Candy Crush.
 *
 * Es una pantalla aparte y no un scroll dentro de la tarjeta del Inicio: un scroll dentro
 * de otro se roba el gesto de bajar por la pantalla, y el Inicio además cambia de pestaña
 * al deslizar de lado.
 */
export function JourneyScreen({ navigation, route }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const { days, startDate } = route.params;
  const scrollRef = useRef<ScrollView>(null);
  const centered = useRef(false);
  const [openStop, setOpenStop] = useState<number | null>(null);

  const reached = lastReachedIndex(days);
  const nextStop = stopAt(reached + 1);
  const count = Math.max(BADGE_STOP_COUNT, reached + 1 + STOPS_AHEAD);

  // Abre centrado en donde va el paciente: el camino crece hacia arriba y arrancar abajo
  // del todo lo dejaría mirando el punto de partida.
  const centerOnToday = (viewportHeight: number) => {
    if (centered.current) return;
    centered.current = true;
    const y = PAD_CONTENT + stopOffset(reached, 0, count) - viewportHeight / 2;
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: Math.max(0, y), animated: false }));
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={c.primary} />

      <View style={styles.header}>
        <Touchable
          style={styles.back}
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <Icon name="arrow-left" size={22} color={c.white} />
        </Touchable>
        <View style={styles.flex}>
          <Text style={styles.title} accessibilityRole="header">Mi camino</Text>
          <Text style={styles.subtitle}>
            {daysText(days)} sin apostar · {daysLeftText(nextStop.days - days).toLowerCase()} para {nextStop.label}
          </Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={styles.content}
        onLayout={(e) => centerOnToday(e.nativeEvent.layout.height)}
      >
        <JourneyPath days={days} first={0} count={count} announceStops onPressStop={setOpenStop} />
      </ScrollView>

      <StopDetailSheet
        index={openStop}
        days={days}
        startDate={startDate}
        onClose={() => setOpenStop(null)}
        onOpenAchievements={() => {
          setOpenStop(null);
          navigation.navigate('MainTabs', { screen: 'Achievements' });
        }}
      />
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.primary },
  flex: { flex: 1 },
  header: {
    backgroundColor: c.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 14,
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: Fonts.headingBold, fontSize: 22, color: c.white, letterSpacing: -0.3 },
  subtitle: { fontFamily: Fonts.body, fontSize: 13, color: c.onPrimaryMuted },
  // El camino va sobre la superficie y no sobre el crema: las paradas bloqueadas usan el
  // crema de relleno y sobre el mismo color se perdían.
  content: { backgroundColor: c.surface, paddingVertical: PAD_CONTENT, flexGrow: 1 },
});
