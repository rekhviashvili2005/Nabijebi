import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/services/auth-context';
import { AppLanguage, saveLanguage } from '@/services/language-storage';
import { stepsProvider } from '@/services/steps';

type Status = 'idle' | 'loading' | 'noAccess' | 'error';

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { session, signOut } = useAuth();
  const [steps, setSteps] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [errorText, setErrorText] = useState('');

  const loadSteps = useCallback(async () => {
    try {
      setStatus('loading');
      const hasAccess = await stepsProvider.requestAccess();
      if (!hasAccess) {
        setSteps(null);
        setStatus('noAccess');
        return;
      }
      const total = await stepsProvider.getStepsForDay(new Date());
      setSteps(total);
      setStatus('idle');
    } catch (error) {
      setSteps(null);
      setErrorText(String(error));
      setStatus('error');
    }
  }, []);

  const changeLanguage = (language: AppLanguage) => {
    void i18n.changeLanguage(language);
    void saveLanguage(language);
  };

  let message = '';
  if (status === 'loading') {
    message = t('steps.loading');
  } else if (status === 'noAccess') {
    message = t('steps.noAccess');
  } else if (status === 'error') {
    message = t('steps.error', { message: errorText });
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="small">
          {t('home.greeting', { name: session?.displayName ?? '' })}
        </ThemedText>

        <AppCard style={styles.card}>
          <ThemedText type="small">{t('steps.title')}</ThemedText>
          <ThemedText type="title">👟 {steps === null ? '-' : steps}</ThemedText>
          {message !== '' && <ThemedText type="small">{message}</ThemedText>}
          <AppButton title={t('steps.readButton')} onPress={loadSteps} />
        </AppCard>

        <AppCard style={styles.card}>
          <ThemedText type="small">{t('language.title')}</ThemedText>
          <View style={styles.languageRow}>
            <AppButton
              style={styles.languageButton}
              variant={i18n.language === 'ka' ? 'primary' : 'secondary'}
              title="ქართული"
              onPress={() => changeLanguage('ka')}
            />
            <AppButton
              style={styles.languageButton}
              variant={i18n.language === 'en' ? 'primary' : 'secondary'}
              title="English"
              onPress={() => changeLanguage('en')}
            />
          </View>
        </AppCard>

        <AppButton
          variant="secondary"
          title={t('auth.signOut')}
          onPress={() => {
            void signOut();
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
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  card: {
    gap: Spacing.three,
  },
  languageRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  languageButton: {
    flex: 1,
  },
});