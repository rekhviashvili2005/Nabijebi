import * as SecureStore from 'expo-secure-store';

const LANGUAGE_KEY = 'app_language';

export type AppLanguage = 'ka' | 'en';

export async function getSavedLanguage(): Promise<AppLanguage | null> {
  try {
    const value = await SecureStore.getItemAsync(LANGUAGE_KEY);
    return value === 'ka' || value === 'en' ? value : null;
  } catch {
    return null;
  }
}

export async function saveLanguage(language: AppLanguage): Promise<void> {
  try {
    await SecureStore.setItemAsync(LANGUAGE_KEY, language);
  } catch {
    // The language still changes for this session even if saving fails
  }
}