import React, { useState } from 'react';
import {
  KeyboardTypeOptions,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/typography';
import { Icon, type IconName } from './Icon';

interface Props {
  label: string;
  required?: boolean;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  leadingIcon?: IconName;     // nombre de ícono Lucide
  prefix?: string;            // ej. "+56" para teléfono
  error?: string;
  hint?: string;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  editable?: boolean;
  trailingIcon?: IconName;    // ícono para chevron/etc.
  onPress?: () => void;       // convierte el campo en selector (calendario, lista)
  maxLength?: number;
  autoCorrect?: boolean;      // apagarla en campos que se reformatean solos (ver TextInput)
}

export function FormInput({
  label,
  required,
  placeholder,
  value,
  onChangeText,
  leadingIcon,
  prefix,
  error,
  hint,
  keyboardType,
  secureTextEntry,
  editable = true,
  trailingIcon,
  onPress,
  maxLength,
  autoCorrect = true,
}: Props) {
  const [focused, setFocused] = useState(false);
  const [secure, setSecure] = useState(secureTextEntry ?? false);

  // El realce de foco se pinta con un anillo aparte, hermano de la fila y no ancestro del
  // TextInput, y montado SIEMPRE: solo cambia su color. Aplicar el realce sobre la fila que
  // contiene al TextInput lo remontaba al enfocarlo —el foco saltaba al campo siguiente y el
  // teclado se cerraba—, y aplazar el re-render con requestAnimationFrame tampoco bastaba:
  // el momento da igual, lo que rompe es tocar el arbol por encima del input. Con el anillo
  // separado el subarbol del TextInput queda intacto y el borde azul vuelve.
  const borderColor = error ? Colors.danger : Colors.border;
  const ringColor = focused && !error ? Colors.primary : 'transparent';

  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.req}> *</Text>}
      </Text>

      <View style={styles.inputWrap}>
        <View style={[styles.inputRow, { borderColor }]}>
          {leadingIcon && (
            <Icon name={leadingIcon} size={18} color={Colors.fg2} />
          )}
          {prefix && (
            <Text style={styles.prefix}>{prefix}</Text>
          )}
          {/* Con la autocorrección encendida el teclado de Android mantiene una región de
              composición sobre lo que se está escribiendo. Un campo que reescribe su propio
              texto en cada tecla —como el RUT, que se formatea solo— la deja obsoleta, y el
              teclado vuelve a soltar su buffer entero: tecleando 123 el campo terminaba con
              123123123. Apagar autoCorrect evita esto en Gboard, pero no en todos los
              teclados (probado: el de Samsung lo ignora); ahí hace falta además forzar
              keyboardType="visible-password" en el campo, que sí o sí corta la composición. */}
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={Colors.fg2}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            keyboardType={keyboardType ?? 'default'}
            secureTextEntry={secure}
            editable={editable}
            maxLength={maxLength}
            autoCorrect={autoCorrect}
            spellCheck={autoCorrect}
            autoComplete={autoCorrect ? undefined : 'off'}
            importantForAutofill={autoCorrect ? undefined : 'no'}
          />
          {secureTextEntry && (
            <TouchableOpacity onPress={() => setSecure((v) => !v)} style={styles.eyeBtn}>
              <Icon name={secure ? 'eye' : 'eye-off'} size={18} color={Colors.fg2} />
            </TouchableOpacity>
          )}
          {trailingIcon && !secureTextEntry && (
            <View style={styles.trailing}>
              <Icon name={trailingIcon} size={18} color={Colors.fg2} />
            </View>
          )}
        </View>
        <View pointerEvents="none" style={[styles.focusRing, { borderColor: ringColor }]} />
        {onPress && <Pressable style={StyleSheet.absoluteFill} onPress={onPress} />}
      </View>

      {error && (
        <View style={styles.errorRow}>
          <Icon name="triangle-alert" size={13} color={Colors.danger} />
          <Text style={styles.error}>{error}</Text>
        </View>
      )}
      {hint && !error && (
        <Text style={styles.hint}>{hint}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 16,
  },
  label: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    color: Colors.ink900,
    marginBottom: 7,
  },
  req: {
    color: Colors.accent,
  },
  inputWrap: {
    position: 'relative',
  },
  focusRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1.5,
    borderRadius: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 52,
    gap: 10,
  },
  prefix: {
    fontFamily: Fonts.bodyBold,
    fontSize: 15,
    color: Colors.fg1,
    paddingRight: 10,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  input: {
    fontFamily: Fonts.body,
    flex: 1,
    fontSize: 15,
    color: Colors.ink900,
    padding: 0,
  },
  eyeBtn: {
    padding: 4,
    marginLeft: 'auto',
  },
  trailing: {
    marginLeft: 'auto',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 7,
  },
  error: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.danger,
  },
  hint: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.fg2,
    marginTop: 7,
    lineHeight: 17,
  },
});
