import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../constants/theme';

const DAYS = [
  { key: 'Mon', name: 'Monday' },
  { key: 'Tue', name: 'Tuesday' },
  { key: 'Wed', name: 'Wednesday' },
  { key: 'Thu', name: 'Thursday' },
  { key: 'Fri', name: 'Friday' },
  { key: 'Sat', name: 'Saturday' },
  { key: 'Sun', name: 'Sunday' },
] as const;

type DayKey = (typeof DAYS)[number]['key'];
type DaySchedule = { enabled: boolean; fromTime: string; toTime: string };
type Schedule = Record<DayKey, DaySchedule>;
type TimeField = 'fromTime' | 'toTime';

const TIME_OPTIONS = [
  '05:00 AM', '05:30 AM', '06:00 AM', '06:30 AM', '07:00 AM', '07:30 AM',
  '08:00 AM', '08:30 AM', '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM',
  '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '01:00 PM', '01:30 PM',
  '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM',
  '05:00 PM', '05:30 PM', '06:00 PM', '06:30 PM', '07:00 PM', '07:30 PM',
  '08:00 PM', '08:30 PM', '09:00 PM', '09:30 PM', '10:00 PM', '10:30 PM',
];

const DAY_PRESETS = [
  { label: 'Mon, Wed, Fri', days: ['Mon', 'Wed', 'Fri'] as DayKey[] },
  { label: 'Tue, Thu, Sat', days: ['Tue', 'Thu', 'Sat'] as DayKey[] },
  { label: 'Mon - Fri', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as DayKey[] },
  { label: 'Mon - Sat', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as DayKey[] },
  { label: 'Weekends', days: ['Sat', 'Sun'] as DayKey[] },
  { label: 'All 7 days', days: DAYS.map((day) => day.key) as DayKey[] },
];

const TIME_PRESETS = [
  { label: 'Morning', from: '06:00 AM', to: '12:00 PM' },
  { label: 'Daytime', from: '09:00 AM', to: '06:00 PM' },
  { label: 'Evening', from: '04:00 PM', to: '09:00 PM' },
  { label: 'Full day', from: '07:00 AM', to: '08:00 PM' },
];

export const DEFAULT_TRAINER_AVAILABILITY = 'Mon, Wed, Fri: 06:00 AM - 12:00 PM';

const defaultSchedule = (): Schedule => Object.fromEntries(
  DAYS.map(({ key }) => [key, {
    enabled: ['Mon', 'Wed', 'Fri'].includes(key),
    fromTime: '06:00 AM',
    toTime: '12:00 PM',
  }]),
) as Schedule;

const dayLabel = (keys: DayKey[]) => {
  const joined = keys.join(',');
  if (joined === 'Mon,Tue,Wed,Thu,Fri') return 'Mon - Fri';
  if (joined === 'Mon,Tue,Wed,Thu,Fri,Sat') return 'Mon - Sat';
  if (joined === 'Mon,Tue,Wed,Thu,Fri,Sat,Sun') return 'All Week (Mon - Sun)';
  if (joined === 'Sat,Sun') return 'Sat - Sun';
  return keys.join(', ');
};

const formatSchedule = (schedule: Schedule, sameHours: boolean) => {
  const active = DAYS.filter(({ key }) => schedule[key].enabled).map(({ key }) => key);
  if (!active.length) return 'Flexible / By Appointment';

  if (sameHours) {
    const first = schedule[active[0]];
    return `${dayLabel(active)}: ${first.fromTime} - ${first.toTime}`;
  }

  const first = schedule[active[0]];
  const hasSameHours = active.every((key) => (
    schedule[key].fromTime === first.fromTime && schedule[key].toTime === first.toTime
  ));
  if (hasSameHours) return `${dayLabel(active)}: ${first.fromTime} - ${first.toTime}`;
  return active.map((key) => `${key}: ${schedule[key].fromTime} - ${schedule[key].toTime}`).join(' | ');
};

const parseTimeRange = (value: string) => {
  const [from, to] = value.split('-').map((part) => part.trim());
  return {
    from: TIME_OPTIONS.includes(from) ? from : '06:00 AM',
    to: TIME_OPTIONS.includes(to) ? to : '12:00 PM',
  };
};

