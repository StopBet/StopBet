import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TextInput, View } from 'react-native';
import type { GifAttachment } from '@stopbet/shared-types';
import type { Palette } from '../constants/colors';
import { Fonts } from '../constants/typography';
import { useColors, useStyles } from '../context/ThemeContext';
import { api } from '../services/api';
import { Icon } from './Icon';
import { Touchable } from './Touchable';

type Estado = 'cargando' | 'listo' | 'bloqueado' | 'error';

// Se busca mientras se escribe, pero no en cada tecla: el backend tiene un tope por minuto.
const ESPERA_MS = 400;

/**
 * El buscador de GIFs del panel, como el de WhatsApp: abre con los del momento y busca
 * mientras se escribe. El filtro de apuestas corre en el backend; acá solo se muestra lo que
 * pasó. Tocar un GIF lo envía.
 */
export function GifPicker({ onElegir }: { onElegir: (gif: GifAttachment) => void }) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const [texto, setTexto] = useState('');
  const [gifs, setGifs] = useState<GifAttachment[]>([]);
  const [estado, setEstado] = useState<Estado>('cargando');

  useEffect(() => {
    let vigente = true;
    setEstado('cargando');
    const t = setTimeout(() => {
      api
        .searchGifs(texto.trim())
        .then((r) => {
          if (!vigente) return;
          setGifs(r.gifs);
          setEstado(r.blocked ? 'bloqueado' : 'listo');
        })
        .catch(() => {
          if (vigente) setEstado('error');
        });
    }, ESPERA_MS);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [texto]);

  const aviso =
    estado === 'error'
      ? 'Los GIFs no están disponibles en este momento.'
      : estado === 'bloqueado' || (estado === 'listo' && gifs.length === 0)
      ? 'No hay GIFs para esa búsqueda.'
      : null;

  return (
    <View style={styles.contenedor}>
      <View style={styles.buscador}>
        <Icon name="search" size={18} color={c.fg2} />
        <TextInput
          style={styles.input}
          value={texto}
          onChangeText={setTexto}
          placeholder="Buscar GIFs"
          placeholderTextColor={c.fg2}
          accessibilityLabel="Buscar GIFs"
          maxLength={50}
          returnKeyType="search"
        />
      </View>
      {estado === 'cargando' ? (
        <ActivityIndicator style={styles.centro} color={c.primary} />
      ) : aviso ? (
        <Text style={[styles.centro, styles.aviso]}>{aviso}</Text>
      ) : (
        <FlatList
          data={gifs}
          keyExtractor={(g) => g.id}
          numColumns={3}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.grilla}
          renderItem={({ item }) => (
            <Touchable
              style={styles.celda}
              onPress={() => onElegir(item)}
              accessibilityRole="button"
              accessibilityLabel={item.title ? `Enviar GIF: ${item.title}` : 'Enviar GIF'}
            >
              <Image source={{ uri: item.previewUrl }} style={styles.imagen} resizeMode="cover" />
            </Touchable>
          )}
        />
      )}
      {/* Lo exigen los términos de GIPHY. */}
      <Text style={styles.credito}>Powered by GIPHY</Text>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    contenedor: { flex: 1 },
    buscador: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 12,
      marginTop: 8,
      paddingHorizontal: 14,
      minHeight: 44,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.bg,
    },
    input: { flex: 1, fontFamily: Fonts.body, fontSize: 14, color: c.ink900, paddingVertical: 8 },
    centro: { flex: 1, textAlignVertical: 'center', textAlign: 'center' },
    aviso: { fontFamily: Fonts.body, fontSize: 14, color: c.fg2, paddingHorizontal: 24 },
    grilla: { padding: 8 },
    celda: { flex: 1 / 3, aspectRatio: 1, padding: 3 },
    imagen: { flex: 1, borderRadius: 8, backgroundColor: c.border },
    credito: { fontFamily: Fonts.body, fontSize: 11, color: c.fg2, textAlign: 'center', paddingVertical: 4 },
  });
