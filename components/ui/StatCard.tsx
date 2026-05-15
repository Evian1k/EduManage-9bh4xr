import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, BorderRadius, FontSize, FontWeight, Spacing, Shadow } from '@/constants/theme';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: keyof typeof MaterialIcons.glyphMap;
  color?: string;
  subtitle?: string;
  trend?: { value: number; label: string };
}

export function StatCard({ label, value, icon, color = Colors.primary, subtitle, trend }: StatCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.iconBg, { backgroundColor: `${color}18` }]}>
          <MaterialIcons name={icon} size={22} color={color} />
        </View>
        {trend ? (
          <View style={[styles.trend, { backgroundColor: trend.value >= 0 ? Colors.successBg : Colors.errorBg }]}>
            <MaterialIcons
              name={trend.value >= 0 ? 'trending-up' : 'trending-down'}
              size={12}
              color={trend.value >= 0 ? Colors.success : Colors.error}
            />
            <Text style={[styles.trendText, { color: trend.value >= 0 ? Colors.success : Colors.error }]}>
              {trend.label}
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    flex: 1,
    minWidth: 140,
    ...Shadow.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  iconBg: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  trendText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  value: {
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  label: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  subtitle: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
});