const parseSchedule = (value?: string | null): { schedule: Schedule; sameHours: boolean } => {
  const schedule = defaultSchedule();
  if (!value) return { schedule, sameHours: true };
  if (value === 'Flexible / By Appointment') {
    DAYS.forEach(({ key }) => { schedule[key].enabled = false; });
    return { schedule, sameHours: true };
  }

  if (value.includes('|')) {
    DAYS.forEach(({ key }) => { schedule[key].enabled = false; });
    const segments = value.split('|').map((part) => part.trim());
    const parsed = segments.map((segment) => {
      const delimiter = segment.indexOf(':');
      if (delimiter < 0) return null;
      const key = segment.slice(0, delimiter).trim().slice(0, 3) as DayKey;
      if (!DAYS.some((day) => day.key === key)) return null;
      return { key, ...parseTimeRange(segment.slice(delimiter + 1)) };
    }).filter((item): item is { key: DayKey; from: string; to: string } => item !== null);
    parsed.forEach(({ key, from, to }) => {
      schedule[key] = { enabled: true, fromTime: from, toTime: to };
    });
    return { schedule, sameHours: false };
  }

  const delimiter = value.includes(':') ? value.indexOf(':') : value.indexOf(',');
  if (delimiter < 0) return { schedule, sameHours: true };
  const dayPart = value.slice(0, delimiter).trim();
  const { from, to } = parseTimeRange(value.slice(delimiter + 1));
  DAYS.forEach(({ key }) => { schedule[key] = { enabled: false, fromTime: from, toTime: to }; });

  if (dayPart.toLowerCase().startsWith('all week')) {
    DAYS.forEach(({ key }) => { schedule[key].enabled = true; });
  } else if (dayPart.includes('-')) {
    const [start, end] = dayPart.split('-').map((part) => part.trim().slice(0, 3));
    const startIndex = DAYS.findIndex((day) => day.key === start);
    const endIndex = DAYS.findIndex((day) => day.key === end);
    if (startIndex >= 0 && endIndex >= 0) {
      for (let index = Math.min(startIndex, endIndex); index <= Math.max(startIndex, endIndex); index += 1) {
        schedule[DAYS[index].key].enabled = true;
      }
    }
  } else {
    dayPart.split(',').forEach((part) => {
      const key = part.trim().slice(0, 3) as DayKey;
      if (DAYS.some((day) => day.key === key)) schedule[key].enabled = true;
    });
  }
  return { schedule, sameHours: true };
};

export const normalizeTrainerAvailability = (value?: string | null) => {
  if (!value) return DEFAULT_TRAINER_AVAILABILITY;
  const parsed = parseSchedule(value);
  return formatSchedule(parsed.schedule, parsed.sameHours);
};

