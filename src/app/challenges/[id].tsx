import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getLeaderboard, Leaderboard, LeaderboardEntry } from '@/services/challenges-api';
import { toLocalDateString } from '@/services/date-utils';
import { getErrorKey } from '@/services/error-key';
import { syncRecentSteps } from '@/services/steps-sync';

const AUTO_REFRESH_MS = 30000;
const MEDALS = ['🥇', '🥈', '🥉'];
// How many top participants get their own lane on the race track
const TRACK_TOP = 5;

// Top three ranks get a medal, but only with steps above zero
function rankLabel(rank: number, totalSteps: number): string {
  if (totalSteps > 0 && rank >= 1 && rank <= MEDALS.length) {
    return MEDALS[rank - 1];
  }
  return String(rank);
}

export default function LeaderboardScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
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

  // Full refresh when the screen comes into view; afterwards only the standings are reloaded
  // every 30 seconds (one request). My own steps are sent when the screen opens, on pull-to-refresh
  // and when the app is reopened.
  useFocusEffect(
    useCallback(() => {
      void refresh();
      const timer = setInterval(() => {
        void load();
      }, AUTO_REFRESH_MS);

      return () => clearInterval(timer);
    }, [refresh, load]),
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

  // My own row (the server always includes it, even when I am outside the top 50)
  const myEntry = leaderboard?.entries.find((entry) => entry.isCurrentUser);

  // The track shows the top lanes, plus my own lane when I am not among them
  const laneEntries: LeaderboardEntry[] = leaderboard ? leaderboard.entries.slice(0, TRACK_TOP) : [];
  if (myEntry && !laneEntries.some((entry) => entry.userId === myEntry.userId)) {
    laneEntries.push(myEntry);
  }

  // The track is relative: the leader is at the end, the others are in proportion to the leader
  const leaderSteps = leaderboard?.entries[0]?.totalSteps ?? 0;

  const renderLane = (entry: LeaderboardEntry) => {
    const percent =
      leaderSteps > 0 ? Math.min(100, Math.round((entry.totalSteps / leaderSteps) * 100)) : 0;
    const color = entry.isCurrentUser ? theme.accent : theme.secondary;

    return (
      <View key={entry.userId} style={styles.lane}>
        <View style={styles.laneHeader}>
          <ThemedText style={styles.rank}>{rankLabel(entry.rank, entry.totalSteps)}</ThemedText>
          <ThemedText style={styles.laneName} numberOfLines={1}>
            {entry.displayName}
            {entry.isCurrentUser ? ` (${t('leaderboard.you')})` : ''}
          </ThemedText>
          <ThemedText type="small">{t('leaderboard.steps', { count: entry.totalSteps })}</ThemedText>
        </View>
        <ThemedView type="backgroundElement" style={styles.track}>
          <View style={[styles.fill, { width: `${percent}%`, backgroundColor: color }]} />
          <View style={styles.runnerRow}>
            <View style={{ flex: percent }} />
            <ThemedText style={styles.runner}>🏃</ThemedText>
            <View style={{ flex: 100 - percent }} />
          </View>
        </ThemedView>
      </View>
    );
  };

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
      {leaderboard && myEntry && (
        <ThemedText style={styles.myPlace}>
          {t('leaderboard.yourPlace', {
            rank: myEntry.rank,
            total: leaderboard.totalParticipants,
          })}
        </ThemedText>
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
      {laneEntries.length > 0 && <View style={styles.lanes}>{laneEntries.map(renderLane)}</View>}
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerShown: true, title: t('leaderboard.title') }} />
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <FlatList
          data={leaderboard?.entries.slice(TRACK_TOP) ?? []}
          keyExtractor={(entry) => entry.userId}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={header}
          ListEmptyComponent={
            hasLoaded && loadError === '' && leaderboard?.entries.length === 0 ? (
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
  myPlace: {
    fontSize: 18,
    fontWeight: '600',
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
  lanes: {
    gap: Spacing.three,
    marginTop: Spacing.three,
  },
  lane: {
    gap: Spacing.one,
  },
  laneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  laneName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  track: {
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    opacity: 0.35,
  },
  runnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  runner: {
    fontSize: 24,
    lineHeight: 32,
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