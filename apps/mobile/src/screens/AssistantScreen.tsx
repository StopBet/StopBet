import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type {
  AIMessage,
  AiSessionSummary,
  CrisisSignal,
  SponsorInfo,
  SendMessageWithRiskResponse,
  TechniqueType,
} from '@stopbet/shared-types';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/typography';
import { api } from '../services/api';
import {
  buildLocalUserMessage,
  buildOfflineFallbackMessage,
} from '../services/assistantFallback';
import { PrivacyCard } from '../components/PrivacyCard';
import { CrisisCard } from '../components/CrisisCard';
import { TechniqueCard } from '../components/TechniqueCard';
import { TypingIndicator } from '../components/TypingIndicator';
import { SessionSummaryModal } from '../components/SessionSummaryModal';
import { Icon } from '../components/Icon';
import type { AppStackParamList } from '../navigation/types';
import { readSponsor } from '../services/offlineStore';

const PLACEHOLDER_USER_ID = '11111111-1111-1111-1111-111111111111'; // TODO: reemplazar con ID real del contexto de auth
const INACTIVITY_MS = 10 * 60 * 1000;
const IDLE_WARNING_MS = 60 * 1000; // el aviso sale 1 minuto antes de cerrar

type Nav = NativeStackNavigationProp<AppStackParamList, 'Assistant'>;

interface ListItem {
  type: 'privacy' | 'recall' | 'message' | 'technique' | 'typing';
  id: string;
  message?: AIMessage;
  context?: string;
  techniqueType?: TechniqueType;
}

