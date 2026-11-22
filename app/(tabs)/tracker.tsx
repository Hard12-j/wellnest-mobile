import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { Header } from '../../src/components/Header';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { COLORS } from '../../src/constants/theme';
import * as trackerApi from '../../src/api/trackerApi';
import { extractErrorMessage } from '../../src/api/client';

const WORKOUT_TYPES = [
  'WALKING',
  'RUNNING',
  'CYCLING',
  'STRENGTH',
  'SWIMMING',
  'YOGA',
  'HIIT',
  'OTHER',
];

const MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'];

export default function TrackerScreen() {
  const [activeTab, setActiveTab] = useState<'meals' | 'workouts' | 'hydration' | 'sleep'>('meals');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  // ── Meals State ──
  const [meals, setMeals] = useState<trackerApi.Meal[]>([]);
  const [mealQuery, setMealQuery] = useState('');
  const [mealType, setMealType] = useState('LUNCH');
  const [estimating, setEstimating] = useState(false);
  const [estimatedNutrition, setEstimatedNutrition] = useState<trackerApi.NutritionEstimate | null>(null);
  const [manualCalories, setManualCalories] = useState('');
  const [manualProtein, setManualProtein] = useState('');
  const [manualCarbs, setManualCarbs] = useState('');
  const [manualFat, setManualFat] = useState('');

  // ── Workouts State ──
  const [workouts, setWorkouts] = useState<trackerApi.Workout[]>([]);
  const [workoutType, setWorkoutType] = useState('WALKING');
  const [durationMin, setDurationMin] = useState('30');
  const [intensity, setIntensity] = useState('MODERATE');
  const [workoutCalories, setWorkoutCalories] = useState('150');
  const [workoutNotes, setWorkoutNotes] = useState('');

  // ── Hydration State ──
  const [hydrations, setHydrations] = useState<trackerApi.Hydration[]>([]);
  const [customWater, setCustomWater] = useState('');

  // ── Sleep State ──
  const [sleeps, setSleeps] = useState<trackerApi.Sleep[]>([]);
  const [sleepHours, setSleepHours] = useState('7.5');
  const [sleepQuality, setSleepQuality] = useState(4);

  const loadData = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [mRes, wRes, hRes, sRes] = await Promise.all([
        trackerApi.listMeals({ from: todayStr, to: todayStr }),
        trackerApi.listWorkouts({ from: todayStr, to: todayStr }),
        trackerApi.listHydration({ from: todayStr, to: todayStr }),
        trackerApi.listSleep({ from: todayStr, to: todayStr }),
      ]);
      setMeals(mRes.content || []);
      setWorkouts(wRes.content || []);
      setHydrations(hRes.content || []);
      setSleeps(sRes.content || []);
    } catch (err: any) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [todayStr]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Auto-Detect Nutrition Estimate ──
  const handleEstimateNutrition = async () => {
    if (!mealQuery.trim()) {
      Alert.alert('Input Required', 'Please enter what you ate (e.g. "2 rotis and a bowl of dal")');
      return;
    }
    setEstimating(true);
    try {
      const estimate = await trackerApi.estimateNutrition(mealQuery.trim());
      setEstimatedNutrition(estimate);
      setManualCalories(String(estimate.calories || ''));
      setManualProtein(String(estimate.proteinG || ''));
      setManualCarbs(String(estimate.carbsG || ''));
      setManualFat(String(estimate.fatG || ''));
    } catch (err: any) {
      Alert.alert('Detection Notice', extractErrorMessage(err));
    } finally {
      setEstimating(false);
    }
  };

  // ── Log Meal ──
  const handleLogMeal = async () => {
    const foodName = estimatedNutrition?.foodName || mealQuery.trim();
    const cals = Number(manualCalories || estimatedNutrition?.calories || 0);

    if (!foodName || cals <= 0) {
      Alert.alert('Validation', 'Please provide a food description and calories.');
      return;
    }

    try {
      await trackerApi.createMeal({
        date: todayStr,
        mealType,
        name: foodName,
        calories: cals,
        proteinG: manualProtein ? Number(manualProtein) : estimatedNutrition?.proteinG ?? null,
        carbsG: manualCarbs ? Number(manualCarbs) : estimatedNutrition?.carbsG ?? null,
        fatG: manualFat ? Number(manualFat) : estimatedNutrition?.fatG ?? null,
      });

      setMealQuery('');
      setEstimatedNutrition(null);
      setManualCalories('');
      setManualProtein('');
      setManualCarbs('');
      setManualFat('');
      loadData();
      Alert.alert('Logged! 🥗', 'Meal recorded successfully.');
    } catch (err: any) {
      Alert.alert('Error', extractErrorMessage(err));
    }
  };

  const handleDeleteMeal = async (id: number) => {
    try {
      await trackerApi.deleteMeal(id);
      loadData();
    } catch (err: any) {
      Alert.alert('Error', extractErrorMessage(err));
    }
  };

  // ── Log Workout ──
  const handleLogWorkout = async () => {
    const dur = Number(durationMin);
    if (!dur || dur <= 0) {
      Alert.alert('Validation', 'Please enter a valid workout duration.');
      return;
    }

    try {
      await trackerApi.createWorkout({
        date: todayStr,
        type: workoutType,
        durationMin: dur,
        intensity,
        caloriesBurned: workoutCalories ? Number(workoutCalories) : null,
        notes: workoutNotes ? workoutNotes.trim() : null,
      });

      setWorkoutNotes('');
      loadData();
      Alert.alert('Logged! 🏋️', 'Workout logged successfully.');
    } catch (err: any) {
      Alert.alert('Error', extractErrorMessage(err));
    }
  };

  const handleDeleteWorkout = async (id: number) => {
    try {
      await trackerApi.deleteWorkout(id);
      loadData();
    } catch (err: any) {
      Alert.alert('Error', extractErrorMessage(err));
    }
  };

  // ── Log Hydration ──
  const handleAddWater = async (amount: number) => {
    try {
      await trackerApi.createHydration({
        date: todayStr,
        amountMl: amount,
      });
      loadData();
    } catch (err: any) {
      Alert.alert('Error', extractErrorMessage(err));
    }
  };

  const handleDeleteHydration = async (id: number) => {
    try {
      await trackerApi.deleteHydration(id);
      loadData();
    } catch (err: any) {
      Alert.alert('Error', extractErrorMessage(err));
    }
  };

  // ── Log Sleep ──
  const handleLogSleep = async () => {
    const hrs = Number(sleepHours);
    if (!hrs || hrs <= 0) {
      Alert.alert('Validation', 'Please enter valid sleep hours.');
      return;
    }

    try {
      await trackerApi.createSleep({
        date: todayStr,
        hours: hrs,
        quality: sleepQuality,
      });
      loadData();
      Alert.alert('Logged! 🌙', 'Sleep record saved.');
    } catch (err: any) {
      Alert.alert('Error', extractErrorMessage(err));
    }
  };

  const handleDeleteSleep = async (id: number) => {
    try {
      await trackerApi.deleteSleep(id);
      loadData();
    } catch (err: any) {
      Alert.alert('Error', extractErrorMessage(err));
    }
  };

  const totalWater = hydrations.reduce((s, h) => s + (h.amountMl || 0), 0);

  return (
    <View style={styles.screen}>
      <Header title="Daily Tracker" subtitle="Log meals, workouts, water, and sleep" />

      {/* ── Segment Selector Tabs ── */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'meals' && styles.tabItemActive]}
          onPress={() => setActiveTab('meals')}
        >
          <Text style={[styles.tabText, activeTab === 'meals' && styles.tabTextActive]}>
            🥗 Meals
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'workouts' && styles.tabItemActive]}
          onPress={() => setActiveTab('workouts')}
        >
          <Text style={[styles.tabText, activeTab === 'workouts' && styles.tabTextActive]}>
            🏋️ Workouts
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'hydration' && styles.tabItemActive]}
          onPress={() => setActiveTab('hydration')}
        >
          <Text style={[styles.tabText, activeTab === 'hydration' && styles.tabTextActive]}>
            💧 Water
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'sleep' && styles.tabItemActive]}
          onPress={() => setActiveTab('sleep')}
        >
          <Text style={[styles.tabText, activeTab === 'sleep' && styles.tabTextActive]}>
            🌙 Sleep
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* ══════════════════ TAB 1: MEALS ══════════════════ */}
        {activeTab === 'meals' && (
          <View>
            <View style={styles.formCard}>
              <Text style={styles.cardHeader}>Log a Meal</Text>
              <Text style={styles.cardSub}>
                Type what you ate in natural language and let AI auto-calculate calories & macros!
              </Text>

              {/* Meal Type Picker */}
              <View style={styles.pillRow}>
                {MEAL_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.pill, mealType === t && styles.pillActive]}
                    onPress={() => setMealType(t)}
                  >
                    <Text style={[styles.pillText, mealType === t && styles.pillTextActive]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Input
                label="What did you eat?"
                placeholder="e.g. 2 parathas with curd and 1 cup chai"
                value={mealQuery}
                onChangeText={setMealQuery}
              />

              <Button
                title={estimating ? 'Detecting...' : 'Auto-Detect Nutrition ✨'}
                onPress={handleEstimateNutrition}
                loading={estimating}
                variant="secondary"
                style={styles.detectBtn}
              />

              {/* Nutrition Preview Badge */}
              {estimatedNutrition && (
                <View style={styles.previewCard}>
                  <View style={styles.previewHeader}>
                    <Text style={styles.previewTitle}>Detected: {estimatedNutrition.foodName}</Text>
                    <View style={styles.sourcePill}>
                      <Text style={styles.sourceText}>{estimatedNutrition.source}</Text>
                    </View>
                  </View>

                  <View style={styles.macroRow}>
                    <View style={styles.macroCol}>
                      <Text style={styles.macroNum}>{estimatedNutrition.calories}</Text>
                      <Text style={styles.macroLabel}>kcal</Text>
                    </View>
                    <View style={styles.macroCol}>
                      <Text style={styles.macroNum}>{estimatedNutrition.proteinG}g</Text>
                      <Text style={styles.macroLabel}>Protein</Text>
                    </View>
                    <View style={styles.macroCol}>
                      <Text style={styles.macroNum}>{estimatedNutrition.carbsG}g</Text>
                      <Text style={styles.macroLabel}>Carbs</Text>
                    </View>
                    <View style={styles.macroCol}>
                      <Text style={styles.macroNum}>{estimatedNutrition.fatG}g</Text>
                      <Text style={styles.macroLabel}>Fat</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Manual adjustments */}
              <View style={styles.macroInputsRow}>
                <Input
                  label="Calories (kcal)"
                  placeholder="0"
                  value={manualCalories}
                  onChangeText={setManualCalories}
                  keyboardType="numeric"
                  containerStyle={styles.halfInput}
                />
                <Input
                  label="Protein (g)"
                  placeholder="0"
                  value={manualProtein}
                  onChangeText={setManualProtein}
                  keyboardType="numeric"
                  containerStyle={styles.halfInput}
                />
              </View>

              <Button
                title="Save Meal"
                onPress={handleLogMeal}
                style={styles.saveBtn}
              />
            </View>

            {/* Meals List */}
            <Text style={styles.listSectionTitle}>Today's Meals ({meals.length})</Text>
            {meals.map((m) => (
              <View key={m.id} style={styles.listItem}>
                <View style={styles.listMain}>
                  <View style={styles.badgeRow}>
                    <Text style={styles.mealBadge}>{m.mealType}</Text>
                  </View>
                  <Text style={styles.itemTitle}>{m.name}</Text>
                  <Text style={styles.itemSub}>
                    {m.calories} kcal
                    {m.proteinG ? ` • ${m.proteinG}g protein` : ''}
                    {m.carbsG ? ` • ${m.carbsG}g carbs` : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => m.id && handleDeleteMeal(m.id)}
                  style={styles.deleteBtn}
                >
                  <Text style={styles.deleteText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            {meals.length === 0 && !loading ? (
              <Text style={styles.emptyText}>No meals logged yet today.</Text>
            ) : null}
          </View>
        )}

        {/* ══════════════════ TAB 2: WORKOUTS ══════════════════ */}
        {activeTab === 'workouts' && (
          <View>
            <View style={styles.formCard}>
              <Text style={styles.cardHeader}>Log a Workout</Text>

              {/* Type Grid */}
              <Text style={styles.label}>Activity Type:</Text>
              <View style={styles.typeGrid}>
                {WORKOUT_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typePill, workoutType === t && styles.typePillActive]}
                    onPress={() => setWorkoutType(t)}
                  >
                    <Text style={[styles.typeText, workoutType === t && styles.typeTextActive]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.row}>
                <Input
                  label="Duration (minutes)"
                  placeholder="30"
                  value={durationMin}
                  onChangeText={setDurationMin}
                  keyboardType="numeric"
                  containerStyle={styles.halfInput}
                />
                <Input
                  label="Calories Burned"
                  placeholder="150"
                  value={workoutCalories}
                  onChangeText={setWorkoutCalories}
                  keyboardType="numeric"
                  containerStyle={styles.halfInput}
                />
              </View>

              <Input
                label="Notes (Optional)"
                placeholder="e.g. morning brisk walk"
                value={workoutNotes}
                onChangeText={setWorkoutNotes}
              />

              <Button
                title="Save Workout"
                onPress={handleLogWorkout}
                style={styles.saveBtn}
              />
            </View>

            {/* Workouts List */}
            <Text style={styles.listSectionTitle}>Today's Workouts ({workouts.length})</Text>
            {workouts.map((w) => (
              <View key={w.id} style={styles.listItem}>
                <View style={styles.listMain}>
                  <View style={styles.badgeRow}>
                    <Text style={styles.workoutBadge}>{w.type}</Text>
                    {w.intensity ? <Text style={styles.intensityBadge}>{w.intensity}</Text> : null}
                  </View>
                  <Text style={styles.itemTitle}>{w.durationMin} mins</Text>
                  <Text style={styles.itemSub}>
                    {w.caloriesBurned ? `${w.caloriesBurned} kcal burned` : ''}
                    {w.notes ? ` • ${w.notes}` : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => w.id && handleDeleteWorkout(w.id)}
                  style={styles.deleteBtn}
                >
                  <Text style={styles.deleteText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            {workouts.length === 0 && !loading ? (
              <Text style={styles.emptyText}>No workouts logged yet today.</Text>
            ) : null}
          </View>
        )}

        {/* ══════════════════ TAB 3: HYDRATION ══════════════════ */}
        {activeTab === 'hydration' && (
          <View>
            <View style={styles.formCard}>
              <Text style={styles.cardHeader}>Daily Water Intake</Text>
              <Text style={styles.waterTotal}>{totalWater} ml</Text>
              <Text style={styles.cardSub}>Target: 2,500 ml per day</Text>

              <View style={styles.quickWaterRow}>
                <TouchableOpacity
                  style={styles.waterBtn}
                  onPress={() => handleAddWater(250)}
                >
                  <Text style={styles.waterBtnEmoji}>🥛</Text>
                  <Text style={styles.waterBtnText}>+250 ml</Text>
                  <Text style={styles.waterBtnSub}>Glass</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.waterBtn}
                  onPress={() => handleAddWater(500)}
                >
                  <Text style={styles.waterBtnEmoji}>🍶</Text>
                  <Text style={styles.waterBtnText}>+500 ml</Text>
                  <Text style={styles.waterBtnSub}>Bottle</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.waterBtn}
                  onPress={() => handleAddWater(1000)}
                >
                  <Text style={styles.waterBtnEmoji}>🚰</Text>
                  <Text style={styles.waterBtnText}>+1,000 ml</Text>
                  <Text style={styles.waterBtnSub}>Jug</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.listSectionTitle}>Today's Water Entries ({hydrations.length})</Text>
            {hydrations.map((h) => (
              <View key={h.id} style={styles.listItem}>
                <View style={styles.listMain}>
                  <Text style={styles.itemTitle}>+{h.amountMl} ml</Text>
                  <Text style={styles.itemSub}>{h.date}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => h.id && handleDeleteHydration(h.id)}
                  style={styles.deleteBtn}
                >
                  <Text style={styles.deleteText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* ══════════════════ TAB 4: SLEEP ══════════════════ */}
        {activeTab === 'sleep' && (
          <View>
            <View style={styles.formCard}>
              <Text style={styles.cardHeader}>Log Sleep</Text>

              <Input
                label="Sleep Duration (hours)"
                placeholder="7.5"
                value={sleepHours}
                onChangeText={setSleepHours}
                keyboardType="numeric"
              />

              <Text style={styles.label}>Sleep Quality:</Text>
              <View style={styles.qualityRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    style={[styles.starBtn, sleepQuality === star && styles.starBtnActive]}
                    onPress={() => setSleepQuality(star)}
                  >
                    <Text style={styles.starText}>{star} ★</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Button
                title="Save Sleep Record"
                onPress={handleLogSleep}
                style={styles.saveBtn}
              />
            </View>

            <Text style={styles.listSectionTitle}>Today's Sleep Record</Text>
            {sleeps.map((s) => (
              <View key={s.id} style={styles.listItem}>
                <View style={styles.listMain}>
                  <Text style={styles.itemTitle}>{s.hours} Hours</Text>
                  <Text style={styles.itemSub}>Quality: {s.quality ?? 3}/5 ★</Text>
                </View>
                <TouchableOpacity
                  onPress={() => s.id && handleDeleteSleep(s.id)}
                  style={styles.deleteBtn}
                >
                  <Text style={styles.deleteText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            {sleeps.length === 0 && !loading ? (
              <Text style={styles.emptyText}>No sleep recorded for today.</Text>
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
  container: {
    padding: 16,
    paddingTop: 8,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabItemActive: {
    backgroundColor: COLORS.primaryLight,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  tabTextActive: {
    color: COLORS.primaryDark,
  },
  errorBox: {
    backgroundColor: COLORS.dangerLight,
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  formCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  cardHeader: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 4,
  },
  cardSub: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: 16,
    lineHeight: 18,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pillActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  pillTextActive: {
    color: COLORS.primaryDark,
  },
  detectBtn: {
    marginBottom: 14,
  },
  previewCard: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1.5,
    borderColor: '#bbf7d0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primaryDark,
    flex: 1,
  },
  sourcePill: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sourceText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroCol: {
    alignItems: 'center',
  },
  macroNum: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.text,
  },
  macroLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  macroInputsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  saveBtn: {
    marginTop: 6,
  },
  listSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 10,
  },
  listItem: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  listMain: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 4,
  },
  mealBadge: {
    backgroundColor: '#fef3c7',
    color: '#b45309',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  workoutBadge: {
    backgroundColor: '#dbeafe',
    color: '#1d4ed8',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  intensityBadge: {
    backgroundColor: '#ede9fe',
    color: '#6d28d9',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  itemSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  deleteBtn: {
    padding: 8,
  },
  deleteText: {
    fontSize: 16,
    color: COLORS.danger,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginVertical: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  typePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  typePillActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  typeTextActive: {
    color: COLORS.primaryDark,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  waterTotal: {
    fontSize: 36,
    fontWeight: '900',
    color: COLORS.info,
    marginVertical: 4,
  },
  quickWaterRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  waterBtn: {
    flex: 1,
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
    borderColor: '#bfdbfe',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  waterBtnEmoji: {
    fontSize: 22,
    marginBottom: 4,
  },
  waterBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  waterBtnSub: {
    fontSize: 11,
    color: '#60a5fa',
    marginTop: 2,
  },
  qualityRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  starBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  starBtnActive: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
  },
  starText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#b45309',
  },
});
