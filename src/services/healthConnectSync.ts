import {
  initialize,
  getSdkStatus,
  requestPermission,
  readRecords,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import * as trackerApi from '../api/trackerApi';

export interface SyncResult {
  success: boolean;
  stepsSynced: number;
  sleepHoursSynced: number;
  message: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Reads today's step count directly from Health Connect (if available and permissions granted).
 * Non-destructive: does not post to backend.
 */
export const getTodayStepsFromHealthConnect = async (): Promise<number> => {
  try {
    const sdkStatus = await getSdkStatus();
    if (sdkStatus === SdkAvailabilityStatus.SDK_UNAVAILABLE) {
      return 0;
    }

    const isInitialized = await initialize();
    if (!isInitialized) return 0;

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

    const stepsResult = await readRecords('Steps', {
      timeRangeFilter: {
        operator: 'between',
        startTime: startOfDay.toISOString(),
        endTime: now.toISOString(),
      },
    });

    return stepsResult.records.reduce((sum, r) => sum + (r.count || 0), 0);
  } catch {
    return 0;
  }
};

export const syncHealthConnect = async (): Promise<SyncResult> => {
  // 1. Check SDK availability
  const sdkStatus = await getSdkStatus();
  if (sdkStatus === SdkAvailabilityStatus.SDK_UNAVAILABLE) {
    return {
      success: false,
      stepsSynced: 0,
      sleepHoursSynced: 0,
      message: 'Health Connect is not available on this device.',
    };
  }

  // 2. Initialize
  const isInitialized = await initialize();
  if (!isInitialized) {
    return {
      success: false,
      stepsSynced: 0,
      sleepHoursSynced: 0,
      message: 'Failed to initialize Health Connect SDK.',
    };
  }

  // 3. Request permissions
  const grantedPermissions = await requestPermission([
    { accessType: 'read', recordType: 'Steps' },
    { accessType: 'read', recordType: 'SleepSession' },
  ]);

  const hasStepsPerm = grantedPermissions.some(
    (p) => p.recordType === 'Steps' && p.accessType === 'read'
  );
  const hasSleepPerm = grantedPermissions.some(
    (p) => p.recordType === 'SleepSession' && p.accessType === 'read'
  );

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;
  const startOfDay = new Date(year, now.getMonth(), now.getDate(), 0, 0, 0);

  let totalSteps = 0;
  let totalSleepHours = 0;

  // ── A. Read Steps ──
  if (hasStepsPerm) {
    try {
      const stepsResult = await readRecords('Steps', {
        timeRangeFilter: {
          operator: 'between',
          startTime: startOfDay.toISOString(),
          endTime: now.toISOString(),
        },
      });

      totalSteps = stepsResult.records.reduce((sum, r) => sum + (r.count || 0), 0);

      if (totalSteps > 0) {
        // Fetch existing workouts for today to check if steps already synced
        const existingWorkouts = await trackerApi.listWorkouts({ from: todayStr, to: todayStr });
        const alreadySynced = existingWorkouts.content?.find(
          (w) => w.notes?.includes('source:healthconnect')
        );

        // 100 steps ~ 1 min walking, 1 step ~ 0.04 kcal
        const duration = Math.max(1, Math.round(totalSteps / 100));
        const calories = Math.max(1, Math.round(totalSteps * 0.04));

        if (alreadySynced && alreadySynced.id) {
          // If already synced, delete old entry so we can write the updated step count
          await trackerApi.deleteWorkout(alreadySynced.id);
          await sleep(200);
        }

        await trackerApi.createWorkout({
          date: todayStr,
          type: 'WALKING',
          durationMin: duration,
          intensity: 'MODERATE',
          caloriesBurned: calories,
          notes: `source:healthconnect - ${totalSteps.toLocaleString()} steps`,
        });
      }
    } catch (err: any) {
      console.warn('Steps sync error:', err?.message);
    }
  }

  await sleep(250);

  // ── B. Read Sleep ──
  if (hasSleepPerm) {
    try {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const sleepResult = await readRecords('SleepSession', {
        timeRangeFilter: {
          operator: 'between',
          startTime: yesterday.toISOString(),
          endTime: now.toISOString(),
        },
      });

      // Sum sleep durations in hours
      let sleepMinutes = 0;
      sleepResult.records.forEach((s) => {
        const start = new Date(s.startTime).getTime();
        const end = new Date(s.endTime).getTime();
        if (end > start) {
          sleepMinutes += (end - start) / (1000 * 60);
        }
      });

      if (sleepMinutes > 0) {
        totalSleepHours = Number((sleepMinutes / 60).toFixed(1));

        // Idempotency: check if sleep logged for today
        const existingSleep = await trackerApi.listSleep({ from: todayStr, to: todayStr });
        if (!existingSleep.content || existingSleep.content.length === 0) {
          await trackerApi.createSleep({
            date: todayStr,
            hours: totalSleepHours,
            quality: 4,
          });
        }
      }
    } catch (err: any) {
      console.warn('Sleep sync error:', err?.message);
    }
  }

  return {
    success: true,
    stepsSynced: totalSteps,
    sleepHoursSynced: totalSleepHours,
    message: `Sync successful! ${totalSteps.toLocaleString()} steps and ${totalSleepHours} hrs sleep synced.`,
  };
};
