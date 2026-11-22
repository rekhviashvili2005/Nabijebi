import { apiRequest } from '@/services/api-client';

export type Challenge = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  participantCount: number;
  isJoined: boolean;
};

export type StepsSnapshot = {
  date: string;
  steps: number;
  source: string;
};

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  displayName: string;
  totalSteps: number;
  isCurrentUser: boolean;
};

export type Leaderboard = {
  challengeId: string;
  challengeName: string;
  startDate: string;
  endDate: string;
  entries: LeaderboardEntry[];
};

export function getRoomChallenges(roomId: string): Promise<Challenge[]> {
  return apiRequest<Challenge[]>(`/api/rooms/${roomId}/challenges`);
}

export function createChallenge(
  roomId: string,
  name: string,
  startDate: string,
  endDate: string,
  today: StepsSnapshot,
): Promise<Challenge> {
  return apiRequest<Challenge>(`/api/rooms/${roomId}/challenges`, {
    method: 'POST',
    body: { name, startDate, endDate, today },
  });
}

export function joinChallenge(challengeId: string, snapshot: StepsSnapshot): Promise<unknown> {
  return apiRequest<unknown>(`/api/challenges/${challengeId}/join`, {
    method: 'POST',
    body: snapshot,
  });
}

export function getLeaderboard(challengeId: string): Promise<Leaderboard> {
  return apiRequest<Leaderboard>(`/api/challenges/${challengeId}/leaderboard`);
}