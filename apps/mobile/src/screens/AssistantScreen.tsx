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
import type { AIMessage, AiSessionSummary, TechniqueType } from '@stopbet/shared-types';
import { Colors } from '../constants/colors';
import { api } from '../services/api';
import { PrivacyCard } from '../components/PrivacyCard';
import { TechniqueCard } from '../components/TechniqueCard';
import { TypingIndicator } from '../components/TypingIndicator';
import { SessionSummaryModal } from '../components/SessionSummaryModal';
import { Icon } from '../components/Icon';
import type { AppStackParamList } from '../navigation/types';

const PLACEHOLDER_USER_ID = '11111111-1111-1111-1111-111111111111'; // TODO: reemplazar con ID real del contexto de auth
const INACTIVITY_MS = 10 * 60 * 1000;

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
  const [summary, setSummary] = useState<AiSessionSummary | null>(null);
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [sessionStartedAt, setSessionStartedAt] = useState<Date | null>(null);

  const listRef = useRef<FlatList>(null);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      handleAutoClose();
    }, INACTIVITY_MS);
  }, [handleAutoClose]);

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

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const existing = await api.getActiveAiSession(PLACEHOLDER_USER_ID);

        if (cancelled) return;

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
          if (cancelled) return;

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
      } catch (e) {
        if (!cancelled) {
          Alert.alert('Error', 'No se pudo conectar con el asistente. Intenta de nuevo.');
        }
      }
    }

    init();
    return () => {
      cancelled = true;
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, []);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isSending || !sessionId) return;

    setInputText('');
    setIsSending(true);
    resetInactivityTimer();

    addTypingIndicator();
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);

    try {
      const res = await api.sendAiMessage(PLACEHOLDER_USER_ID, sessionId, text);
      removeTypingIndicator();
      appendMessages([res.userMessage, res.assistantMessage]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    } catch {
      removeTypingIndicator();
      Alert.alert('Error', 'No se pudo enviar el mensaje. Intenta de nuevo.');
    } finally {
      setIsSending(false);
    }
  }, [inputText, isSending, sessionId, resetInactivityTimer]);

  const handleManualClose = useCallback(async () => {
    if (!sessionId) return;
    Alert.alert(
      'Cerrar sesión',
      '¿Quieres cerrar la sesión? Se generará un resumen de tu conversación.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar',
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
        <View style={styles.bubbleWrapLeft}>
          <TechniqueCard
            type={item.techniqueType}
            onStart={() =>
              Alert.alert(
                'Guía de técnica',
                'Próximamente podrás seguir la guía interactiva paso a paso.',
              )
            }
          />
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
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
            <TouchableOpacity onPress={handleManualClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>Cerrar</Text>
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

        {/* Input */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Escribe aquí…"
            placeholderTextColor={Colors.fg2}
            multiline
            maxLength={1000}
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!inputText.trim() || isSending}
            style={[
              styles.sendBtn,
              (!inputText.trim() || isSending) && styles.sendBtnDisabled,
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
        onViewHistory={() => {
          setSummaryVisible(false);
          // Navegar a historial cuando esté disponible
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
  headerTitle: { fontWeight: '700', fontSize: 15, color: Colors.ink900 },
  headerSub: { fontSize: 12, color: Colors.fg2, marginTop: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  closeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 9999,
  },
  closeBtnText: { fontSize: 12, color: Colors.fg2, fontWeight: '600' },
  panicBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FEE2E2',
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
  recallTitle: { fontWeight: '700', fontSize: 13, color: Colors.sage500 },
  recallBody: { fontSize: 12.5, color: Colors.fg2, lineHeight: 17, marginTop: 3 },

  bubbleWrap: { maxWidth: '80%' },
  bubbleWrapLeft: { alignSelf: 'flex-start' },
  bubbleWrapRight: { alignSelf: 'flex-end' },
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
  bubbleText: { fontSize: 15, lineHeight: 21 },
  bubbleTextUser: { color: Colors.white },
  bubbleTextAI: { color: Colors.ink900 },
  bubbleTime: { fontSize: 10, color: Colors.fg2, marginTop: 4, alignSelf: 'flex-end' },
  bubbleTimeUser: { color: Colors.overlayWhite72 },

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
});
