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
  Modal,
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
  const [selectedPlan, setSelectedPlan] = useState<trainerApi.TrainerPlan | null>(null);

  // Booking Modal
  const [requestModalVisible, setRequestModalVisible] = useState(false);
  const [selectedTrainer, setSelectedTrainer] = useState<trainerApi.TrainerProfile | null>(null);
  const [userGoal, setUserGoal] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);

  const fetchTrainersData = useCallback(async () => {
    setError(null);
    try {
      const [searchRes, recRes, reqRes, planRes] = await Promise.allSettled([
        trainerApi.searchTrainers({
          q: searchQuery.trim() || undefined,
          specialization: spec === 'ALL' ? undefined : spec,
        }),
        trainerApi.getRecommendedTrainers(),
        trainerApi.getMyRequests(),
        trainerApi.getMyPlans(),
      ]);

      if (searchRes.status === 'fulfilled') setTrainers(searchRes.value.content || []);
      if (recRes.status === 'fulfilled') setRecommended(recRes.value || []);
      if (reqRes.status === 'fulfilled') setMyRequests(reqRes.value || []);
      if (planRes.status === 'fulfilled') setMyPlans(planRes.value || []);
    } catch (err: any) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery, spec]);

  useEffect(() => {
    fetchTrainersData();
  }, [fetchTrainersData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTrainersData();
  };

  const handleOpenBookingModal = (trainer: trainerApi.TrainerProfile) => {
    setSelectedTrainer(trainer);
    setUserGoal('');
    setRequestModalVisible(true);
  };

  const handleSubmitBooking = async () => {
    if (!selectedTrainer) return;
    setSubmittingRequest(true);
    try {
      await trainerApi.sendTrainerRequest(selectedTrainer.userId, userGoal.trim() || undefined);
      setRequestModalVisible(false);
      Alert.alert(
        'Request Sent! 🎉',
        `Your coaching request was delivered to ${selectedTrainer.first}. You can view the status in "My Plans & Bookings".`
      );
      fetchTrainersData();
    } catch (err: any) {
      Alert.alert('Booking Error', extractErrorMessage(err));
    } finally {
      setSubmittingRequest(false);
    }
  };

  const acceptedCoachRequest = myRequests.find((r) => r.status === 'ACCEPTED');

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
          activeOpacity={0.8}
        >
          <Text style={[styles.sectionTabText, activeSection === 'browse' && styles.sectionTabTextActive]}>
            🔍 Find Coaches
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.sectionTab, activeSection === 'myPlans' && styles.sectionTabActive]}
          onPress={() => setActiveSection('myPlans')}
          activeOpacity={0.8}
        >
          <Text style={[styles.sectionTabText, activeSection === 'myPlans' && styles.sectionTabTextActive]}>
            📋 Assigned Plans {myPlans.length > 0 ? `(${myPlans.length})` : ''}
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
        {/* If user has assigned plans, show banner in browse view */}
        {myPlans.length > 0 && activeSection === 'browse' ? (
          <TouchableOpacity
            style={styles.assignedAlertBanner}
            onPress={() => setActiveSection('myPlans')}
            activeOpacity={0.85}
          >
            <Text style={styles.assignedAlertIcon}>📋</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.assignedAlertTitle}>
                {myPlans.length} Customized Training {myPlans.length === 1 ? 'Plan' : 'Plans'} Assigned!
              </Text>
              <Text style={styles.assignedAlertSub}>
                Tap to open and review your workout & nutrition instructions.
              </Text>
            </View>
            <Text style={styles.assignedAlertArrow}>→</Text>
          </TouchableOpacity>
        ) : null}

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
              placeholder="Search coaches by name, location, or goals..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />

            {/* Specialization Filter Pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.specScroll}
            >
              {SPECIALIZATIONS.map((s) => {
                const isSelected = spec === s;
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.specPill, isSelected && styles.specPillActive]}
                    onPress={() => setSpec(s)}
                  >
                    <Text style={[styles.specText, isSelected && styles.specTextActive]}>
                      {s.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {loading && !refreshing ? (
              <View style={styles.centerLoading}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Searching certified coaches...</Text>
              </View>
            ) : (
              <>
                {/* Recommended Trainers */}
                {recommended.length > 0 && (
                  <View style={styles.recommendedSection}>
                    <Text style={styles.sectionHeading}>⭐ Top Recommended Coaches</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.recScroll}
                    >
                      {recommended.map((t) => (
                        <View key={t.userId} style={styles.recCard}>
                          <View style={styles.trainerAvatarCircle}>
                            <Text style={styles.trainerAvatarText}>
                              {t.first?.[0]}
                              {t.last?.[0]}
                            </Text>
                          </View>
                          <Text style={styles.recName} numberOfLines={1}>
                            {t.first} {t.last}
                          </Text>
                          <Text style={styles.recSpec} numberOfLines={1}>
                            {t.specialization || 'Fitness Specialist'}
                          </Text>
                          <Text style={styles.recExp}>
                            {t.experienceYears ? `${t.experienceYears}+ yrs exp` : 'Certified'}
                          </Text>
                          <TouchableOpacity
                            style={styles.hireBtn}
                            onPress={() => handleOpenBookingModal(t)}
                          >
                            <Text style={styles.hireBtnText}>Request Coach</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Directory Results */}
                <Text style={[styles.sectionHeading, { marginTop: 16 }]}>
                  All Coaches ({trainers.length})
                </Text>

                {trainers.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyEmoji}>🏋️</Text>
                    <Text style={styles.emptyTitle}>No coaches match your search</Text>
                    <Text style={styles.emptySub}>
                      Try clearing filters or searching with another keyword.
                    </Text>
                  </View>
                ) : (
                  trainers.map((t) => (
                    <View key={t.userId} style={styles.trainerCard}>
                      <View style={styles.trainerCardTop}>
                        <View style={styles.trainerAvatarCircle}>
                          <Text style={styles.trainerAvatarText}>
                            {t.first?.[0]}
                            {t.last?.[0]}
                          </Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <View style={styles.nameRow}>
                            <Text style={styles.trainerName}>
                              {t.first} {t.last}
                            </Text>
                            {t.verified ? (
                              <View style={styles.verifiedBadge}>
                                <Text style={styles.verifiedText}>✓ Verified</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={styles.trainerSpec}>
                            {t.specialization || 'Fitness & Wellness Coach'}
                          </Text>
                          <Text style={styles.trainerMeta}>
                            📍 {t.location || 'Online / Global'} • {t.experienceYears || 3}+ yrs
                          </Text>
                        </View>
                      </View>

                      <View style={styles.trainerCardBottom}>
                        <TouchableOpacity
                          style={styles.bookBtn}
                          onPress={() => handleOpenBookingModal(t)}
                        >
                          <Text style={styles.bookBtnText}>Request Coaching</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </>
            )}
          </View>
        )}

        {/* ══════════════════ SECTION 2: MY PLANS & BOOKINGS ══════════════════ */}
        {activeSection === 'myPlans' && (
          <View>
            {/* Active Coach Banner */}
            {acceptedCoachRequest ? (
              <View style={styles.activeCoachBanner}>
                <View style={styles.activeCoachIconCircle}>
                  <Text style={styles.activeCoachIconText}>🏅</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.activeCoachTitle}>Connected Personal Coach</Text>
                  <Text style={styles.activeCoachSub}>
                    Coach ID #{acceptedCoachRequest.trainerId} • Goal: {acceptedCoachRequest.userGoal || 'Fitness'}
                  </Text>
                </View>
                <View style={styles.connectedBadge}>
                  <Text style={styles.connectedBadgeText}>Active</Text>
                </View>
              </View>
            ) : null}

            {/* ── Assigned Plans Section ── */}
            <Text style={styles.sectionHeading}>
              Assigned Training Plans ({myPlans.length})
            </Text>

            {myPlans.length === 0 && !loading ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyEmoji}>📋</Text>
                <Text style={styles.emptyTitle}>No Plans Assigned Yet</Text>
                <Text style={styles.emptySub}>
                  Once your coach reviews your target goals, your customized workout routines and
                  dietary guidelines will be published right here!
                </Text>
              </View>
            ) : (
              myPlans.map((plan) => (
                <TouchableOpacity
                  key={plan.id}
                  style={styles.planCard}
                  onPress={() => setSelectedPlan(plan)}
                  activeOpacity={0.85}
                >
                  <View style={styles.planCardHeader}>
                    <View style={styles.planBadge}>
                      <Text style={styles.planBadgeText}>COACH ASSIGNED PLAN</Text>
                    </View>
                    <Text style={styles.planDate}>
                      Coach #{plan.trainerId}
                    </Text>
                  </View>

                  <Text style={styles.planTitle}>{plan.title}</Text>
                  <Text style={styles.planDetailsPreview} numberOfLines={3}>
                    {plan.details}
                  </Text>

                  <View style={styles.planCardFooter}>
                    <Text style={styles.viewPlanLink}>View Full Program Details →</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}

            {/* ── Booking Requests History ── */}
            <Text style={[styles.sectionHeading, { marginTop: 24 }]}>
              Booking Requests ({myRequests.length})
            </Text>

            {myRequests.length === 0 && !loading ? (
              <Text style={styles.emptySub}>You have no pending coach requests.</Text>
            ) : (
              myRequests.map((r) => {
                const isAccepted = r.status === 'ACCEPTED';
                const isPending = r.status === 'PENDING';
                return (
                  <View key={r.id} style={styles.requestCard}>
                    <View style={styles.requestTop}>
                      <Text style={styles.requestId}>Coaching Request #{r.id}</Text>
                      <View
                        style={[
                          styles.statusPill,
                          isAccepted
                            ? styles.statusGreen
                            : isPending
                            ? styles.statusYellow
                            : styles.statusRed,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            isAccepted
                              ? styles.textGreen
                              : isPending
                              ? styles.textYellow
                              : styles.textRed,
                          ]}
                        >
                          {r.status}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.requestGoal}>
                      Goal: {r.userGoal || 'Personal Fitness Program'}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {/* ══════════════════ MODAL: VIEW FULL PLAN ══════════════════ */}
      <Modal
        visible={selectedPlan !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedPlan(null)}
      >
        <View style={styles.modalScreen}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <View style={styles.planBadge}>
                <Text style={styles.planBadgeText}>PERSONALIZED PROGRAM</Text>
              </View>
              <Text style={styles.modalSub}>Assigned by Coach #{selectedPlan?.trainerId}</Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedPlan(null)} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={styles.planModalTitle}>{selectedPlan?.title}</Text>
            <View style={styles.planDetailsBox}>
              <Text style={styles.planModalDetails}>{selectedPlan?.details}</Text>
            </View>

            <View style={styles.planNoteBox}>
              <Text style={styles.planNoteTitle}>💡 Trainer Advice</Text>
              <Text style={styles.planNoteText}>
                Follow the reps, sets, and rest intervals consistently. Log your workouts and meals
                in the Tracker tab so your coach can observe your daily progression!
              </Text>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ══════════════════ MODAL: REQUEST COACHING ══════════════════ */}
      <Modal
        visible={requestModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setRequestModalVisible(false)}
      >
        <View style={styles.modalScreen}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderTitle}>
              Request {selectedTrainer?.first} {selectedTrainer?.last}
            </Text>
            <TouchableOpacity onPress={() => setRequestModalVisible(false)} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={styles.modalDesc}>
              Tell your coach what your target weight, fitness goals, and availability look like:
            </Text>

            <Input
              label="Your Wellness & Fitness Goals"
              placeholder="e.g. Lose 5kg in 2 months, build core strength, or tone muscle..."
              value={userGoal}
              onChangeText={setUserGoal}
              multiline
              numberOfLines={4}
            />

            <Button
              title={submittingRequest ? 'Sending Request...' : 'Submit Coaching Request 🚀'}
              onPress={handleSubmitBooking}
              loading={submittingRequest}
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
  sectionTabs: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  sectionTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
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
    fontWeight: '900',
  },
  container: {
    padding: 16,
    paddingTop: 12,
  },
  assignedAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderWidth: 1.5,
    borderColor: '#a7f3d0',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  assignedAlertIcon: {
    fontSize: 26,
  },
  assignedAlertTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#065f46',
  },
  assignedAlertSub: {
    fontSize: 11,
    color: '#047857',
    marginTop: 2,
  },
  assignedAlertArrow: {
    fontSize: 18,
    fontWeight: '900',
    color: '#065f46',
  },
  specScroll: {
    gap: 8,
    paddingBottom: 14,
  },
  specPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    fontWeight: '900',
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: 12,
  },
  recommendedSection: {
    marginBottom: 16,
  },
  recScroll: {
    gap: 12,
    paddingBottom: 8,
  },
  recCard: {
    width: 160,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  trainerAvatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  trainerAvatarText: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.text,
  },
  recName: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
  },
  recSpec: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
  },
  recExp: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
    marginBottom: 10,
  },
  hireBtn: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  hireBtnText: {
    color: COLORS.primaryDark,
    fontSize: 11,
    fontWeight: '800',
  },
  trainerCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  trainerCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trainerName: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  verifiedBadge: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  verifiedText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#059669',
  },
  trainerSpec: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '700',
    marginTop: 2,
  },
  trainerMeta: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 3,
  },
  trainerCardBottom: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    alignItems: 'flex-end',
  },
  bookBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 10,
  },
  bookBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  activeCoachBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1.5,
    borderColor: '#bbf7d0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    gap: 12,
  },
  activeCoachIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeCoachIconText: {
    fontSize: 22,
  },
  activeCoachTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#166534',
  },
  activeCoachSub: {
    fontSize: 11,
    color: '#15803d',
    marginTop: 2,
  },
  connectedBadge: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  connectedBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  planCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#bbf7d0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  planCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  planBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  planBadgeText: {
    color: '#15803d',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  planDate: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '700',
  },
  planTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: 6,
  },
  planDetailsPreview: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
    marginBottom: 12,
  },
  planCardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
  },
  viewPlanLink: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
  },
  requestCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  requestTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  requestId: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
  },
  requestGoal: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusGreen: { backgroundColor: '#dcfce7' },
  statusYellow: { backgroundColor: '#fef3c7' },
  statusRed: { backgroundColor: '#fee2e2' },
  statusText: { fontSize: 10, fontWeight: '800' },
  textGreen: { color: '#15803d' },
  textYellow: { color: '#b45309' },
  textRed: { color: '#dc2626' },
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
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 10,
  },
  emptyEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  emptySub: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 17,
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
  modalSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
    fontWeight: '600',
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
  modalDesc: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: 16,
    lineHeight: 18,
  },
  planModalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: 16,
    lineHeight: 28,
  },
  planDetailsBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  planModalDetails: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 22,
  },
  planNoteBox: {
    backgroundColor: '#eff6ff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  planNoteTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1e40af',
    marginBottom: 4,
  },
  planNoteText: {
    fontSize: 12,
    color: '#1d4ed8',
    lineHeight: 17,
  },
});
