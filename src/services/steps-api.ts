import { apiRequest } from '@/services/api-client';

export type StepsDay = {
  date: string;
  steps: number;
  source: string;
};

export function syncSteps(days: StepsDay[]): Promise<unknown> {
  return apiRequest<unknown>('/api/steps/sync', {
    method: 'POST',
    body: { days },
  });
}