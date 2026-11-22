import { StyleSheet } from 'react-native';

import { ThemedView, type ThemedViewProps } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export type AppCardProps = ThemedViewProps;

export function AppCard({ style, type = 'backgroundElement', ...rest }: AppCardProps) {
  return <ThemedView type={type} style={[styles.card, style]} {...rest} />;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: Spacing.three,
    gap: Spacing.two,
  },
});