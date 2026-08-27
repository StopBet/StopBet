import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '../constants/colors';
import { Icon } from './Icon';

type Props = {
  visible: boolean;
  value: string;              // dd/mm/aaaa, vacío si no hay
  onSelect: (value: string) => void;
  onClose: () => void;
};

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

// Solo se acota lo que es objetivo: no se puede haber nacido en el futuro, ni hace mas de
// 110 años. AJUTER no tiene definida una edad minima de ingreso; mientras no exista esa
// regla en el proyecto, el selector no la inventa —bloquear en silencio meses que parecen
// validos deja al usuario sin saber que hizo mal.
const MAX_AGE = 110;

const pad = (n: number) => String(n).padStart(2, '0');
const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

// getDay() devuelve 0 para domingo; acá la semana parte el lunes.
const firstWeekdayOffset = (year: number, month: number) => (new Date(year, month, 1).getDay() + 6) % 7;

function parse(value: string): { d: number; m: number; y: number } | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  return { d: Number(match[1]), m: Number(match[2]) - 1, y: Number(match[3]) };
}

export function BirthDatePicker({ visible, value, onSelect, onClose }: Props) {
  const today = useMemo(() => new Date(), []);
  const maxYear = today.getFullYear();
  const minYear = today.getFullYear() - MAX_AGE;

  const initial = parse(value);
  // Se abre en el año y no en el día: para una fecha de nacimiento el año es lo que está
  // lejos, y es justo lo que el picker nativo obliga a recorrer mes a mes.
  const [step, setStep] = useState<'year' | 'month' | 'day'>('year');
  const [year, setYear] = useState(initial?.y ?? maxYear - 10);
  const [month, setMonth] = useState(initial?.m ?? 0);
  const yearScroll = useRef<ScrollView>(null);

  // Android entrega al modal recien montado el mismo toque que lo abrio: al pulsar el campo
  // se seleccionaba de una el año que quedaba bajo el dedo y saltaba a mes. Se ignoran los
  // toques hasta que la aparicion termina.
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!visible) {
      setArmed(false);
      return;
    }
    const start = parse(value);
    setStep('year');
    setYear(start?.y ?? maxYear - 10);
    setMonth(start?.m ?? 0);
    const id = setTimeout(() => setArmed(true), 350);
    return () => clearTimeout(id);
  }, [visible, value, maxYear]);

  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = maxYear; y >= minYear; y--) list.push(y);
    return list;
  }, [maxYear, minYear]);

  const pickDay = (day: number) => {
    if (!armed) return;
    onSelect(`${pad(day)}/${pad(month + 1)}/${year}`);
    onClose();
  };

  const monthDisabled = (index: number) =>
    year === maxYear && index > today.getMonth();

  const dayDisabled = (day: number) =>
    year === maxYear && month === today.getMonth() && day > today.getDate();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Fecha de nacimiento</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Icon name="x" size={20} color={Colors.fg2} />
            </TouchableOpacity>
          </View>

          {/* Migas: cada tramo ya elegido vuelve a su paso con un toque */}
          <View style={styles.crumbs}>
            <TouchableOpacity activeOpacity={0.7} onPress={() => setStep('year')}
              style={[styles.crumbPill, step === 'year' && styles.crumbPillOn]}>
              {step !== 'year' && <Icon name="chevron-left" size={14} color={Colors.primary} />}
              <Text style={[styles.crumb, step === 'year' && styles.crumbActive]}>{year}</Text>
            </TouchableOpacity>
            {step !== 'year' && (
              <TouchableOpacity activeOpacity={0.7} onPress={() => setStep('month')}
                style={[styles.crumbPill, step === 'month' && styles.crumbPillOn]}>
                {step === 'day' && <Icon name="chevron-left" size={14} color={Colors.primary} />}
                <Text style={[styles.crumb, step === 'month' && styles.crumbActive]}>
                  {MONTHS[month]}
                </Text>
              </TouchableOpacity>
            )}
            <Text style={styles.crumbHint}>
              {step === 'year' ? 'Elige el año' : step === 'month' ? 'Elige el mes' : 'Elige el día'}
            </Text>
          </View>

          {step === 'year' && (
            <ScrollView ref={yearScroll} style={styles.scroll} contentContainerStyle={styles.grid}>
              {years.map(y => (
                <TouchableOpacity key={y} style={[styles.cell3, y === year && styles.cellOn]}
                  activeOpacity={0.7}
                  onPress={() => { if (!armed) return; setYear(y); setStep('month'); }}>
                  <Text style={[styles.cellText, y === year && styles.cellTextOn]}>{y}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {step === 'month' && (
            <View style={styles.grid}>
              {MONTHS.map((name, i) => {
                const off = monthDisabled(i);
                return (
                  <TouchableOpacity key={name} disabled={off}
                    style={[styles.cell3, i === month && styles.cellOn, off && styles.cellOff]}
                    activeOpacity={0.7}
                    onPress={() => { if (!armed) return; setMonth(i); setStep('day'); }}>
                    <Text style={[styles.cellText, i === month && styles.cellTextOn, off && styles.cellTextOff]}>
                      {name.slice(0, 3)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {step === 'day' && (
            <View>
              <View style={styles.weekRow}>
                {WEEKDAYS.map((w, i) => (
                  <Text key={i} style={styles.weekday}>{w}</Text>
                ))}
              </View>
              <View style={styles.grid}>
                {Array.from({ length: firstWeekdayOffset(year, month) }).map((_, i) => (
                  <View key={`gap-${i}`} style={styles.cell7} />
                ))}
                {Array.from({ length: daysInMonth(year, month) }).map((_, i) => {
                  const day = i + 1;
                  const off = dayDisabled(day);
                  const on = initial?.d === day && initial.m === month && initial.y === year;
                  return (
                    <TouchableOpacity key={day} disabled={off} activeOpacity={0.7}
                      style={[styles.cell7, on && styles.cellOn, off && styles.cellOff]}
                      onPress={() => pickDay(day)}>
                      <Text style={[styles.cellText, on && styles.cellTextOn, off && styles.cellTextOff]}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
    maxHeight: '78%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: { fontWeight: '700', fontSize: 16.5, color: Colors.fg1 },
  crumbs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  crumbPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 9999,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  crumbPillOn: { borderColor: Colors.primary, backgroundColor: Colors.surface },
  crumb: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
  crumbActive: { color: Colors.primary, fontWeight: '700' },
  crumbHint: { fontSize: 12.5, color: Colors.fg2, marginLeft: 'auto' },
  scroll: { maxHeight: 320 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell3: {
    width: '33.33%',
    paddingVertical: 13,
    alignItems: 'center',
    borderRadius: 12,
  },
  cell7: {
    width: '14.28%',
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  cellOn: { backgroundColor: Colors.primary },
  cellOff: { opacity: 0.28 },
  cellText: { fontSize: 15, color: Colors.fg1 },
  cellTextOn: { color: Colors.white, fontWeight: '700' },
  cellTextOff: { color: Colors.fg2 },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekday: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: Colors.fg2,
  },
});
