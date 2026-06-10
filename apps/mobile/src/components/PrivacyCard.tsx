import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/colors';
import { Icon } from './Icon';

export function PrivacyCard() {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.shield}>
          <Icon name="shield" size={18} color={Colors.primary} />
        </View>
        <Text style={styles.title}>Esta conversación es privada</Text>
      </View>

      <Text style={styles.body}>
        Habla con total libertad. Nada de lo que escribas aquí se comparte. Al cerrar la sesión solo
        se guarda un resumen muy general de tu progreso.
      </Text>

      <View style={styles.list}>
        <View style={styles.listItem}>
          <View style={styles.listIcon}>
            <Icon name="check" size={14} color={Colors.sage500} />
          </View>
          <Text style={styles.listText}>
            Solo se registran datos generales: ánimo, técnica usada y nivel de riesgo.
          </Text>
        </View>
        <View style={styles.listItem}>
          <View style={styles.listIcon}>
            <Icon name="x" size={14} color={Colors.fg2} />
          </View>
          <Text style={styles.listText}>No se guarda el contenido de los mensajes.</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: '#CFE7E3',
    borderRadius: 16,
    padding: 16,
    shadowColor: Colors.shadowSoft,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  shield: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: '#EAF3F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontWeight: '700',
    fontSize: 15,
    color: Colors.ink900,
    lineHeight: 20,
  },
  body: {
    fontSize: 13,
    color: Colors.fg2,
    lineHeight: 19,
    marginTop: 12,
  },
  list: {
    marginTop: 12,
    gap: 9,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  listIcon: {
    width: 16,
    marginTop: 1,
  },
  listText: {
    flex: 1,
    fontSize: 12.5,
    color: Colors.ink900,
    lineHeight: 18,
  },
});
