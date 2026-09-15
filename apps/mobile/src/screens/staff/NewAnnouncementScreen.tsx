import React, { useState } from 'react';
import {
  ActivityIndicator,
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
import { Icon } from '../../components/Icon';
import { Touchable } from '../../components/Touchable';
import { EventDatePicker } from '../../components/EventDatePicker';
import type { Palette } from '../../constants/colors';
import { useColors, useStyles } from '../../context/ThemeContext';
import { Fonts } from '../../constants/typography';
import { useToast } from '../../context/ToastContext';
import { useDialog } from '../../context/DialogContext';
import { api } from '../../services/api';
import { isNetworkError } from '../../services/checkInQueue';
import { fechaHora } from '../../utils/staff';
import type { StaffStackParamList } from '../../navigation/types';

const LARGO_MÁXIMO = 1000;
const TÍTULO_MÁXIMO = 120;

type Props = NativeStackScreenProps<StaffStackParamList, 'NewAnnouncement'>;

/**
 * Es una pantalla del stack y no un `Modal` dentro de Comunidad a propósito.
 *
 * Comunidad vive en un pager (`react-native-pager-view`). Con el manifiesto en
 * `adjustResize`, abrir el teclado redimensiona la ventana, el pager se rearma en la
 * primera página y la pantalla se vuelve a montar: el modal desaparecía con el anuncio a
 * medio escribir apenas se tocaba el segundo campo. Acá arriba del pager eso no pasa, y de
 * paso el botón atrás de Android hace lo que corresponde.
 */
export function NewAnnouncementScreen({ navigation, route }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const { showToast } = useToast();
  const { showDialog } = useDialog();
  const { sedeNombre } = route.params;

  const [titulo, setTitulo] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [fecha, setFecha] = useState<Date | null>(null);
  const [eligiendoFecha, setEligiendoFecha] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const restantes = LARGO_MÁXIMO - cuerpo.length;
  const puedePublicar = cuerpo.trim().length > 0 && !enviando;
  const hayTexto = cuerpo.trim().length > 0 || titulo.trim().length > 0;

  // El botón atrás de Android sale igual que la X. Sin esto, un anuncio de diez líneas
  // se perdía con un toque y sin aviso.
  const salir = React.useCallback(() => {
    if (!hayTexto || enviando) {
      navigation.goBack();
      return;
    }
    showDialog({
      title: '¿Descartar este anuncio?',
      message: 'Lo que escribiste se pierde.',
      actions: [
        { label: 'Descartar', tone: 'danger', onPress: () => navigation.goBack() },
        { label: 'Seguir escribiendo', tone: 'cancel' },
      ],
    });
  }, [hayTexto, enviando, navigation, showDialog]);

  React.useEffect(() => {
    const quitar = navigation.addListener('beforeRemove', (e) => {
      if (!hayTexto || enviando) return;
      e.preventDefault();
      salir();
    });
    return quitar;
  }, [navigation, hayTexto, enviando, salir]);

  const publicar = async () => {
    if (!puedePublicar) return;
    setEnviando(true);
    try {
      await api.createAnnouncement({
        sede: sedeNombre,
        body: cuerpo.trim(),
        title: titulo.trim() || undefined,
        eventDate: fecha ? fecha.toISOString() : undefined,
      });
      // `enviando` corta el aviso de descarte: ya está publicado, no hay nada que perder
      setCuerpo('');
      setTitulo('');
      navigation.goBack();
      showToast('Anuncio publicado. Ya lo ve toda la sede.');
    } catch (err) {
      showToast(
        isNetworkError(err)
          ? 'Sin conexión: el anuncio no se publicó. Tu texto sigue acá.'
          : 'No pudimos publicar el anuncio. Tu texto sigue acá.',
        'error',
      );
      setEnviando(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={c.primary} />

      <View style={styles.header}>
        <Touchable
          onPress={salir}
          style={styles.cerrar}
          accessibilityRole="button"
          accessibilityLabel="Salir sin publicar"
        >
          <Icon name="x" size={22} color={c.white} />
        </Touchable>
        <Text style={styles.titulo} accessibilityRole="header">Nuevo anuncio</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.contenido}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.destino}>
            Lo verá toda la comunidad de <Text style={styles.sede}>{sedeNombre}</Text>.
          </Text>

          <Text style={styles.campoLabel}>Título (opcional)</Text>
          <TextInput
            style={styles.campoTitulo}
            value={titulo}
            onChangeText={(t) => setTitulo(t.slice(0, TÍTULO_MÁXIMO))}
            placeholder="Sesión grupal de la semana"
            placeholderTextColor={c.fg2}
            accessibilityLabel="Título del anuncio, opcional"
          />

          <Text style={styles.campoLabel}>Mensaje</Text>
          <TextInput
            style={styles.campoCuerpo}
            value={cuerpo}
            onChangeText={(t) => setCuerpo(t.slice(0, LARGO_MÁXIMO))}
            placeholder="Escribe lo que quieres contarle a la comunidad…"
            placeholderTextColor={c.fg2}
            multiline
            textAlignVertical="top"
            accessibilityLabel="Mensaje del anuncio"
          />
          <Text style={[styles.contadorLargo, restantes < 100 && styles.contadorLargoCerca]}>
            {restantes} caracteres disponibles
          </Text>

          {/* Con fecha, el anuncio le sale al paciente con "Confirmar asistencia"; sin
              fecha es solo un mensaje. Por eso se dice acá y no se deja adivinar. */}
          <Text style={styles.campoLabel}>¿Es un evento con fecha?</Text>
          <Touchable
            style={styles.fechaBoton}
            onPress={() => setEligiendoFecha(true)}
            accessibilityRole="button"
            accessibilityLabel={
              fecha ? `Evento el ${fechaHora(fecha.toISOString())}. Cambiar` : 'Agregar fecha y hora'
            }
          >
            <Icon name="calendar" size={18} color={fecha ? c.primaryText : c.fg2} />
            <Text style={[styles.fechaTexto, fecha && styles.fechaTextoPuesta]}>
              {fecha ? fechaHora(fecha.toISOString()) : 'Agregar fecha y hora'}
            </Text>
            {fecha ? (
              <Touchable
                onPress={() => setFecha(null)}
                borderless
                style={styles.fechaQuitar}
                accessibilityRole="button"
                accessibilityLabel="Quitar la fecha"
              >
                <Icon name="x" size={16} color={c.fg2} />
              </Touchable>
            ) : null}
          </Touchable>
          <Text style={styles.fechaNota}>
            {fecha
              ? 'Los pacientes podrán confirmar su asistencia.'
              : 'Sin fecha se publica como un mensaje, sin confirmación de asistencia.'}
          </Text>
        </ScrollView>

        <View style={styles.pie}>
          <Touchable
            style={[styles.publicar, !puedePublicar && styles.publicarApagado]}
            onPress={publicar}
            disabled={!puedePublicar}
            rippleColor="rgba(255,255,255,0.28)"
            accessibilityRole="button"
            accessibilityState={{ disabled: !puedePublicar, busy: enviando }}
          >
            {enviando ? (
              <ActivityIndicator color={c.white} />
            ) : (
              <>
                <Icon name="send" size={18} color={c.white} />
                <Text style={styles.publicarTexto}>Publicar</Text>
              </>
            )}
          </Touchable>
        </View>
      </KeyboardAvoidingView>

      <EventDatePicker
        visible={eligiendoFecha}
        value={fecha}
        onSelect={setFecha}
        onClose={() => setEligiendoFecha(false)}
      />
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: c.primary, paddingHorizontal: 8, paddingVertical: 8,
  },
  cerrar: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontFamily: Fonts.headingBold, fontSize: 20, color: c.white, letterSpacing: -0.3 },

  contenido: { padding: 20, paddingBottom: 28 },
  destino: { fontFamily: Fonts.body, fontSize: 13, color: c.fg2, lineHeight: 19 },
  sede: { fontFamily: Fonts.bodyBold, color: c.fg1 },

  campoLabel: {
    fontFamily: Fonts.bodyBold, fontSize: 12, color: c.fg2,
    textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 18, marginBottom: 6,
  },
  campoTitulo: {
    fontFamily: Fonts.body, fontSize: 16, color: c.fg1,
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
    borderRadius: 12, paddingHorizontal: 14, minHeight: 52,
  },
  campoCuerpo: {
    fontFamily: Fonts.body, fontSize: 16, color: c.fg1, lineHeight: 23,
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
    borderRadius: 12, padding: 14, minHeight: 150,
  },
  contadorLargo: { fontFamily: Fonts.body, fontSize: 11, color: c.fg2, textAlign: 'right', marginTop: 5 },
  contadorLargoCerca: { color: c.dangerText },

  fechaBoton: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    minHeight: 52, paddingHorizontal: 14,
    borderRadius: 12, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surface,
  },
  fechaTexto: { flex: 1, fontFamily: Fonts.body, fontSize: 15, color: c.fg2 },
  fechaTextoPuesta: { fontFamily: Fonts.bodyBold, color: c.fg1 },
  fechaQuitar: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  fechaNota: { fontFamily: Fonts.body, fontSize: 12, color: c.fg2, marginTop: 6, lineHeight: 18 },

  pie: {
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14,
    borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.bg,
  },
  publicar: {
    flexDirection: 'row', gap: 8, height: 54, borderRadius: 9999,
    backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center',
  },
  publicarApagado: { opacity: 0.4 },
  publicarTexto: { fontFamily: Fonts.bodyBold, fontSize: 15, color: c.white },
});
