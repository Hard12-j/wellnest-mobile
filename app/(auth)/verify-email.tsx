import React, { useState, useEffect } from 'react';
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

export default function VerifyEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { verifyEmail, resendOtp } = useAuth();

  const [username, setUsername] = useState((params.username as string) || '');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleVerify = async () => {
    if (!username.trim() || !otp.trim()) {
      setError('Please enter your email and verification code.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const res = await verifyEmail({
        username: username.trim(),
        otp: otp.trim(),
      });

      Alert.alert('Email Verified! ✨', res.message || 'You can now log in to WellNest.', [
        {
          text: 'Proceed to Login',
          onPress: () => router.replace('/(auth)/login'),
        },
      ]);
    } catch (err: any) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!username.trim()) {
      setError('Please provide your username/email to resend code.');
      return;
    }

    setError(null);
    setResending(true);
    try {
      const res = await resendOtp({ username: username.trim() });
      setSuccess(res.message || 'Verification code resent. Check your inbox!');
      setCooldown(60);
    } catch (err: any) {
      setError(extractErrorMessage(err));
    } finally {
      setResending(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Text style={styles.icon}>✉️</Text>
        </View>
        <Text style={styles.title}>Verify Email</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit OTP code sent to your email address.
        </Text>
      </View>

      <View style={styles.card}>
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {success ? (
          <View style={styles.successBox}>
            <Text style={styles.successText}>{success}</Text>
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
          label="6-Digit Verification Code"
          placeholder="e.g. 123456"
          value={otp}
          onChangeText={(t) => { setOtp(t); setError(null); }}
          keyboardType="number-pad"
          maxLength={6}
          style={styles.otpInput}
        />

        <Button
          title="Verify & Continue"
          onPress={handleVerify}
          loading={loading}
          style={styles.verifyBtn}
        />

        <View style={styles.resendContainer}>
          <Text style={styles.resendText}>Didn't receive code? </Text>
          <TouchableOpacity
            disabled={cooldown > 0 || resending}
            onPress={handleResend}
          >
            <Text style={[styles.resendLink, cooldown > 0 && styles.resendDisabled]}>
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.replace('/(auth)/login')}
        >
          <Text style={styles.backLink}>Back to Login</Text>
        </TouchableOpacity>
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
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  icon: {
    fontSize: 28,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
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
  successBox: {
    backgroundColor: COLORS.primaryLight,
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  successText: {
    color: COLORS.primaryDark,
    fontSize: 13,
    fontWeight: '600',
  },
  otpInput: {
    fontSize: 20,
    letterSpacing: 6,
    textAlign: 'center',
    fontWeight: '800',
  },
  verifyBtn: {
    marginTop: 8,
    marginBottom: 20,
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  resendText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  resendLink: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  resendDisabled: {
    color: COLORS.textLight,
  },
  backBtn: {
    alignItems: 'center',
  },
  backLink: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
});

