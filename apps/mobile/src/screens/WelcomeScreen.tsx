import React from 'react';
import {
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
                <Text style={styles.badgeHeart}>♥</Text>
              </View>
            </View>
          </View>
        </View>

        <Text style={styles.logo}>
          stop<Text style={styles.logoBold}>bet</Text>
        </Text>
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
  ringOuter: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: 'rgba(232,136,58,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  ringMid: {
    width: 152,
    height: 152,
    borderRadius: 76,
    borderWidth: 1.5,
    borderColor: 'rgba(232,136,58,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInner: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: 'rgba(232,136,58,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    width: 80,
    height: 80,
    borderRadius: 22,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeHeart: {
    fontSize: 36,
    color: Colors.white,
  },
  logo: {
    fontWeight: '800',
    fontSize: 40,
    color: Colors.primary,
    letterSpacing: -0.5,
    marginTop: 22,
  },
  logoBold: {
    color: Colors.accent,
  },
  tagline: {
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
    fontWeight: '700',
    fontSize: 16,
    color: Colors.white,
  },
  btnLink: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  btnLinkText: {
    fontWeight: '600',
    fontSize: 14,
    color: Colors.primary,
  },
});
