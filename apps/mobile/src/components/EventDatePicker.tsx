import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Palette } from '../constants/colors';
import { useColors, useStyles } from '../context/ThemeContext';
import { Fonts } from '../constants/typography';
import { Icon } from './Icon';
import { Touchable } from './Touchable';

interface Props {
  visible: boolean;
  value: Date | null;
  onSelect: (fecha: Date) => void;
  onClose: () => void;
}

const DÍAS_A_MOSTRAR = 60;
// De las 8 a las 21:30: fuera de ese rango no hay sesiones de grupo ni talleres
const HORAS = Array.from({ length: 28 }, (_, i) => {
  const minutos = 8 * 60 + i * 30;
  return { h: Math.floor(minutos / 60), m: minutos % 60 };
});

function etiquetaDía(fecha: Date, hoy: Date): string {
  const díasDeDiferencia = Math.round(
    (new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()).getTime() -
      new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime()) / 86_400_000,
  );
  if (díasDeDiferencia === 0) return 'Hoy';
  if (díasDeDiferencia === 1) return 'Mañana';
  // Solo la primera letra: `textTransform: capitalize` dejaba "Jueves, 17 De Septiembre"
  const texto = fecha.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

const dosDígitos = (n: number) => String(n).padStart(2, '0');

// Ancho de cada píldora más su separación: todas dicen "HH:MM", así que miden lo mismo
const ANCHO_HORA = 94;

const índiceDeHora = (h: { h: number; m: number }) =>
  Math.max(0, HORAS.findIndex((x) => x.h === h.h && x.m === h.m));

/**
 * Para la fecha de un anuncio no sirve el selector de nacimiento: ahí lo lejano es el año
 * y acá el evento casi siempre es esta semana. Se eligen el día y la hora de una lista de
 * los próximos dos meses, sin recorrer un calendario mes a mes.
 */
export function EventDatePicker({ visible, value, onSelect, onClose }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const hoy = React.useMemo(() => new Date(), [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const [día, setDía] = React.useState<Date | null>(value);
  const [hora, setHora] = React.useState<{ h: number; m: number }>(
    value ? { h: value.getHours(), m: value.getMinutes() } : { h: 18, m: 0 },
  );

  React.useEffect(() => {
    if (!visible) return;
    setDía(value);
    setHora(value ? { h: value.getHours(), m: value.getMinutes() } : { h: 18, m: 0 });
  }, [visible, value]);

  const días = React.useMemo(() => {
    const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    return Array.from({ length: DÍAS_A_MOSTRAR }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return d;
    });
  }, [hoy]);

  const confirmar = () => {
    if (!día) return;
    const elegida = new Date(día);
    elegida.setHours(hora.h, hora.m, 0, 0);
    onSelect(elegida);
    onClose();
  };

  const mismoDía = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* accessible={false}: si no, TalkBack agrupa todo el modal y no llega a las celdas */}
      <Pressable style={styles.velo} onPress={onClose} accessible={false}>
        <Pressable style={styles.hoja} accessible={false}>
          <View style={styles.header}>
            <Text style={styles.titulo} accessibilityRole="header">¿Cuándo es?</Text>
            <Touchable onPress={onClose} hitSlop={14} accessibilityRole="button" accessibilityLabel="Cerrar">
              <Icon name="x" size={20} color={c.fg2} />
            </Touchable>
          </View>

          <Text style={styles.etiqueta}>Día</Text>
          <ScrollView style={styles.listaDías} showsVerticalScrollIndicator={false}>
            {días.map((d) => {
              const elegido = día ? mismoDía(d, día) : false;
              return (
                <Touchable
                  key={d.toISOString()}
                  style={[styles.día, elegido && styles.díaElegido]}
                  onPress={() => setDía(d)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: elegido }}
                >
                  <Text style={[styles.díaTexto, elegido && styles.díaTextoElegido]}>
                    {etiquetaDía(d, hoy)}
                  </Text>
                  {elegido ? <Icon name="check" size={18} color={c.primaryText} /> : null}
                </Touchable>
              );
            })}
          </ScrollView>

          <Text style={styles.etiqueta}>Hora</Text>
          {/* Sin esto la lista abre en las 08:00 y la hora elegida - 18:00 por omisión -
              queda fuera de la pantalla: parecía que no había ninguna seleccionada. */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horas}
            contentOffset={{ x: Math.max(0, índiceDeHora(hora) - 1) * ANCHO_HORA, y: 0 }}
          >
            {HORAS.map((h) => {
              const elegida = h.h === hora.h && h.m === hora.m;
              const texto = `${dosDígitos(h.h)}:${dosDígitos(h.m)}`;
              return (
                <Touchable
                  key={texto}
                  style={[styles.hora, elegida && styles.horaElegida]}
                  onPress={() => setHora(h)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: elegida }}
                  accessibilityLabel={`${texto} horas`}
                >
                  <Text style={[styles.horaTexto, elegida && styles.horaTextoElegida]}>{texto}</Text>
                </Touchable>
              );
            })}
          </ScrollView>

          <Touchable
            style={[styles.confirmar, !día && styles.confirmarApagado]}
            onPress={confirmar}
            disabled={!día}
            rippleColor="rgba(255,255,255,0.28)"
            accessibilityRole="button"
          >
            <Text style={styles.confirmarTexto}>
              {día ? `Usar ${etiquetaDía(día, hoy)} · ${dosDígitos(hora.h)}:${dosDígitos(hora.m)}` : 'Elige un día'}
            </Text>
          </Touchable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  velo: { flex: 1, backgroundColor: c.overlay, alignItems: 'center', justifyContent: 'center', padding: 20 },
  hoja: {
    width: '100%', maxWidth: 420, maxHeight: '85%',
    backgroundColor: c.surface, borderRadius: 22, padding: 18,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  titulo: { fontFamily: Fonts.headingBold, fontSize: 19, color: c.fg1 },
  etiqueta: {
    fontFamily: Fonts.bodyBold, fontSize: 12, color: c.fg2,
    textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 12, marginBottom: 6,
  },
  listaDías: { maxHeight: 210 },
  día: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 48, paddingHorizontal: 12, borderRadius: 12,
  },
  díaElegido: { backgroundColor: c.infoSurface },
  díaTexto: { fontFamily: Fonts.body, fontSize: 15, color: c.fg1 },
  díaTextoElegido: { fontFamily: Fonts.bodyBold, color: c.primaryText },
  horas: { gap: 8, paddingVertical: 2, paddingRight: 8 },
  hora: {
    width: ANCHO_HORA - 8, minHeight: 48, alignItems: 'center', justifyContent: 'center',
    borderRadius: 9999, borderWidth: 1.5, borderColor: c.border,
  },
  horaElegida: { borderColor: c.primary, backgroundColor: c.infoSurface },
  horaTexto: { fontFamily: Fonts.bodyBold, fontSize: 14, color: c.fg1 },
  horaTextoElegida: { color: c.primaryText },
  confirmar: {
    marginTop: 18, height: 52, borderRadius: 9999,
    backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center',
  },
  confirmarApagado: { opacity: 0.4 },
  confirmarTexto: { fontFamily: Fonts.bodyBold, fontSize: 15, color: c.white },
});
