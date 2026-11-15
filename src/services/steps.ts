import {
    aggregateRecord,
    getSdkStatus,
    initialize,
    requestPermission,
    SdkAvailabilityStatus,
} from 'react-native-health-connect';

export type StepsProvider = {
  requestAccess: () => Promise<boolean>;
  getStepsForDay: (date: Date) => Promise<number>;
};

export const stepsProvider: StepsProvider = {
  async requestAccess() {
    // Health Connect must be installed and available on the device
    const status = await getSdkStatus();
    if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
      return false;
    }

    const isInitialized = await initialize();
    if (!isInitialized) {
      return false;
    }

    const granted = await requestPermission([
      { accessType: 'read', recordType: 'Steps' },
    ]);
    return granted.some((permission) => permission.recordType === 'Steps');
  },

  async getStepsForDay(date: Date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    // aggregateRecord lets Health Connect merge data from several sources,
    // so steps from phone + watch are not double counted
    const result = await aggregateRecord({
      recordType: 'Steps',
      timeRangeFilter: {
        operator: 'between',
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      },
    });

    return result.COUNT_TOTAL ?? 0;
  },
};