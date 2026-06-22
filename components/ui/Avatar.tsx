import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, BorderRadius, FontWeight } from '@/constants/theme';
import { getInitials } from '@/constants/config';

const COLORS = [
  '#2196F3', '#AB47BC', '#00B4D8', '#4CAF50',
  '#FF9800', '#F44336', '#FFD60A', '#26A69A',
];

function getColorForName(name: string): string {
  const index = name.charCodeAt(0) % COLORS.length;
  return COLORS[index];
}

interface AvatarProps {
  name: string;
  size?: number;
  imageUrl?: string;
}

export function Avatar({ name, size = 40, imageUrl }: AvatarProps) {
  const initials = getInitials(name || 'U');
  const bg = getColorForName(name || 'U');
  const fontSize = Math.max(10, size * 0.38);

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: `${bg}30`,
          borderColor: `${bg}60`,
        },
      ]}
    >
      <Text style={[styles.initials, { fontSize, color: bg }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  initials: {
    fontWeight: FontWeight.bold,
  },
});
