import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export type AppInputProps = TextInputProps;

export function AppInput({ style, ...rest }: AppInputProps) {
  const theme = useTheme();

  return (
    <TextInput
      placeholderTextColor={theme.textSecondary}
      style={[
        styles.input,
        { color: theme.text, backgroundColor: theme.backgroundElement },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
});