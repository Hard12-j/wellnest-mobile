import { request, GATEWAY_URL } from './client';

export interface Blog {
  id: number;
  title: string;
  category: string;
  content: string;
  authorName?: string | null;
  imageUrl?: string | null;
  contentType: 'ARTICLE' | 'POST' | string;
  likesCount?: number;
  commentsCount?: number;
  liked?: boolean;
  createdAt?: string;
}

export interface TipResponse {
  id: number;
  text: string;
}

export interface Comment {
  id: number;
  blogId: number;
  userName?: string | null;
  commentText: string;
  createdAt?: string;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export const listBlogs = async (params: {
  category?: string;
  contentType?: string;
  q?: string;
  page?: number;
  size?: number;
} = {}): Promise<PageResponse<Blog>> => {
  return request<PageResponse<Blog>>('/api/content/blogs', {
    method: 'GET',
    params: { page: 0, size: 20, ...params },
  });
};

export const getTipOfTheDay = async (): Promise<TipResponse> => {
  return request<TipResponse>('/api/content/tip-of-the-day', { method: 'GET' });
};

export const toggleLikeBlog = async (id: number): Promise<{ liked: boolean; likesCount: number }> => {
  return request<{ liked: boolean; likesCount: number }>(`/api/content/blogs/${id}/like`, {
    method: 'POST',
  });
};

export const createPost = async (params: {
  title: string;
  category: string;
  content: string;
  authorName?: string;
}): Promise<Blog> => {
  return request<Blog>('/api/content/blogs', {
    method: 'POST',
    body: JSON.stringify({
      ...params,
      contentType: 'POST',
      status: 'PUBLISHED',
    }),
  });
};

export const listComments = async (blogId: number): Promise<PageResponse<Comment>> => {
  return request<PageResponse<Comment>>(`/api/content/blogs/${blogId}/comments`, {
    method: 'GET',
    params: { page: 0, size: 30 },
  });
};

export const addComment = async (blogId: number, commentText: string): Promise<Comment> => {
  return request<Comment>(`/api/content/blogs/${blogId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ commentText }),
  });
};

