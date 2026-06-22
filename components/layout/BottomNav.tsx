import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/theme';

export interface NavItem {
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  route: string;
}

interface BottomNavProps {
  items: NavItem[];
  accentColor?: string;
}

export function BottomNav({ items, accentColor = Colors.primary }: BottomNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: Platform.select({
            ios: insets.bottom + 4,
            android: insets.bottom + 4,
            default: 8,
          }),
          height: Platform.select({
            ios: insets.bottom + 64,
            android: insets.bottom + 64,
            default: 72,
          }),
        },
      ]}
    >
      {items.map((item) => {
        const isActive = pathname === item.route || pathname.startsWith(item.route + '/');
        return (
          <Pressable
            key={item.route}
            style={styles.tab}
            onPress={() => router.push(item.route as any)}
            hitSlop={4}
          >
            <View style={[styles.iconWrap, isActive && { backgroundColor: `${accentColor}18` }]}>
              <MaterialIcons
                name={item.icon}
                size={22}
                color={isActive ? accentColor : Colors.textMuted}
              />
            </View>
            <Text style={[styles.label, { color: isActive ? accentColor : Colors.textMuted }]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 8,
    paddingHorizontal: Spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  iconWrap: {
    width: 40,
    height: 32,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
});
