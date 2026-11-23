import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppInput } from '@/components/app-input';
import { challengeDates, DEFAULT_DURATION, DurationPicker } from '@/components/duration-picker';
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
import { deleteRoom, leaveRoom } from '@/services/rooms-api';
import { stepsProvider } from '@/services/steps';


export default function RoomDetailsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useAuth();
  const { id, name, inviteCode, memberCount, ownerId, isPublic } = useLocalSearchParams<{
    id: string;
    name: string;
    inviteCode: string;
    memberCount: string;
    ownerId: string;
    isPublic: string;
  }>();

  const isOwner =
    !!ownerId && session?.userId.toLowerCase() === ownerId.toLowerCase();

  // The public room is joined with a button, so its code is not shown
  const isPublicRoom = isPublic === 'true';

  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [challengeName, setChallengeName] = useState('');
  const [duration, setDuration] = useState<number>(DEFAULT_DURATION);
  const [formError, setFormError] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState('');
  const [roomError, setRoomError] = useState('');
  const [isRoomBusy, setIsRoomBusy] = useState(false);

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
        const { startDate, endDate } = challengeDates(duration);
        await createChallenge(id, trimmedName, startDate, endDate, {
          date: startDate,
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

  // Runs leave/delete; on success the screen closes and the rooms list reloads by itself
  const runRoomAction = async (action: () => Promise<void>) => {
    if (isRoomBusy) {
      return;
    }

    setRoomError('');
    setIsRoomBusy(true);

    try {
      await action();
      router.back();
    } catch (cause) {
      setRoomError(t(getErrorKey(cause)));
    } finally {
      setIsRoomBusy(false);
    }
  };

  const confirmLeave = () => {
    Alert.alert(t('rooms.leaveConfirmTitle'), t('rooms.leaveConfirmMessage'), [
      { text: t('rooms.cancel'), style: 'cancel' },
      {
        text: t('rooms.leaveButton'),
        style: 'destructive',
        onPress: () => {
          void runRoomAction(() => leaveRoom(id));
        },
      },
    ]);
  };

  const confirmDelete = () => {
    Alert.alert(t('rooms.deleteConfirmTitle'), t('rooms.deleteConfirmMessage'), [
      { text: t('rooms.cancel'), style: 'cancel' },
      {
        text: t('rooms.deleteButton'),
        style: 'destructive',
        onPress: () => {
          void runRoomAction(() => deleteRoom(id));
        },
      },
    ]);
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
          <ThemedText type="small">{t('challenges.duration')}</ThemedText>
          <DurationPicker value={duration} onChange={setDuration} disabled={isBusy} />
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

  // The owner can delete the room (not the public one); everyone else can leave it
  const footer = (
    <View style={styles.footer}>
      {roomError !== '' && <ThemedText type="small">{roomError}</ThemedText>}
      {!isOwner && (
        <AppButton
          variant="secondary"
          title={t('rooms.leaveButton')}
          onPress={confirmLeave}
          disabled={isRoomBusy}
        />
      )}
      {isOwner && !isPublicRoom && (
        <AppButton
          variant="secondary"
          title={t('rooms.deleteButton')}
          onPress={confirmDelete}
          disabled={isRoomBusy}
        />
      )}
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
          ListFooterComponent={footer}
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
  footer: {
    gap: Spacing.two,
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