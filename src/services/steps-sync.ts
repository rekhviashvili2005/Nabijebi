import { toLocalDateString } from '@/services/date-utils';
import { stepsProvider } from '@/services/steps';
import { StepsDay, syncSteps } from '@/services/steps-api';

const DAYS_TO_SYNC = 7;
const MAX_STEPS_PER_DAY = 100000;

let isSyncing = false;

// Reads the last few days from Health Connect and sends them to the server.
// Fails silently: a sync problem must never block the app.
export async function syncRecentSteps(): Promise<void> {
  if (isSyncing) {
    return;
  }
  isSyncing = true;

  try {
    const hasAccess = await stepsProvider.requestAccess();
    if (!hasAccess) {
      return;
    }

    const days: StepsDay[] = [];
    for (let offset = DAYS_TO_SYNC - 1; offset >= 0; offset--) {
      const date = new Date();
      date.setDate(date.getDate() - offset);

      const steps = await stepsProvider.getStepsForDay(date);
      days.push({
        date: toLocalDateString(date),
        steps: Math.min(Math.round(steps), MAX_STEPS_PER_DAY),
        source: 'HealthConnect',
      });
    }

    await syncSteps(days);
  } catch {
    // Ignored on purpose
  } finally {
    isSyncing = false;
  }
}