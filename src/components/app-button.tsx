import { Pressable, StyleSheet, type PressableProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export type AppButtonProps = Omit<PressableProps, 'children'> & {
  title: string;
  // "primary" is the bright accent button, "secondary" is the quiet one
  variant?: 'primary' | 'secondary';
};

export function AppButton({ title, variant = 'primary', disabled, style, ...rest }: AppButtonProps) {
  const theme = useTheme();
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={(state) => [
        styles.button,
        { backgroundColor: isPrimary ? theme.accent : theme.backgroundElement },
        disabled && styles.disabled,
        state.pressed && styles.pressed,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}>
      <ThemedText
        style={styles.title}
        themeColor={isPrimary ? 'onAccent' : 'text'}>
        {title}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
  },
});