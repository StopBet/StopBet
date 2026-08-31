import React from 'react';
import {
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/types';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/typography';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bg} />

      {/* Ilustración central */}
      <View style={styles.body}>
        <View style={styles.ringOuter}>
          <View style={styles.ringMid}>
            <View style={styles.ringInner}>
              <View style={styles.badge}>
                <Image
                  source={require('../assets/isotipo-blanco.png')}
                  style={styles.isotipo}
                  resizeMode="contain"
                  accessibilityLabel="StopBet"
                />
              </View>
            </View>
          </View>
        </View>

        {/* El manual escribe la marca "StopBet": antes decía "stopbet" en
            minúsculas y con dos tonos de azul que no son de la paleta. */}
        <Text style={styles.logo}>StopBet</Text>
        <Text style={styles.tagline}>Tu camino hacia una vida libre</Text>
      </View>

      {/* Footer con CTAs */}
      <View style={styles.footer}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.btnPrimary}
          onPress={() => navigation.navigate('SelectInstitution')}
        >
          <Text style={styles.btnPrimaryText}>Comenzar registro</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.75}
          style={styles.btnLink}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.btnLinkText}>Ya tengo cuenta · Iniciar sesión</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  // Los anillos venían en rgba(232,136,58) — el naranja AJUTER de la paleta
  // anterior. Ahora derivan del azul principal del manual (#396fb6).
  ringOuter: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: 'rgba(57,111,182,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  ringMid: {
    width: 152,
    height: 152,
    borderRadius: 76,
    borderWidth: 1.5,
    borderColor: 'rgba(57,111,182,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInner: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: 'rgba(57,111,182,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    width: 80,
    height: 80,
    borderRadius: 22,
    // El isotipo es blanco: sobre el azul claro no se leía.
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  isotipo: {
    width: 46,
    height: 46,
  },
  logo: {
    // Chillax es la tipografía primaria del manual. Sin fontFamily explícito
    // heredaba Lato del default global de App.tsx.
    fontFamily: Fonts.headingBold,
    fontSize: 40,
    color: Colors.primary,
    letterSpacing: -0.5,
    marginTop: 22,
  },
  tagline: {
    fontFamily: Fonts.body,
    fontSize: 16,
    color: Colors.fg2,
    marginTop: 10,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 240,
  },
  footer: {
    paddingHorizontal: 26,
    paddingBottom: 30,
  },
  btnPrimary: {
    backgroundColor: Colors.primary,
    borderRadius: 9999,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 16,
    color: Colors.white,
  },
  btnLink: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  btnLinkText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    color: Colors.primary,
  },
});
