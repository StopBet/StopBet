import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { DirectContact } from '@stopbet/shared-types';
import type { AppStackParamList } from '../navigation/types';
import { Icon } from '../components/Icon';
import { Touchable } from '../components/Touchable';
import { initial } from '../components/ChatMessage';
import type { Palette } from '../constants/colors';
import { useColors, useStyles } from '../context/ThemeContext';
import { Fonts } from '../constants/typography';
import { api } from '../services/api';
import { ROLE_LABEL } from '../utils/roles';
import { useCurrentUser } from '../context/AuthContext';

// Suficiente para no pedir una búsqueda por cada letra mientras se escribe un nombre.
const ESPERA_BÚSQUEDA_MS = 300;

type Props = NativeStackScreenProps<AppStackParamList, 'NewDirectMessage'>;

/** El botón «+» de la lista de chats: buscar a alguien de la sede y escribirle. */
export function NewDirectMessageScreen({ navigation }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const sede = useCurrentUser()?.sedeId ?? '';
  // La última persona de la lista no puede quedar debajo de la barra de navegación de Android.
  const { bottom } = useSafeAreaInsets();
  const [texto, setTexto] = useState('');
  const [contactos, setContactos] = useState<DirectContact[] | null>(null);
  const [error, setError] = useState(false);
  // La respuesta de una búsqueda vieja no puede pisar la de una más nueva.
  const últimaBúsqueda = useRef(0);

  useEffect(() => {
    const n = ++últimaBúsqueda.current;
    const t = setTimeout(async () => {
      try {
        const r = await api.findDirectContacts(texto);
        if (n !== últimaBúsqueda.current) return;
        setContactos(r);
        setError(false);
      } catch {
        if (n !== últimaBúsqueda.current) return;
        setError(true);
      }
    }, texto ? ESPERA_BÚSQUEDA_MS : 0);
    return () => clearTimeout(t);
  }, [texto]);

  const abrir = (contacto: DirectContact) => {
    // `replace`: al volver desde la conversación se llega a la lista de chats, no al buscador.
    navigation.replace('DirectChat', { userId: contacto.id, name: contacto.name });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={c.primary} />
      <View style={styles.header}>
        <Touchable
          style={styles.headerBtn}
          onPress={() => navigation.goBack()}
          hitSlop={10}
          borderless
          accessibilityRole="button"
          accessibilityLabel="Volver a los chats"
        >
          <Icon name="chevron-left" size={26} color={c.white} />
        </Touchable>
        <View style={styles.flex}>
          <Text style={styles.headerTitle} accessibilityRole="header">Nuevo mensaje</Text>
          <Text style={styles.headerSub}>Personas de la sede {sede}</Text>
        </View>
      </View>

      <View style={styles.fondo}>
        <View style={styles.buscador}>
          <Icon name="search" size={18} color={c.fg2} />
          <TextInput
            style={styles.buscadorInput}
            value={texto}
            onChangeText={setTexto}
            placeholder="Buscar por nombre"
            placeholderTextColor={c.fg2}
            accessibilityLabel="Buscar a quién escribirle"
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
          />
          {texto ? (
            <Touchable
              onPress={() => setTexto('')}
              hitSlop={12}
              borderless
              accessibilityRole="button"
              accessibilityLabel="Borrar la búsqueda"
            >
              <Icon name="x" size={18} color={c.fg2} />
            </Touchable>
          ) : null}
        </View>

        {contactos === null && !error ? (
          <ActivityIndicator size="large" color={c.primaryText} style={styles.cargando} />
        ) : (
          <FlatList
            data={contactos ?? []}
            keyExtractor={(u) => u.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.lista, { paddingBottom: 24 + bottom }]}
            ListEmptyComponent={
              <Text style={styles.vacío}>
                {error
                  ? 'No pudimos buscar. Revisa tu conexión e inténtalo de nuevo.'
                  : texto
                    ? `No encontramos a nadie de tu sede que se llame «${texto}».`
                    : 'Todavía no hay otras personas en tu sede.'}
              </Text>
            }
            renderItem={({ item }) => (
              <Touchable
                style={styles.fila}
                onPress={() => abrir(item)}
                accessibilityRole="button"
                accessibilityLabel={`Escribirle a ${item.name}${
                  item.role === 'sponsor' ? `, ${ROLE_LABEL.sponsor}` : ''
                }`}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarLetra}>{initial(item.name)}</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={styles.nombre} numberOfLines={1}>{item.name}</Text>
                  {item.role === 'sponsor' ? (
                    <Text style={styles.rol}>{ROLE_LABEL.sponsor}</Text>
                  ) : null}
                </View>
              </Touchable>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.primary },
  flex: { flex: 1, minWidth: 0 },
  fondo: { flex: 1, backgroundColor: c.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: c.primary,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: Fonts.headingBold, fontSize: 18, color: c.white },
  headerSub: { fontFamily: Fonts.body, fontSize: 12.5, color: c.onPrimaryMuted, marginTop: 1 },

  buscador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    margin: 12,
    paddingHorizontal: 14,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 24,
    minHeight: 48,
  },
  buscadorInput: { flex: 1, fontFamily: Fonts.body, fontSize: 15, color: c.ink900, paddingVertical: 10 },

  cargando: { marginTop: 32 },
  lista: { paddingBottom: 24 },
  vacío: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: c.fg2,
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: 24,
    paddingTop: 32,
  },

  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    minHeight: 68,
    backgroundColor: c.surface,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.teal400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetra: { fontFamily: Fonts.bodyBold, fontSize: 17, color: c.white },
  nombre: { fontFamily: Fonts.bodyBold, fontSize: 16, color: c.ink900 },
  rol: { fontFamily: Fonts.body, fontSize: 13, color: c.fg2, marginTop: 2 },
});
