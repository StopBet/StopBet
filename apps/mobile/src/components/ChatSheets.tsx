import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Keyboard, Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ReactionEmoji, ReactionSummary } from '@stopbet/shared-types';
import { Icon, type IconName } from './Icon';
import { Touchable } from './Touchable';
import { REACTION_ICON_MAP, REACTION_NAME } from './ChatMessage';
import type { Palette } from '../constants/colors';
import { useColors, useStyles } from '../context/ThemeContext';
import { Fonts } from '../constants/typography';

// Las piezas del chat que comparten el grupo de la sede y las conversaciones uno a uno. Vivían
// dentro de CommunityScreen; con dos pantallas de chat, copiarlas era garantizar que se
// separaran a la primera corrección.

const REACCIONES: ReactionEmoji[] = ['💪', '❤️', '🤗'];

export interface OpciónDeMenú {
  label: string;
  icon: IconName;
  tone?: 'danger';
  onPress: () => void;
}

/**
 * El menú de una burbuja (toque largo o «···»): las opciones se leen antes de tocarlas.
 * Las reacciones van arriba solo si se pasa `onReact`; en los mensajes directos no hay.
 */
export function MenuDeMensaje({
  visible,
  reacciones,
  onReact,
  opciones,
  onClose,
}: {
  visible: boolean;
  reacciones?: ReactionSummary[];
  onReact?: (emoji: ReactionEmoji) => void;
  opciones: OpciónDeMenú[];
  onClose: () => void;
}) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Touchable style={styles.sheetBackdrop} activeOpacity={1} onPress={onClose} accessible={false}>
        <View style={styles.sheetCard}>
          {onReact ? (
            <View style={styles.sheetReacciones}>
              {REACCIONES.map((emoji) => {
                const resumen = reacciones?.find((r) => r.emoji === emoji);
                return (
                  <Touchable
                    key={emoji}
                    style={[styles.sheetReaccion, resumen?.userReacted && styles.sheetReaccionOn]}
                    accessibilityRole="button"
                    accessibilityLabel={REACTION_NAME[emoji]}
                    accessibilityState={{ selected: !!resumen?.userReacted }}
                    onPress={() => {
                      onClose();
                      onReact(emoji);
                    }}
                  >
                    <Icon
                      name={REACTION_ICON_MAP[emoji]}
                      size={22}
                      color={resumen?.userReacted ? c.primary : c.fg1}
                    />
                    <Text style={styles.sheetReaccionTexto}>{REACTION_NAME[emoji]}</Text>
                  </Touchable>
                );
              })}
            </View>
          ) : null}

          {opciones.map((o) => (
            <Touchable
              key={o.label}
              style={styles.sheetItem}
              accessibilityRole="button"
              onPress={() => {
                onClose();
                o.onPress();
              }}
            >
              <Icon name={o.icon} size={18} color={o.tone === 'danger' ? c.dangerText : c.fg1} />
              <Text style={[styles.sheetItemText, o.tone === 'danger' && { color: c.dangerText }]}>
                {o.label}
              </Text>
            </Touchable>
          ))}
          <Touchable style={styles.sheetItem} accessibilityRole="button" onPress={onClose}>
            <Icon name="x" size={18} color={c.fg2} />
            <Text style={[styles.sheetItemText, { color: c.fg2 }]}>Cancelar</Text>
          </Touchable>
        </View>
      </Touchable>
    </Modal>
  );
}

/**
 * Pide el motivo del reporte (CA5.3). Android no tiene `Alert.prompt`, por eso es un modal
 * propio. `onEnviar` devuelve si salió: si no, el modal se queda abierto con el texto.
 */