export function AssistantScreen() {
  const navigation = useNavigation<Nav>();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [crisis, setCrisis] = useState<CrisisSignal | null>(null);
  const [summary, setSummary] = useState<AiSessionSummary | null>(null);
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [idleWarning, setIdleWarning] = useState(false);
  const [sponsor, setSponsor] = useState<SponsorInfo | null>(null);
  const [sessionStartedAt, setSessionStartedAt] = useState<Date | null>(null);

  const listRef = useRef<FlatList>(null);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inactivityWarning = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAutoClose = useCallback(async () => {
    if (!sessionId) return;
    try {
      const result = await api.closeAiSession(PLACEHOLDER_USER_ID, sessionId);
      setSummary(result);
      setSummaryVisible(true);
    } catch {
      // Auto-close silencioso si falla la red
    }
  }, [sessionId]);

  // El cierre por inactividad abría el resumen de golpe, sin decir que iba a pasar
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (inactivityWarning.current) clearTimeout(inactivityWarning.current);
    setIdleWarning(false);
    inactivityWarning.current = setTimeout(() => {
      setIdleWarning(true);
    }, INACTIVITY_MS - IDLE_WARNING_MS);
    inactivityTimer.current = setTimeout(() => {
      setIdleWarning(false);
      handleAutoClose();
    }, INACTIVITY_MS);
  }, [handleAutoClose]);

  // La tarjeta de crisis ofrecía "Contactar a mi padrino" y abría otra pantalla.
  // Con el teléfono guardado se puede llamar de verdad desde acá.
  useEffect(() => {
    readSponsor().then(setSponsor).catch(() => {});
  }, []);

  const addTypingIndicator = () => {
    setItems((prev) => [...prev, { type: 'typing', id: '__typing__' }]);
  };

  const removeTypingIndicator = () => {
    setItems((prev) => prev.filter((i) => i.id !== '__typing__'));
  };

  const appendMessages = (messages: AIMessage[]) => {
    const newItems: ListItem[] = messages.flatMap((msg) => {
      const base: ListItem = { type: 'message', id: msg.id, message: msg };
      if (msg.techniqueTriggered && msg.role === 'assistant') {
        return [
          base,
          {
            type: 'technique',
            id: `technique-${msg.id}`,
            techniqueType: msg.techniqueTriggered,
          },
        ];
      }
      return [base];
    });
    setItems((prev) => [...prev, ...newItems]);
  };

  const [initError, setInitError] = useState(false);
  const cancelledRef = useRef(false);

  const initSession = useCallback(async () => {
    setInitError(false);
    try {
      const existing = await api.getActiveAiSession(PLACEHOLDER_USER_ID);

      if (cancelledRef.current) return;

      if (existing) {
        setSessionId(existing.session.id);
        setSessionStartedAt(new Date(existing.session.startedAt));

        const initial: ListItem[] = [{ type: 'privacy', id: '__privacy__' }];
        if (existing.previousContext) {
          initial.push({
            type: 'recall',
            id: '__recall__',
            context: existing.previousContext,
          });
        }
        setItems(initial);
        appendMessages(existing.messages);
        resetInactivityTimer();
      } else {
        const started = await api.startAiSession(PLACEHOLDER_USER_ID);
        if (cancelledRef.current) return;

        setSessionId(started.session.id);
        setSessionStartedAt(new Date(started.session.startedAt));

        const initial: ListItem[] = [{ type: 'privacy', id: '__privacy__' }];
        if (started.previousContext) {
          initial.push({
            type: 'recall',
            id: '__recall__',
            context: started.previousContext,
          });
        }
        setItems(initial);
        appendMessages(started.messages);
        resetInactivityTimer();
      }
    } catch {
      // Sin sesión el envío no puede funcionar: se avisa con reintento en vez de dejar el chat mudo
      if (!cancelledRef.current) setInitError(true);
    }
  }, [appendMessages, resetInactivityTimer]);

  useEffect(() => {
    cancelledRef.current = false;
    initSession();
    return () => {
      cancelledRef.current = true;
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      if (inactivityWarning.current) clearTimeout(inactivityWarning.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isSending || !sessionId) return;

    setInputText('');
    setIsSending(true);
    resetInactivityTimer();

    addTypingIndicator();
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);

    try {
      // CA2.1: el backend ya devuelve `crisis`, pero el tipo de `sendAiMessage`
      // vive en services/api.ts, que comparten otras ramas este sprint. Se acota
      // acá para no tocarlo; al mergear conviene subir el tipo a la función.
      const res = (await api.sendAiMessage(
        PLACEHOLDER_USER_ID,
        sessionId,
        text,
      )) as SendMessageWithRiskResponse;
      removeTypingIndicator();
      appendMessages([res.userMessage, res.assistantMessage]);
      setCrisis(res.crisis ?? null);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    } catch {
      // S.8: antes esto lanzaba un Alert y dejaba la pantalla vacía e inutilizable.
      // El respaldo entra como un mensaje más del hilo, con la ruta de escalada.
      removeTypingIndicator();
      appendMessages([
        buildLocalUserMessage(sessionId, text),
        buildOfflineFallbackMessage(sessionId),
      ]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    } finally {
      setIsSending(false);
    }
  }, [inputText, isSending, sessionId, resetInactivityTimer]);

  const handleManualClose = useCallback(async () => {
    if (!sessionId) return;
    Alert.alert(
      // "Cerrar sesión" son las mismas palabras que salir de la cuenta, en Perfil
      'Terminar conversación',
      '¿Quieres terminar? Se guardará un resumen de lo que conversaste.',
      [
        { text: 'Seguir conversando', style: 'cancel' },
        {
          text: 'Terminar',
          onPress: async () => {
            try {
              if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
              const result = await api.closeAiSession(PLACEHOLDER_USER_ID, sessionId);
              setSummary(result);
              setSummaryVisible(true);
            } catch {
              Alert.alert('Error', 'No se pudo cerrar la sesión correctamente.');
            }
          },
        },
      ],
    );
  }, [sessionId]);

  const durationMinutes = sessionStartedAt
    ? Math.max(1, Math.round((Date.now() - sessionStartedAt.getTime()) / 60000))
    : 1;

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'privacy') {
      return (
        <View style={styles.sectionPad}>
          <PrivacyCard />
        </View>
      );
    }

    if (item.type === 'recall') {
      return (
        <View style={styles.recallBanner}>
          <View style={styles.recallIcon}>
            <Icon name="lightbulb" size={18} color={Colors.accent} />
          </View>
          <View style={styles.recallText}>
            <Text style={styles.recallTitle}>Retomamos donde lo dejaste</Text>
            <Text style={styles.recallBody}>{item.context}</Text>
          </View>
        </View>
      );
    }

    if (item.type === 'typing') {
      return (
        <View style={styles.bubbleWrapLeft}>
          <TypingIndicator />
        </View>
      );
    }

    if (item.type === 'technique' && item.techniqueType) {
      return (
        <View style={styles.techniqueWrap}>
          <TechniqueCard type={item.techniqueType} />
        </View>
      );
    }

    const msg = item.message!;
    const isUser = msg.role === 'user';

    return (
      <View style={[styles.bubbleWrap, isUser ? styles.bubbleWrapRight : styles.bubbleWrapLeft]}>
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
          <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextAI]}>
            {msg.content}
          </Text>
          <Text style={[styles.bubbleTime, isUser ? styles.bubbleTimeUser : {}]}>
            {new Date(msg.createdAt).toLocaleTimeString('es-CL', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <Icon name="arrow-left" size={20} color={Colors.fg1} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={styles.avatarDot} />
          <View>
            <Text style={styles.headerTitle}>Asistente StopBet</Text>
            <Text style={styles.headerSub}>AJUTER · Privado y seguro</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          {sessionId && (
            <TouchableOpacity
              onPress={handleManualClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Terminar conversación"
            >
              <Text style={styles.closeBtnText}>Terminar</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => navigation.navigate('Panic')}
            style={styles.panicBtn}
            accessibilityLabel="Botón de pánico"
          >
            <Icon name="siren" size={20} color={Colors.danger} />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          showsVerticalScrollIndicator={false}
        />

        {crisis && (
          <CrisisCard
            crisis={crisis}
            sponsor={sponsor}
            onPanic={() => navigation.navigate('Panic')}
            onOpenSupportNetwork={() => navigation.navigate('Panic')}
          />
        )}

        {initError && (
          <View style={styles.initError} accessibilityLiveRegion="polite">
            <Text style={styles.initErrorTitle}>No pudimos conectar con el asistente</Text>
            <Text style={styles.initErrorBody}>
              Revisa tu conexión y vuelve a intentarlo. Si necesitas ayuda ahora, usa el botón de pánico o llama al *4141.
            </Text>
            <View style={styles.initErrorActions}>
              <TouchableOpacity style={styles.retryBtn} onPress={initSession} accessibilityRole="button">
                <Text style={styles.retryText}>Reintentar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.panicLink}
                onPress={() => navigation.navigate('Panic')}
                accessibilityRole="button"
              >
                <Text style={styles.panicLinkText}>Ir al botón de pánico</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* El resumen aparecía de golpe a los 10 minutos sin avisar */}
        {idleWarning && (
          <View style={styles.idleBanner} accessibilityLiveRegion="polite">
            <Icon name="hourglass" size={15} color={Colors.fg1} />
            <Text style={styles.idleText}>
              Si no escribes en un minuto, cerramos la conversación y guardamos el resumen.
            </Text>
            <TouchableOpacity
              onPress={resetInactivityTimer}
              style={styles.idleBtn}
              accessibilityRole="button"
            >
              <Text style={styles.idleBtnText}>Sigo acá</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Input */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            accessibilityLabel="Mensaje para el asistente"
            placeholder={sessionId ? 'Escribe aquí…' : initError ? 'Sin conexión con el asistente' : 'Conectando…'}
            placeholderTextColor={Colors.fg2}
            editable={!!sessionId}
            multiline
            maxLength={1000}
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!sessionId || !inputText.trim() || isSending}
            accessibilityRole="button"
            accessibilityLabel="Enviar mensaje"
            style={[
              styles.sendBtn,
              (!sessionId || !inputText.trim() || isSending) && styles.sendBtnDisabled,
            ]}
          >
            <Icon name="arrow-up" size={20} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <SessionSummaryModal
        visible={summaryVisible}
        summary={summary}
        durationMinutes={durationMinutes}
        onContinue={() => {
          setSummaryVisible(false);
          navigation.goBack();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { padding: 6, marginRight: 6 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarDot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primary,
  },
  headerTitle: { fontFamily: Fonts.bodyBold, fontSize: 15, color: Colors.ink900 },
  headerSub: { fontFamily: Fonts.body, fontSize: 12, color: Colors.fg2, marginTop: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  closeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 9999,
  },
  closeBtnText: { fontFamily: Fonts.bodyBold, fontSize: 12, color: Colors.fg2 },
  panicBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.dangerSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, gap: 10 },

  sectionPad: { marginBottom: 4 },

  recallBanner: {
    flexDirection: 'row',
    backgroundColor: Colors.sage50,
    borderRadius: 14,
    padding: 12,
    gap: 10,
    alignItems: 'flex-start',
  },
  recallIcon: { marginTop: 1 },
  recallText: { flex: 1 },
  recallTitle: { fontFamily: Fonts.bodyBold, fontSize: 13, color: Colors.greenText },
  recallBody: { fontFamily: Fonts.body, fontSize: 12.5, color: Colors.fg2, lineHeight: 17, marginTop: 3 },

  bubbleWrap: { maxWidth: '80%' },
  bubbleWrapLeft: { alignSelf: 'flex-start' },
  bubbleWrapRight: { alignSelf: 'flex-end' },
  // ancho fijo: si la guía se ajusta a su contenido, cambia de tamaño en cada paso y los textos se montan
  techniqueWrap: { width: '88%', alignSelf: 'flex-start' },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontFamily: Fonts.body, fontSize: 15, lineHeight: 21 },
  bubbleTextUser: { color: Colors.white },
  bubbleTextAI: { color: Colors.ink900 },
  bubbleTime: { fontFamily: Fonts.body, fontSize: 12, color: Colors.fg2, marginTop: 4, alignSelf: 'flex-end' },
  bubbleTimeUser: { color: Colors.onPrimaryMuted },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 10,
  },
  input: {
    fontFamily: Fonts.body,
    flex: 1,
    backgroundColor: Colors.bg,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    color: Colors.ink900,
    maxHeight: 110,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: Colors.border },

  initError: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    gap: 6,
  },
  initErrorTitle: { fontFamily: Fonts.bodyBold, fontSize: 15, color: Colors.ink900 },
  initErrorBody: { fontFamily: Fonts.body, fontSize: 14, color: Colors.fg1, lineHeight: 20 },
  initErrorActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  retryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 9999,
    paddingHorizontal: 18,
    minHeight: 48,
    justifyContent: 'center',
  },
  retryText: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.white },
  panicLink: {
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: Colors.danger,
    paddingHorizontal: 18,
    minHeight: 48,
    justifyContent: 'center',
  },
  panicLinkText: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.danger },
  idleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  idleText: { fontFamily: Fonts.body, flex: 1, fontSize: 12.5, color: Colors.fg1, lineHeight: 18 },
  idleBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10 },
  idleBtnText: { fontFamily: Fonts.bodyBold, fontSize: 13, color: Colors.primary },

});
