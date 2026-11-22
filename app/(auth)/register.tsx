import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { COLORS } from '../../src/constants/theme';
import { extractErrorMessage } from '../../src/api/client';

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();

  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'USER' | 'TRAINER'>('USER');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    if (!first.trim() || !last.trim() || !username.trim() || !password || !confirmPassword) {
      setError('Please fill out all fields.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const res = await register({
        first: first.trim(),
        last: last.trim(),
        username: username.trim(),
        password,
        confirmPassword,
        role,
      });

      Alert.alert(
        'Registration Successful! 🎉',
        res.message || 'Please enter the verification code sent to your email.',
        [
          {
            text: 'Verify Code',
            onPress: () => router.push({
              pathname: '/(auth)/verify-email',
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardContainer}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join WellNest to track workouts, nutrition & sleep</Text>
        </View>

        <View style={styles.card}>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorBoxText}>{error}</Text>
            </View>
          ) : null}

          {/* Role Selector */}
          <Text style={styles.label}>I am a:</Text>
          <View style={styles.roleContainer}>
            <TouchableOpacity
              style={[styles.roleOption, role === 'USER' && styles.roleOptionActive]}
              onPress={() => setRole('USER')}
            >
              <Text style={[styles.roleText, role === 'USER' && styles.roleTextActive]}>
                🏃 Regular User
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.roleOption, role === 'TRAINER' && styles.roleOptionActive]}
              onPress={() => setRole('TRAINER')}
            >
              <Text style={[styles.roleText, role === 'TRAINER' && styles.roleTextActive]}>
                🏋️ Fitness Trainer
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.nameRow}>
            <Input
              label="First Name"
              placeholder="e.g. John"
              value={first}
              onChangeText={(t) => { setFirst(t); setError(null); }}
              containerStyle={styles.halfInput}
            />
            <Input
              label="Last Name"
              placeholder="e.g. Doe"
              value={last}
              onChangeText={(t) => { setLast(t); setError(null); }}
              containerStyle={styles.halfInput}
            />
          </View>

          <Input
            label="Email or Username"
            placeholder="e.g. john@example.com"
            value={username}
            onChangeText={(t) => { setUsername(t); setError(null); }}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Input
            label="Password"
            placeholder="At least 6 characters"
            value={password}
            onChangeText={(t) => { setPassword(t); setError(null); }}
            secureTextEntry
          />

          <Input
            label="Confirm Password"
            placeholder="Repeat your password"
            value={confirmPassword}
            onChangeText={(t) => { setConfirmPassword(t); setError(null); }}
            secureTextEntry
          />

          <Button
            title="Create My Account"
            onPress={handleRegister}
            loading={loading}
            style={styles.submitBtn}
          />

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already registered? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.loginLink}>Log In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  container: {
    flexGrow: 1,
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  header: {
    marginBottom: 20,
  },
  backBtn: {
    marginBottom: 12,
  },
  backBtnText: {
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
    borderLeftWidth: 4,
    borderLeftColor: COLORS.danger,
  },
  errorBoxText: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  roleContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  roleOption: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  roleOptionActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  roleText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  roleTextActive: {
    color: COLORS.primaryDark,
    fontWeight: '700',
  },
  nameRow: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  submitBtn: {
    marginTop: 8,
    marginBottom: 20,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  loginLink: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
});
