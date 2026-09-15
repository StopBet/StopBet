import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/typography';
import { Icon } from './Icon';

export function PrivacyCard() {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.shield}>
          <Icon name="shield" size={18} color={Colors.primary} />
        </View>
        <Text style={styles.title}>Qué pasa con lo que escribes</Text>
      </View>

      <Text style={styles.body}>
        Puedes hablar con libertad. Esto es lo que pasa con tus mensajes:
      </Text>

      <View style={styles.list}>
        <View style={styles.listItem}>
          <View style={styles.listIcon}>
            <Icon name="eye-off" size={14} color={Colors.primary} />
          </View>
          <Text style={styles.listText}>Tu psicólogo no lee esta conversación.</Text>
        </View>
        <View style={styles.listItem}>
          <View style={styles.listIcon}>
            <Icon name="lock" size={14} color={Colors.primary} />
          </View>
          <Text style={styles.listText}>
            Tus mensajes quedan guardados en tu cuenta para que puedas retomar la conversación,
            mientras tu cuenta exista.
          </Text>
        </View>
        <View style={styles.listItem}>
          <View style={styles.listIcon}>
            <Icon name="sparkles" size={14} color={Colors.primary} />
          </View>
          <Text style={styles.listText}>
            Para responderte, tus mensajes pasan por un servicio de IA de Google, sin tu nombre ni tu RUT.
          </Text>
        </View>
        <View style={styles.listItem}>
          <View style={styles.listIcon}>
            <Icon name="clipboard-list" size={14} color={Colors.primary} />
          </View>
          <Text style={styles.listText}>
            Al cerrar, se guarda un resumen: ánimo, técnica usada y nivel de riesgo.
          </Text>
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
    fontFamily: Fonts.bodyBold,
    flex: 1,
    fontSize: 15,
    color: Colors.ink900,
    lineHeight: 20,
  },
  body: {
    fontFamily: Fonts.body,
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
    fontFamily: Fonts.body,
    flex: 1,
    fontSize: 12.5,
    color: Colors.ink900,
    lineHeight: 18,
  },
});
