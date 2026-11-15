import { useCallback, useState } from 'react';
import { Button, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { stepsProvider } from '@/services/steps';

export default function HomeScreen() {
  const [steps, setSteps] = useState<number | null>(null);
  const [message, setMessage] = useState<string>('');

  const loadSteps = useCallback(async () => {
    try {
      setMessage('Loading...');
      const hasAccess = await stepsProvider.requestAccess();
      if (!hasAccess) {
        setSteps(null);
        setMessage('No access to Health Connect (not installed or permission denied)');
        return;
      }
      const total = await stepsProvider.getStepsForDay(new Date());
      setSteps(total);
      setMessage('');
    } catch (error) {
      setSteps(null);
      setMessage(`Error: ${String(error)}`);
    }
  }, []);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title">Today's steps</ThemedText>
        <ThemedText type="title">{steps === null ? '-' : steps}</ThemedText>
        {message !== '' && <ThemedText type="small">{message}</ThemedText>}
        <Button title="Read steps" onPress={loadSteps} />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
});