export function DiálogoDeReporte({
  visible,
  título,
  texto,
  onEnviar,
  onClose,
}: {
  visible: boolean;
  título: string;
  texto: string;
  onEnviar: (motivo: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (visible) setMotivo('');
  }, [visible]);

  const enviar = async () => {
    const limpio = motivo.trim();
    if (!limpio || enviando) return;
    setEnviando(true);
    try {
      if (await onEnviar(limpio)) onClose();
    } finally {
      setEnviando(false);
    }
  };

  const puede = !!motivo.trim() && !enviando;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{título}</Text>
          <Text style={styles.modalText}>{texto}</Text>
          <TextInput
            style={styles.modalInput}
            accessibilityLabel="Motivo del reporte"
            placeholder="Motivo del reporte…"
            placeholderTextColor={c.fg2}
            value={motivo}
            onChangeText={setMotivo}
            multiline
            maxLength={500}
            autoFocus
          />
          <View style={styles.modalActions}>
            <Touchable
              style={styles.modalCancel}
              onPress={onClose}
              accessibilityRole="button"
              disabled={enviando}
            >
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </Touchable>
            <Touchable
              rippleColor="rgba(255,255,255,0.28)"
              style={[styles.modalSubmit, !puede && styles.modalSubmitDisabled]}
              onPress={enviar}
              disabled={!puede}
              accessibilityRole="button"
              accessibilityLabel="Reportar"
              accessibilityState={{ busy: enviando }}
            >
              {enviando ? (
                <ActivityIndicator size="small" color={c.white} />
              ) : (
                <Text style={styles.modalSubmitText}>Reportar</Text>
              )}
            </Touchable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * El margen de abajo para lo que va pegado al pie de un chat.
 *
 * Las conversaciones son pantallas del stack, sin la barra inferior de la app debajo: sin este
 * margen, la barra de navegación de Android (los tres botones de Samsung) quedaba encima del
 * campo de texto. Con el teclado abierto esa barra queda tapada y el margen sobraría: dejaba un
 * hueco entre el campo y el teclado.
 */
export function useMargenInferior(): number {
  const { bottom } = useSafeAreaInsets();
  const [teclado, setTeclado] = useState(false);
  useEffect(() => {
    const mostrar = Keyboard.addListener('keyboardDidShow', () => setTeclado(true));
    const ocultar = Keyboard.addListener('keyboardDidHide', () => setTeclado(false));
    return () => {
      mostrar.remove();
      ocultar.remove();
    };
  }, []);
  return teclado ? 0 : bottom;
}

/** El campo de texto y el botón de enviar, al pie de cualquier chat. */
export function ComposerDeChat({
  valor,
  onCambio,
  onEnviar,
  apagado,
  ocupado,
  placeholder,
  etiqueta,
}: {
  valor: string;
  onCambio: (t: string) => void;
  onEnviar: () => void;
  /** Sin conexión o sin permiso para escribir. */
  apagado: boolean;
  ocupado: boolean;
  placeholder: string;
  etiqueta: string;
}) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const margen = useMargenInferior();
  const puede = !apagado && !!valor.trim() && !ocupado;
  return (
    <View style={[styles.composer, { paddingBottom: 14 + margen }, apagado && styles.composerOff]}>
      <TextInput
        style={styles.composerInput}
        accessibilityLabel={etiqueta}
        placeholder={placeholder}
        placeholderTextColor={c.fg2}
        value={valor}
        onChangeText={onCambio}
        editable={!apagado}
        maxLength={1000}
        multiline
      />
      <Touchable
        rippleColor="rgba(255,255,255,0.28)"
        style={[styles.sendBtn, !puede && styles.sendBtnDisabled]}
        onPress={onEnviar}
        disabled={!puede}
        accessibilityRole="button"
        accessibilityLabel="Enviar mensaje"
        accessibilityState={{ disabled: !puede, busy: ocupado }}
        activeOpacity={0.85}
      >
        {ocupado ? (
          <ActivityIndicator size="small" color={c.white} />
        ) : (
          <Icon name="send" size={18} color={c.white} />
        )}
      </Touchable>
    </View>
  );
}

