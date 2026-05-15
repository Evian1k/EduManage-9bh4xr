import React from 'react';
import { View, StyleSheet, Pressable, ViewStyle } from 'react-native';
import { Colors, BorderRadius, Spacing, Shadow } from '@/constants/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  elevated?: boolean;
  padding?: number;
}

export function Card({ children, style, onPress, elevated = false, padding = Spacing.md }: CardProps) {
  const containerStyle = [styles.card, elevated && styles.elevated, { padding }, style];

  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [...containerStyle, pressed && styles.pressed]}
        onPress={onPress}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={containerStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  elevated: {
    backgroundColor: Colors.surface2,
    ...Shadow.md,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
});
