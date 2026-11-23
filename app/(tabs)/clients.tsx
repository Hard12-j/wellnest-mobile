import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { COLORS } from '../../src/constants/theme';
import { Header } from '../../src/components/Header';
import * as trainerApi from '../../src/api/trainerApi';
import * as analyticsApi from '../../src/api/analyticsApi';
import { extractErrorMessage } from '../../src/api/client';
import type { TrainerClient, TrainerPlan, TrainerRequest } from '../../src/api/trainerApi';
import type { GoalCardProgressResponse, GoalProgressResponse, InsightsResponse, WeeklyTrendsResponse } from '../../src/api/analyticsApi';

type DashboardSection = 'clients' | 'requests' | 'plans' | 'analytics';
type AnalyticsState = {
  cards: GoalCardProgressResponse | null;
  progress: GoalProgressResponse | null;
  insights: InsightsResponse | null;
  trends: WeeklyTrendsResponse | null;
};

const isoDate = (daysAgo: number) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
};

export default function ClientsScreen() {
  const [section, setSection] = useState<DashboardSection>('clients');
  const [profile, setProfile] = useState<trainerApi.TrainerProfile | null>(null);
  const [clients, setClients] = useState<TrainerClient[]>([]);
  const [requests, setRequests] = useState<TrainerRequest[]>([]);
  const [plans, setPlans] = useState<TrainerPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [processingRequest, setProcessingRequest] = useState<number | null>(null);
  const [planModal, setPlanModal] = useState(false);
  const [planClientId, setPlanClientId] = useState<number | null>(null);
  const [planTitle, setPlanTitle] = useState('');
  const [planDetails, setPlanDetails] = useState('');
  const [savingPlan, setSavingPlan] = useState(false);
  const [analyticsClient, setAnalyticsClient] = useState<TrainerClient | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsState>({ cards: null, progress: null, insights: null, trends: null });

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    const [profileResult, clientsResult, requestsResult, plansResult] = await Promise.allSettled([
      trainerApi.getMyTrainerProfile(),
      trainerApi.getMyClients(),
      trainerApi.getPendingTrainerRequests(),
      trainerApi.getGivenPlans(),
    ]);
    if (profileResult.status === 'fulfilled') setProfile(profileResult.value);
    if (clientsResult.status === 'fulfilled') setClients(clientsResult.value || []);
    if (requestsResult.status === 'fulfilled') setRequests(requestsResult.value || []);
    if (plansResult.status === 'fulfilled') setPlans(plansResult.value || []);
    const failures = [profileResult, clientsResult, requestsResult, plansResult].filter((result) => result.status === 'rejected');
    if (failures.length === 4) Alert.alert('Dashboard unavailable', 'Could not load trainer dashboard data. Pull down to retry.');
    else if (failures.length > 0) Alert.alert('Some data could not load', 'Pull down to retry the missing trainer dashboard data.');
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void loadDashboard(); }, 0);
    return () => clearTimeout(timer);
  }, [loadDashboard]);

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return clients;
    return clients.filter((client) => String(client.userId).includes(query) || client.fitnessGoal?.toLowerCase().includes(query));
  }, [clients, search]);

  const openPlanModal = (client?: TrainerClient) => {
    setPlanClientId(client?.userId ?? clients[0]?.userId ?? null);
    setPlanTitle('');
    setPlanDetails('');
    setPlanModal(true);
  };

  const submitPlan = async () => {
    if (!planClientId || !planTitle.trim() || !planDetails.trim()) {
      Alert.alert('Complete the plan', 'Choose a client and enter a title and plan details.');
      return;
    }
    setSavingPlan(true);
    try {
      const assignedPlan = await trainerApi.assignTrainerPlan({ userId: planClientId, title: planTitle, details: planDetails });
      setPlanModal(false);
      setSection('plans');
      if (assignedPlan?.id) setPlans((current) => [assignedPlan, ...current.filter((plan) => plan.id !== assignedPlan.id)]);
      try { setPlans(await trainerApi.getGivenPlans()); } catch { /* the new plan is already saved; keep it in the list */ }
      Alert.alert('Plan assigned', `Your plan was sent to Client #${planClientId}.`);
    } catch (error) {
      Alert.alert('Could not assign plan', extractErrorMessage(error));
    } finally { setSavingPlan(false); }
  };

  const processRequest = async (request: TrainerRequest, action: 'accept' | 'reject') => {
    setProcessingRequest(request.id);
    try {
      if (action === 'accept') await trainerApi.acceptTrainerRequest(request.id);
      else await trainerApi.rejectTrainerRequest(request.id);
      setRequests((current) => current.filter((item) => item.id !== request.id));
      if (action === 'accept') {
        try { setClients(await trainerApi.getMyClients()); } catch { /* accepted request can be refreshed later */ }
      }
      try { setRequests(await trainerApi.getPendingTrainerRequests()); } catch { /* keep the optimistic request update */ }
      Alert.alert(action === 'accept' ? 'Request accepted' : 'Request declined', action === 'accept' ? `Client #${request.userId} was added to your clients.` : `The request from User #${request.userId} was declined.`);
    } catch (error) {
      Alert.alert('Request not updated', extractErrorMessage(error));
    } finally { setProcessingRequest(null); }
  };

  const openAnalytics = (client: TrainerClient) => {
    setAnalyticsClient(client);
    setAnalytics({ cards: null, progress: null, insights: null, trends: null });
    setAnalyticsError(null);
    setSection('analytics');
  };

  useEffect(() => {
    if (section !== 'analytics' || !analyticsClient) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setAnalyticsLoading(true);
      setAnalyticsError(null);
      const clientId = analyticsClient.userId;
      Promise.allSettled([
        analyticsApi.getClientGoalCards(clientId),
        analyticsApi.getClientGoalProgress(clientId),
        analyticsApi.getClientInsights(clientId),
        analyticsApi.getClientWeeklyTrends(clientId, isoDate(6), isoDate(0)),
      ]).then((results) => {
        if (cancelled) return;
        setAnalytics({
          cards: results[0].status === 'fulfilled' ? results[0].value : null,
          progress: results[1].status === 'fulfilled' ? results[1].value : null,
          insights: results[2].status === 'fulfilled' ? results[2].value : null,
          trends: results[3].status === 'fulfilled' ? results[3].value : null,
        });
        if (results.every((result) => result.status === 'rejected')) {
          setAnalyticsError('Client analytics could not be loaded. Check that the client has activity and try again.');
        }
        setAnalyticsLoading(false);
      });
    }, 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [section, analyticsClient]);

  const weeklySummary = useMemo(() => {
    const days = analytics.trends?.days || [];
    return days.reduce((summary, day) => ({
      workouts: summary.workouts + (day.workoutCount || 0),
      minutes: summary.minutes + (day.workoutMinutes || 0),
      water: summary.water + (day.waterMl || 0),
      sleep: summary.sleep + (day.sleepHours || 0),
      logged: summary.logged + (day.logged ? 1 : 0),
    }), { workouts: 0, minutes: 0, water: 0, sleep: 0, logged: 0 });
  }, [analytics.trends]);

  if (loading) return <View style={styles.screen}><Header title="Clients" subtitle="Manage clients, requests, and plans" /><View style={styles.loading}><ActivityIndicator size="large" color={COLORS.primary} /><Text style={styles.muted}>Loading trainer dashboard…</Text></View></View>;

  const trainerName = profile?.first || 'Coach';
  const sections: { key: DashboardSection; label: string; count: number }[] = [
    { key: 'clients', label: 'Clients', count: clients.length },
    { key: 'requests', label: 'Requests', count: requests.length },
    { key: 'plans', label: 'Plans', count: plans.length },
    { key: 'analytics', label: 'Analytics', count: clients.length },
  ];

  return (
    <View style={styles.screen}>
      <Header title="Clients" subtitle="Manage clients, requests, and plans" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadDashboard(); }} colors={[COLORS.primary]} />}
      >
        <View style={styles.hero}>
          <Text style={styles.kicker}>TRAINER COMMAND CENTER</Text>
          <Text style={styles.heroTitle}>Welcome, {trainerName}</Text>
          <Text style={styles.heroCopy}>Manage clients, coaching requests, progress, and personalized plans.</Text>
          <TouchableOpacity style={[styles.heroAction, clients.length === 0 && styles.disabled]} onPress={() => openPlanModal()} disabled={clients.length === 0}>
            <Text style={styles.heroActionText}>＋  Assign a plan</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.metricsRow}>
          <Metric label="Active clients" value={clients.length} tint="#dcfce7" />
          <Metric label="New requests" value={requests.length} tint="#fef3c7" />
          <Metric label="Plans assigned" value={plans.length} tint="#dbeafe" />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectionTabs}>
          {sections.map((item) => <TouchableOpacity key={item.key} onPress={() => setSection(item.key)} style={[styles.sectionTab, section === item.key && styles.sectionTabActive]}>
            <Text style={[styles.sectionTabText, section === item.key && styles.sectionTabTextActive]}>{item.label}</Text>
            <Text style={[styles.sectionCount, section === item.key && styles.sectionCountActive]}>{item.count}</Text>
          </TouchableOpacity>)}
        </ScrollView>

        {section === 'clients' ? <View>
          <View style={styles.sectionHeadingRow}><View><Text style={styles.sectionTitle}>Your clients</Text><Text style={styles.muted}>Review progress and create tailored plans.</Text></View></View>
          <TextInput value={search} onChangeText={setSearch} placeholder="Search by client ID or fitness goal" style={styles.searchInput} />
          {filteredClients.length === 0 ? <EmptyState title={search ? 'No matching clients' : 'No active clients yet'} copy={requests.length ? 'Review pending requests to add clients to your roster.' : 'Accepted coaching relationships will appear here.'} action={requests.length ? `Review ${requests.length} request${requests.length === 1 ? '' : 's'}` : undefined} onPress={() => setSection('requests')} /> : filteredClients.map((client) => <ClientCard key={client.userId} client={client} plansCount={plans.filter((plan) => Number(plan.userId) === Number(client.userId)).length} onAnalytics={() => openAnalytics(client)} onAssign={() => openPlanModal(client)} />)}
        </View> : null}

        {section === 'requests' ? <View>
          <Text style={styles.sectionTitle}>Coaching requests</Text><Text style={styles.muted}>Accept requests to add users to your client list.</Text>
          {requests.length === 0 ? <EmptyState title="You're all caught up" copy="New coaching requests will appear here." /> : requests.map((request) => <View style={styles.requestCard} key={request.id}>
            <View style={styles.requestTop}><View style={styles.avatar}><Text style={styles.avatarText}>U{String(request.userId).slice(-2)}</Text></View><View style={styles.flex}><Text style={styles.cardTitle}>User #{request.userId}</Text><Text style={styles.muted}>{request.createdAt ? `Requested ${new Date(request.createdAt).toLocaleDateString()}` : 'Coaching request'}</Text></View><Text style={styles.pendingPill}>PENDING</Text></View>
            <Text style={styles.goalText}>Goal: {request.userGoal || 'Personal fitness coaching'}</Text>
            <View style={styles.buttonRow}><ActionButton label="Accept" onPress={() => void processRequest(request, 'accept')} loading={processingRequest === request.id} /><ActionButton label="Decline" secondary onPress={() => void processRequest(request, 'reject')} loading={processingRequest === request.id} /></View>
          </View>)}
        </View> : null}

        {section === 'plans' ? <View>
          <View style={styles.sectionHeadingRow}><View><Text style={styles.sectionTitle}>Assigned plans</Text><Text style={styles.muted}>Workout and nutrition plans sent to your clients.</Text></View><TouchableOpacity style={styles.smallAction} onPress={() => openPlanModal()} disabled={clients.length === 0}><Text style={styles.smallActionText}>＋ New</Text></TouchableOpacity></View>
          {plans.length === 0 ? <EmptyState title="No plans assigned yet" copy="Create a personalized plan for one of your active clients." action={clients.length ? 'Assign a plan' : undefined} onPress={() => openPlanModal()} /> : plans.map((plan) => <View style={styles.planCard} key={plan.id}>
            <View style={styles.planHeader}><Text style={styles.cardTitle}>{plan.title}</Text><Text style={styles.clientTag}>Client #{plan.userId}</Text></View>
            <Text style={styles.planDetails}>{plan.details}</Text>
            <Text style={styles.muted}>{plan.createdAt ? new Date(plan.createdAt).toLocaleDateString() : 'Assigned plan'}</Text>
          </View>)}
        </View> : null}

        {section === 'analytics' ? <View>
          <Text style={styles.sectionTitle}>Client analytics</Text><Text style={styles.muted}>Choose a client to review their last seven days.</Text>
          {clients.length === 0 ? <EmptyState title="No clients to review" copy="Accept a coaching request to see a client's activity analytics." action={requests.length ? 'Review requests' : undefined} onPress={() => setSection('requests')} /> : <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.clientPicker}>
              {clients.map((client) => <TouchableOpacity key={client.userId} onPress={() => setAnalyticsClient(client)} style={[styles.clientPill, analyticsClient?.userId === client.userId && styles.clientPillActive]}><Text style={[styles.clientPillText, analyticsClient?.userId === client.userId && styles.clientPillTextActive]}>Client #{client.userId}</Text></TouchableOpacity>)}
            </ScrollView>
            {!analyticsClient ? <EmptyState title="Select a client" copy="Choose a client above to load their progress." /> : analyticsLoading ? <ActivityIndicator size="large" color={COLORS.primary} style={styles.analyticsSpinner} /> : <>
              <View style={styles.clientGoalCard}><Text style={styles.kicker}>PRIMARY FITNESS GOAL</Text><Text style={styles.cardTitle}>{analyticsClient.fitnessGoal || analytics.progress?.fitnessGoal || 'General fitness'}</Text><Text style={styles.muted}>Client #{analyticsClient.userId}</Text></View>
              {analyticsError ? <Text style={styles.errorText}>{analyticsError}</Text> : null}
              <View style={styles.metricsRow}>
                <Metric label="Weight progress" value={analytics.progress?.progressPercent != null ? `${Math.round(analytics.progress.progressPercent)}%` : '—'} tint="#dcfce7" />
                <Metric label="Logging streak" value={`${analytics.progress?.currentStreakDays ?? 0} days`} tint="#fef3c7" />
              </View>
              <View style={styles.analyticsGrid}>
                <AnalyticsMetric label="Workouts" value={`${weeklySummary.workouts}`} detail={`${weeklySummary.minutes} min this week`} />
                <AnalyticsMetric label="Water" value={`${(weeklySummary.water / 1000).toFixed(1)} L`} detail="logged this week" />
                <AnalyticsMetric label="Sleep" value={`${weeklySummary.sleep.toFixed(1)} hrs`} detail="logged this week" />
                <AnalyticsMetric label="Active days" value={`${weeklySummary.logged}/7`} detail="with wellness activity" />
              </View>
              <Text style={styles.subsectionTitle}>Assigned goals</Text>
              <View style={styles.goalCards}>
                <ProgressCard label="Workouts" value={analytics.cards?.workouts?.percentage} detail={`${analytics.cards?.workouts?.completedDays ?? 0}/${analytics.cards?.workouts?.targetDays ?? 0} days`} />
                <ProgressCard label="Water" value={analytics.cards?.water?.percentage} detail={`${analytics.cards?.water?.currentLitres ?? 0}/${analytics.cards?.water?.targetLitres ?? 0} L`} />
                <ProgressCard label="Sleep" value={analytics.cards?.sleep?.percentage} detail={`${analytics.cards?.sleep?.avgHours ?? 0}/${analytics.cards?.sleep?.targetHours ?? 0} hrs`} />
              </View>
              <Text style={styles.subsectionTitle}>Coaching insights</Text>
              {(analytics.insights?.insights || []).length === 0 ? <Text style={styles.insightEmpty}>No coaching alerts for this client this week.</Text> : (analytics.insights?.insights || []).map((insight, index) => <View style={styles.insightCard} key={`${insight.id || insight.code || 'insight'}-${index}`}><Text style={styles.insightTitle}>{insight.title || (insight.severity === 'WARNING' ? 'Needs attention' : 'Coaching note')}</Text><Text style={styles.planDetails}>{insight.description || insight.message}</Text></View>)}
            </>}
          </>}
        </View> : null}
      </ScrollView>

      <Modal visible={planModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPlanModal(false)}>
        <KeyboardAvoidingView style={styles.modalScreen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}><View style={styles.flex}><Text style={styles.modalTitle}>Assign a plan</Text><Text style={styles.muted}>Create a workout or nutrition plan for a client.</Text></View><TouchableOpacity onPress={() => setPlanModal(false)} style={styles.closeButton}><Text style={styles.closeText}>×</Text></TouchableOpacity></View>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>CLIENT</Text>
            {clients.length === 0 ? <Text style={styles.muted}>Accept a client request before assigning a plan.</Text> : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.clientPicker}>{clients.map((client) => <TouchableOpacity key={client.userId} onPress={() => setPlanClientId(client.userId)} style={[styles.clientPill, planClientId === client.userId && styles.clientPillActive]}><Text style={[styles.clientPillText, planClientId === client.userId && styles.clientPillTextActive]}>Client #{client.userId}</Text></TouchableOpacity>)}</ScrollView>}
            <Text style={styles.fieldLabel}>PLAN TITLE</Text><TextInput value={planTitle} onChangeText={setPlanTitle} placeholder="e.g. 4-week strength program" style={styles.formInput} maxLength={120} />
            <Text style={styles.fieldLabel}>PLAN DETAILS</Text><TextInput value={planDetails} onChangeText={setPlanDetails} placeholder="Describe workouts, sets, nutrition guidance, and schedule…" style={[styles.formInput, styles.detailsInput]} multiline textAlignVertical="top" maxLength={5000} />
            <TouchableOpacity style={[styles.primaryButton, (!planClientId || savingPlan) && styles.disabled]} onPress={() => void submitPlan()} disabled={!planClientId || savingPlan}>{savingPlan ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Send plan to client</Text>}</TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function Metric({ label, value, tint }: { label: string; value: string | number; tint: string }) {
  return <View style={styles.metricCard}><View style={[styles.metricIcon, { backgroundColor: tint }]}><Text style={styles.metricDot}>●</Text></View><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function ClientCard({ client, plansCount, onAnalytics, onAssign }: { client: TrainerClient; plansCount: number; onAnalytics: () => void; onAssign: () => void }) {
  return <View style={styles.clientCard}>
    <View style={styles.requestTop}><View style={styles.avatar}><Text style={styles.avatarText}>U{String(client.userId).slice(-2)}</Text></View><View style={styles.flex}><Text style={styles.cardTitle}>Client #{client.userId}</Text><Text style={styles.muted}>{client.since ? `Member since ${new Date(client.since).toLocaleDateString()}` : 'Active client'}</Text></View><Text style={styles.planCount}>{plansCount} plans</Text></View>
    <Text style={styles.goalText}>Goal: {client.fitnessGoal || 'General fitness'}</Text>
    <View style={styles.buttonRow}><ActionButton label="View analytics" secondary onPress={onAnalytics} /><ActionButton label="Assign plan" onPress={onAssign} /></View>
  </View>;
}

function ActionButton({ label, onPress, secondary = false, loading = false }: { label: string; onPress: () => void; secondary?: boolean; loading?: boolean }) {
  return <TouchableOpacity style={[styles.actionButton, secondary && styles.actionButtonSecondary, loading && styles.disabled]} onPress={onPress} disabled={loading}>{loading ? <ActivityIndicator size="small" color={secondary ? COLORS.primary : '#fff'} /> : <Text style={[styles.actionButtonText, secondary && styles.actionButtonTextSecondary]}>{label}</Text>}</TouchableOpacity>;
}

function EmptyState({ title, copy, action, onPress }: { title: string; copy: string; action?: string; onPress?: () => void }) {
  return <View style={styles.emptyCard}><Text style={styles.emptyIcon}>✦</Text><Text style={styles.cardTitle}>{title}</Text><Text style={styles.emptyCopy}>{copy}</Text>{action && onPress ? <TouchableOpacity style={styles.smallAction} onPress={onPress}><Text style={styles.smallActionText}>{action}</Text></TouchableOpacity> : null}</View>;
}

function AnalyticsMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <View style={styles.analyticsMetric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.analyticsValue}>{value}</Text><Text style={styles.muted}>{detail}</Text></View>;
}

function ProgressCard({ label, value, detail }: { label: string; value?: number; detail: string }) {
  const percent = Math.max(0, Math.min(100, value || 0));
  return <View style={styles.progressCard}><View style={styles.planHeader}><Text style={styles.cardTitle}>{label}</Text><Text style={styles.progressPercent}>{percent}%</Text></View><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${percent}%` }]} /></View><Text style={styles.muted}>{detail}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg }, content: { padding: 16, paddingBottom: 30 }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg, gap: 12 },
  hero: { padding: 20, borderRadius: 22, backgroundColor: '#065f46', marginBottom: 14 }, kicker: { fontSize: 10, color: '#a7f3d0', fontWeight: '900', letterSpacing: 1.1 }, heroTitle: { fontSize: 24, lineHeight: 30, color: '#fff', fontWeight: '900', marginTop: 8 }, heroCopy: { fontSize: 13, lineHeight: 19, color: '#d1fae5', marginTop: 6 }, heroAction: { backgroundColor: '#fff', alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, marginTop: 16 }, heroActionText: { color: '#065f46', fontSize: 13, fontWeight: '900' },
  metricsRow: { flexDirection: 'row', gap: 9, marginBottom: 16 }, metricCard: { flex: 1, padding: 12, minHeight: 104, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border }, metricIcon: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, metricDot: { color: COLORS.primary, fontSize: 11 }, metricValue: { fontSize: 21, fontWeight: '900', color: COLORS.text, marginTop: 8 }, metricLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, marginTop: 2 },
  sectionTabs: { gap: 8, paddingBottom: 16 }, sectionTab: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 12 }, sectionTabActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary }, sectionTabText: { color: COLORS.textMuted, fontSize: 12, fontWeight: '800' }, sectionTabTextActive: { color: COLORS.primaryDark }, sectionCount: { color: COLORS.textMuted, fontSize: 10, fontWeight: '900' }, sectionCountActive: { color: COLORS.primaryDark },
  sectionHeadingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }, sectionTitle: { color: COLORS.text, fontSize: 19, fontWeight: '900' }, subsectionTitle: { color: COLORS.text, fontSize: 15, fontWeight: '900', marginTop: 20, marginBottom: 9 }, muted: { color: COLORS.textMuted, fontSize: 12, lineHeight: 17, marginTop: 3 }, searchInput: { backgroundColor: '#fff', borderColor: COLORS.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11, fontSize: 13, marginVertical: 12, color: COLORS.text },
  clientCard: { padding: 14, borderRadius: 17, backgroundColor: '#fff', borderColor: COLORS.border, borderWidth: 1, marginBottom: 11 }, requestCard: { padding: 14, borderRadius: 17, backgroundColor: '#fff', borderColor: COLORS.border, borderWidth: 1, marginTop: 11 }, requestTop: { flexDirection: 'row', alignItems: 'center', gap: 10 }, avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center' }, avatarText: { color: COLORS.primaryDark, fontSize: 11, fontWeight: '900' }, flex: { flex: 1 }, cardTitle: { fontSize: 14, color: COLORS.text, fontWeight: '900' }, planCount: { color: COLORS.primaryDark, backgroundColor: COLORS.primaryLight, fontSize: 10, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 9, fontWeight: '800' }, goalText: { marginTop: 12, color: COLORS.textSecondary, fontSize: 12, lineHeight: 18 }, buttonRow: { flexDirection: 'row', gap: 8, marginTop: 14 }, actionButton: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 40, borderRadius: 11, backgroundColor: COLORS.primary, paddingHorizontal: 8 }, actionButtonSecondary: { backgroundColor: COLORS.primaryLight, borderWidth: 1, borderColor: COLORS.primaryBorder }, actionButtonText: { color: '#fff', fontSize: 11, fontWeight: '900' }, actionButtonTextSecondary: { color: COLORS.primaryDark }, pendingPill: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, color: '#92400e', backgroundColor: '#fef3c7', fontSize: 9, fontWeight: '900', overflow: 'hidden' },
  emptyCard: { marginTop: 12, padding: 22, backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, alignItems: 'center' }, emptyIcon: { fontSize: 28, color: COLORS.primary, marginBottom: 8 }, emptyCopy: { color: COLORS.textMuted, textAlign: 'center', fontSize: 12, lineHeight: 18, marginTop: 5 }, smallAction: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, marginTop: 12 }, smallActionText: { color: COLORS.primaryDark, fontSize: 11, fontWeight: '900' },
  planCard: { padding: 14, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border, marginTop: 10 }, planHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, clientTag: { color: COLORS.primaryDark, backgroundColor: COLORS.primaryLight, fontSize: 10, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, overflow: 'hidden' }, planDetails: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 9 },
  clientPicker: { gap: 8, paddingVertical: 12 }, clientPill: { borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border }, clientPillActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary }, clientPillText: { color: COLORS.textMuted, fontSize: 11, fontWeight: '800' }, clientPillTextActive: { color: COLORS.primaryDark }, clientGoalCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border, padding: 15, borderRadius: 16, marginBottom: 10 }, analyticsSpinner: { marginTop: 40, marginBottom: 40 }, analyticsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 10 }, analyticsMetric: { width: '48%', minHeight: 100, backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border, borderRadius: 15, padding: 12 }, analyticsValue: { color: COLORS.text, fontSize: 20, fontWeight: '900', marginTop: 8 }, goalCards: { gap: 8 }, progressCard: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 12 }, progressPercent: { color: COLORS.primaryDark, fontSize: 12, fontWeight: '900' }, progressTrack: { height: 7, backgroundColor: COLORS.surface, borderRadius: 4, marginVertical: 9, overflow: 'hidden' }, progressFill: { height: 7, backgroundColor: COLORS.primary, borderRadius: 4 }, insightCard: { padding: 13, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 }, insightTitle: { fontSize: 12, color: COLORS.text, fontWeight: '900' }, insightEmpty: { color: COLORS.textMuted, fontSize: 12, paddingVertical: 8 }, errorText: { color: COLORS.danger, fontSize: 12, marginVertical: 8 },
  modalScreen: { flex: 1, backgroundColor: '#fff' }, modalHeader: { flexDirection: 'row', alignItems: 'flex-start', padding: 18, borderBottomWidth: 1, borderBottomColor: COLORS.border }, modalTitle: { fontSize: 20, color: COLORS.text, fontWeight: '900' }, closeButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' }, closeText: { color: COLORS.text, fontSize: 23, lineHeight: 25 }, modalContent: { padding: 18, paddingBottom: 40 }, fieldLabel: { color: COLORS.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 0.8, marginTop: 15, marginBottom: 7 }, formInput: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceLight, borderRadius: 12, minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, color: COLORS.text, fontSize: 13 }, detailsInput: { minHeight: 150 }, primaryButton: { minHeight: 48, borderRadius: 13, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginTop: 20 }, primaryButtonText: { color: '#fff', fontSize: 13, fontWeight: '900' }, disabled: { opacity: 0.5 },
});
