import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, RefreshControl, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppInput } from '@/components/app-input';
import { challengeDates, DEFAULT_DURATION, DurationPicker } from '@/components/duration-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { ApiError } from '@/services/api-client';
import { createChallenge } from '@/services/challenges-api';
import { getErrorKey } from '@/services/error-key';
import {
  createRoom,
  getMyRooms,
  getPublicRoom,
  joinPublicRoom,
  joinRoom,
  Room,
} from '@/services/rooms-api';
import { stepsProvider } from '@/services/steps';

export default function RoomsScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [publicRoom, setPublicRoom] = useState<Room | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [duration, setDuration] = useState<number>(DEFAULT_DURATION);
  const [inviteCode, setInviteCode] = useState('');
  const [formError, setFormError] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const load = useCallback(async () => {
    // Both requests start at the same time, so the screen waits for the slower one, not for both
    const [roomsResult, publicResult] = await Promise.allSettled([getMyRooms(), getPublicRoom()]);

    if (roomsResult.status === 'fulfilled') {
      setRooms(roomsResult.value);
      setLoadError('');
    } else {
      setLoadError(t(getErrorKey(roomsResult.reason)));
    }
    setHasLoaded(true);

    // The public room is optional: if it cannot be loaded, keep whatever was shown before
    if (publicResult.status === 'fulfilled') {
      setPublicRoom(publicResult.value);
    }
  }, [t]);

  // Reload the list every time the tab comes into view
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

  // Creates the room and its first challenge in one step
  const handleCreate = async () => {
    if (isBusy) {
      return;
    }

    const name = newRoomName.trim();
    if (name.length < 2) {
      setFormError(t('rooms.errors.nameLength'));
      return;
    }

    setFormError('');
    setIsBusy(true);

    try {
      // The first challenge starts counting from today's current steps.
      // If the steps cannot be read, the room is still created, only without the challenge.
      let steps: number | null = null;
      let stepsError = '';
      try {
        const hasAccess = await stepsProvider.requestAccess();
        if (!hasAccess) {
          stepsError = t('steps.noAccess');
        } else {
          steps = await stepsProvider.getStepsForDay(new Date());
        }
      } catch (cause) {
        stepsError = t('steps.error', { message: cause instanceof Error ? cause.message : '' });
      }

      const room = await createRoom(name);
      setNewRoomName('');

      if (steps === null) {
        setFormError(stepsError);
      } else {
        try {
          const { startDate, endDate } = challengeDates(duration);
          await createChallenge(room.id, name, startDate, endDate, {
            date: startDate,
            steps,
            source: 'HealthConnect',
          });
        } catch (cause) {
          setFormError(t(getErrorKey(cause)));
        }
      }

      await load();
    } catch (cause) {
      setFormError(t(getErrorKey(cause)));
    } finally {
      setIsBusy(false);
    }
  };

  const handleJoin = async () => {
    if (isBusy) {
      return;
    }

    const code = inviteCode.trim().toUpperCase();
    if (code.length < 4) {
      setFormError(t('rooms.errors.codeLength'));
      return;
    }

    setFormError('');
    setIsBusy(true);

    try {
      await joinRoom(code);
      setInviteCode('');
      await load();
    } catch (cause) {
      setFormError(
        cause instanceof ApiError && cause.status === 404
          ? t('rooms.codeNotFound')
          : t(getErrorKey(cause)),
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleJoinPublic = async () => {
    if (isBusy) {
      return;
    }

    setFormError('');
    setIsBusy(true);

    try {
      await joinPublicRoom();
      await load();
    } catch (cause) {
      setFormError(t(getErrorKey(cause)));
    } finally {
      setIsBusy(false);
    }
  };

  const shareCode = (room: Room) => {
    Share.share({
      message: t('rooms.shareMessage', { name: room.name, code: room.inviteCode }),
    }).catch(() => {
      // The user closed the share sheet or sharing is not available
    });
  };

  // Opens the room details screen with the room data as route params
  const openRoom = (room: Room) => {
    router.push({
      pathname: '/rooms/[id]',
      params: {
        id: room.id,
        name: room.name,
        inviteCode: room.inviteCode,
        memberCount: String(room.memberCount),
        ownerId: room.ownerId,
        isPublic: String(room.isPublic),
      },
    });
  };

  // The user is a member of the public room when it appears in their own room list
  const isPublicMember = publicRoom !== null && rooms.some((room) => room.id === publicRoom.id);

  // The public room has its own card, so it is not repeated in the list of private rooms
  const privateRooms = rooms.filter((room) => !room.isPublic);

  const header = (
    <View style={styles.header}>
      <ThemedText type="title">{t('rooms.title')}</ThemedText>

      {publicRoom !== null && (
        <AppCard type="backgroundSelected">
          <Pressable
            onPress={() => openRoom(publicRoom)}
            disabled={!isPublicMember}
            style={styles.cardBody}>
            <ThemedText style={styles.roomName}>🌍 {t('rooms.publicTitle')}</ThemedText>
            <ThemedText type="small">{t('rooms.publicDescription')}</ThemedText>
            <ThemedText type="small">
              {t('rooms.members', { count: publicRoom.memberCount })}
            </ThemedText>
            {isPublicMember && <ThemedText type="small">{t('rooms.publicOpen')}</ThemedText>}
          </Pressable>
          {!isPublicMember && (
            <AppButton
              title={t('rooms.publicJoinButton')}
              onPress={handleJoinPublic}
              disabled={isBusy}
            />
          )}
        </AppCard>
      )}

      <ThemedText>{t('rooms.createTitle')}</ThemedText>
      <AppInput
        value={newRoomName}
        onChangeText={setNewRoomName}
        placeholder={t('rooms.roomName')}
        maxLength={100}
        editable={!isBusy}
      />
      <ThemedText type="small">{t('challenges.duration')}</ThemedText>
      <DurationPicker value={duration} onChange={setDuration} disabled={isBusy} />
      <AppButton title={t('rooms.createButton')} onPress={handleCreate} disabled={isBusy} />

      <ThemedText>{t('rooms.joinTitle')}</ThemedText>
      <AppInput
        value={inviteCode}
        onChangeText={setInviteCode}
        placeholder={t('rooms.inviteCodePlaceholder')}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={16}
        editable={!isBusy}
      />
      <AppButton title={t('rooms.joinButton')} onPress={handleJoin} disabled={isBusy} />

      {formError !== '' && <ThemedText type="small">{formError}</ThemedText>}
      {loadError !== '' && <ThemedText type="small">{loadError}</ThemedText>}
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <FlatList
          data={privateRooms}
          keyExtractor={(room) => room.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={header}
          ListEmptyComponent={
            hasLoaded && loadError === '' ? (
              <ThemedText type="small">{t('rooms.empty')}</ThemedText>
            ) : undefined
          }
          renderItem={({ item }) => (
            <AppCard>
              <Pressable onPress={() => openRoom(item)} style={styles.cardBody}>
                <ThemedText style={styles.roomName}>{item.name}</ThemedText>
                <ThemedText type="small">
                  {t('rooms.members', { count: item.memberCount })}
                </ThemedText>
                <ThemedText type="small">
                  {t('rooms.inviteCode', { code: item.inviteCode })}
                </ThemedText>
              </Pressable>
              <AppButton
                variant="secondary"
                title={t('rooms.shareButton')}
                onPress={() => shareCode(item)}
              />
            </AppCard>
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
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  header: {
    gap: Spacing.three,
    paddingTop: Spacing.four,
  },
  cardBody: {
    gap: Spacing.two,
  },
  roomName: {
    fontSize: 18,
    fontWeight: '600',
  },
});