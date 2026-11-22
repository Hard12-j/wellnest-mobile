import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { COLORS } from '../../src/constants/theme';
import { extractErrorMessage } from '../../src/api/client';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { resetPassword } = useAuth();

  const [username, setUsername] = useState((params.username as string) || '');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReset = async () => {
    if (!username.trim() || !otp.trim() || !newPassword) {
      setError('Please fill in all fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const res = await resetPassword({
        username: username.trim(),
        otp: otp.trim(),
        newPassword,
      });

      Alert.alert(
        'Password Updated! 🔒',
        res.message || 'You can now log in with your new password.',
        [
          {
            text: 'Sign In Now',
            onPress: () => router.replace('/(auth)/login'),
          },
        ]
      );
    } catch (err: any) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Set New Password</Text>
        <Text style={styles.subtitle}>
          Enter the reset code sent to your email and your new password.
        </Text>
      </View>

      <View style={styles.card}>
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Input
          label="Email or Username"
          placeholder="your email"
          value={username}
          onChangeText={(t) => { setUsername(t); setError(null); }}
          autoCapitalize="none"
          editable={!params.username}
        />

        <Input
          label="Verification Code (OTP)"
          placeholder="e.g. 123456"
          value={otp}
          onChangeText={(t) => { setOtp(t); setError(null); }}
          keyboardType="number-pad"
        />

        <Input
          label="New Password"
          placeholder="At least 6 characters"
          value={newPassword}
          onChangeText={(t) => { setNewPassword(t); setError(null); }}
          secureTextEntry
        />

        <Input
          label="Confirm New Password"
          placeholder="Repeat new password"
          value={confirmPassword}
          onChangeText={(t) => { setConfirmPassword(t); setError(null); }}
          secureTextEntry
        />

        <Button
          title="Update Password"
          onPress={handleReset}
          loading={loading}
          style={styles.submitBtn}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: COLORS.bg,
  },
  header: {
    marginBottom: 24,
  },
  backBtn: {
    marginBottom: 12,
  },
  backText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
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
  submitBtn: {
    marginTop: 8,
  },
});

