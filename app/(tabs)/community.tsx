import React, { useState, useEffect, useCallback, useMemo } from 'react';
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

const POST_CATEGORIES = [
  'ALL',
  'Daily Update',
  'Workout Done',
  'Nutrition Win',
  'Motivation',
  'Milestone',
  'Recovery',
  'General Wellness',
];

const ARTICLE_CATEGORIES = [
  'ALL',
  'Fitness',
  'Nutrition',
  'Mental Health',
  'Recovery',
  'Weight Loss',
  'General Wellness',
];

export default function CommunityScreen() {
  const { user } = useAuth();
  const isTrainer = user?.role === 'TRAINER';

  // Active primary tab: 'articles' | 'posts'
  const [activeTab, setActiveTab] = useState<'articles' | 'posts'>('articles');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data state
  const [articles, setArticles] = useState<contentApi.Blog[]>([]);
  const [posts, setPosts] = useState<contentApi.Blog[]>([]);
  const [tip, setTip] = useState<string | null>(null);

  // Filters
  const [selectedArticleCat, setSelectedArticleCat] = useState('ALL');
  const [selectedPostCat, setSelectedPostCat] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Reader Modal (for reading full article or post)
  const [readingItem, setReadingItem] = useState<contentApi.Blog | null>(null);
  const [comments, setComments] = useState<contentApi.Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Create Post Modal
  const [postModalVisible, setPostModalVisible] = useState(false);
  const [postTitle, setPostTitle] = useState('');
  const [postCategory, setPostCategory] = useState('Daily Update');
  const [postContent, setPostContent] = useState('');
  const [posting, setPosting] = useState(false);

  // Author display name
  const authorDisplayName = useMemo(() => {
    const full = `${user?.first || ''} ${user?.last || ''}`.trim();
    return full || user?.username || 'Wellness Member';
  }, [user]);

  const fetchCommunityData = useCallback(async () => {
    setError(null);
    try {
      const articleCat = selectedArticleCat === 'ALL' ? undefined : selectedArticleCat;
      const postCat = selectedPostCat === 'ALL' ? undefined : selectedPostCat;

      const [articlesRes, postsRes, tipRes] = await Promise.allSettled([
        contentApi.listBlogs({
          contentType: 'ARTICLE',
          category: articleCat,
          q: searchQuery.trim() || undefined,
          size: 30,
        }),
        contentApi.listBlogs({
          contentType: 'POST',
          category: postCat,
          q: searchQuery.trim() || undefined,
          size: 30,
        }),
        contentApi.getTipOfTheDay(),
      ]);

      if (articlesRes.status === 'fulfilled') {
        setArticles(articlesRes.value.content || []);
      }
      if (postsRes.status === 'fulfilled') {
        setPosts(postsRes.value.content || []);
      }
      if (tipRes.status === 'fulfilled' && tipRes.value?.text) {
        setTip(tipRes.value.text);
      }
    } catch (err: any) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedArticleCat, selectedPostCat, searchQuery]);

  useEffect(() => {
    fetchCommunityData();
  }, [fetchCommunityData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCommunityData();
  };

  // Like handler
  const handleLike = async (item: contentApi.Blog) => {
    try {
      const res = await contentApi.toggleLikeBlog(item.id);
      const updater = (list: contentApi.Blog[]) =>
        list.map((b) =>
          b.id === item.id ? { ...b, liked: res.liked, likesCount: res.likesCount } : b
        );

      setArticles(updater);
      setPosts(updater);

      if (readingItem && readingItem.id === item.id) {
        setReadingItem((prev) =>
          prev ? { ...prev, liked: res.liked, likesCount: res.likesCount } : null
        );
      }
    } catch (err: any) {
      Alert.alert('Error', extractErrorMessage(err));
    }
  };

  // Open item reader & load comments
  const handleOpenReader = async (item: contentApi.Blog) => {
    setReadingItem(item);
    setComments([]);
    setLoadingComments(true);
    try {
      const res = await contentApi.listComments(item.id);
      setComments(res.content || []);
    } catch {
      // tolerate comment load error
    } finally {
      setLoadingComments(false);
    }
  };

  // Submit comment
  const handleAddComment = async () => {
    if (!readingItem || !commentText.trim()) return;
    setSubmittingComment(true);
    try {
      const newComment = await contentApi.addComment(readingItem.id, commentText.trim());
      setComments((prev) => [...prev, newComment]);
      setCommentText('');

      const countUpdater = (list: contentApi.Blog[]) =>
        list.map((b) =>
          b.id === readingItem.id
            ? { ...b, commentsCount: (b.commentsCount || 0) + 1 }
            : b
        );
      setArticles(countUpdater);
      setPosts(countUpdater);
      setReadingItem((prev) =>
        prev ? { ...prev, commentsCount: (prev.commentsCount || 0) + 1 } : null
      );
    } catch (err: any) {
      Alert.alert('Comment Error', extractErrorMessage(err));
    } finally {
      setSubmittingComment(false);
    }
  };

  // Publish new post
  const handleCreatePost = async () => {
    if (!postTitle.trim() || !postContent.trim()) {
      Alert.alert('Validation', 'Please provide a title and your post content.');
      return;
    }
    setPosting(true);
    try {
      await contentApi.createPost({
        title: postTitle.trim(),
        category: postCategory,
        content: postContent.trim(),
        authorName: authorDisplayName,
      });

      setPostTitle('');
      setPostContent('');
      setPostCategory('Daily Update');
      setPostModalVisible(false);
      Alert.alert('Published! 🎉', 'Your community update is now live.');
      fetchCommunityData();
    } catch (err: any) {
      Alert.alert('Error', extractErrorMessage(err));
    } finally {
      setPosting(false);
    }
  };

  const currentCategories = activeTab === 'articles' ? ARTICLE_CATEGORIES : POST_CATEGORIES;
  const selectedCat = activeTab === 'articles' ? selectedArticleCat : selectedPostCat;
  const setSelectedCat = activeTab === 'articles' ? setSelectedArticleCat : setSelectedPostCat;
  const currentList = activeTab === 'articles' ? articles : posts;

  return (
    <View style={styles.screen}>
      <Header
        title="Community Hub"
        subtitle="Expert coaching articles & member check-ins"
      />

      {/* ── Primary Tab Switcher (Articles vs Posts) ── */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'articles' && styles.tabBtnActive]}
          onPress={() => setActiveTab('articles')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabBtnText, activeTab === 'articles' && styles.tabBtnTextActive]}>
            📖 Articles & Guides ({articles.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'posts' && styles.tabBtnActive]}
          onPress={() => setActiveTab('posts')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabBtnText, activeTab === 'posts' && styles.tabBtnTextActive]}>
            💬 Member Posts ({posts.length})
          </Text>
        </TouchableOpacity>
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
        {/* Tip of the Day Banner */}
        {tip ? (
          <View style={styles.tipBanner}>
            <Text style={styles.tipIcon}>💡</Text>
            <View style={styles.tipContent}>
              <Text style={styles.tipTitle}>Daily Wellness Tip</Text>
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          </View>
        ) : null}

        {/* Action Row: Create Post & Category Filter */}
        <View style={styles.actionRow}>
          <Text style={styles.sectionTitle}>
            {activeTab === 'articles' ? 'Coaching Library' : 'Community Feed'}
          </Text>

          {activeTab === 'posts' ? (
            <TouchableOpacity
              style={styles.createPostBtn}
              onPress={() => setPostModalVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.createPostBtnText}>+ Share Update</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Category Horizontal Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catScroll}
        >
          {currentCategories.map((c) => {
            const isSelected = selectedCat === c;
            return (
              <TouchableOpacity
                key={c}
                style={[styles.catPill, isSelected && styles.catPillActive]}
                onPress={() => setSelectedCat(c)}
              >
                <Text style={[styles.catPillText, isSelected && styles.catPillTextActive]}>
                  {c}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {loading && !refreshing ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading {activeTab}...</Text>
          </View>
        ) : (
          <>
            {currentList.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyEmoji}>
                  {activeTab === 'articles' ? '📚' : '✍️'}
                </Text>
                <Text style={styles.emptyTitle}>
                  No {activeTab} found
                </Text>
                <Text style={styles.emptySub}>
                  {activeTab === 'articles'
                    ? 'Check back soon for new evidence-based coaching articles.'
                    : 'Be the first to share your workout win or daily wellness check-in!'}
                </Text>
                {activeTab === 'posts' ? (
                  <TouchableOpacity
                    style={[styles.createPostBtn, { marginTop: 14 }]}
                    onPress={() => setPostModalVisible(true)}
                  >
                    <Text style={styles.createPostBtnText}>Create Post Now</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : (
              currentList.map((item) => {
                const isArticle = item.contentType === 'ARTICLE';
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.card}
                    onPress={() => handleOpenReader(item)}
                    activeOpacity={0.85}
                  >
                    {/* Top Row: Category Pill & Author */}
                    <View style={styles.cardTopRow}>
                      <View style={[styles.categoryBadge, isArticle ? styles.badgeArticle : styles.badgePost]}>
                        <Text style={[styles.categoryBadgeText, isArticle ? styles.badgeTextArticle : styles.badgeTextPost]}>
                          {item.category || (isArticle ? 'ARTICLE' : 'POST')}
                        </Text>
                      </View>
                      <Text style={styles.cardAuthor}>
                        {isArticle ? '🏅 ' : '👤 '}
                        {item.authorName || (isArticle ? 'Certified Coach' : 'Member')}
                      </Text>
                    </View>

                    {/* Title & Preview Content */}
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.cardContent} numberOfLines={3}>
                      {item.content}
                    </Text>

                    {/* Card Footer: Date, Like & Comment Counters */}
                    <View style={styles.cardFooter}>
                      <Text style={styles.readMoreText}>Read full {isArticle ? 'article' : 'post'} →</Text>
                      <View style={styles.interactionsRow}>
                        <TouchableOpacity
                          style={styles.counterBtn}
                          onPress={() => handleLike(item)}
                        >
                          <Text style={styles.counterEmoji}>{item.liked ? '❤️' : '🤍'}</Text>
                          <Text style={[styles.counterNum, item.liked && styles.counterNumActive]}>
                            {item.likesCount || 0}
                          </Text>
                        </TouchableOpacity>

                        <View style={styles.counterBtn}>
                          <Text style={styles.counterEmoji}>💬</Text>
                          <Text style={styles.counterNum}>{item.commentsCount || 0}</Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      {/* ══════════════════ MODAL: ARTICLE / POST READER ══════════════════ */}
      <Modal
        visible={readingItem !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setReadingItem(null)}
      >
        <View style={styles.modalScreen}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <View style={[styles.categoryBadge, readingItem?.contentType === 'ARTICLE' ? styles.badgeArticle : styles.badgePost]}>
                <Text style={[styles.categoryBadgeText, readingItem?.contentType === 'ARTICLE' ? styles.badgeTextArticle : styles.badgeTextPost]}>
                  {readingItem?.category}
                </Text>
              </View>
              <Text style={styles.modalAuthor}>
                By {readingItem?.authorName || 'Coach'} • {readingItem?.contentType === 'ARTICLE' ? 'Detailed Guide' : 'Community Check-in'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setReadingItem(null)}
              style={styles.closeBtn}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={styles.readerTitle}>{readingItem?.title}</Text>
            <Text style={styles.readerContent}>{readingItem?.content}</Text>

            {/* Interaction Bar */}
            <View style={styles.readerInteractRow}>
              <TouchableOpacity
                style={[styles.likeActionBtn, readingItem?.liked && styles.likeActionBtnActive]}
                onPress={() => readingItem && handleLike(readingItem)}
              >
                <Text style={styles.likeActionEmoji}>{readingItem?.liked ? '❤️' : '🤍'}</Text>
                <Text style={[styles.likeActionText, readingItem?.liked && styles.likeActionTextActive]}>
                  {readingItem?.liked ? 'Liked' : 'Like'} ({readingItem?.likesCount || 0})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Comments Section */}
            <Text style={styles.commentsHeading}>
              Comments ({comments.length})
            </Text>

            {loadingComments ? (
              <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: 12 }} />
            ) : comments.length === 0 ? (
              <Text style={styles.noCommentsText}>No comments yet. Start the conversation!</Text>
            ) : (
              comments.map((c) => (
                <View key={c.id} style={styles.commentItem}>
                  <Text style={styles.commentAuthor}>{c.userName || 'Member'}</Text>
                  <Text style={styles.commentBody}>{c.commentText}</Text>
                </View>
              ))
            )}

            {/* Add Comment Input */}
            <View style={styles.commentInputBox}>
              <Input
                label="Add a Comment"
                placeholder="Share your thoughts or questions..."
                value={commentText}
                onChangeText={setCommentText}
                multiline
                numberOfLines={3}
              />
              <Button
                title={submittingComment ? 'Posting...' : 'Post Comment'}
                onPress={handleAddComment}
                loading={submittingComment}
                disabled={!commentText.trim()}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ══════════════════ MODAL: CREATE POST ══════════════════ */}
      <Modal
        visible={postModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPostModalVisible(false)}
      >
        <View style={styles.modalScreen}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderTitle}>Share Community Update</Text>
            <TouchableOpacity
              onPress={() => setPostModalVisible(false)}
              style={styles.closeBtn}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Category Selector */}
            <Text style={styles.inputLabel}>SELECT TOPIC</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.catScroll, { marginBottom: 16 }]}
            >
              {POST_CATEGORIES.filter((c) => c !== 'ALL').map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.catPill, postCategory === c && styles.catPillActive]}
                  onPress={() => setPostCategory(c)}
                >
                  <Text style={[styles.catPillText, postCategory === c && styles.catPillTextActive]}>
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Input
              label="Post Title"
              placeholder="e.g. Hit a new 5k personal best today!"
              value={postTitle}
              onChangeText={setPostTitle}
            />

            <Input
              label="Details & Reflection"
              placeholder="Share your workout routine, meal recipe, milestone, or words of encouragement..."
              value={postContent}
              onChangeText={setPostContent}
              multiline
              numberOfLines={6}
            />

            <Button
              title={posting ? 'Publishing...' : 'Publish Update 🎉'}
              onPress={handleCreatePost}
              loading={posting}
            />
          </ScrollView>
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabBtnActive: {
    backgroundColor: COLORS.primaryLight,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  tabBtnTextActive: {
    color: COLORS.primaryDark,
    fontWeight: '900',
  },
  container: {
    padding: 16,
    paddingTop: 12,
  },
  tipBanner: {
    backgroundColor: '#fffbeb',
    borderColor: '#fef3c7',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  tipIcon: {
    fontSize: 26,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#b45309',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tipText: {
    fontSize: 13,
    color: '#78350f',
    marginTop: 2,
    lineHeight: 18,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.text,
  },
  createPostBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  createPostBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  catScroll: {
    gap: 8,
    paddingBottom: 14,
  },
  catPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  catPillActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  catPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  catPillTextActive: {
    color: COLORS.primaryDark,
    fontWeight: '900',
  },
  errorBox: {
    backgroundColor: COLORS.dangerLight,
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  centerLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    marginTop: 10,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  emptySub: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    maxWidth: 280,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  badgeArticle: {
    backgroundColor: '#eff6ff',
  },
  badgeTextArticle: {
    color: '#1d4ed8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  badgePost: {
    backgroundColor: '#ecfdf5',
  },
  badgeTextPost: {
    color: '#059669',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardAuthor: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 6,
  },
  cardContent: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
    marginBottom: 14,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  readMoreText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
  },
  interactionsRow: {
    flexDirection: 'row',
    gap: 14,
  },
  counterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  counterEmoji: {
    fontSize: 14,
  },
  counterNum: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  counterNumActive: {
    color: '#ef4444',
  },

  // Modal Styles
  modalScreen: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.text,
  },
  modalAuthor: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
    fontWeight: '500',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  modalBody: {
    padding: 20,
  },
  readerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: 14,
    lineHeight: 28,
  },
  readerContent: {
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 24,
    marginBottom: 20,
  },
  readerInteractRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
    paddingVertical: 12,
    marginBottom: 20,
  },
  likeActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  likeActionBtnActive: {
    backgroundColor: '#fee2e2',
  },
  likeActionEmoji: {
    fontSize: 16,
  },
  likeActionText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
  },
  likeActionTextActive: {
    color: '#dc2626',
  },
  commentsHeading: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: 12,
  },
  noCommentsText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    marginBottom: 16,
  },
  commentItem: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  commentAuthor: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primaryDark,
    marginBottom: 3,
  },
  commentBody: {
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 18,
  },
  commentInputBox: {
    marginTop: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMuted,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
});
