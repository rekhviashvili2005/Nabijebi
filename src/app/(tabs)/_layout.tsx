import { useEffect } from 'react';
import { AppState } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { syncRecentSteps } from '@/services/steps-sync';

export default function TabsLayout() {
  // Send the last few days of steps to the server when the app opens
  // and every time it comes back from the background
  useEffect(() => {
    void syncRecentSteps();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void syncRecentSteps();
      }
    });

    return () => subscription.remove();
  }, []);

  return <AppTabs />;
}