import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, BorderRadius, FontSize } from '@/constants/theme';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'default' | 'primary' | 'gold';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
}

const variantColors: Record<BadgeVariant, { bg: string; text: string }> = {
  success: { bg: Colors.successBg, text: Colors.success },
  warning: { bg: Colors.warningBg, text: Colors.warning },
  error: { bg: Colors.errorBg, text: Colors.error },
  info: { bg: Colors.infoBg, text: Colors.info },
  default: { bg: Colors.surface2, text: Colors.textSecondary },
  primary: { bg: Colors.schoolAdminBg, text: Colors.primary },
  gold: { bg: Colors.superAdminBg, text: Colors.superAdmin },
};

export function Badge({ label, variant = 'default', size = 'md' }: BadgeProps) {
  const { bg, text } = variantColors[variant];
  return (
    <View style={[styles.badge, { backgroundColor: bg }, size === 'sm' && styles.sm]}>
      <Text style={[styles.label, { color: text }, size === 'sm' && styles.smText]}>{label}</Text>
    </View>
  );
}

export function getPlanBadgeVariant(plan: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    free_trial: 'default',
    basic: 'success',
    pro: 'primary',
    enterprise: 'gold',
  };
  return map[plan] || 'default';
}

export function getStatusBadgeVariant(status: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    active: 'success',
    trial: 'warning',
    suspended: 'error',
    cancelled: 'error',
    open: 'warning',
    in_progress: 'info',
    resolved: 'success',
    closed: 'default',
    present: 'success',
    absent: 'error',
    late: 'warning',
    excused: 'info',
  };
  return map[status] || 'default';
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  sm: { paddingHorizontal: 7, paddingVertical: 2 },
  label: { fontSize: FontSize.sm, fontWeight: '600' },
  smText: { fontSize: FontSize.xs },
});
