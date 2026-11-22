import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { getLeaderboard, Leaderboard } from '@/services/challenges-api';
import { toLocalDateString } from '@/services/date-utils';
import { getErrorKey } from '@/services/error-key';
import { syncRecentSteps } from '@/services/steps-sync';

const AUTO_REFRESH_MS = 30000;
const MEDALS = ['🥇', '🥈', '🥉'];

// Top three ranks get a medal, but only with steps above zero
function rankLabel(rank: number, totalSteps: number): string {
  if (totalSteps > 0 && rank >= 1 && rank <= MEDALS.length) {
    return MEDALS[rank - 1];
  }
  return String(rank);
}

export default function LeaderboardScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    try {
      setLeaderboard(await getLeaderboard(id));
      setLoadError('');
    } catch (cause) {
      setLoadError(t(getErrorKey(cause)));
    } finally {
      setHasLoaded(true);
    }
  }, [id, t]);

  // Show the standings first, then send my latest steps and show the standings again
  const refresh = useCallback(async () => {
    await load();
    await syncRecentSteps();
    await load();
  }, [load]);

  // Refresh when the screen comes into view and every 30 seconds while it stays open
  useFocusEffect(
    useCallback(() => {
      void refresh();
      const timer = setInterval(() => {
        void refresh();
      }, AUTO_REFRESH_MS);

      return () => clearInterval(timer);
    }, [refresh]),
  );

  const onRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  };

  // The end date is part of the challenge, so it is over only after that day has passed.
  // "yyyy-MM-dd" strings compare correctly as plain text.
  const isEnded = leaderboard !== null && toLocalDateString(new Date()) > leaderboard.endDate;

  // Everyone on rank 1 wins (ties), but nobody wins with zero steps
  const winners =
    leaderboard === null
      ? []
      : leaderboard.entries.filter((entry) => entry.rank === 1 && entry.totalSteps > 0);
  const winnerNames = winners.map((entry) => entry.displayName).join(', ');

  const header = (
    <View style={styles.header}>
      <ThemedText type="title">{leaderboard?.challengeName ?? t('leaderboard.title')}</ThemedText>
      {leaderboard && (
        <>
          <ThemedText type="small">
            {t('challenges.period', { start: leaderboard.startDate, end: leaderboard.endDate })}
          </ThemedText>
          <ThemedText type="small">
            {isEnded ? t('leaderboard.ended') : t('leaderboard.active')}
          </ThemedText>
        </>
      )}
      {isEnded && (
        <ThemedView type="backgroundSelected" style={styles.winnerBox}>
          <ThemedText style={styles.winnerText}>
            {winners.length === 0
              ? t('leaderboard.noWinner')
              : winners.length === 1
                ? t('leaderboard.winner', { names: winnerNames })
                : t('leaderboard.winners', { names: winnerNames })}
          </ThemedText>
        </ThemedView>
      )}
      {loadError !== '' && <ThemedText type="small">{loadError}</ThemedText>}
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerShown: true, title: t('leaderboard.title') }} />
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <FlatList
          data={leaderboard?.entries ?? []}
          keyExtractor={(entry) => entry.userId}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={header}
          ListEmptyComponent={
            hasLoaded && loadError === '' ? (
              <ThemedText type="small">{t('leaderboard.empty')}</ThemedText>
            ) : undefined
          }
          renderItem={({ item }) => (
            <ThemedView
              type={item.isCurrentUser ? 'backgroundSelected' : 'backgroundElement'}
              style={styles.row}>
              <ThemedText style={styles.rank}>{rankLabel(item.rank, item.totalSteps)}</ThemedText>
              <View style={styles.rowText}>
                <ThemedText style={styles.name}>
                  {item.displayName}
                  {item.isCurrentUser ? ` (${t('leaderboard.you')})` : ''}
                </ThemedText>
                <ThemedText type="small">
                  {t('leaderboard.steps', { count: item.totalSteps })}
                </ThemedText>
              </View>
            </ThemedView>
          )}
        />
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
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
  },
  header: {
    gap: Spacing.two,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
  },
  winnerBox: {
    padding: Spacing.three,
    borderRadius: 16,
    marginTop: Spacing.two,
  },
  winnerText: {
    fontSize: 18,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 16,
  },
  rank: {
    fontSize: 22,
    fontWeight: '700',
    minWidth: 32,
    textAlign: 'center',
  },
  rowText: {
    flex: 1,
    gap: Spacing.one,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
  },
});