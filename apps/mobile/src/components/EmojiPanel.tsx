import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Palette } from '../constants/colors';
import { useColors, useStyles } from '../context/ThemeContext';
import { Icon } from './Icon';
import { Touchable } from './Touchable';

/**
 * Lista curada y no una librería con todos los emojis: el set completo suma cientos de KB a un
 * bundle que se achicó a propósito, y a una comunidad de apoyo le basta con esto. Quedan
 * fuera los del juego (🎰 🎲 🃏 💰 💸): es una app para dejar de apostar.
 */
const CATEGORÍAS: { nombre: string; ícono: string; emojis: string[] }[] = [
  {
    nombre: 'Caras',
    ícono: '😀',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '🙂', '😉', '😇',
      '😍', '🥰', '😘', '😋', '😎', '🤗', '🤔', '🙃', '😐', '😌', '😬', '😴',
      '😔', '😟', '🥺', '😢', '😭', '😥', '😓', '😤', '😠', '😮', '😱', '🤒',
    ],
  },
  {
    nombre: 'Gestos',
    ícono: '👍',
    emojis: [
      '👍', '👎', '👏', '🙌', '🙏', '🤝', '💪', '👋', '✌️', '👌', '🤞', '✋',
      '👊', '🫶', '🫂', '☝️',
    ],
  },
  {
    nombre: 'Corazones',
    ícono: '❤️',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🤍', '🖤', '💔', '❣️', '💕', '💖',
      '💗', '💯', '✨', '⭐', '🌟', '🔥', '🎉', '🎊', '🏆', '🥇',
    ],
  },
  {
    nombre: 'Cosas',
    ícono: '🌻',
    emojis: [
      '☀️', '🌈', '🌸', '🌻', '🌿', '🍀', '🌊', '☕', '🍵', '🍎', '⚽', '🎶',
      '📅', '⏰', '🏠', '👨‍👩‍👧', '🚶', '🧘', '🏃', '💬', '📞', '✅',
    ],
  },
];

const TODOS = CATEGORÍAS.flatMap((cat) => cat.emojis);

/**
 * Borra lo que hay antes del cursor de a un emoji completo, no de a una unidad de código:
 * «❤️» o «👨‍👩‍👧» son varias, y borrarlas por partes deja caracteres rotos en el mensaje.
 */
export function borrarUltimo(texto: string): string {
  const emoji = TODOS.find((e) => texto.endsWith(e));
  if (emoji) return texto.slice(0, -emoji.length);
  return Array.from(texto).slice(0, -1).join('');
}

/** El panel que reemplaza al teclado, como en WhatsApp. */
export function EmojiPanel({
  onElegir,
  onBorrar,
}: {
  onElegir: (emoji: string) => void;
  onBorrar: () => void;
}) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const [categoría, setCategoría] = useState(0);

  return (
    <View style={styles.panel}>
      <View style={styles.pestañas} accessibilityRole="tablist">
        {CATEGORÍAS.map((cat, i) => (
          <Touchable
            key={cat.nombre}
            style={[styles.pestaña, i === categoría && styles.pestañaActiva]}
            onPress={() => setCategoría(i)}
            accessibilityRole="tab"
            accessibilityLabel={cat.nombre}
            accessibilityState={{ selected: i === categoría }}
          >
            <Text style={styles.pestañaÍcono}>{cat.ícono}</Text>
          </Touchable>
        ))}
        <Touchable
          style={styles.pestaña}
          onPress={onBorrar}
          accessibilityRole="button"
          accessibilityLabel="Borrar"
        >
          <Icon name="delete" size={22} color={c.fg2} />
        </Touchable>
      </View>
      <ScrollView contentContainerStyle={styles.grilla} keyboardShouldPersistTaps="always">
        {CATEGORÍAS[categoría].emojis.map((emoji) => (
          <Touchable
            key={emoji}
            style={styles.celda}
            onPress={() => onElegir(emoji)}
            accessibilityRole="button"
            accessibilityLabel={emoji}
          >
            <Text style={styles.emoji}>{emoji}</Text>
          </Touchable>
        ))}
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    panel: { height: 280, backgroundColor: c.surface },
    pestañas: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      paddingHorizontal: 8,
    },
    pestaña: {
      flex: 1,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    pestañaActiva: { borderBottomColor: c.primary },
    pestañaÍcono: { fontSize: 22 },
    grilla: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 8,
      paddingVertical: 8,
    },
    // 48 dp como mínimo: la app la usan adultos mayores.
    celda: { width: '12.5%', minWidth: 48, height: 52, alignItems: 'center', justifyContent: 'center' },
    emoji: { fontSize: 28 },
  });
