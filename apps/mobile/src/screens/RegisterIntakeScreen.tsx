import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  INTAKE_DURATIONS,
  INTAKE_GAMBLING_TYPES,
  INTAKE_MOTIVES,
  INTAKE_TRIGGERS,
  type IntakeAnswers,
} from '@stopbet/shared-types';
import type { AuthStackParamList } from '../navigation/types';
import { TopBar } from '../components/TopBar';
import { StepperHeader } from '../components/StepperHeader';
import { Icon } from '../components/Icon';
import { Touchable } from '../components/Touchable';
import type { Palette } from '../constants/colors';
import { useTheme, useColors, useStyles } from '../context/ThemeContext';
import { Fonts } from '../constants/typography';

type Props = NativeStackScreenProps<AuthStackParamList, 'RegisterIntake'>;

const OTRO = 'Otro';

// Paso 2 del registro (HdU13). Lo que se responde acá alimenta la ficha clínica, pero se
// guarda como lo declarado por el paciente y el psicólogo no lo edita.
//
// **Todo es opcional y se puede saltar.** Quien llena esto está pidiendo ayuda, no haciendo un
// trámite: una pregunta obligatoria de más es alguien que abandona el registro a medio camino.
// Por eso el botón dice «Continuar» aunque no haya marcado nada, y hay un «Prefiero no
// responder ahora» a la vista.
export function RegisterIntakeScreen({ navigation, route }: Props) {
  const { isDark } = useTheme();
  const c = useColors();
  const styles = useStyles(makeStyles);
  const { institutionId, basicData } = route.params;

  const [motive, setMotive] = useState<string | null>(null);
  const [motiveOther, setMotiveOther] = useState('');
  const [gamblingTypes, setGamblingTypes] = useState<string[]>([]);
  const [gamblingOther, setGamblingOther] = useState('');
  const [duration, setDuration] = useState<string | null>(null);
  const [triggers, setTriggers] = useState<string[]>([]);
  const [triggersOther, setTriggersOther] = useState('');

  const alternar = (lista: string[], valor: string) =>
    lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];

  const continuar = (saltar = false) => {
    const answers: IntakeAnswers | undefined = saltar
      ? undefined
      : {
          motive: motive === OTRO ? null : motive,
          motiveOther: motive === OTRO ? motiveOther.trim() || null : null,
          gamblingTypes: gamblingTypes.filter((t) => t !== OTRO),
          gamblingTypesOther: gamblingTypes.includes(OTRO) ? gamblingOther.trim() || null : null,
          duration,
          triggers: triggers.filter((t) => t !== OTRO),
          triggersOther: triggers.includes(OTRO) ? triggersOther.trim() || null : null,
        };

    navigation.navigate('RegisterStep2', { institutionId, basicData, intake: answers });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={c.bg} />
      <TopBar title="Crear cuenta" onBack={() => navigation.goBack()} />
      <StepperHeader current={2} labels={['Datos', 'Tu juego', 'Sede']} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Sobre tu juego</Text>
          <Text style={styles.subtitle}>
            Esto le sirve a tu psicólogo para preparar tu primera sesión. Responde solo lo que
            quieras: puedes saltarte esta parte y conversarlo en persona.
          </Text>

          <Pregunta titulo="¿Qué te trae a AJUTER?" ayuda="Elige la que más se acerque.">
            {[...INTAKE_MOTIVES, OTRO].map((op) => (
              <Opcion
                key={op}
                texto={op}
                activa={motive === op}
                onPress={() => setMotive(motive === op ? null : op)}
              />
            ))}
          </Pregunta>
          {motive === OTRO && (
            <OtroCampo
              valor={motiveOther}
              onChange={setMotiveOther}
              placeholder="Cuéntanos con tus palabras"
            />
          )}

          <Pregunta titulo="¿A qué juegas o apuestas?" ayuda="Puedes marcar varias.">
            {[...INTAKE_GAMBLING_TYPES, OTRO].map((op) => (
              <Opcion
                key={op}
                texto={op}
                activa={gamblingTypes.includes(op)}
                onPress={() => setGamblingTypes(alternar(gamblingTypes, op))}
              />
            ))}
          </Pregunta>
          {gamblingTypes.includes(OTRO) && (
            <OtroCampo
              valor={gamblingOther}
              onChange={setGamblingOther}
              placeholder="¿A qué más?"
            />
          )}

          <Pregunta titulo="¿Hace cuánto?" ayuda="Una aproximación basta.">
            {INTAKE_DURATIONS.map((op) => (
              <Opcion
                key={op}
                texto={op}
                activa={duration === op}
                onPress={() => setDuration(duration === op ? null : op)}
              />
            ))}
          </Pregunta>

          <Pregunta
            titulo="¿En qué momentos te dan más ganas de jugar?"
            ayuda="Puedes marcar varias. Esto le sirve al asistente para acompañarte mejor."
          >
            {[...INTAKE_TRIGGERS, OTRO].map((op) => (
              <Opcion
                key={op}
                texto={op}
                activa={triggers.includes(op)}
                onPress={() => setTriggers(alternar(triggers, op))}
              />
            ))}
          </Pregunta>
          {triggers.includes(OTRO) && (
            <OtroCampo
              valor={triggersOther}
              onChange={setTriggersOther}
              placeholder="¿En qué otro momento?"
            />
          )}

          <Touchable style={styles.btn} onPress={() => continuar()} accessibilityRole="button">
            <Text style={styles.btnText}>Continuar</Text>
            <Icon name="arrow-right" size={18} color={c.white} />
          </Touchable>

          <Touchable
            style={styles.skip}
            onPress={() => continuar(true)}
            accessibilityRole="button"
          >
            <Text style={styles.skipText}>Prefiero no responder ahora</Text>
          </Touchable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Pregunta({
  titulo,
  ayuda,
  children,
}: {
  titulo: string;
  ayuda: string;
  children: React.ReactNode;
}) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.pregunta}>
      <Text style={styles.preguntaTitulo}>{titulo}</Text>
      <Text style={styles.preguntaAyuda}>{ayuda}</Text>
      <View style={styles.opciones}>{children}</View>
    </View>
  );
}

