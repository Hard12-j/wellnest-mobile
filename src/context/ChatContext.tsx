import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Client } from '@stomp/stompjs';
import { GATEWAY_URL, getStoredToken } from '../api/client';
import { useAuth } from './AuthContext';
import * as chatApi from '../api/chatApi';

type ChatContextValue = {
  unreadCount: number;
  connectionStatus: 'connected' | 'connecting' | 'reconnecting' | 'disconnected';
  errorMessage: string | null;
  clearError: () => void;
  sendMessage: (conversationId: number, content: string) => void;
  subscribeToMessages: (listener: (message: chatApi.ChatMessage) => void) => () => void;
  registerReconnect: (listener: () => void) => () => void;
  setActiveConversation: (id: number | null) => void;
  refreshUnread: () => Promise<void>;
};

const ChatContext = createContext<ChatContextValue | null>(null);
export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used within ChatProvider');
  return context;
};

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const currentUserId = user?.id;
  const [unreadCount, setUnreadCount] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<ChatContextValue['connectionStatus']>('disconnected');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const clientRef = useRef<Client | null>(null);
  const listeners = useRef(new Set<(message: chatApi.ChatMessage) => void>());
  const reconnectListeners = useRef(new Set<() => void>());
  const activeConversationId = useRef<number | null>(null);
  const connectedOnce = useRef(false);

  const refreshUnread = useCallback(async () => {
    if (!isAuthenticated) return;
    try { setUnreadCount((await chatApi.getUnreadCount()).unread || 0); } catch { /* network may be unavailable */ }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !currentUserId) {
      clientRef.current?.deactivate();
      clientRef.current = null;
      const resetTimer = setTimeout(() => {
        setUnreadCount(0);
        setConnectionStatus('disconnected');
      }, 0);
      connectedOnce.current = false;
      return () => clearTimeout(resetTimer);
    }

    const unreadTimer = setTimeout(() => {
      setConnectionStatus('connecting');
      void refreshUnread();
    }, 0);
    const brokerURL = `${GATEWAY_URL.replace(/^http/, 'ws').replace(/\/$/, '')}/ws`;
    const client = new Client({
      brokerURL,
      connectHeaders: {},
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      beforeConnect: async () => {
        const token = await getStoredToken();
        client.connectHeaders = { Authorization: token ? `Bearer ${token}` : '' };
      },
      onConnect: () => {
        setConnectionStatus('connected');
        client.subscribe('/user/queue/messages', (frame) => {
          try {
            const message = JSON.parse(frame.body) as chatApi.ChatMessage;
            listeners.current.forEach((listener) => listener(message));
            if (Number(message.senderId) !== Number(currentUserId) && Number(message.conversationId) !== activeConversationId.current) {
              setUnreadCount((count) => count + 1);
            }
          } catch { setErrorMessage('Could not read an incoming message.'); }
        });
        client.subscribe('/user/queue/errors', (frame) => {
          try { setErrorMessage(JSON.parse(frame.body)?.message || 'Could not send message.'); }
          catch { setErrorMessage('Could not send message.'); }
        });
        if (connectedOnce.current) {
          void refreshUnread();
          reconnectListeners.current.forEach((listener) => listener());
        }
        connectedOnce.current = true;
      },
      onWebSocketClose: () => setConnectionStatus('reconnecting'),
      onWebSocketError: () => setConnectionStatus('reconnecting'),
      onStompError: () => { setConnectionStatus('reconnecting'); setErrorMessage('Chat service connection error.'); },
      onDisconnect: () => setConnectionStatus('disconnected'),
    });
    clientRef.current = client;
    client.activate();
    const poll = setInterval(() => void refreshUnread(), 60000);
    return () => { clearTimeout(unreadTimer); clearInterval(poll); void client.deactivate(); clientRef.current = null; };
  }, [isAuthenticated, currentUserId, refreshUnread]);

  const value: ChatContextValue = {
    unreadCount, connectionStatus, errorMessage,
    clearError: () => setErrorMessage(null),
    sendMessage: (conversationId, content) => {
      if (!clientRef.current?.connected) throw new Error('Chat is reconnecting. Please try again shortly.');
      clientRef.current.publish({ destination: '/app/chat.send', body: JSON.stringify({ conversationId, content }) });
    },
    subscribeToMessages: (listener) => { listeners.current.add(listener); return () => { listeners.current.delete(listener); }; },
    registerReconnect: (listener) => { reconnectListeners.current.add(listener); return () => { reconnectListeners.current.delete(listener); }; },
    setActiveConversation: (id) => { activeConversationId.current = id; },
    refreshUnread,
  };
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
