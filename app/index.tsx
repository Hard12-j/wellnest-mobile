import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import {
  initialize,
  getSdkStatus,
  requestPermission,
  readRecords,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';

export default function HomeScreen() {
  const [loading, setLoading] = useState(false);
  const [steps, setSteps] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Press button to fetch today\'s steps.');

  const handleReadSteps = async () => {
    setLoading(true);
    setStatusMessage('Checking Health Connect status...');
    try {
      // 1. Check SDK availability
      const sdkStatus = await getSdkStatus();
      if (sdkStatus === SdkAvailabilityStatus.SDK_UNAVAILABLE) {
        setStatusMessage('Health Connect is not available on this device.');
        Alert.alert('Health Connect Unavailable', 'This device does not support Health Connect.');
        return;
      }
      if (sdkStatus === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
        setStatusMessage('Health Connect needs to be installed or updated.');
        Alert.alert('Update Required', 'Please install or update Health Connect from the Google Play Store.');
        return;
      }

      // 2. Initialize Health Connect
      setStatusMessage('Initializing Health Connect...');
      const isInitialized = await initialize();
      if (!isInitialized) {
        setStatusMessage('Failed to initialize Health Connect.');
        return;
      }

      // 3. Request permissions for Steps
      setStatusMessage('Requesting Steps permission...');
      const grantedPermissions = await requestPermission([
        { accessType: 'read', recordType: 'Steps' },
      ]);

      const hasStepsPermission = grantedPermissions.some(
        (perm) => perm.recordType === 'Steps' && perm.accessType === 'read'
      );

      if (!hasStepsPermission) {
        setStatusMessage('Steps permission was not granted.');
        Alert.alert('Permission Required', 'Please grant permission to read step count from Health Connect.');
        return;
      }

      // 4. Query today's steps (from 00:00:00 today to current time)
      setStatusMessage('Reading today\'s steps...');
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

      const result = await readRecords('Steps', {
        timeRangeFilter: {
          operator: 'between',
          startTime: startOfDay.toISOString(),
          endTime: now.toISOString(),
        },
      });

      // Sum all step count records for today
      const totalSteps = result.records.reduce((sum, record) => sum + (record.count || 0), 0);

      setSteps(totalSteps);
      setStatusMessage(`Successfully synced! Found ${result.records.length} step records today.`);
    } catch (error: any) {
      console.error('Health Connect error:', error);
      setStatusMessage(`Error: ${error?.message || 'Unknown error occurred'}`);
      Alert.alert('Error', error?.message || 'Failed to read Health Connect steps.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>HEALTH CONNECT TEST</Text>
        </View>

        <Text style={styles.title}>Daily Step Counter</Text>
        <Text style={styles.subtitle}>
          Connects directly to Android Health Connect to read your physical device activity.
        </Text>

        <View style={styles.stepsDisplay}>
          <Text style={styles.stepsNumber}>
            {steps !== null ? steps.toLocaleString() : '---'}
          </Text>
          <Text style={styles.stepsUnit}>steps today</Text>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleReadSteps}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.buttonText}>Read Today's Steps</Text>
          )}
        </TouchableOpacity>

        <View style={styles.statusBox}>
          <Text style={styles.statusLabel}>Status:</Text>
          <Text style={styles.statusText}>{statusMessage}</Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Verification Instructions</Text>
        <Text style={styles.infoText}>
          1. When prompted, grant "Steps (read)" access.{'\n'}
          2. If Health Connect has steps logged from your smartwatch or phone sensors, they will appear above.{'\n'}
          3. Once verified, we will proceed to Step 2 (full auth & tabs).
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#f8fafc',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    alignItems: 'center',
  },
  badge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 12,
  },
  badgeText: {
    color: '#15803d',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  stepsDisplay: {
    backgroundColor: '#f0fdf4',
    borderWidth: 2,
    borderColor: '#86efac',
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 32,
    alignItems: 'center',
    width: '100%',
    marginBottom: 24,
  },
  stepsNumber: {
    fontSize: 48,
    fontWeight: '900',
    color: '#16a34a',
  },
  stepsUnit: {
    fontSize: 15,
    fontWeight: '600',
    color: '#15803d',
    marginTop: 4,
  },
  button: {
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    backgroundColor: '#86efac',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  statusBox: {
    width: '100%',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 12,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 2,
  },
  statusText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  infoCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#16a34a',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 20,
  },
});

