import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { Header } from '../../src/components/Header';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { COLORS } from '../../src/constants/theme';
import { useAuth } from '../../src/context/AuthContext';
import * as contentApi from '../../src/api/contentApi';
import { extractErrorMessage } from '../../src/api/client';

const CATEGORIES = ['ALL', 'WORKOUT', 'NUTRITION', 'WELLNESS', 'LIFESTYLE'];

export default function CommunityScreen() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [blogs, setBlogs] = useState<contentApi.Blog[]>([]);
  const [tip, setTip] = useState<string | null>(null);

  // Create post modal state
  const [postModalVisible, setPostModalVisible] = useState(false);
  const [postTitle, setPostTitle] = useState('');
  const [postCategory, setPostCategory] = useState('WELLNESS');
  const [postContent, setPostContent] = useState('');
  const [posting, setPosting] = useState(false);

  // Comment modal state
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [activeBlog, setActiveBlog] = useState<contentApi.Blog | null>(null);
  const [comments, setComments] = useState<contentApi.Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  const fetchCommunity = useCallback(async () => {
    setError(null);
    try {
      const [blogRes, tipRes] = await Promise.all([
        contentApi.listBlogs({
          category: selectedCategory === 'ALL' ? undefined : selectedCategory,
        }).catch(() => ({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0, last: true })),
        contentApi.getTipOfTheDay().catch(() => null),
      ]);

      setBlogs(blogRes.content || []);
      if (tipRes?.text) setTip(tipRes.text);
    } catch (err: any) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    fetchCommunity();
  }, [fetchCommunity]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCommunity();
  };

  const handleLike = async (blogId: number) => {
    try {
      const res = await contentApi.toggleLikeBlog(blogId);
      setBlogs((prev) =>
        prev.map((b) =>
          b.id === blogId
            ? { ...b, liked: res.liked, likesCount: res.likesCount }
            : b
        )
      );
    } catch (err: any) {
      Alert.alert('Error', extractErrorMessage(err));
    }
  };

  const handleCreatePost = async () => {
    if (!postTitle.trim() || !postContent.trim()) {
      Alert.alert('Required', 'Please enter a title and content for your post.');
      return;
    }

    setPosting(true);
    try {
      await contentApi.createPost({
        title: postTitle.trim(),
        category: postCategory,
        content: postContent.trim(),
        authorName: `${user?.first || ''} ${user?.last || ''}`.trim() || undefined,
      });

      setPostModalVisible(false);
      setPostTitle('');
      setPostContent('');
      fetchCommunity();
      Alert.alert('Posted! 🚀', 'Your post is now live in the community feed.');
    } catch (err: any) {
      Alert.alert('Error', extractErrorMessage(err));
    } finally {
      setPosting(false);
    }
  };

  const openComments = async (blog: contentApi.Blog) => {
    setActiveBlog(blog);
    setCommentModalVisible(true);
    try {
      const res = await contentApi.listComments(blog.id);
      setComments(res.content || []);
    } catch (err) {
      console.warn('Failed to fetch comments', err);
    }
  };

  const handleAddComment = async () => {
    if (!activeBlog || !commentText.trim()) return;

    setSubmittingComment(true);
    try {
      const newComment = await contentApi.addComment(activeBlog.id, commentText.trim());
      setComments((prev) => [newComment, ...prev]);
      setCommentText('');
      setBlogs((prev) =>
        prev.map((b) =>
          b.id === activeBlog.id
            ? { ...b, commentsCount: (b.commentsCount || 0) + 1 }
            : b
        )
      );
    } catch (err: any) {
      Alert.alert('Error', extractErrorMessage(err));
    } finally {
      setSubmittingComment(false);
    }
  };

  return (
    <View style={styles.screen}>
      <Header
        title="Community"
        subtitle="Inspiration, articles & wellness discussions"
        rightAction={
          <TouchableOpacity
            style={styles.postPill}
            onPress={() => setPostModalVisible(true)}
          >
            <Text style={styles.postPillText}>+ Post</Text>
          </TouchableOpacity>
        }
      />

      {/* ── Category Filter Bar ── */}
      <View style={styles.categoryScrollContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.catPill, selectedCategory === cat && styles.catPillActive]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text style={[styles.catText, selectedCategory === cat && styles.catTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* ── Daily Wellness Tip ── */}
        {tip ? (
          <View style={styles.tipCard}>
            <View style={styles.tipHeader}>
              <Text style={styles.tipBadge}>💡 TIP OF THE DAY</Text>
            </View>
            <Text style={styles.tipText}>"{tip}"</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {loading && !refreshing ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading community feed...</Text>
          </View>
        ) : (
          <>
            {blogs.map((b) => (
              <View key={b.id} style={styles.blogCard}>
                <View style={styles.blogTop}>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>{b.category}</Text>
                  </View>
                  <Text style={styles.authorText}>
                    {b.authorName ? `By ${b.authorName}` : 'WellNest Member'}
                  </Text>
                </View>

                <Text style={styles.blogTitle}>{b.title}</Text>
                <Text style={styles.blogContent} numberOfLines={4}>
                  {b.content}
                </Text>

                <View style={styles.blogFooter}>
                  <TouchableOpacity
                    style={[styles.interactionBtn, b.liked && styles.interactionBtnLiked]}
                    onPress={() => handleLike(b.id)}
                  >
                    <Text style={styles.interactionEmoji}>{b.liked ? '❤️' : '🤍'}</Text>
                    <Text style={[styles.interactionText, b.liked && styles.likedText]}>
                      {b.likesCount || 0}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.interactionBtn}
                    onPress={() => openComments(b)}
                  >
                    <Text style={styles.interactionEmoji}>💬</Text>
                    <Text style={styles.interactionText}>
                      {b.commentsCount || 0} Comments
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {blogs.length === 0 && !loading ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No Posts Yet</Text>
                <Text style={styles.emptySub}>
                  Be the first to share an update, tip, or achievement with the community!
                </Text>
                <Button
                  title="Create First Post"
                  onPress={() => setPostModalVisible(true)}
                  style={{ marginTop: 14 }}
                />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      {/* ── Create Post Modal ── */}
      <Modal visible={postModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Community Post</Text>
              <TouchableOpacity onPress={() => setPostModalVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Input
              label="Title"
              placeholder="Give your post a title..."
              value={postTitle}
              onChangeText={setPostTitle}
            />

            <Text style={styles.label}>Category:</Text>
            <View style={styles.modalCatRow}>
              {['WORKOUT', 'NUTRITION', 'WELLNESS', 'LIFESTYLE'].map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.modalCatPill, postCategory === c && styles.modalCatPillActive]}
                  onPress={() => setPostCategory(c)}
                >
                  <Text style={[styles.modalCatText, postCategory === c && styles.modalCatTextActive]}>
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input
              label="Content"
              placeholder="Share your thoughts, routine, or question..."
              value={postContent}
              onChangeText={setPostContent}
              multiline
              numberOfLines={4}
              style={{ minHeight: 90, textAlignVertical: 'top' }}
            />

            <Button
              title="Publish Post"
              onPress={handleCreatePost}
              loading={posting}
              style={{ marginTop: 8 }}
            />
          </View>
        </View>
      </Modal>

      {/* ── Comments Modal ── */}
      <Modal visible={commentModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Comments</Text>
              <TouchableOpacity onPress={() => setCommentModalVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.commentsList}>
              {comments.map((c) => (
                <View key={c.id} style={styles.commentItem}>
                  <Text style={styles.commentUser}>
                    {c.userName || 'Community Member'}
                  </Text>
                  <Text style={styles.commentText}>{c.commentText}</Text>
                </View>
              ))}
              {comments.length === 0 ? (
                <Text style={styles.noCommentsText}>No comments yet. Start the conversation!</Text>
              ) : null}
            </ScrollView>

            <View style={styles.commentInputRow}>
              <Input
                placeholder="Write a comment..."
                value={commentText}
                onChangeText={setCommentText}
                containerStyle={{ flex: 1, marginBottom: 0 }}
              />
              <Button
                title="Send"
                onPress={handleAddComment}
                loading={submittingComment}
                style={{ paddingHorizontal: 16 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  postPill: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  postPillText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  categoryScrollContainer: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 8,
  },
  categoryScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  catPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
  },
  catPillActive: {
    backgroundColor: COLORS.primaryLight,
  },
  catText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  catTextActive: {
    color: COLORS.primaryDark,
  },
  container: {
    padding: 16,
  },
  tipCard: {
    backgroundColor: '#fffbeb',
    borderWidth: 1.5,
    borderColor: '#fde68a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  tipHeader: {
    marginBottom: 6,
  },
  tipBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#b45309',
    letterSpacing: 0.8,
  },
  tipText: {
    fontSize: 13,
    color: '#92400e',
    fontStyle: 'italic',
    lineHeight: 19,
    fontWeight: '500',
  },
  centerLoading: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.textMuted,
    fontSize: 14,
  },
  errorBox: {
    backgroundColor: COLORS.dangerLight,
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  blogCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  blogTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryBadge: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  authorText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  blogTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 6,
  },
  blogContent: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 14,
  },
  blogFooter: {
    flexDirection: 'row',
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
  },
  interactionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  interactionBtnLiked: {
    backgroundColor: '#fee2e2',
  },
  interactionEmoji: {
    fontSize: 16,
  },
  interactionText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  likedText: {
    color: COLORS.danger,
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  modalClose: {
    fontSize: 20,
    color: COLORS.textMuted,
    fontWeight: '700',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  modalCatRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  modalCatPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalCatPillActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  modalCatText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  modalCatTextActive: {
    color: COLORS.primaryDark,
  },
  commentsList: {
    maxHeight: 250,
    marginBottom: 14,
  },
  commentItem: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  commentUser: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primaryDark,
    marginBottom: 2,
  },
  commentText: {
    fontSize: 13,
    color: COLORS.text,
  },
  noCommentsText: {
    textAlign: 'center',
    color: COLORS.textMuted,
    fontSize: 13,
    marginVertical: 20,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});

