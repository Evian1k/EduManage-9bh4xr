import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { Colors, BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/theme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  fullWidth = false,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const containerStyle = [
    styles.base,
    styles[variant],
    styles[size],
    fullWidth && styles.fullWidth,
    isDisabled && styles.disabled,
  ];

  const textStyle = [styles.label, styles[`${variant}Text` as keyof typeof styles], styles[`${size}Text` as keyof typeof styles]];

  return (
    <Pressable
      style={({ pressed }) => [...containerStyle, pressed && !isDisabled && styles.pressed]}
      onPress={onPress}
      disabled={isDisabled}
      hitSlop={8}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? Colors.textPrimary : Colors.primary}
        />
      ) : (
        <View style={styles.content}>
          {icon && <View style={styles.icon}>{icon}</View>}
          <Text style={textStyle}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  icon: { marginRight: 2 },
  fullWidth: { width: '100%' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.4 },

  // Variants
  primary: { backgroundColor: Colors.primary },
  secondary: { backgroundColor: Colors.surface2 },
  outline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.primary },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: Colors.error },

  // Text colors
  primaryText: { color: Colors.textPrimary },
  secondaryText: { color: Colors.textPrimary },
  outlineText: { color: Colors.primary },
  ghostText: { color: Colors.textSecondary },
  dangerText: { color: Colors.textPrimary },

  // Sizes
  sm: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, minHeight: 36 },
  md: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm + 2, minHeight: 44 },
  lg: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, minHeight: 52 },

  // Size labels
  label: { fontWeight: FontWeight.semibold },
  smText: { fontSize: FontSize.sm },
  mdText: { fontSize: FontSize.base },
  lgText: { fontSize: FontSize.md },
});
