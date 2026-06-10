import React, { useState } from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/types';
import { TopBar } from '../components/TopBar';
import { Icon } from '../components/Icon';
import { Colors } from '../constants/colors';

const INSTITUTION_ID = 'AJUTER';

type Props = NativeStackScreenProps<AuthStackParamList, 'SelectInstitution'>;

export function SelectInstitutionScreen({ navigation }: Props) {
  const [selected, setSelected] = useState<string>(INSTITUTION_ID);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bg} />

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
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setSelected(INSTITUTION_ID)}
          style={[styles.card, selected === INSTITUTION_ID && styles.cardSelected]}
        >
          <View style={[styles.logo, selected === INSTITUTION_ID && styles.logoSelected]}>
            <Text style={styles.logoText}>AJUTER</Text>
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardName}>AJUTER</Text>
            <Text style={styles.cardAddr}>Asociación de Jugadores en Terapia y Rehabilitación</Text>
            <View style={styles.metaPill}>
              <Icon name="map-pin" size={12} color={Colors.primary} />
              <Text style={styles.metaText}>3 sedes · Chile</Text>
            </View>
          </View>
          {selected === INSTITUTION_ID && (
            <Icon name="check" size={20} color={Colors.primary} />
          )}
        </TouchableOpacity>

        {/* Próximamente */}
        <View style={[styles.card, styles.cardSoon]}>
          <View style={[styles.logo, styles.logoSoon]}>
            <Text style={styles.logoTextSoon}>+</Text>
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardNameSoon}>Más instituciones</Text>
            <Text style={styles.cardAddr}>Pronto podrás elegir entre más centros aliados.</Text>
            <View style={[styles.metaPill, styles.metaSoon]}>
              <Icon name="clock" size={12} color={Colors.fg2} />
              <Text style={styles.metaTextSoon}>Próximamente</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.btn, !selected && styles.btnDisabled]}
          onPress={() =>
            selected && navigation.navigate('RegisterStep1', { institutionId: selected })
          }
          disabled={!selected}
        >
          <Text style={styles.btnText}>Continuar</Text>
          <Icon name="arrow-right" size={18} color={Colors.white} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 22, paddingBottom: 16 },
  title: { fontWeight: '700', fontSize: 24, color: Colors.fg1, letterSpacing: -0.3, marginTop: 6 },
  subtitle: { fontSize: 13, color: Colors.fg2, lineHeight: 19, marginTop: 8, marginBottom: 20 },

  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 15,
    marginBottom: 12,
    gap: 13,
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: Colors.primary,
    backgroundColor: '#EAF3F2',
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
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoSelected: { backgroundColor: Colors.primary },
  logoSoon: { backgroundColor: Colors.bg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: Colors.border },
  logoText: { fontWeight: '800', fontSize: 12, color: Colors.white, letterSpacing: 0.5 },
  logoTextSoon: { fontSize: 20, color: Colors.fg2 },

  cardBody: { flex: 1 },
  cardName: { fontWeight: '700', fontSize: 16, color: Colors.ink900 },
  cardNameSoon: { fontWeight: '700', fontSize: 16, color: Colors.fg2 },
  cardAddr: { fontSize: 13, color: Colors.fg2, marginTop: 1 },

  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: Colors.sage50,
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 8,
  },
  metaSoon: { backgroundColor: Colors.bg },
  metaText: { fontWeight: '600', fontSize: 11.5, color: Colors.sage500 },
  metaTextSoon: { fontWeight: '600', fontSize: 11.5, color: Colors.fg2 },

  footer: { paddingHorizontal: 22, paddingBottom: 26, paddingTop: 14 },
  btn: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 9999,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontWeight: '700', fontSize: 16, color: Colors.white },
});
