import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { COLORS } from '../../src/constants/theme';
import { extractErrorMessage } from '../../src/api/client';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { forgotPassword } = useAuth();

  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequestOtp = async () => {
    if (!username.trim()) {
      setError('Please enter your email or username.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const res = await forgotPassword({ username: username.trim() });
      Alert.alert(
        'Code Sent! 📬',
        res.message || 'If an account exists, a password reset code has been sent.',
        [
          {
            text: 'Enter Code',
            onPress: () => router.push({
              pathname: '/(auth)/reset-password',
              params: { username: username.trim() },
            }),
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
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>
          Enter your username or email address and we will send you a verification code.
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
          placeholder="your username or email"
          value={username}
          onChangeText={(t) => { setUsername(t); setError(null); }}
          autoCapitalize="none"
        />

        <Button
          title="Send Reset Code"
          onPress={handleRequestOtp}
          loading={loading}
          style={styles.submitBtn}
        />

        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={() => router.back()}
        >
          <Text style={styles.cancelText}>Cancel</Text>
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
    marginBottom: 16,
  },
  cancelBtn: {
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
});