function Opcion({
  texto,
  activa,
  onPress,
}: {
  texto: string;
  activa: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  return (
    <Touchable
      style={[styles.opcion, activa && styles.opcionActiva]}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: activa }}
      accessibilityLabel={texto}
    >
      {activa && <Icon name="check" size={14} color={c.primaryText} />}
      <Text style={[styles.opcionTexto, activa && styles.opcionTextoActivo]}>{texto}</Text>
    </Touchable>
  );
}

function OtroCampo({
  valor,
  onChange,
  placeholder,
}: {
  valor: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  return (
    <TextInput
      style={styles.otro}
      value={valor}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={c.fg2}
      multiline
      accessibilityLabel={placeholder}
    />
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    flex: { flex: 1 },
    scroll: { flex: 1 },
    content: { paddingHorizontal: 22, paddingBottom: 28 },
    title: {
      fontFamily: Fonts.headingBold,
      fontSize: 24,
      color: c.fg1,
      letterSpacing: -0.3,
      marginTop: 6,
    },
    subtitle: {
      fontFamily: Fonts.body,
      fontSize: 13,
      color: c.fg2,
      lineHeight: 19,
      marginTop: 8,
      marginBottom: 20,
    },
    pregunta: { marginBottom: 20 },
    preguntaTitulo: { fontFamily: Fonts.bodyBold, fontSize: 15.5, color: c.fg1, marginBottom: 4 },
    preguntaAyuda: { fontFamily: Fonts.body, fontSize: 12.5, color: c.fg2, marginBottom: 12 },
    opciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    opcion: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: c.surface,
      borderRadius: 9999,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    // El estado marcado se distingue por borde y fondo, no solo por color de texto: en la
    // paleta oscura un cambio de tono solo habría quedado por debajo del contraste mínimo.
    opcionActiva: { borderColor: c.primary, backgroundColor: c.bg, borderWidth: 1.5 },
    opcionTexto: { fontFamily: Fonts.body, fontSize: 13.5, color: c.fg1 },
    opcionTextoActivo: { fontFamily: Fonts.bodyBold, color: c.primaryText },
    otro: {
      backgroundColor: c.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontFamily: Fonts.body,
      fontSize: 14,
      color: c.fg1,
      minHeight: 76,
      textAlignVertical: 'top',
      marginTop: -8,
      marginBottom: 20,
    },
    btn: {
      flexDirection: 'row',
      gap: 8,
      backgroundColor: c.primary,
      borderRadius: 9999,
      height: 54,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 6,
    },
    btnText: { fontFamily: Fonts.bodyBold, fontSize: 16, color: c.white },
    skip: { alignItems: 'center', paddingVertical: 16 },
    skipText: { fontFamily: Fonts.body, fontSize: 14, color: c.fg2 },
  });
