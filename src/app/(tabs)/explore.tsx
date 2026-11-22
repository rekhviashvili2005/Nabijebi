import { useCallback, useState } from 'react';
import { Button, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

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
        <ThemedText type="title">{t('steps.title')}</ThemedText>
        <ThemedText type="title">{steps === null ? '-' : steps}</ThemedText>
        {message !== '' && <ThemedText type="small">{message}</ThemedText>}
        <Button title={t('steps.readButton')} onPress={loadSteps} />

        <ThemedText type="small">{t('language.title')}</ThemedText>
        <View style={styles.languageRow}>
          <Button
            title="ქართული"
            onPress={() => changeLanguage('ka')}
            disabled={i18n.language === 'ka'}
          />
          <Button
            title="English"
            onPress={() => changeLanguage('en')}
            disabled={i18n.language === 'en'}
          />
        </View>

        <Button
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
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  languageRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
});