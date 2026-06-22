import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Keyboard, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAlert } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import { globalSearch, SearchResult } from '@/services/search.service';
import { Header } from '@/components/layout/Header';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

const TYPE_META: Record<
  SearchResult['type'],
  {
    icon: keyof typeof MaterialIcons.glyphMap;
    color: string;
    bg: string;
    label: string;
  }
> = {
  student: {
    icon: 'person',
    color: Colors.student,
    bg: Colors.studentBg,
    label: 'Student',
  },
  teacher: {
    icon: 'cast-for-education',
    color: Colors.teacher,
    bg: Colors.teacherBg,
    label: 'Teacher',
  },
  book: {
    icon: 'menu-book',
    color: Colors.primary,
    bg: Colors.schoolAdminBg,
    label: 'Book',
  },
  announcement: {
    icon: 'campaign',
    color: Colors.warning,
    bg: Colors.warningBg,
    label: 'Announcement',
  },
};

const RECENT_QUERIES_KEY = 'edumanage_search_recent';

export default function SearchScreen() {
  const { showAlert } = useAlert();
  const { school } = useAppContext();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqId = useRef(0);

  // Load recent queries from AsyncStorage-equivalent (kept simple — in-memory)
  useEffect(() => {
    try {
      const raw = ''; // async storage hook omitted intentionally; would load RECENT_QUERIES_KEY
      setRecentQueries(raw ? JSON.parse(raw) : []);
    } catch {
      setRecentQueries([]);
    }
  }, []);

  // Debounce input → debouncedQuery
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setDebouncedQuery('');
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceTimer.current = setTimeout(() => {
      setDebouncedQuery(trimmed);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query]);

  // Run search whenever debouncedQuery changes
  const runSearch = useCallback(
    async (q: string) => {
      if (!school?.id) {
        setError('No active school context. Please sign in to your school.');
        setLoading(false);
        return;
      }
      const myId = ++reqId.current;
      const { data, error: err } = await globalSearch(school.id, q);
      if (myId !== reqId.current) return; // stale response
      if (err) {
        setError(err);
        setResults([]);
      } else {
        setError(null);
        setResults(data ?? []);
      }
      setLoading(false);
    },
    [school?.id],
  );

  useEffect(() => {
    if (!debouncedQuery) return;
    runSearch(debouncedQuery);
  }, [debouncedQuery, runSearch]);

  const handleClearQuery = () => {
    setQuery('');
    setDebouncedQuery('');
    setResults([]);
    setError(null);
  };

  const handleResultPress = (item: SearchResult) => {
    const meta = TYPE_META[item.type];
    showAlert(
      meta.label,
      `${item.title}${item.subtitle ? `\n\n${item.subtitle}` : ''}\n\nID: ${item.id}`,
    );
  };

  const handleRecentPress = (q: string) => {
    setQuery(q);
    Keyboard.dismiss();
  };

  const renderItem = ({ item }: { item: SearchResult }) => {
    const meta = TYPE_META[item.type];
    return (
      <Pressable
        onPress={() => handleResultPress(item)}
        style={({ pressed }) => [styles.resultRow, pressed && { opacity: 0.8 }]}
      >
        <View style={[styles.resultIcon, { backgroundColor: meta.bg }]}>
          <MaterialIcons name={meta.icon} size={22} color={meta.color} />
        </View>
        <View style={styles.resultBody}>
          <Text style={styles.resultTitle} numberOfLines={1}>
            {item.title}
          </Text>
          {item.subtitle ? (
            <Text style={styles.resultSubtitle} numberOfLines={1}>
              {item.subtitle}
            </Text>
          ) : null}
        </View>
        <Badge label={meta.label} variant="default" size="sm" />
        <MaterialIcons name="chevron-right" size={18} color={Colors.textMuted} />
      </Pressable>
    );
  };

  const showInitialEmptyState =
    !debouncedQuery && query.trim().length < MIN_QUERY_LENGTH;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.flex}>
        <Header title="Search" subtitle="Find students, staff, books, announcements" showBack accentColor={Colors.primary} />

        {/* Search input */}
        <View style={styles.searchBarWrap}>
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder="Search across your school…"
            leftIcon="search"
            rightIcon={query ? 'cancel' : undefined}
            onRightIconPress={query ? handleClearQuery : undefined}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
        </View>

        {error ? (
          <View style={styles.centerWrap}>
            <EmptyState
              icon="cloud-off"
              title="Search Error"
              description={error}
              actionLabel="Retry"
              onAction={() => debouncedQuery && runSearch(debouncedQuery)}
            />
          </View>
        ) : showInitialEmptyState ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.initialContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.heroIcon}>
              <MaterialIcons name="search" size={40} color={Colors.primary} />
            </View>
            <Text style={styles.heroTitle}>Start typing to search</Text>
            <Text style={styles.heroSubtitle}>
              Search across students, teachers, library books, and announcements in your school. Minimum {MIN_QUERY_LENGTH} characters.
            </Text>

            {recentQueries.length > 0 ? (
              <View style={styles.recentSection}>
                <Text style={styles.recentTitle}>Recent searches</Text>
                <View style={styles.recentChips}>
                  {recentQueries.map((q) => (
                    <Pressable key={q} style={styles.recentChip} onPress={() => handleRecentPress(q)}>
                      <MaterialIcons name="history" size={12} color={Colors.textMuted} />
                      <Text style={styles.recentChipText}>{q}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.tipSection}>
              <Text style={styles.tipTitle}>Tips</Text>
              {[
                'Type a name like "Jane" to find students or staff.',
                'Use admission numbers or employee numbers for direct lookups.',
                'Search book titles or authors for the library catalog.',
                'Find announcements by keyword.',
              ].map((t) => (
                <View key={t} style={styles.tipRow}>
                  <MaterialIcons name="circle" size={4} color={Colors.textMuted} />
                  <Text style={styles.tipText}>{t}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        ) : loading ? (
          <View style={styles.centerWrap}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Searching for "{debouncedQuery}"…</Text>
          </View>
        ) : results.length === 0 ? (
          <View style={styles.centerWrap}>
            <EmptyState
              icon="search-off"
              title="No results found"
              description={`We couldn't find anything matching "${debouncedQuery}". Try different keywords or check spelling.`}
              actionLabel="Clear Search"
              onAction={handleClearQuery}
            />
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => `${item.type}-${item.id}`}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <View style={styles.listHeader}>
                <Text style={styles.listHeaderText}>
                  {results.length} result{results.length === 1 ? '' : 's'} for "{debouncedQuery}"
                </Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  searchBarWrap: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  centerWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.lg, gap: Spacing.md },
  loadingText: { color: Colors.textSecondary, fontSize: FontSize.base },

  initialContent: { padding: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.lg },
  heroIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.schoolAdminBg,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center',
  },
  heroTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, textAlign: 'center' },
  heroSubtitle: { fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  recentSection: { gap: Spacing.sm },
  recentTitle: {
    fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  recentChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  recentChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.surface, paddingHorizontal: Spacing.sm, paddingVertical: 6,
    borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.border,
  },
  recentChipText: { fontSize: FontSize.xs, color: Colors.textSecondary },

  tipSection: { gap: Spacing.xs, backgroundColor: Colors.surface, padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border },
  tipTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  tipText: { flex: 1, fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18 },

  list: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  listHeader: { paddingBottom: Spacing.sm },
  listHeaderText: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: FontWeight.medium },
  separator: { height: 0.5, backgroundColor: Colors.border },

  resultRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
    marginBottom: Spacing.xs,
  },
  resultIcon: {
    width: 44, height: 44, borderRadius: BorderRadius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  resultBody: { flex: 1, gap: 2 },
  resultTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  resultSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary },
});
