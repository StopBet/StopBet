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
          <Icon name={leadingIcon} size={18} color={focused ? Colors.primary : Colors.fg2} />
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
            <Icon name={secure ? 'eye' : 'eye-off'} size={18} color={Colors.fg2} />
          </TouchableOpacity>
        )}
        {trailingIcon && !secureTextEntry && (
          <View style={styles.trailing}>
            <Icon name={trailingIcon} size={18} color={Colors.fg2} />
          </View>
        )}
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
    marginLeft: 'auto',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 7,
  },
  error: {
    fontSize: 12,
    color: Colors.danger,
  },
  hint: {
    fontSize: 12,
    color: Colors.fg2,
    marginTop: 7,
    lineHeight: 17,
  },
});
