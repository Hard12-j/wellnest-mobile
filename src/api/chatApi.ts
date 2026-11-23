import { request } from './client';

export interface Conversation {
  id: number;
  otherUserId: number;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

export interface ChatMessage {
  id: number | string;
  conversationId: number;
  senderId: number;
  content: string;
  sentAt: string;
  readAt: string | null;
  isTemporary?: boolean;
}

export interface MessagePage {
  content: ChatMessage[];
  page: number;
  totalPages: number;
}

export const getConversations = () => request<Conversation[]>('/api/chat/conversations');
export const getMessages = (id: number, page = 0, size = 30) =>
  request<MessagePage>(`/api/chat/conversations/${id}/messages`, { params: { page, size } });
export const markAsRead = (id: number) =>
  request<{ updated: number }>(`/api/chat/conversations/${id}/read`, { method: 'POST' });
export const getUnreadCount = () => request<{ unread: number }>('/api/chat/unread-count');