export function TrainerAvailabilityPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [schedule, setSchedule] = useState<Schedule>(() => parseSchedule(value).schedule);
  const [sameHours, setSameHours] = useState(() => parseSchedule(value).sameHours);
  const [timePicker, setTimePicker] = useState<{ day?: DayKey; field: TimeField } | null>(null);
  const activeDays = DAYS.filter(({ key }) => schedule[key].enabled);
  const preview = formatSchedule(schedule, sameHours);

  const commit = (next: Schedule, nextSameHours = sameHours) => {
    setSchedule(next);
    setSameHours(nextSameHours);
    onChange(formatSchedule(next, nextSameHours));
  };

  const toggleDay = (day: DayKey) => {
    const next = { ...schedule, [day]: { ...schedule[day], enabled: !schedule[day].enabled } };
    commit(next);
  };

  const applyDays = (days: DayKey[]) => {
    const next = { ...schedule };
    DAYS.forEach(({ key }) => { next[key] = { ...next[key], enabled: days.includes(key) }; });
    commit(next);
  };

  const updateTime = (target: { day?: DayKey; field: TimeField }, time: string) => {
    const next = { ...schedule };
    if (target.day) {
      next[target.day] = { ...next[target.day], [target.field]: time };
    } else {
      DAYS.forEach(({ key }) => { next[key] = { ...next[key], [target.field]: time }; });
    }
    commit(next);
    setTimePicker(null);
  };

  const applyTimePreset = (from: string, to: string) => {
    const next = { ...schedule };
    DAYS.forEach(({ key }) => { next[key] = { ...next[key], fromTime: from, toTime: to }; });
    commit(next);
  };

  const copyDayTimes = (sourceDay: DayKey) => {
    const source = schedule[sourceDay];
    const next = { ...schedule };
    activeDays.forEach(({ key }) => {
      next[key] = { ...next[key], fromTime: source.fromTime, toTime: source.toTime };
    });
    commit(next);
  };

  const selectedTime = timePicker
    ? timePicker.day ? schedule[timePicker.day][timePicker.field] : schedule[activeDays[0]?.key || 'Mon'][timePicker.field]
    : '';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Availability & Working Days Schedule</Text>
      <Text style={styles.description}>
        Select your working days and hours. The schedule saves in the same format as the web app.
      </Text>

      <View style={styles.preview}>
        <Text style={styles.previewLabel}>SAVED SCHEDULE</Text>
        <Text style={styles.previewValue}>{preview}</Text>
      </View>

      <Text style={styles.sectionTitle}>1. Select Working Days</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayList}>
        {DAYS.map(({ key }) => {
          const enabled = schedule[key].enabled;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => toggleDay(key)}
              style={[styles.dayChip, enabled && styles.dayChipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: enabled }}
            >
              <Text style={[styles.dayText, enabled && styles.dayTextActive]}>{key}</Text>
              <Text style={[styles.dayStatus, enabled && styles.dayStatusActive]}>{enabled ? 'Working' : 'Off'}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={styles.smallLabel}>Quick Select</Text>
      <View style={styles.presetWrap}>
        {DAY_PRESETS.map((preset) => {
          const matches = preset.days.length === activeDays.length
            && preset.days.every((day) => schedule[day].enabled);
          return (
            <TouchableOpacity
              key={preset.label}
              onPress={() => applyDays(preset.days)}
              style={[styles.presetChip, matches && styles.presetChipActive]}
            >
              <Text style={[styles.presetText, matches && styles.presetTextActive]}>{preset.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>2. Configure Working Hours</Text>
      <View style={styles.modeRow}>
        {[
          { label: 'Same hours', value: true },
          { label: 'Different hours by day', value: false },
        ].map((mode) => (
          <TouchableOpacity
            key={mode.label}
            onPress={() => {
              if (!mode.value) {
                commit(schedule, false);
                return;
              }
              const common = schedule[activeDays[0]?.key || 'Mon'];
              const next = { ...schedule };
              DAYS.forEach(({ key }) => {
                next[key] = { ...next[key], fromTime: common.fromTime, toTime: common.toTime };
              });
              commit(next, true);
            }}
            style={[styles.modeButton, sameHours === mode.value && styles.modeButtonActive]}
          >
            <Text style={[styles.modeText, sameHours === mode.value && styles.modeTextActive]}>{mode.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {sameHours ? (
        <View style={styles.timePanel}>
          <View style={styles.presetWrap}>
            {TIME_PRESETS.map((preset) => {
              const commonDay = activeDays[0]?.key || 'Mon';
              const selected = schedule[commonDay].fromTime === preset.from && schedule[commonDay].toTime === preset.to;
              return (
                <TouchableOpacity
                  key={preset.label}
                  onPress={() => applyTimePreset(preset.from, preset.to)}
                  style={[styles.timePreset, selected && styles.timePresetActive]}
                >
                  <Text style={[styles.timePresetText, selected && styles.timePresetTextActive]}>{preset.label}</Text>
                  <Text style={[styles.timePresetSub, selected && styles.timePresetSubActive]}>
                    {preset.from} - {preset.to}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.timeRow}>
            <TimeButton label="Start Time" value={schedule[activeDays[0]?.key || 'Mon'].fromTime} onPress={() => setTimePicker({ field: 'fromTime' })} />
            <Text style={styles.toText}>to</Text>
            <TimeButton label="End Time" value={schedule[activeDays[0]?.key || 'Mon'].toTime} onPress={() => setTimePicker({ field: 'toTime' })} />
          </View>
        </View>
      ) : activeDays.length ? (
        <View style={styles.individualList}>
          {activeDays.map(({ key, name }) => (
            <View key={key} style={styles.individualRow}>
              <View style={styles.individualHeading}>
                <Text style={styles.individualDay}>{name}</Text>
                <TouchableOpacity onPress={() => copyDayTimes(key)}>
                  <Text style={styles.copyText}>Copy to active days</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.timeRow}>
                <TimeButton label="Start" value={schedule[key].fromTime} onPress={() => setTimePicker({ day: key, field: 'fromTime' })} />
                <Text style={styles.toText}>to</Text>
                <TimeButton label="End" value={schedule[key].toTime} onPress={() => setTimePicker({ day: key, field: 'toTime' })} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.emptyHint}>No working days selected. Choose one or more days above.</Text>
      )}

      <Modal visible={Boolean(timePicker)} transparent animationType="slide" onRequestClose={() => setTimePicker(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.timeModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose time</Text>
              <TouchableOpacity onPress={() => setTimePicker(null)}>
                <Text style={styles.modalDone}>Done</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.timeOptions}>
              {TIME_OPTIONS.map((time) => (
                <TouchableOpacity
                  key={time}
                  onPress={() => timePicker && updateTime(timePicker, time)}
                  style={[styles.timeOption, selectedTime === time && styles.timeOptionActive]}
                >
                  <Text style={[styles.timeOptionText, selectedTime === time && styles.timeOptionTextActive]}>{time}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function TimeButton({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.timeButton}>
      <Text style={styles.timeButtonLabel}>{label}</Text>
      <Text style={styles.timeButtonValue}>{value}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#f0fdf4', borderRadius: 16, borderWidth: 1, borderColor: '#bbf7d0', padding: 14, marginBottom: 16 },
  title: { color: COLORS.text, fontSize: 14, fontWeight: '900' },
  description: { color: COLORS.textMuted, fontSize: 12, lineHeight: 17, marginTop: 5, marginBottom: 12 },
  preview: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 11, marginBottom: 14 },
  previewLabel: { color: '#dcfce7', fontSize: 9, fontWeight: '900', letterSpacing: 0.8, marginBottom: 4 },
  previewValue: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
  sectionTitle: { color: COLORS.text, fontSize: 12, fontWeight: '900', marginTop: 5, marginBottom: 9 },
  dayList: { gap: 7, paddingBottom: 5 },
  dayChip: { width: 58, minHeight: 58, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: COLORS.border, borderRadius: 12 },
  dayChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dayText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '900' },
  dayTextActive: { color: '#ffffff' },
  dayStatus: { color: COLORS.textMuted, fontSize: 9, fontWeight: '700', marginTop: 3 },
  dayStatusActive: { color: '#dcfce7' },
  smallLabel: { color: COLORS.textMuted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginTop: 7, marginBottom: 6 },
  presetWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  presetChip: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 10 },
  presetChipActive: { backgroundColor: '#166534', borderColor: '#166534' },
  presetText: { color: COLORS.textSecondary, fontSize: 10, fontWeight: '800' },
  presetTextActive: { color: '#ffffff' },
  modeRow: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 11, padding: 3, marginBottom: 10 },
  modeButton: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 9 },
  modeButtonActive: { backgroundColor: '#ffffff' },
  modeText: { color: COLORS.textMuted, fontSize: 10, fontWeight: '700' },
  modeTextActive: { color: COLORS.primaryDark, fontWeight: '900' },
  timePanel: { backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: 10 },
  timePreset: { width: '48%', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 8 },
  timePresetActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  timePresetText: { color: COLORS.text, fontSize: 11, fontWeight: '900' },
  timePresetTextActive: { color: '#ffffff' },
  timePresetSub: { color: COLORS.textMuted, fontSize: 9, marginTop: 4 },
  timePresetSubActive: { color: '#dcfce7' },
  timeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  timeButton: { flex: 1, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 8 },
  timeButtonLabel: { color: COLORS.textMuted, fontSize: 9, fontWeight: '800', textTransform: 'uppercase', marginBottom: 4 },
  timeButtonValue: { color: COLORS.text, fontSize: 12, fontWeight: '900' },
  toText: { color: COLORS.textMuted, fontSize: 11, fontWeight: '800', paddingBottom: 11 },
  individualList: { gap: 8 },
  individualRow: { backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: 10 },
  individualHeading: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  individualDay: { color: COLORS.text, fontSize: 12, fontWeight: '900' },
  copyText: { color: COLORS.primaryDark, fontSize: 10, fontWeight: '800' },
  emptyHint: { color: COLORS.warning, fontSize: 12, marginBottom: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'flex-end' },
  timeModal: { maxHeight: '70%', backgroundColor: '#ffffff', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle: { color: COLORS.text, fontSize: 16, fontWeight: '900' },
  modalDone: { color: COLORS.primaryDark, fontSize: 14, fontWeight: '900', padding: 5 },
  timeOptions: { marginTop: 6 },
  timeOption: { paddingVertical: 12, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: COLORS.surface },
  timeOptionActive: { backgroundColor: COLORS.primaryLight, borderRadius: 8 },
  timeOptionText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '700' },
  timeOptionTextActive: { color: COLORS.primaryDark, fontWeight: '900' },
});
