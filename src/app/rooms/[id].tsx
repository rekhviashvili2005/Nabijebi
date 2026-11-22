import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppInput } from '@/components/app-input';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/services/auth-context';
import {
  Challenge,
  createChallenge,
  getRoomChallenges,
  joinChallenge,
} from '@/services/challenges-api';
import { toLocalDateString } from '@/services/date-utils';
import { getErrorKey } from '@/services/error-key';
import { stepsProvider } from '@/services/steps';

const MAX_CHALLENGE_DAYS = 365;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
// Must match the invite code of the public room in the database (seed-public-room.sql)
const PUBLIC_ROOM_CODE = 'PUBLIC00';

// Parses "yyyy-MM-dd" as a local date; returns null if the text is not a real date
function parseLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  const isRealDate =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;

  return isRealDate ? date : null;
}

function defaultEndDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 6);
  return toLocalDateString(date);
}

export default function RoomDetailsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useAuth();
  const { id, name, inviteCode, memberCount, ownerId } = useLocalSearchParams<{
    id: string;
    name: string;
    inviteCode: string;
    memberCount: string;
    ownerId: string;
  }>();

  const isOwner =
    !!ownerId && session?.userId.toLowerCase() === ownerId.toLowerCase();

  // The public room is joined with a button, so its code is not shown
  const isPublicRoom = inviteCode === PUBLIC_ROOM_CODE;

  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [challengeName, setChallengeName] = useState('');
  const [startDate, setStartDate] = useState(() => toLocalDateString(new Date()));
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [formError, setFormError] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState('');

  const load = useCallback(async () => {
    try {
      setChallenges(await getRoomChallenges(id));
      setLoadError('');
    } catch (cause) {
      setLoadError(t(getErrorKey(cause)));
    } finally {
      setHasLoaded(true);
    }
  }, [id, t]);

  // Reload the challenges every time the screen comes into view
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  };

  const openLeaderboard = (challenge: Challenge) => {
    router.push({
      pathname: '/challenges/[id]',
      params: { id: challenge.id },
    });
  };

  const handleCreate = async () => {
    if (isBusy) {
      return;
    }

    const trimmedName = challengeName.trim();
    if (trimmedName.length < 2) {
      setFormError(t('challenges.errors.nameLength'));
      return;
    }

    const start = parseLocalDate(startDate);
    const end = parseLocalDate(endDate);
    if (start === null || end === null) {
      setFormError(t('challenges.errors.dateFormat'));
      return;
    }

    const days = Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
    if (days < 0) {
      setFormError(t('challenges.errors.endBeforeStart'));
      return;
    }
    if (days > MAX_CHALLENGE_DAYS) {
      setFormError(t('challenges.errors.tooLong'));
      return;
    }

    setFormError('');
    setIsBusy(true);

    try {
      // The server needs today's current step total to start counting from
      let steps: number;
      try {
        const hasAccess = await stepsProvider.requestAccess();
        if (!hasAccess) {
          setFormError(t('steps.noAccess'));
          return;
        }
        steps = await stepsProvider.getStepsForDay(new Date());
      } catch (cause) {
        setFormError(t('steps.error', { message: cause instanceof Error ? cause.message : '' }));
        return;
      }

      try {
        await createChallenge(id, trimmedName, toLocalDateString(start), toLocalDateString(end), {
          date: toLocalDateString(new Date()),
          steps,
          source: 'HealthConnect',
        });
        setChallengeName('');
        await load();
      } catch (cause) {
        setFormError(t(getErrorKey(cause)));
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleJoin = async (challenge: Challenge) => {
    if (joiningId !== null) {
      return;
    }

    setJoinError('');
    setJoiningId(challenge.id);

    try {
      // The server counts steps only from the moment of joining, so it needs today's current total
      let steps: number;
      try {
        const hasAccess = await stepsProvider.requestAccess();
        if (!hasAccess) {
          setJoinError(t('steps.noAccess'));
          return;
        }
        steps = await stepsProvider.getStepsForDay(new Date());
      } catch (cause) {
        setJoinError(t('steps.error', { message: cause instanceof Error ? cause.message : '' }));
        return;
      }

      try {
        await joinChallenge(challenge.id, {
          date: toLocalDateString(new Date()),
          steps,
          source: 'HealthConnect',
        });
      } catch (cause) {
        setJoinError(t(getErrorKey(cause)));
      }

      // Always reload, so the list shows the real joined state
      await load();
    } finally {
      setJoiningId(null);
    }
  };

  const header = (
    <View style={styles.header}>
      <ThemedText type="title">{name}</ThemedText>
      <ThemedText type="small">{t('rooms.members', { count: Number(memberCount) })}</ThemedText>
      {!isPublicRoom && (
        <ThemedText type="small">{t('rooms.inviteCode', { code: inviteCode })}</ThemedText>
      )}

      {isOwner && (
        <AppCard style={styles.form}>
          <ThemedText style={styles.sectionTitle}>{t('challenges.createTitle')}</ThemedText>
          <AppInput
            value={challengeName}
            onChangeText={setChallengeName}
            placeholder={t('challenges.namePlaceholder')}
            maxLength={100}
            editable={!isBusy}
          />
          <ThemedText type="small">{t('challenges.startDate')}</ThemedText>
          <AppInput
            value={startDate}
            onChangeText={setStartDate}
            keyboardType="numbers-and-punctuation"
            autoCorrect={false}
            maxLength={10}
            editable={!isBusy}
          />
          <ThemedText type="small">{t('challenges.endDate')}</ThemedText>
          <AppInput
            value={endDate}
            onChangeText={setEndDate}
            keyboardType="numbers-and-punctuation"
            autoCorrect={false}
            maxLength={10}
            editable={!isBusy}
          />
          <AppButton
            title={t('challenges.createButton')}
            onPress={handleCreate}
            disabled={isBusy}
          />
          {formError !== '' && <ThemedText type="small">{formError}</ThemedText>}
        </AppCard>
      )}

      <ThemedText style={styles.sectionTitle}>{t('challenges.title')}</ThemedText>
      {loadError !== '' && <ThemedText type="small">{loadError}</ThemedText>}
      {joinError !== '' && <ThemedText type="small">{joinError}</ThemedText>}
    </View>
  );

  // "yyyy-MM-dd" strings compare correctly as plain text
  const today = toLocalDateString(new Date());

  // Active challenges first (ending soonest on top), then ended ones (most recently ended on top)
  const sortedChallenges = [...challenges].sort((a, b) => {
    const aEnded = today > a.endDate;
    const bEnded = today > b.endDate;

    if (aEnded !== bEnded) {
      return aEnded ? 1 : -1;
    }
    if (aEnded) {
      return a.endDate < b.endDate ? 1 : a.endDate > b.endDate ? -1 : 0;
    }
    return a.endDate < b.endDate ? -1 : a.endDate > b.endDate ? 1 : 0;
  });

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerShown: true, title: name }} />
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <FlatList
          data={sortedChallenges}
          keyExtractor={(challenge) => challenge.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={header}
          ListEmptyComponent={
            hasLoaded && loadError === '' ? (
              <ThemedText type="small">{t('challenges.empty')}</ThemedText>
            ) : undefined
          }
          renderItem={({ item }) => {
            const isEnded = today > item.endDate;

            return (
              <AppCard>
                <Pressable onPress={() => openLeaderboard(item)} style={styles.cardBody}>
                  <ThemedText style={styles.challengeName}>{item.name}</ThemedText>
                  <ThemedText type="small">
                    {t('challenges.period', { start: item.startDate, end: item.endDate })}
                  </ThemedText>
                  <ThemedText type="smallBold">
                    {isEnded ? '🏁 ' : '🟢 '}
                    {isEnded ? t('leaderboard.ended') : t('leaderboard.active')}
                  </ThemedText>
                  <ThemedText type="small">
                    {t('challenges.participants', { count: item.participantCount })}
                  </ThemedText>
                  <ThemedText type="small">
                    {item.isJoined ? t('challenges.joined') : t('challenges.notJoined')}
                  </ThemedText>
                  {item.isJoined && (
                    <ThemedText type="small">
                      {t('challenges.mySteps', { count: item.myTotalSteps })}
                    </ThemedText>
                  )}
                  <ThemedText type="small">{t('leaderboard.open')}</ThemedText>
                </Pressable>
                {!item.isJoined && !isEnded && (
                  <AppButton
                    title={t('challenges.joinButton')}
                    onPress={() => handleJoin(item)}
                    disabled={joiningId !== null}
                  />
                )}
              </AppCard>
            );
          }}
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
  },
  form: {
    marginTop: Spacing.three,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: Spacing.three,
  },
  cardBody: {
    gap: Spacing.two,
  },
  challengeName: {
    fontSize: 18,
    fontWeight: '600',
  },
});