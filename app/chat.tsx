import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, RefreshControl,
  ScrollView, ScrollViewInstance, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { useChat } from '../src/context/ChatContext';
import * as chatApi from '../src/api/chatApi';
import * as trainerApi from '../src/api/trainerApi';
import { extractErrorMessage } from '../src/api/client';
import { COLORS } from '../src/constants/theme';

const MAX_MESSAGE_LENGTH = 2000;
type Meta = { name: string; subtitle: string; initials: string };
const timeLabel = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  return date.toDateString() === today.toDateString()
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};
const messageTimeLabel = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default function ChatScreen() {
  const { user } = useAuth();
  const {
    connectionStatus, errorMessage, clearError, sendMessage, subscribeToMessages,
    registerReconnect, setActiveConversation, refreshUnread,
  } = useChat();
  const [conversations, setConversations] = useState<chatApi.Conversation[]>([]);
  const [selected, setSelected] = useState<chatApi.Conversation | null>(null);
  const selectedRef = useRef<chatApi.Conversation | null>(null);
  const [names, setNames] = useState<Record<number, Meta>>({});
  const [messages, setMessages] = useState<chatApi.ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const oldHeight = useRef(0);
  const oldOffset = useRef(0);
  const pendingAnchor = useRef(false);
  const paginationLock = useRef(false);

  const isTrainer = user?.role === 'TRAINER';
  const fallbackMeta = useCallback((id: number): Meta => ({
    name: `${isTrainer ? 'Client' : 'Trainer'} #${id}`,
    subtitle: isTrainer ? 'Client' : 'Fitness Coach',
    initials: `${isTrainer ? 'C' : 'T'}${id}`,
  }), [isTrainer]);

  const fetchConversations = useCallback(async () => {
    try {
      const data = await chatApi.getConversations();
      setConversations(data || []);
      return data || [];
    } catch (error) {
      Alert.alert('Chat unavailable', extractErrorMessage(error));
      return [];
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void fetchConversations(); }, 0);
    return () => clearTimeout(timer);
  }, [fetchConversations]);
  useEffect(() => {
    const missing = conversations.map((c) => c.otherUserId).filter((id) => id && !names[id]);
    if (!missing.length) return;
    let cancelled = false;
    const resolve = async () => {
      if (isTrainer) {
        try {
          const clients = await trainerApi.getMyClients();
          if (cancelled) return;
          setNames((current) => {
            const next = { ...current };
            missing.forEach((id) => {
              const client = clients.find((item) => Number(item.userId) === Number(id));
              next[id] = { ...fallbackMeta(id), subtitle: client?.fitnessGoal ? `Goal: ${client.fitnessGoal}` : 'Client' };
            });
            return next;
          });
        } catch {
          if (!cancelled) setNames((current) => ({ ...current, ...Object.fromEntries(missing.map((id) => [id, fallbackMeta(id)])) }));
        }
      } else {
        await Promise.all(missing.map(async (id) => {
          try {
            const trainer = await trainerApi.getTrainerById(id);
            if (cancelled) return;
            const name = `${trainer.first || ''} ${trainer.last || ''}`.trim() || fallbackMeta(id).name;
            setNames((current) => ({ ...current, [id]: {
              name, subtitle: trainer.specialization || 'Fitness Coach',
              initials: `${trainer.first?.[0] || 'T'}${trainer.last?.[0] || ''}`.toUpperCase(),
            } }));
          } catch {
            if (!cancelled) setNames((current) => ({ ...current, [id]: fallbackMeta(id) }));
          }
        }));
      }
    };
    void resolve();
    return () => { cancelled = true; };
  }, [conversations, names, isTrainer, fallbackMeta]);

  const openConversation = useCallback(async (conversation: chatApi.Conversation) => {
    selectedRef.current = conversation;
    setSelected(conversation);
    setActiveConversation(conversation.id);
    setMessages([]);
    setPage(0);
    setTotalPages(1);
    setLoadingMessages(true);
    try {
      const result = await chatApi.getMessages(conversation.id, 0, 30);
      if (selectedRef.current?.id !== conversation.id) return;
      setMessages([...(result.content || [])].reverse());
      setPage(result.page ?? 0);
      setTotalPages(result.totalPages ?? 1);
      await chatApi.markAsRead(conversation.id);
      setConversations((current) => current.map((item) => item.id === conversation.id ? { ...item, unreadCount: 0 } : item));
      void refreshUnread();
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: false }));
    } catch (error) { Alert.alert('Unable to load messages', extractErrorMessage(error)); }
    finally { setLoadingMessages(false); }
  }, [setActiveConversation, refreshUnread]);

  useEffect(() => {
    const unsubscribe = subscribeToMessages((incoming) => {
      const isOpen = selectedRef.current?.id === Number(incoming.conversationId);
      setConversations((current) => {
        const found = current.find((item) => item.id === Number(incoming.conversationId));
        if (!found) { void fetchConversations(); return current; }
        return [{ ...found, lastMessage: incoming.content, lastMessageAt: incoming.sentAt,
          unreadCount: isOpen || Number(incoming.senderId) === Number(user?.id) ? 0 : found.unreadCount + 1 },
          ...current.filter((item) => item.id !== found.id)];
      });
      if (isOpen) {
        setMessages((current) => {
          const optimisticIndex = current.findIndex((item) => item.isTemporary && item.content === incoming.content);
          if (optimisticIndex >= 0) return current.map((item, index) => index === optimisticIndex ? incoming : item);
          if (current.some((item) => String(item.id) === String(incoming.id))) return current;
          return [...current, incoming];
        });
        void chatApi.markAsRead(Number(incoming.conversationId)).then(refreshUnread);
        requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
      }
    });
    const reconnect = registerReconnect(() => { void fetchConversations(); });
    return () => { unsubscribe(); reconnect(); setActiveConversation(null); };
  }, [subscribeToMessages, registerReconnect, fetchConversations, user?.id, refreshUnread, setActiveConversation]);

  const loadOlder = useCallback(async () => {
    if (!selected || loadingOlder || page + 1 >= totalPages || paginationLock.current) return;
    paginationLock.current = true;
    setLoadingOlder(true);
    try {
      const result = await chatApi.getMessages(selected.id, page + 1, 30);
      pendingAnchor.current = true;
      setMessages((current) => [...result.content.slice().reverse(), ...current]);
      setPage(result.page ?? page + 1);
      requestAnimationFrame(() => { paginationLock.current = false; });
    } catch (error) { Alert.alert('Unable to load older messages', extractErrorMessage(error)); paginationLock.current = false; }
    finally { setLoadingOlder(false); }
  }, [selected, loadingOlder, page, totalPages]);

  const handleScroll = (event: any) => {
    const { contentOffset, contentSize } = event.nativeEvent;
    if (contentOffset.y < 40 && !loadingOlder) {
      oldOffset.current = contentOffset.y;
      oldHeight.current = contentSize.height;
      void loadOlder();
    }
  };
  const handleContentSizeChange = (_width: number, height: number) => {
    if (pendingAnchor.current && oldHeight.current) {
      pendingAnchor.current = false;
      const addedHeight = height - oldHeight.current;
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: oldOffset.current + addedHeight, animated: false }));
    }
  };

  const handleSend = () => {
    if (!selected || !text.trim()) return;
    const content = text.trim();
    if (content.length > MAX_MESSAGE_LENGTH) return;
    const temporary: chatApi.ChatMessage = {
      id: `temp-${Date.now()}`, conversationId: selected.id, senderId: user!.id,
      content, sentAt: new Date().toISOString(), readAt: null, isTemporary: true,
    };
    setMessages((current) => [...current, temporary]);
    setText('');
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    try { sendMessage(selected.id, content); }
    catch (error: any) {
      setMessages((current) => current.filter((item) => item.id !== temporary.id));
      setText(content);
      Alert.alert('Message not sent', error.message || 'Please try again.');
    }
  };

  const orderedConversations = useMemo(() => conversations, [conversations]);
  const retryBanner = connectionStatus !== 'connected' && connectionStatus !== 'disconnected';

  if (selected) {
    const meta = names[selected.otherUserId] || fallbackMeta(selected.otherUserId);
    return (
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        <View style={styles.threadHeader}>
          <TouchableOpacity onPress={() => { setSelected(null); selectedRef.current = null; setActiveConversation(null); }} style={styles.backButton} accessibilityLabel="Back to conversations">
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <View style={styles.avatar}><Text style={styles.avatarText}>{meta.initials}</Text></View>
          <View style={styles.personDetails}><Text style={styles.personName}>{meta.name}</Text><Text style={styles.personSubtitle}>{meta.subtitle}</Text></View>
        </View>
        {retryBanner ? <Text style={styles.reconnect}>Reconnecting to chat… Sending is temporarily disabled.</Text> : null}
        {errorMessage ? <TouchableOpacity style={styles.errorToast} onPress={clearError}><Text style={styles.errorToastText}>{errorMessage}  ×</Text></TouchableOpacity> : null}
        <ScrollView ref={scrollRef} style={styles.messageArea} contentContainerStyle={styles.messageContent}
          onScroll={handleScroll} scrollEventThrottle={100} onContentSizeChange={handleContentSizeChange}>
          {loadingOlder ? <ActivityIndicator color={COLORS.primary} style={styles.olderSpinner} /> : null}
          {loadingMessages ? <ActivityIndicator size="large" color={COLORS.primary} style={styles.threadSpinner} /> : messages.length === 0 && !loadingMessages ? (
            <View style={styles.emptyThread}><Text style={styles.emptyIcon}>✦</Text><Text style={styles.emptyTitle}>No messages yet</Text><Text style={styles.emptyCopy}>Say hello to {meta.name} to start the conversation.</Text></View>
          ) : messages.map((message) => {
            const mine = Number(message.senderId) === Number(user?.id);
            return <View key={String(message.id)} style={[styles.messageRow, mine ? styles.messageRowMine : styles.messageRowTheirs]}>
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{message.content}</Text>
              </View>
              <Text style={styles.messageTime}>{messageTimeLabel(message.sentAt)}{mine ? (message.isTemporary ? '  ·' : message.readAt ? '  ✓✓' : '  ✓') : ''}</Text>
            </View>;
          })}
        </ScrollView>
        <View style={styles.composerWrap}>
          <View style={styles.composer}>
            <TextInput style={styles.input} value={text} onChangeText={setText} placeholder={connectionStatus === 'connected' ? 'Write a message…' : 'Reconnecting to chat…'}
              multiline maxLength={MAX_MESSAGE_LENGTH} editable={connectionStatus === 'connected'} onSubmitEditing={handleSend} blurOnSubmit={false} />
            <TouchableOpacity style={[styles.sendButton, (!text.trim() || connectionStatus !== 'connected') && styles.sendButtonDisabled]}
              onPress={handleSend} disabled={!text.trim() || connectionStatus !== 'connected'} accessibilityLabel="Send message">
              <Text style={styles.sendText}>Send</Text>
            </TouchableOpacity>
          </View>
          {text.length > 1800 ? <Text style={styles.counter}>{text.length}/{MAX_MESSAGE_LENGTH}</Text> : null}
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.listHeader}>
        <View style={styles.listTitleRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.listBackButton} accessibilityLabel="Close chat">
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <View><Text style={styles.title}>Messages</Text><Text style={styles.subtitle}>Stay connected with your coach</Text></View>
        </View>
      </View>
      {errorMessage ? <TouchableOpacity style={styles.errorToast} onPress={clearError}><Text style={styles.errorToastText}>{errorMessage}  ×</Text></TouchableOpacity> : null}
      {loading ? <ActivityIndicator size="large" color={COLORS.primary} style={styles.listSpinner} /> : orderedConversations.length === 0 ? (
        <ScrollView contentContainerStyle={styles.emptyList} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void fetchConversations(); }} colors={[COLORS.primary]} />}>
          <Text style={styles.emptyIcon}>💬</Text><Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptyCopy}>{isTrainer ? 'Your clients will appear here once you accept their requests.' : 'Once a trainer accepts your request you can chat here.'}</Text>
        </ScrollView>
      ) : <FlatList data={orderedConversations} keyExtractor={(item) => String(item.id)} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void fetchConversations(); }} colors={[COLORS.primary]} />}
        contentContainerStyle={styles.conversationList} renderItem={({ item }) => {
          const meta = names[item.otherUserId] || fallbackMeta(item.otherUserId);
          return <TouchableOpacity style={styles.conversationRow} onPress={() => void openConversation(item)} activeOpacity={0.7}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{meta.initials}</Text></View>
            <View style={styles.conversationInfo}><View style={styles.conversationNameLine}><Text style={styles.conversationName} numberOfLines={1}>{meta.name}</Text><Text style={styles.conversationTime}>{timeLabel(item.lastMessageAt)}</Text></View>
              <View style={styles.previewLine}><Text style={styles.preview} numberOfLines={1}>{item.lastMessage || 'Start a conversation'}</Text>{item.unreadCount > 0 ? <View style={styles.unreadBadge}><Text style={styles.unreadText}>{item.unreadCount > 99 ? '99+' : item.unreadCount}</Text></View> : null}</View>
            </View>
          </TouchableOpacity>;
        }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  listHeader: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  listTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, listBackButton: { width: 34, height: 42, justifyContent: 'center' },
  title: { color: COLORS.text, fontSize: 25, fontWeight: '900' }, subtitle: { color: COLORS.textMuted, fontSize: 13, marginTop: 4 },
  conversationList: { paddingVertical: 6 }, conversationRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primaryLight }, avatarText: { fontSize: 13, fontWeight: '900', color: COLORS.primaryDark },
  conversationInfo: { flex: 1 }, conversationNameLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, conversationName: { flex: 1, fontSize: 15, fontWeight: '800', color: COLORS.text }, conversationTime: { fontSize: 11, color: COLORS.textMuted },
  previewLine: { flexDirection: 'row', alignItems: 'center', marginTop: 5, gap: 8 }, preview: { flex: 1, color: COLORS.textMuted, fontSize: 13 }, unreadBadge: { minWidth: 21, height: 21, borderRadius: 11, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }, unreadText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  threadHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 10 }, backButton: { width: 34, height: 42, justifyContent: 'center' }, backText: { color: COLORS.primaryDark, fontSize: 36, lineHeight: 40 }, personDetails: { flex: 1 }, personName: { color: COLORS.text, fontSize: 15, fontWeight: '800' }, personSubtitle: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  reconnect: { textAlign: 'center', color: '#92400e', backgroundColor: '#fef3c7', paddingVertical: 7, fontSize: 11, fontWeight: '700' }, errorToast: { marginHorizontal: 12, marginTop: 8, padding: 10, borderRadius: 10, backgroundColor: COLORS.dangerLight }, errorToastText: { color: COLORS.danger, fontSize: 12, fontWeight: '700' },
  messageArea: { flex: 1 }, messageContent: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 18, flexGrow: 1, justifyContent: 'flex-end' }, messageRow: { marginBottom: 12, maxWidth: '86%' }, messageRowMine: { alignSelf: 'flex-end', alignItems: 'flex-end' }, messageRowTheirs: { alignSelf: 'flex-start', alignItems: 'flex-start' }, bubble: { paddingHorizontal: 13, paddingVertical: 10, borderRadius: 17 }, bubbleMine: { backgroundColor: COLORS.primary, borderBottomRightRadius: 5 }, bubbleTheirs: { backgroundColor: '#fff', borderBottomLeftRadius: 5, borderWidth: 1, borderColor: COLORS.border }, bubbleText: { color: COLORS.text, fontSize: 14, lineHeight: 20 }, bubbleTextMine: { color: '#fff' }, messageTime: { marginTop: 3, paddingHorizontal: 3, fontSize: 10, color: COLORS.textLight },
  composerWrap: { paddingHorizontal: 12, paddingTop: 9, paddingBottom: Platform.OS === 'ios' ? 8 : 10, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: '#fff' }, composer: { flexDirection: 'row', alignItems: 'flex-end', borderRadius: 17, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceLight, padding: 6 }, input: { flex: 1, maxHeight: 108, minHeight: 40, paddingHorizontal: 9, paddingTop: 9, paddingBottom: 8, color: COLORS.text, fontSize: 14 }, sendButton: { backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, marginLeft: 6 }, sendButtonDisabled: { backgroundColor: COLORS.borderDark }, sendText: { color: '#fff', fontWeight: '800', fontSize: 12 }, counter: { alignSelf: 'flex-end', color: COLORS.textMuted, fontSize: 10, marginTop: 4 },
  emptyList: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }, emptyThread: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 }, emptyIcon: { fontSize: 36, marginBottom: 12 }, emptyTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text }, emptyCopy: { color: COLORS.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 19, marginTop: 6, maxWidth: 290 }, listSpinner: { marginTop: 48 }, threadSpinner: { marginVertical: 40 }, olderSpinner: { marginVertical: 10 },
});
