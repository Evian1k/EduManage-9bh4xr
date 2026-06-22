import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, Pressable, TextInput } from 'react-native';
import { useAuth, useAlert } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import { BottomNav } from '@/components/layout/BottomNav';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { getBooks, getLibraryStats, getBorrows } from '@/services/library.service';

const NAV = [
  { label: 'Library', icon: 'local-library' as const, route: '/(librarian)/' },
  { label: 'Books', icon: 'menu-book' as const, route: '/(librarian)/books' },
  { label: 'Borrow', icon: 'import-contacts' as const, route: '/(librarian)/borrow' },
];

export default function LibrarianDashboard() {
  const { user, logout } = useAuth();
  const { showAlert } = useAlert();
  const { school } = useAppContext();
  const [stats, setStats] = useState<any>(null);
  const [books, setBooks] = useState<any[]>([]);
  const [borrowing, setBorrowing] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!school) return;
    const [statsRes, booksRes, borrowRes] = await Promise.all([
      getLibraryStats(school.id),
      getBooks(school.id),
      getBorrows(school.id, { status: 'borrowed' }),
    ]);
    setStats(statsRes);
    setBooks(booksRes.data || []);
    setBorrowing(borrowRes.data || []);
    setLoading(false);
  }, [school]);

  useEffect(() => { load(); }, [school]);

  if (loading) return <LoadingScreen message="Loading library..." />;

  const filtered = books.filter(b =>
    !search || b.title?.toLowerCase().includes(search.toLowerCase()) ||
    b.author?.toLowerCase().includes(search.toLowerCase()) ||
    b.category?.toLowerCase().includes(search.toLowerCase())
  );

  const overdue = borrowing.filter(r => new Date(r.due_date) < new Date());

  return (
    <View style={s.flex}>
      <Header
        title="Library Management"
        subtitle={school?.name}
        accentColor="#E65100"
        rightAction={{ icon: 'logout', onPress: () => showAlert('Sign Out', 'Sign out?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign Out', style: 'destructive', onPress: () => logout() }]) }}
      />
      <ScrollView style={s.flex} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Welcome */}
        <View style={s.welcomeRow}>
          <View style={s.avatar}><MaterialIcons name="local-library" size={22} color="#E65100" /></View>
          <View>
            <Text style={s.welcomeName}>{user?.username || 'Librarian'}</Text>
            <Text style={s.welcomeRole}>Library Management</Text>
          </View>
        </View>

        {/* Overdue Alert */}
        {overdue.length > 0 ? (
          <View style={s.overdueAlert}>
            <MaterialIcons name="warning" size={18} color={Colors.error} />
            <Text style={s.overdueText}>{overdue.length} overdue book{overdue.length > 1 ? 's' : ''} — action required</Text>
          </View>
        ) : null}

        {/* Stats */}
        <View style={s.statsGrid}>
          {[
            { label: 'Total Books', value: stats?.totalBooks || 0, icon: 'menu-book', color: '#E65100' },
            { label: 'Available', value: stats?.availableCopies || 0, icon: 'check-circle', color: Colors.success },
            { label: 'Borrowed', value: stats?.borrowedCount || 0, icon: 'import-contacts', color: Colors.primary },
            { label: 'Overdue', value: stats?.overdueCount || 0, icon: 'schedule', color: Colors.error },
          ].map(stat => (
            <View key={stat.label} style={s.statCard}>
              <MaterialIcons name={stat.icon as any} size={20} color={stat.color} />
              <Text style={[s.statNum, { color: stat.color }]}>{stat.value}</Text>
              <Text style={s.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Currently Borrowed */}
        {borrowing.length > 0 ? (
          <>
            <Text style={s.sectionTitle}>Currently Borrowed ({borrowing.length})</Text>
            {borrowing.slice(0, 5).map(r => {
              const isOverdue = new Date(r.due_date) < new Date();
              return (
                <Card key={r.id} style={[s.borrowCard, isOverdue && { borderColor: `${Colors.error}60` }]}>
                  <View style={s.borrowRow}>
                    <View style={[s.borrowIcon, { backgroundColor: isOverdue ? Colors.errorBg : Colors.infoBg }]}>
                      <MaterialIcons name="import-contacts" size={18} color={isOverdue ? Colors.error : Colors.primary} />
                    </View>
                    <View style={s.borrowInfo}>
                      <Text style={s.borrowTitle}>{r.library_books?.title || 'Unknown Book'}</Text>
                      <Text style={s.borrowAuthor}>{r.library_books?.author}</Text>
                      <Text style={s.borrower}>
                        {r.students ? `${r.students.full_name} ${r.}` : r.borrower_name || 'Unknown'}
                      </Text>
                    </View>
                    <View style={s.dueWrap}>
                      <Text style={[s.dueDate, { color: isOverdue ? Colors.error : Colors.textMuted }]}>
                        Due: {new Date(r.due_date).toLocaleDateString()}
                      </Text>
                      {isOverdue ? <Badge label="OVERDUE" variant="error" size="sm" /> : null}
                    </View>
                  </View>
                </Card>
              );
            })}
          </>
        ) : null}

        {/* Book Catalog */}
        <Text style={[s.sectionTitle, { marginTop: Spacing.md }]}>Book Catalog</Text>
        <View style={s.searchBox}>
          <MaterialIcons name="search" size={18} color={Colors.textMuted} />
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search by title, author, category..."
            placeholderTextColor={Colors.textMuted}
          />
        </View>
        {filtered.slice(0, 10).map(book => (
          <Card key={book.id} style={s.bookCard}>
            <View style={s.bookRow}>
              <View style={s.bookCover}>
                <MaterialIcons name="menu-book" size={24} color="#E65100" />
              </View>
              <View style={s.bookInfo}>
                <Text style={s.bookTitle}>{book.title}</Text>
                <Text style={s.bookAuthor}>{book.author}</Text>
                <View style={s.bookMeta}>
                  <Badge label={book.category} variant="default" size="sm" />
                  {book.location ? <Text style={s.bookLocation}>{book.location}</Text> : null}
                </View>
              </View>
              <View style={s.copiesWrap}>
                <Text style={[s.copiesNum, { color: book.available_copies > 0 ? Colors.success : Colors.error }]}>
                  {book.available_copies}
                </Text>
                <Text style={s.copiesLabel}>/ {book.total_copies}</Text>
                <Text style={s.copiesLabel}>avail.</Text>
              </View>
            </View>
          </Card>
        ))}
        {filtered.length === 0 && (
          <Card><Text style={s.emptyText}>No books found. Add books from the Books tab.</Text></Card>
        )}
      </ScrollView>
      <BottomNav items={NAV} accentColor="#E65100" />
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: 100, gap: Spacing.sm },
  welcomeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(230,81,0,0.15)', alignItems: 'center', justifyContent: 'center' },
  welcomeName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  welcomeRole: { fontSize: FontSize.sm, color: Colors.textSecondary },
  overdueAlert: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.errorBg, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: `${Colors.error}30` },
  overdueText: { flex: 1, fontSize: FontSize.sm, color: Colors.error, fontWeight: FontWeight.semibold },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: Colors.border },
  statNum: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold },
  statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'center' },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  borrowCard: { borderWidth: 1, borderColor: Colors.border },
  borrowRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  borrowIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  borrowInfo: { flex: 1, gap: 2 },
  borrowTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  borrowAuthor: { fontSize: FontSize.xs, color: Colors.textMuted },
  borrower: { fontSize: FontSize.sm, color: Colors.textSecondary },
  dueWrap: { alignItems: 'flex-end', gap: 4 },
  dueDate: { fontSize: FontSize.xs },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.sm, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: FontSize.base },
  bookCard: {},
  bookRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  bookCover: { width: 44, height: 56, borderRadius: 6, backgroundColor: 'rgba(230,81,0,0.12)', alignItems: 'center', justifyContent: 'center' },
  bookInfo: { flex: 1, gap: 4 },
  bookTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  bookAuthor: { fontSize: FontSize.xs, color: Colors.textSecondary },
  bookMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  bookLocation: { fontSize: FontSize.xs, color: Colors.textMuted },
  copiesWrap: { alignItems: 'center', gap: 1 },
  copiesNum: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  copiesLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  emptyText: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', padding: Spacing.sm },
});
