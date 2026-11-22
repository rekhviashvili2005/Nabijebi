import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  FlatList,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, Spacing } from '@/constants/theme';
import { ApiError } from '@/services/api-client';
import { getErrorKey } from '@/services/error-key';
import {
  createRoom,
  getMyRooms,
  getPublicRoom,
  joinPublicRoom,
  joinRoom,
  Room,
} from '@/services/rooms-api';

export default function RoomsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const [rooms, setRooms] = useState<Room[]>([]);
  const [publicRoom, setPublicRoom] = useState<Room | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [formError, setFormError] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const inputStyle = [
    styles.input,
    { color: colors.text, backgroundColor: colors.backgroundElement },
  ];

  const load = useCallback(async () => {
    try {
      setRooms(await getMyRooms());
      setLoadError('');
    } catch (cause) {
      setLoadError(t(getErrorKey(cause)));
    } finally {
      setHasLoaded(true);
    }

    // The public room is optional: if it cannot be loaded, the rest of the screen still works
    try {
      setPublicRoom(await getPublicRoom());
    } catch {
      // Keep whatever was shown before
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
      await createRoom(name);
      setNewRoomName('');
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
        <ThemedView type="backgroundSelected" style={styles.card}>
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
            <Button
              title={t('rooms.publicJoinButton')}
              onPress={handleJoinPublic}
              disabled={isBusy}
            />
          )}
        </ThemedView>
      )}

      <ThemedText>{t('rooms.createTitle')}</ThemedText>
      <TextInput
        style={inputStyle}
        value={newRoomName}
        onChangeText={setNewRoomName}
        placeholder={t('rooms.roomName')}
        placeholderTextColor="#888888"
        maxLength={100}
        editable={!isBusy}
      />
      <Button title={t('rooms.createButton')} onPress={handleCreate} disabled={isBusy} />

      <ThemedText>{t('rooms.joinTitle')}</ThemedText>
      <TextInput
        style={inputStyle}
        value={inviteCode}
        onChangeText={setInviteCode}
        placeholder={t('rooms.inviteCodePlaceholder')}
        placeholderTextColor="#888888"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={16}
        editable={!isBusy}
      />
      <Button title={t('rooms.joinButton')} onPress={handleJoin} disabled={isBusy} />

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
            <ThemedView type="backgroundElement" style={styles.card}>
              <Pressable onPress={() => openRoom(item)} style={styles.cardBody}>
                <ThemedText style={styles.roomName}>{item.name}</ThemedText>
                <ThemedText type="small">
                  {t('rooms.members', { count: item.memberCount })}
                </ThemedText>
                <ThemedText type="small">
                  {t('rooms.inviteCode', { code: item.inviteCode })}
                </ThemedText>
              </Pressable>
              <Button title={t('rooms.shareButton')} onPress={() => shareCode(item)} />
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
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  header: {
    gap: Spacing.three,
    paddingTop: Spacing.four,
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 16,
  },
  cardBody: {
    gap: Spacing.two,
  },
  roomName: {
    fontSize: 18,
    fontWeight: '600',
  },
});