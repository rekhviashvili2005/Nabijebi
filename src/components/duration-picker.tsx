import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { Spacing } from '@/constants/theme';
import { toLocalDateString } from '@/services/date-utils';

export const CHALLENGE_DURATIONS = [7, 14, 30] as const;
export const DEFAULT_DURATION = 7;

// A challenge starts today and lasts the given number of days (today counts as the first day)
export function challengeDates(days: number): { startDate: string; endDate: string } {
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + days - 1);

  return { startDate: toLocalDateString(start), endDate: toLocalDateString(end) };
}

export type DurationPickerProps = {
  value: number;
  onChange: (days: number) => void;
  disabled?: boolean;
};

export function DurationPicker({ value, onChange, disabled }: DurationPickerProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.row}>
      {CHALLENGE_DURATIONS.map((days) => (
        <AppButton
          key={days}
          style={styles.item}
          variant={value === days ? 'primary' : 'secondary'}
          title={t('challenges.days', { count: days })}
          onPress={() => onChange(days)}
          disabled={disabled}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  item: {
    flex: 1,
    paddingHorizontal: 8,
  },
});