import React, { useContext } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../../components/Icon';
import { Touchable } from '../../components/Touchable';
import type { Palette } from '../../constants/colors';
import { useColors, useStyles, useTheme } from '../../context/ThemeContext';
import { Fonts } from '../../constants/typography';
import { AuthContext, useCurrentUser } from '../../context/AuthContext';
import { useDialog } from '../../context/DialogContext';
import { useSede } from '../../context/SedeContext';
import type { ThemePreference } from '../../services/offlineStore';
import { sedeCorta } from '../../utils/staff';

const TEMAS: { id: ThemePreference; icon: IconName; label: string; hint: string }[] = [
  { id: 'system', icon: 'smartphone', label: 'Automático', hint: 'Sigue el ajuste de tu teléfono' },
  { id: 'light',  icon: 'sunrise',    label: 'Claro',      hint: 'La app siempre en claro' },
  { id: 'dark',   icon: 'moon',       label: 'Oscuro',     hint: 'La app siempre en oscuro' },
];

export function StaffProfileScreen() {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const usuario = useCurrentUser();
  const { signOut } = useContext(AuthContext);
  const { preference, setPreference } = useTheme();
  const { sedes } = useSede();
  const { showDialog } = useDialog();

  const nombre = [usuario?.firstName, usuario?.lastName].filter(Boolean).join(' ');

  const cerrarSesión = () => {
    showDialog({
      title: 'Cerrar sesión',
      message: '¿Seguro que quieres salir? Tendrás que escribir tu correo y contraseña de nuevo.',
      actions: [
        { label: 'Cerrar sesión', tone: 'danger', onPress: signOut },
        { label: 'Cancelar', tone: 'cancel' },
      ],
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={c.primary} />

      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarTexto}>{(usuario?.firstName ?? '?').charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.headerCuerpo}>
          <Text style={styles.nombre} numberOfLines={2}>{nombre}</Text>
          <Text style={styles.rol}>
            {usuario?.role === 'coordinator' ? 'Coordinador' : 'Psicólogo'}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.contenido} showsVerticalScrollIndicator={false}>
        <View style={styles.tarjeta}>
          <Text style={styles.tarjetaTitulo} accessibilityRole="header">Tu cuenta</Text>
          <View style={styles.fila}>
            <Text style={styles.filaLabel}>Correo</Text>
            <Text style={styles.filaValor} numberOfLines={2}>{usuario?.email ?? '-'}</Text>
          </View>
          <View style={styles.fila}>
            <Text style={styles.filaLabel}>
              {sedes.length === 1 ? 'Sede' : 'Sedes'}
            </Text>
            <Text style={styles.filaValor}>
              {sedes.length ? sedes.map((s) => sedeCorta(s.name)).join(' · ') : 'Sin sede asignada'}
            </Text>
          </View>
        </View>

        <View style={styles.tarjeta}>
          <Text style={styles.tarjetaTitulo} accessibilityRole="header">Apariencia</Text>
          <View style={styles.temas} accessibilityRole="radiogroup">
            {TEMAS.map((opt) => {
              const elegido = preference === opt.id;
              return (
                <Touchable
                  key={opt.id}
                  style={[styles.tema, elegido && styles.temaElegido]}
                  onPress={() => setPreference(opt.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: elegido }}
                  accessibilityLabel={opt.label}
                  accessibilityHint={opt.hint}
                >
                  <Icon name={opt.icon} size={20} color={elegido ? c.primaryText : c.fg2} />
                  <Text style={[styles.temaLabel, elegido && styles.temaLabelElegido]}>{opt.label}</Text>
                </Touchable>
              );
            })}
          </View>
        </View>

        {/* Lo que esta vista no puede hacer, dicho una sola vez y en el lugar donde alguien
            iría a buscarlo. */}
        <View style={styles.nota}>
          <Icon name="chart-column" size={16} color={c.primaryText} />
          <Text style={styles.notaTexto}>
            El panel completo - solicitudes, finanzas, equipo, informes y el historial clínico -
            vive en la web. Esta app es para mirar rápido, publicar anuncios y acompañar el foro.
          </Text>
        </View>

        <Touchable
          style={styles.salir}
          onPress={cerrarSesión}
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión"
        >
          <Icon name="log-out" size={18} color={c.fg1} />
          <Text style={styles.salirTexto}>Cerrar sesión</Text>
        </Touchable>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  header: {
    backgroundColor: c.primary, flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: c.overlayWhite16, alignItems: 'center', justifyContent: 'center',
  },
  avatarTexto: { fontFamily: Fonts.headingBold, fontSize: 22, color: c.white },
  headerCuerpo: { flex: 1 },
  nombre: { fontFamily: Fonts.headingBold, fontSize: 21, color: c.white, letterSpacing: -0.3 },
  rol: { fontFamily: Fonts.body, fontSize: 13, color: c.onPrimaryMuted, marginTop: 2 },

  scroll: { flex: 1 },
  contenido: { padding: 16, paddingBottom: 28, gap: 14 },

  tarjeta: {
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
    borderRadius: 16, padding: 14,
  },
  tarjetaTitulo: { fontFamily: Fonts.headingBold, fontSize: 16, color: c.fg1, marginBottom: 8 },
  fila: { paddingVertical: 9, borderTopWidth: 1, borderTopColor: c.border },
  filaLabel: { fontFamily: Fonts.body, fontSize: 11, color: c.fg2 },
  filaValor: { fontFamily: Fonts.bodyBold, fontSize: 14, color: c.fg1, marginTop: 2 },

  temas: { flexDirection: 'row', gap: 8 },
  tema: {
    flex: 1, alignItems: 'center', gap: 6, minHeight: 72, justifyContent: 'center',
    borderRadius: 14, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.bg,
  },
  temaElegido: { borderColor: c.primary, backgroundColor: c.infoSurface },
  temaLabel: { fontFamily: Fonts.bodyBold, fontSize: 13, color: c.fg2 },
  temaLabelElegido: { color: c.primaryText },

  nota: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: c.infoSurface, borderWidth: 1, borderColor: c.infoBorder,
    borderRadius: 14, padding: 13,
  },
  notaTexto: { flex: 1, fontFamily: Fonts.body, fontSize: 13, color: c.fg1, lineHeight: 19 },

  salir: {
    flexDirection: 'row', gap: 9, minHeight: 54, alignItems: 'center', justifyContent: 'center',
    borderRadius: 9999, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surface,
  },
  salirTexto: { fontFamily: Fonts.bodyBold, fontSize: 15, color: c.fg1 },
});
