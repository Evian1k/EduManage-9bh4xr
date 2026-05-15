import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, BorderRadius, FontSize, Spacing } from '@/constants/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: keyof typeof MaterialIcons.glyphMap;
  rightIcon?: keyof typeof MaterialIcons.glyphMap;
  onRightIconPress?: () => void;
  hint?: string;
}

export function Input({
  label,
  error,
  leftIcon,
  rightIcon,
  onRightIconPress,
  hint,
  secureTextEntry,
  ...props
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isPassword = secureTextEntry;
  const effectiveSecure = isPassword ? !showPassword : false;

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputWrapper, focused && styles.focused, error ? styles.errorBorder : null]}>
        {leftIcon ? (
          <MaterialIcons name={leftIcon} size={18} color={Colors.textSecondary} style={styles.leftIcon} />
        ) : null}
        <TextInput
          style={[styles.input, leftIcon ? styles.inputWithLeft : null]}
          placeholderTextColor={Colors.textMuted}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          secureTextEntry={effectiveSecure}
          {...props}
        />
        {isPassword ? (
          <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.rightIcon}>
            <MaterialIcons
              name={showPassword ? 'visibility-off' : 'visibility'}
              size={18}
              color={Colors.textSecondary}
            />
          </Pressable>
        ) : rightIcon ? (
          <Pressable onPress={onRightIconPress} style={styles.rightIcon}>
            <MaterialIcons name={rightIcon} size={18} color={Colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {hint && !error ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface2,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 48,
  },
  focused: { borderColor: Colors.primary },
  errorBorder: { borderColor: Colors.error },
  leftIcon: { marginLeft: Spacing.md },
  rightIcon: { paddingHorizontal: Spacing.md },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.base,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  inputWithLeft: { paddingLeft: Spacing.sm },
  errorText: { fontSize: FontSize.xs, color: Colors.error },
  hint: { fontSize: FontSize.xs, color: Colors.textMuted },
});
