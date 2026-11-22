import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ScrollView, StyleSheet, TextInput, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { ApiError } from '@/services/api-client';
import { useAuth } from '@/services/auth-context';

type Mode = 'signIn' | 'register';

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

export default function AuthScreen() {
  const { t } = useTranslation();
  const { signIn, signUp } = useAuth();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRegister = mode === 'register';

  const inputStyle = [
    styles.input,
    { color: colors.text, backgroundColor: colors.backgroundElement },
  ];

  const validate = (): string => {
    if (!EMAIL_PATTERN.test(email.trim())) {
      return t('auth.errors.invalidEmail');
    }

    if (isRegister) {
      const nameLength = displayName.trim().length;
      if (nameLength < 2 || nameLength > 50) {
        return t('auth.errors.displayNameLength');
      }

      if (password.length < 8) {
        return t('auth.errors.passwordLength');
      }
    } else if (password.length === 0) {
      return t('auth.errors.passwordRequired');
    }

    return '';
  };

  const getErrorMessage = (cause: unknown): string => {
    if (cause instanceof ApiError) {
      if (cause.status === 0) {
        return t('auth.errors.network');
      }
      if (cause.status === 401) {
        return t('auth.errors.invalidCredentials');
      }
      if (cause.status === 409) {
        return t('auth.errors.emailTaken');
      }
    }

    return t('auth.errors.generic');
  };

  const submit = async () => {
    if (isSubmitting) {
      return;
    }

    const validationError = validate();
    if (validationError !== '') {
      setError(validationError);
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      if (isRegister) {
        await signUp(email.trim(), displayName.trim(), password);
      } else {
        await signIn(email.trim(), password);
      }
      // On success the root layout switches to the app, so there is nothing else to do here
    } catch (cause) {
      setError(getErrorMessage(cause));
      setIsSubmitting(false);
    }
  };

  const switchMode = () => {
    setMode(isRegister ? 'signIn' : 'register');
    setError('');
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ThemedText type="title" style={styles.title}>
            {isRegister ? t('auth.registerTitle') : t('auth.signInTitle')}
          </ThemedText>

          <TextInput
            style={inputStyle}
            value={email}
            onChangeText={setEmail}
            placeholder={t('auth.email')}
            placeholderTextColor="#888888"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            maxLength={256}
            editable={!isSubmitting}
          />

          {isRegister && (
            <TextInput
              style={inputStyle}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder={t('auth.displayName')}
              placeholderTextColor="#888888"
              maxLength={50}
              editable={!isSubmitting}
            />
          )}

          <TextInput
            style={inputStyle}
            value={password}
            onChangeText={setPassword}
            placeholder={t('auth.password')}
            placeholderTextColor="#888888"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={72}
            editable={!isSubmitting}
          />

          {error !== '' && <ThemedText type="small">{error}</ThemedText>}

          <Button
            title={isRegister ? t('auth.registerButton') : t('auth.signInButton')}
            onPress={submit}
            disabled={isSubmitting}
          />

          <Button
            title={isRegister ? t('auth.switchToSignIn') : t('auth.switchToRegister')}
            onPress={switchMode}
            disabled={isSubmitting}
          />
        </ScrollView>
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
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  title: {
    textAlign: 'center',
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
});