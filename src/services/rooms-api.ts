import { ApiError, apiRequest } from '@/services/api-client';

export type Room = {
  id: string;
  name: string;
  inviteCode: string;
  ownerId: string;
  memberCount: number;
  createdAtUtc: string;
  isPublic: boolean;
};

export function getMyRooms(): Promise<Room[]> {
  return apiRequest<Room[]>('/api/rooms');
}

export function createRoom(name: string): Promise<Room> {
  return apiRequest<Room>('/api/rooms', { method: 'POST', body: { name } });
}

export function joinRoom(inviteCode: string): Promise<Room> {
  return apiRequest<Room>('/api/rooms/join', { method: 'POST', body: { inviteCode } });
}

// Returns null when there is no public room yet (the server answers 404)
export async function getPublicRoom(): Promise<Room | null> {
  try {
    return await apiRequest<Room>('/api/rooms/public');
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 404) {
      return null;
    }
    throw cause;
  }
}

export function joinPublicRoom(): Promise<Room> {
  return apiRequest<Room>('/api/rooms/public/join', { method: 'POST' });
}