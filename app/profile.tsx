import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Input } from '../src/components/Input';
import { Button } from '../src/components/Button';
import { COLORS } from '../src/constants/theme';
import { useAuth } from '../src/context/AuthContext';
import * as profileApi from '../src/api/profileApi';
import { GATEWAY_URL, extractErrorMessage } from '../src/api/client';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<profileApi.Profile | null>(null);
  const [bmi, setBmi] = useState<profileApi.BmiResponse | null>(null);

  // Form fields
  const [age, setAge] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [targetWeightKg, setTargetWeightKg] = useState('');
  const [fitnessGoal, setFitnessGoal] = useState('WEIGHT_LOSS');

  const loadProfile = useCallback(async () => {
    setError(null);
    try {
      const [pRes, bRes] = await Promise.all([
        profileApi.getProfile().catch(() => null),
        profileApi.getBmi().catch(() => null),
      ]);

      if (pRes) {
        setProfile(pRes);
        setAge(pRes.age ? String(pRes.age) : '');
        setHeightCm(pRes.heightCm ? String(pRes.heightCm) : '');
        setWeightKg(pRes.weightKg ? String(pRes.weightKg) : '');
        setTargetWeightKg(pRes.targetWeightKg ? String(pRes.targetWeightKg) : '');
        setFitnessGoal(pRes.fitnessGoal || 'MAINTENANCE');
      }
      setBmi(bRes);
    } catch (err: any) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const updated = await profileApi.updateProfile({
        age: age ? Number(age) : null,
        heightCm: heightCm ? Number(heightCm) : null,
        weightKg: weightKg ? Number(weightKg) : null,
        targetWeightKg: targetWeightKg ? Number(targetWeightKg) : null,
        fitnessGoal,
      });

      setProfile(updated);
      setEditing(false);
      loadProfile();
      Alert.alert('Success! 👤', 'Your fitness profile was updated.');
    } catch (err: any) {
      Alert.alert('Update Failed', extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to log out of WellNest?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      {/* ── Top Bar with Back Navigation ── */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.screenTitle}>My Profile</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {/* ── User Overview Card ── */}
        <View style={styles.userCard}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>
              {(user?.first?.[0] || 'U').toUpperCase()}
            </Text>
          </View>

          <Text style={styles.userName}>
            {user?.first} {user?.last}
          </Text>
          <Text style={styles.userHandle}>@{user?.username}</Text>

          <View style={styles.pillRow}>
            <View style={styles.rolePill}>
              <Text style={styles.roleText}>{user?.role || 'USER'}</Text>
            </View>
            <View style={[styles.verifiedPill, user?.verifiedUser ? styles.verifiedGreen : styles.verifiedYellow]}>
              <Text style={[styles.verifiedText, user?.verifiedUser ? styles.textGreen : styles.textYellow]}>
                {user?.verifiedUser ? '✓ Verified' : 'Pending Verification'}
              </Text>
            </View>
          </View>
        </View>

        {loading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading profile data...</Text>
          </View>
        ) : (
          <>
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* ── BMI Guidance Card ── */}
            {bmi ? (
              <View style={styles.bmiCard}>
                <View style={styles.bmiTop}>
                  <Text style={styles.bmiLabel}>BODY MASS INDEX (BMI)</Text>
                  <View style={styles.bmiCategoryPill}>
                    <Text style={styles.bmiCategoryText}>{bmi.category}</Text>
                  </View>
                </View>
                <Text style={styles.bmiNum}>{bmi.bmi?.toFixed(1) ?? '--'}</Text>
                <Text style={styles.bmiGuidance}>{bmi.guidance}</Text>
                {bmi.kgToTarget ? (
                  <Text style={styles.bmiTargetSub}>
                    Difference to target weight: {bmi.kgToTarget > 0 ? `+${bmi.kgToTarget}` : bmi.kgToTarget} kg
                  </Text>
                ) : null}
              </View>
            ) : null}

            {/* ── Fitness Profile Metrics Card ── */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Fitness Profile</Text>
                <TouchableOpacity onPress={() => setEditing(!editing)}>
                  <Text style={styles.editLink}>{editing ? 'Cancel' : 'Edit'}</Text>
                </TouchableOpacity>
              </View>

              {editing ? (
                <View style={styles.formContainer}>
                  <View style={styles.inputRow}>
                    <Input
                      label="Age (years)"
                      placeholder="25"
                      value={age}
                      onChangeText={setAge}
                      keyboardType="numeric"
                      containerStyle={styles.halfInput}
                    />
                    <Input
                      label="Height (cm)"
                      placeholder="175"
                      value={heightCm}
                      onChangeText={setHeightCm}
                      keyboardType="numeric"
                      containerStyle={styles.halfInput}
                    />
                  </View>

                  <View style={styles.inputRow}>
                    <Input
                      label="Current Weight (kg)"
                      placeholder="70"
                      value={weightKg}
                      onChangeText={setWeightKg}
                      keyboardType="numeric"
                      containerStyle={styles.halfInput}
                    />
                    <Input
                      label="Target Weight (kg)"
                      placeholder="65"
                      value={targetWeightKg}
                      onChangeText={setTargetWeightKg}
                      keyboardType="numeric"
                      containerStyle={styles.halfInput}
                    />
                  </View>

                  <Text style={styles.goalLabel}>Fitness Goal:</Text>
                  <View style={styles.goalPillRow}>
                    {['WEIGHT_LOSS', 'MAINTENANCE', 'MUSCLE_GAIN'].map((g) => (
                      <TouchableOpacity
                        key={g}
                        style={[styles.goalPill, fitnessGoal === g && styles.goalPillActive]}
                        onPress={() => setFitnessGoal(g)}
                      >
                        <Text style={[styles.goalPillText, fitnessGoal === g && styles.goalPillTextActive]}>
                          {g.replace('_', ' ')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Button
                    title="Save Changes"
                    onPress={handleSaveProfile}
                    loading={saving}
                    style={styles.saveBtn}
                  />
                </View>
              ) : (
                <View style={styles.statsGrid}>
                  <View style={styles.statCol}>
                    <Text style={styles.statVal}>{profile?.age || '--'}</Text>
                    <Text style={styles.statLbl}>Age</Text>
                  </View>
                  <View style={styles.statCol}>
                    <Text style={styles.statVal}>{profile?.heightCm ? `${profile.heightCm} cm` : '--'}</Text>
                    <Text style={styles.statLbl}>Height</Text>
                  </View>
                  <View style={styles.statCol}>
                    <Text style={styles.statVal}>{profile?.weightKg ? `${profile.weightKg} kg` : '--'}</Text>
                    <Text style={styles.statLbl}>Current</Text>
                  </View>
                  <View style={styles.statCol}>
                    <Text style={styles.statVal}>{profile?.targetWeightKg ? `${profile.targetWeightKg} kg` : '--'}</Text>
                    <Text style={styles.statLbl}>Target</Text>
                  </View>
                </View>
              )}
            </View>

            {/* ── App Info ── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Backend Gateway</Text>
              <Text style={styles.gatewayText}>{GATEWAY_URL}</Text>
              <Text style={styles.versionText}>WellNest Mobile • v1.0.0 (Expo SDK 58)</Text>
            </View>

            {/* ── Logout Button ── */}
            <Button
              title="Sign Out"
              onPress={handleLogout}
              variant="outline"
              style={styles.logoutBtn}
              textStyle={{ color: COLORS.danger }}
            />
          </>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  backBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },
  screenTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
  },
  container: {
    padding: 16,
    paddingBottom: 32,
  },
  centerLoading: {
    alignItems: 'center',
    paddingVertical: 50,
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
  userCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  userAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 3,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  userAvatarText: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
  },
  userHandle: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  rolePill: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textSecondary,
  },
  verifiedPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  verifiedGreen: {
    backgroundColor: '#dcfce7',
  },
  verifiedYellow: {
    backgroundColor: '#fef3c7',
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '800',
  },
  textGreen: {
    color: '#15803d',
  },
  textYellow: {
    color: '#b45309',
  },
  bmiCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  bmiTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  bmiLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
  },
  bmiCategoryPill: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  bmiCategoryText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#b45309',
  },
  bmiNum: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: 4,
  },
  bmiGuidance: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  bmiTargetSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 6,
    fontWeight: '600',
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  editLink: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCol: {
    alignItems: 'center',
    flex: 1,
  },
  statVal: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  statLbl: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  formContainer: {
    marginTop: 4,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  goalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  goalPillRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  goalPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  goalPillActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  goalPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  goalPillTextActive: {
    color: COLORS.primaryDark,
  },
  saveBtn: {
    marginTop: 6,
  },
  gatewayText: {
    fontSize: 12,
    color: COLORS.primaryDark,
    fontWeight: '600',
    backgroundColor: COLORS.primaryLight,
    padding: 8,
    borderRadius: 8,
    marginVertical: 8,
  },
  versionText: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  logoutBtn: {
    borderColor: '#fecaca',
    backgroundColor: '#fff5f5',
    marginTop: 8,
  },
});

