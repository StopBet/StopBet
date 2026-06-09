import React from 'react';
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
import { Colors } from '../constants/colors';

type Props = NativeStackScreenProps<AuthStackParamList, 'RequestSent'>;

type TlState = 'done' | 'current' | 'todo';

interface TimelineItem {
  state: TlState;
  title: string;
  meta?: string;
}

const TIMELINE: TimelineItem[] = [
  { state: 'done',    title: 'Registro completado' },
  { state: 'current', title: 'Revisión por psicólogo de AJUTER', meta: 'En revisión · Plazo estimado: 24-48 horas' },
  { state: 'todo',    title: 'Pago de mensualidad' },
  { state: 'todo',    title: 'Acceso completo activado' },
];

function TlDot({ state }: { state: TlState }) {
  const bg = state === 'done' ? Colors.sage500 : state === 'current' ? Colors.accent : 'transparent';
  const border = state === 'todo' ? Colors.border : bg;
  const icon = state === 'done' ? '✓' : state === 'current' ? '⏳' : '';
  return (
    <View style={[styles.tlDot, { backgroundColor: bg, borderColor: border }]}>
      {icon ? <Text style={styles.tlDotIcon}>{icon}</Text> : null}
    </View>
  );
}

export function RequestSentScreen({ navigation, route }: Props) {
  const { email } = route.params;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bg} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Badge de reloj */}
        <View style={styles.badge}>
          <Text style={styles.badgeIcon}>⏳</Text>
        </View>

        <Text style={styles.title}>¡Solicitud enviada!</Text>
        <Text style={styles.subtitle}>Datos registrados · Esperando aprobación</Text>

        {/* Timeline de estado */}
        <View style={styles.card}>
          {TIMELINE.map((item, idx) => (
            <View key={idx} style={styles.tlItem}>
              <View style={styles.tlRail}>
                <TlDot state={item.state} />
                {idx < TIMELINE.length - 1 && (
                  <View style={[styles.tlLine, item.state === 'done' && styles.tlLineDone]} />
                )}
              </View>
              <View style={styles.tlBody}>
                <Text style={[styles.tlTitle, item.state === 'todo' && styles.tlTitleTodo]}>
                  {item.title}
                </Text>
                {item.meta && <Text style={styles.tlMeta}>{item.meta}</Text>}
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.note}>
          Te avisaremos por correo y notificación cuando tu cuenta esté aprobada.
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.btnOutline}
          onPress={() => navigation.navigate('Welcome')}
        >
          <Text style={styles.btnOutlineText}>Volver al inicio</Text>
        </TouchableOpacity>
        <Text style={styles.contactText}>
          ¿Preguntas? Escríbenos a{' '}
          <Text style={styles.contactLink}>contacto@ajuter.cl</Text>
        </Text>
        <Text style={styles.powered}>Powered by StopBet</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  content: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 30,
    paddingBottom: 16,
  },

  badge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#EAF3F2',
    borderWidth: 4,
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  badgeIcon: { fontSize: 40 },

  title: { fontWeight: '700', fontSize: 28, color: Colors.ink900, letterSpacing: -0.3, textAlign: 'center' },
  subtitle: { fontWeight: '600', fontSize: 15, color: Colors.sage500, marginTop: 12, textAlign: 'center' },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginTop: 24,
    width: '100%',
    shadowColor: Colors.shadowMedium,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },

  tlItem: { flexDirection: 'row', gap: 14 },
  tlRail: { flexDirection: 'column', alignItems: 'center' },
  tlDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tlDotIcon: { fontSize: 11, color: Colors.white, fontWeight: '800' },
  tlLine: { width: 2, flex: 1, minHeight: 16, marginVertical: 3, backgroundColor: Colors.border },
  tlLineDone: { backgroundColor: Colors.sage500 },
  tlBody: { flex: 1, paddingBottom: 18 },
  tlTitle: { fontWeight: '600', fontSize: 14, color: Colors.ink900, lineHeight: 19 },
  tlTitleTodo: { fontWeight: '400', color: Colors.fg2 },
  tlMeta: { fontSize: 13, color: Colors.fg2, marginTop: 3, lineHeight: 18 },

  note: { fontSize: 14, color: Colors.fg2, marginTop: 20, lineHeight: 21, textAlign: 'center', maxWidth: 290 },

  footer: { paddingHorizontal: 22, paddingBottom: 26, paddingTop: 14, alignItems: 'center' },
  btnOutline: {
    width: '100%',
    borderRadius: 9999,
    height: 54,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutlineText: { fontWeight: '700', fontSize: 16, color: Colors.primary },
  contactText: { fontSize: 13, color: Colors.fg2, marginTop: 12 },
  contactLink: { color: Colors.primary, fontWeight: '600' },
  powered: { fontSize: 11, color: Colors.fg2, marginTop: 6, opacity: 0.6 },
});
