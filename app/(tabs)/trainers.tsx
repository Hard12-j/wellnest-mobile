import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Header } from '../../src/components/Header';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { COLORS } from '../../src/constants/theme';
import * as trainerApi from '../../src/api/trainerApi';
import { extractErrorMessage } from '../../src/api/client';

const SPECIALIZATIONS = ['ALL', 'STRENGTH', 'YOGA', 'NUTRITION', 'CARDIO', 'WEIGHT_LOSS'];

export default function TrainersScreen() {
  const [activeSection, setActiveSection] = useState<'browse' | 'myPlans'>('browse');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Browse state
  const [searchQuery, setSearchQuery] = useState('');
  const [spec, setSpec] = useState('ALL');
  const [trainers, setTrainers] = useState<trainerApi.TrainerProfile[]>([]);
  const [recommended, setRecommended] = useState<trainerApi.TrainerProfile[]>([]);
  const [bookingId, setBookingId] = useState<number | null>(null);

  // My Plans state
  const [myRequests, setMyRequests] = useState<trainerApi.TrainerRequest[]>([]);
  const [myPlans, setMyPlans] = useState<trainerApi.TrainerPlan[]>([]);

  const fetchTrainersData = useCallback(async () => {
    setError(null);
    try {
      if (activeSection === 'browse') {
        const [searchRes, recRes] = await Promise.all([
          trainerApi.searchTrainers({
            q: searchQuery.trim() || undefined,
            specialization: spec === 'ALL' ? undefined : spec,
          }).catch(() => ({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0, last: true })),
          trainerApi.getRecommendedTrainers().catch(() => []),
        ]);
        setTrainers(searchRes.content || []);
        setRecommended(recRes || []);
      } else {
        const [reqRes, planRes] = await Promise.all([
          trainerApi.getMyRequests().catch(() => []),
          trainerApi.getMyPlans().catch(() => []),
        ]);
        setMyRequests(reqRes || []);
        setMyPlans(planRes || []);
      }
    } catch (err: any) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeSection, searchQuery, spec]);

  useEffect(() => {
    fetchTrainersData();
  }, [fetchTrainersData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTrainersData();
  };

  const handleBookTrainer = async (trainer: trainerApi.TrainerProfile) => {
    Alert.alert(
      'Book Trainer',
      `Send a coaching and consultation request to ${trainer.first} ${trainer.last}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Request',
          onPress: async () => {
            setBookingId(trainer.userId);
            try {
              await trainerApi.sendTrainerRequest(trainer.userId);
              Alert.alert(
                'Request Sent! 🎉',
                `Your booking request was delivered to ${trainer.first}. You can view the status in "My Bookings".`
              );
              fetchTrainersData();
            } catch (err: any) {
              Alert.alert('Booking Error', extractErrorMessage(err));
            } finally {
              setBookingId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.screen}>
      <Header
        title="Fitness Coaches"
        subtitle="Certified personal trainers & tailored programs"
      />

      {/* ── Sub Navigation Tabs ── */}
      <View style={styles.sectionTabs}>
        <TouchableOpacity
          style={[styles.sectionTab, activeSection === 'browse' && styles.sectionTabActive]}
          onPress={() => setActiveSection('browse')}
        >
          <Text style={[styles.sectionTabText, activeSection === 'browse' && styles.sectionTabTextActive]}>
            Find Trainers
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.sectionTab, activeSection === 'myPlans' && styles.sectionTabActive]}
          onPress={() => setActiveSection('myPlans')}
        >
          <Text style={[styles.sectionTabText, activeSection === 'myPlans' && styles.sectionTabTextActive]}>
            My Bookings & Plans
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
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* ══════════════════ SECTION 1: BROWSE TRAINERS ══════════════════ */}
        {activeSection === 'browse' && (
          <View>
            {/* Search Input */}
            <Input
              placeholder="Search by name, location..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={fetchTrainersData}
              containerStyle={{ marginBottom: 12 }}
            />

            {/* Specialization Filter Pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.specScroll}
            >
              {SPECIALIZATIONS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.specPill, spec === s && styles.specPillActive]}
                  onPress={() => setSpec(s)}
                >
                  <Text style={[styles.specText, spec === s && styles.specTextActive]}>
                    {s.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {loading && !refreshing ? (
              <View style={styles.centerLoading}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Finding certified trainers...</Text>
              </View>
            ) : (
              <>
                {/* ── Recommended Trainers ── */}
                {recommended.length > 0 && !searchQuery && spec === 'ALL' && (
                  <View style={styles.recSection}>
                    <Text style={styles.recHeader}>⭐ Recommended For Your Goal</Text>
                    {recommended.map((t) => (
                      <View key={`rec-${t.userId}`} style={[styles.trainerCard, styles.recCard]}>
                        <View style={styles.trainerHeader}>
                          <View style={styles.trainerAvatar}>
                            <Text style={styles.trainerAvatarText}>
                              {(t.first?.[0] || 'T').toUpperCase()}
                            </Text>
                          </View>
                          <View style={styles.trainerMeta}>
                            <View style={styles.nameRow}>
                              <Text style={styles.trainerName}>{t.first} {t.last}</Text>
                              {t.verified ? <Text style={styles.verifiedCheck}>✓ Verified</Text> : null}
                            </View>
                            <Text style={styles.specLabel}>{t.specialization || 'Personal Trainer'}</Text>
                            <Text style={styles.locLabel}>
                              📍 {t.location || 'Online'} • {t.experienceYears ? `${t.experienceYears} yrs exp` : 'Experienced'}
                            </Text>
                          </View>
                        </View>

                        <Button
                          title="Request Consultation"
                          onPress={() => handleBookTrainer(t)}
                          loading={bookingId === t.userId}
                          style={styles.bookBtn}
                        />
                      </View>
                    ))}
                  </View>
                )}

                {/* ── Search Results List ── */}
                <Text style={styles.sectionHeading}>
                  All Coaches ({trainers.length})
                </Text>

                {trainers.map((t) => (
                  <View key={t.userId} style={styles.trainerCard}>
                    <View style={styles.trainerHeader}>
                      <View style={styles.trainerAvatar}>
                        <Text style={styles.trainerAvatarText}>
                          {(t.first?.[0] || 'T').toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.trainerMeta}>
                        <View style={styles.nameRow}>
                          <Text style={styles.trainerName}>{t.first} {t.last}</Text>
                          {t.verified ? <Text style={styles.verifiedCheck}>✓ Verified</Text> : null}
                        </View>
                        <Text style={styles.specLabel}>{t.specialization || 'Fitness Coach'}</Text>
                        <Text style={styles.locLabel}>
                          📍 {t.location || 'Online'} • {t.experienceYears ? `${t.experienceYears} yrs exp` : 'Certified'}
                        </Text>
                      </View>
                    </View>

                    <Button
                      title="Book Coach"
                      onPress={() => handleBookTrainer(t)}
                      loading={bookingId === t.userId}
                      variant="outline"
                      style={styles.bookBtn}
                    />
                  </View>
                ))}

                {trainers.length === 0 && !loading ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyTitle}>No Coaches Found</Text>
                    <Text style={styles.emptySub}>
                      Try adjusting your search query or specialization filter.
                    </Text>
                  </View>
                ) : null}
              </>
            )}
          </View>
        )}

        {/* ══════════════════ SECTION 2: MY BOOKINGS & PLANS ══════════════════ */}
        {activeSection === 'myPlans' && (
          <View>
            {/* Booking Requests */}
            <Text style={styles.sectionHeading}>My Booking Requests ({myRequests.length})</Text>
            {myRequests.map((r) => {
              const isAccepted = r.status === 'ACCEPTED';
              const isPending = r.status === 'PENDING';
              return (
                <View key={r.id} style={styles.requestCard}>
                  <View style={styles.requestTop}>
                    <Text style={styles.requestId}>Booking Request #{r.id}</Text>
                    <View style={[styles.statusPill, isAccepted ? styles.statusGreen : isPending ? styles.statusYellow : styles.statusRed]}>
                      <Text style={[styles.statusText, isAccepted ? styles.textGreen : isPending ? styles.textYellow : styles.textRed]}>
                        {r.status}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.requestGoal}>
                    Goal: {r.userGoal || 'Personal Fitness Program'}
                  </Text>
                </View>
              );
            })}
            {myRequests.length === 0 && !loading ? (
              <Text style={styles.emptySub}>You have no pending trainer requests.</Text>
            ) : null}

            {/* Assigned Plans */}
            <Text style={[styles.sectionHeading, { marginTop: 24 }]}>
              Assigned Training Plans ({myPlans.length})
            </Text>
            {myPlans.map((p) => (
              <View key={p.id} style={styles.planCard}>
                <View style={styles.planBadge}>
                  <Text style={styles.planBadgeText}>ASSIGNED PROGRAM</Text>
                </View>
                <Text style={styles.planTitle}>{p.title}</Text>
                <Text style={styles.planDetails}>{p.details}</Text>
              </View>
            ))}
            {myPlans.length === 0 && !loading ? (
              <Text style={styles.emptySub}>
                No workout or meal plans have been assigned by a coach yet.
              </Text>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  sectionTabs: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  sectionTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  sectionTabActive: {
    backgroundColor: COLORS.primaryLight,
  },
  sectionTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  sectionTabTextActive: {
    color: COLORS.primaryDark,
  },
  container: {
    padding: 16,
  },
  specScroll: {
    gap: 8,
    paddingBottom: 14,
  },
  specPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  specPillActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  specText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  specTextActive: {
    color: COLORS.primaryDark,
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
  recSection: {
    marginBottom: 20,
  },
  recHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primaryDark,
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  trainerCard: {
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
  recCard: {
    borderColor: COLORS.primaryBorder,
    backgroundColor: '#fafffa',
  },
  trainerHeader: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 14,
  },
  trainerAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  trainerAvatarText: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  trainerMeta: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  trainerName: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  verifiedCheck: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primaryDark,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  specLabel: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '700',
    marginBottom: 2,
  },
  locLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  bookBtn: {
    paddingVertical: 10,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  requestCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  requestTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  requestId: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusGreen: {
    backgroundColor: '#dcfce7',
  },
  statusYellow: {
    backgroundColor: '#fef3c7',
  },
  statusRed: {
    backgroundColor: '#fee2e2',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  textGreen: {
    color: '#15803d',
  },
  textYellow: {
    color: '#b45309',
  },
  textRed: {
    color: '#b91c1c',
  },
  requestGoal: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  planCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  planBadge: {
    backgroundColor: COLORS.primaryLight,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 8,
  },
  planBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  planTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 6,
  },
  planDetails: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
  },
});