/** Encabezado de una conversación: volver, avatar, nombre y, si hace falta, un menú. */
export function EncabezadoDeChat({
  título,
  subtítulo,
  avatar,
  esGrupo,
  onVolver,
  onMenú,
}: {
  título: string;
  subtítulo?: string;
  avatar: string;
  esGrupo?: boolean;
  onVolver: () => void;
  onMenú?: () => void;
}) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.header}>
      <Touchable
        style={styles.headerBtn}
        onPress={onVolver}
        hitSlop={10}
        borderless
        accessibilityRole="button"
        accessibilityLabel="Volver a los chats"
      >
        <Icon name="chevron-left" size={26} color={c.white} />
      </Touchable>
      <View style={[styles.headerAvatar, esGrupo && styles.headerAvatarGrupo]}>
        {esGrupo ? (
          <Icon name="users" size={20} color={c.primary} />
        ) : (
          <Text style={styles.headerAvatarLetra}>{avatar}</Text>
        )}
      </View>
      <View style={styles.flex}>
        <Text style={styles.headerTitle} numberOfLines={1} accessibilityRole="header">
          {título}
        </Text>
        {subtítulo ? (
          <Text style={styles.headerSub} numberOfLines={1}>
            {subtítulo}
          </Text>
        ) : null}
      </View>
      {onMenú ? (
        <Touchable
          style={styles.headerBtn}
          onPress={onMenú}
          hitSlop={10}
          borderless
          accessibilityRole="button"
          accessibilityLabel="Opciones de la conversación"
        >
          <Icon name="ellipsis-vertical" size={22} color={c.white} />
        </Touchable>
      ) : null}
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: c.primary,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.teal400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarGrupo: { backgroundColor: c.white },
  headerAvatarLetra: { fontFamily: Fonts.bodyBold, fontSize: 17, color: c.white },
  headerTitle: { fontFamily: Fonts.headingBold, fontSize: 18, color: c.white },
  headerSub: { fontFamily: Fonts.body, fontSize: 12.5, color: c.onPrimaryMuted, marginTop: 1 },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: c.surface,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  composerOff: { opacity: 0.7 },
  composerInput: {
    fontFamily: Fonts.body,
    flex: 1,
    backgroundColor: c.bg,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 11,
    fontSize: 14,
    color: c.ink900,
    maxHeight: 110,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: c.border },

  sheetBackdrop: { flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' },
  sheetCard: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 26,
  },
  sheetReacciones: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 6,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  sheetReaccion: {
    alignItems: 'center',
    gap: 4,
    minWidth: 84,
    minHeight: 60,
    justifyContent: 'center',
    borderRadius: 14,
  },
  sheetReaccionOn: { backgroundColor: c.infoSurface },
  sheetReaccionTexto: { fontFamily: Fonts.body, fontSize: 12, color: c.fg2 },
  sheetItem: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 8 },
  sheetItemText: { fontFamily: Fonts.bodyBold, fontSize: 15, color: c.fg1 },

  modalBackdrop: {
    flex: 1,
    backgroundColor: c.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: { width: '100%', backgroundColor: c.surface, borderRadius: 18, padding: 20, gap: 12 },
  modalTitle: { fontFamily: Fonts.headingBold, fontSize: 18, color: c.ink900 },
  modalText: { fontFamily: Fonts.body, fontSize: 14, color: c.fg2, lineHeight: 20 },
  modalInput: {
    fontFamily: Fonts.body,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: c.ink900,
    backgroundColor: c.bg,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  modalCancel: { paddingHorizontal: 18, paddingVertical: 11 },
  modalCancelText: { fontFamily: Fonts.bodyMedium, fontSize: 14, color: c.fg2 },
  modalSubmit: {
    backgroundColor: c.danger,
    borderRadius: 9999,
    paddingHorizontal: 22,
    paddingVertical: 11,
    minWidth: 110,
    alignItems: 'center',
  },
  modalSubmitDisabled: { backgroundColor: c.border },
  modalSubmitText: { fontFamily: Fonts.bodyBold, fontSize: 14, color: c.white },
});
