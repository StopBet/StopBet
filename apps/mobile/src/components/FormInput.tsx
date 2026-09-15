import React, { useState } from 'react';
import {
  KeyboardTypeOptions,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { Palette } from '../constants/colors';
import { useColors, useStyles } from '../context/ThemeContext';
import { Fonts } from '../constants/typography';
import { Icon, type IconName } from './Icon';
import { Touchable } from './Touchable';

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
  const c = useColors();
  const styles = useStyles(makeStyles);
  const [focused, setFocused] = useState(false);
  const [secure, setSecure] = useState(secureTextEntry ?? false);

  // El realce de foco se pinta con un anillo aparte, hermano de la fila y no ancestro del
  // TextInput, y montado SIEMPRE: solo cambia su color. Aplicar el realce sobre la fila que
  // contiene al TextInput lo remontaba al enfocarlo —el foco saltaba al campo siguiente y el
  // teclado se cerraba—, y aplazar el re-render con requestAnimationFrame tampoco bastaba:
  // el momento da igual, lo que rompe es tocar el arbol por encima del input. Con el anillo
  // separado el subarbol del TextInput queda intacto y el borde azul vuelve.
  const borderColor = error ? c.danger : c.border;
  const ringColor = focused && !error ? c.primary : 'transparent';

  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.req}> *</Text>}
      </Text>

      <View style={styles.inputWrap}>
        <View style={[styles.inputRow, { borderColor }]}>
          {leadingIcon && (
            <Icon name={leadingIcon} size={18} color={c.fg2} />
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
            accessibilityLabel={required ? `${label}, obligatorio` : label}
            accessibilityHint={error ?? hint}
            // si el campo es un selector, TalkBack debe llegar al botón de encima y no a este input
            importantForAccessibility={onPress ? 'no' : 'auto'}
            placeholder={placeholder}
            placeholderTextColor={c.fg2}
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
            <Touchable
              onPress={() => setSecure((v) => !v)}
              style={styles.eyeBtn}
              hitSlop={11}
              accessibilityRole="button"
              accessibilityLabel={secure ? 'Mostrar contraseña' : 'Ocultar contraseña'}
            >
              <Icon name={secure ? 'eye' : 'eye-off'} size={18} color={c.fg2} />
            </Touchable>
          )}
          {trailingIcon && !secureTextEntry && (
            <View style={styles.trailing}>
              <Icon name={trailingIcon} size={18} color={c.fg2} />
            </View>
          )}
        </View>
        <View pointerEvents="none" style={[styles.focusRing, { borderColor: ringColor }]} />
        {onPress && (
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={`${label}${required ? ', obligatorio' : ''}: ${value || 'sin elegir'}`}
            accessibilityHint={error ?? hint}
          />
        )}
      </View>

      {error && (
        <View style={styles.errorRow} accessibilityLiveRegion="polite">
          <Icon name="triangle-alert" size={13} color={c.dangerText} />
          <Text style={styles.error}>{error}</Text>
        </View>
      )}
      {hint && !error && (
        <Text style={styles.hint}>{hint}</Text>
      )}
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  field: {
    marginBottom: 16,
  },
  label: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    color: c.ink900,
    marginBottom: 7,
  },
  req: {
    color: c.primaryText,
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
    backgroundColor: c.surface,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 52,
    gap: 10,
  },
  prefix: {
    fontFamily: Fonts.bodyBold,
    fontSize: 15,
    color: c.fg1,
    paddingRight: 10,
    borderRightWidth: 1,
    borderRightColor: c.border,
  },
  input: {
    fontFamily: Fonts.body,
    flex: 1,
    fontSize: 15,
    color: c.ink900,
    padding: 0,
    // todo el alto de la caja es tocable, no solo la línea de texto
    alignSelf: 'stretch',
    textAlignVertical: 'center',
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
    color: c.dangerText,
  },
  hint: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: c.fg2,
    marginTop: 7,
    lineHeight: 17,
  },
});
