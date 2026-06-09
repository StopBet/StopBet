import React, { useState } from 'react';
import {
  KeyboardTypeOptions,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '../constants/colors';

interface Props {
  label: string;
  required?: boolean;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  leadingIcon?: string;       // emoji usado como ícono
  prefix?: string;            // ej. "+56" para teléfono
  error?: string;
  hint?: string;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  editable?: boolean;
  trailingIcon?: string;      // emoji para chevron/ojo etc.
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
}: Props) {
  const [focused, setFocused] = useState(false);
  const [secure, setSecure] = useState(secureTextEntry ?? false);

  const borderColor = error
    ? Colors.danger
    : focused
    ? Colors.primary
    : Colors.border;

  const shadowColor = focused && !error ? Colors.primary : 'transparent';

  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.req}> *</Text>}
      </Text>

      <View style={[styles.inputRow, { borderColor }, focused && !error && styles.inputFocused]}>
        {leadingIcon && (
          <Text style={[styles.icon, focused && styles.iconFocused]}>{leadingIcon}</Text>
        )}
        {prefix && (
          <Text style={styles.prefix}>{prefix}</Text>
        )}
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
        />
        {secureTextEntry && (
          <TouchableOpacity onPress={() => setSecure((v) => !v)} style={styles.eyeBtn}>
            <Text style={styles.icon}>{secure ? '👁️' : '🙈'}</Text>
          </TouchableOpacity>
        )}
        {trailingIcon && !secureTextEntry && (
          <Text style={styles.trailing}>{trailingIcon}</Text>
        )}
      </View>

      {error && (
        <Text style={styles.error}>⚠ {error}</Text>
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
    fontWeight: '600',
    fontSize: 13,
    color: Colors.ink900,
    marginBottom: 7,
  },
  req: {
    color: Colors.accent,
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
  inputFocused: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.13,
    shadowRadius: 6,
    elevation: 2,
  },
  icon: {
    fontSize: 17,
    color: Colors.fg2,
  },
  iconFocused: {
    color: Colors.primary,
  },
  prefix: {
    fontWeight: '600',
    fontSize: 15,
    color: Colors.fg1,
    paddingRight: 10,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  input: {
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
    fontSize: 17,
    color: Colors.fg2,
    marginLeft: 'auto',
  },
  error: {
    fontSize: 12,
    color: Colors.danger,
    marginTop: 7,
  },
  hint: {
    fontSize: 12,
    color: Colors.fg2,
    marginTop: 7,
    lineHeight: 17,
  },
});
