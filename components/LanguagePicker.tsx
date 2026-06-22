// EduManage — Language Picker component
// Dropdown/modal for selecting the app language.

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, FlatList } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation, LANGUAGES, LanguageCode } from '@/hooks/useTranslation';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';

interface LanguagePickerProps {
  compact?: boolean;
}

export function LanguagePicker({ compact = false }: LanguagePickerProps) {
  const { t, lang, setLanguage } = useTranslation();
  const [open, setOpen] = useState(false);
  const current = LANGUAGES[lang];

  const handleSelect = (code: LanguageCode) => {
    setLanguage(code);
    setOpen(false);
  };

  if (compact) {
    return (
      <>
        <Pressable style={s.compact} onPress={() => setOpen(true)}>
          <Text style={s.flag}>{current?.flag}</Text>
          <Text style={s.compactText}>{current?.nativeName}</Text>
          <MaterialIcons name="expand-more" size={16} color={Colors.textSecondary} />
        </Pressable>
        <LanguageModal
          visible={open}
          onClose={() => setOpen(false)}
          currentLang={lang}
          onSelect={handleSelect}
        />
      </>
    );
  }

  return (
    <>
      <Pressable style={s.full} onPress={() => setOpen(true)}>
        <View style={s.left}>
          <Text style={s.flag}>{current?.flag}</Text>
          <View>
            <Text style={s.label}>{t('settings.language')}</Text>
            <Text style={s.value}>{current?.nativeName} ({lang.toUpperCase()})</Text>
          </View>
        </View>
        <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
      </Pressable>
      <LanguageModal
        visible={open}
        onClose={() => setOpen(false)}
        currentLang={lang}
        onSelect={handleSelect}
      />
    </>
  );
}

function LanguageModal({
  visible,
  onClose,
  currentLang,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  currentLang: LanguageCode;
  onSelect: (code: LanguageCode) => void;
}) {
  const codes = Object.keys(LANGUAGES) as LanguageCode[];
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <View style={s.sheet}>
          <Text style={s.title}>Select Language</Text>
          <FlatList
            data={codes}
            keyExtractor={(item) => item}
            renderItem={({ item }) => {
              const lang = LANGUAGES[item];
              const selected = item === currentLang;
              return (
                <Pressable
                  style={[s.item, selected && s.itemSelected]}
                  onPress={() => onSelect(item)}
                >
                  <Text style={s.itemFlag}>{lang.flag}</Text>
                  <View style={s.itemInfo}>
                    <Text style={s.itemName}>{lang.nativeName}</Text>
                    <Text style={s.itemSub}>{lang.name} · {item.toUpperCase()}</Text>
                  </View>
                  {selected && <MaterialIcons name="check" size={20} color={Colors.primary} />}
                </Pressable>
              );
            }}
          />
        </View>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.surface2,
    borderRadius: BorderRadius.md,
  },
  flag: { fontSize: FontSize.md },
  compactText: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  full: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  label: { fontSize: FontSize.base, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  value: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    maxHeight: '60%',
  },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.md },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  itemSelected: { backgroundColor: `${Colors.primary}15` },
  itemFlag: { fontSize: FontSize.xl },
  itemInfo: { flex: 1 },
  itemName: { fontSize: FontSize.base, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  itemSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
});
