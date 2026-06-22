// EduManage — Search service
//
// Global search across students, teachers, library_books, and announcements.
// Uses Postgres FTS (`search_vector` column if present) with an ILIKE
// fallback for tables that don't have a generated search_vector.

import { getSupabaseClient } from '@/template';
import { ServiceResult } from '@/lib/types';

export interface SearchResult {
  type: 'student' | 'teacher' | 'book' | 'announcement';
  id: string;
  title: string;
  subtitle?: string;
  meta?: Record<string, unknown>;
}

export async function globalSearch(
  schoolId: string,
  query: string,
  limit = 20,
): Promise<ServiceResult<SearchResult[]>> {
  const supabase = getSupabaseClient();
  const q = query.trim();
  if (!q) return { data: [], error: null };

  const ilike = `%${q.replace(/[%_]/g, (m) => '\\' + m)}%`;
  const results: SearchResult[] = [];

  // Students
  const studentsRes = await supabase
    .from('students')
    .select('id, full_name, admission_number, status, classes(name)')
    .eq('school_id', schoolId)
    .or(`full_name.ilike.${ilike},admission_number.ilike.${ilike},national_id.ilike.${ilike}`)
    .limit(limit);
  if (studentsRes.error) return { data: null, error: studentsRes.error.message };
  for (const s of (studentsRes.data ?? []) as Array<{
    id: string;
    full_name: string;
    admission_number: string;
    status: string;
    classes: { name: string } | null;
  }>) {
    results.push({
      type: 'student',
      id: s.id,
      title: s.full_name,
      subtitle: `${s.admission_number} • ${s.classes?.name ?? 'No class'}`,
      meta: { status: s.status, admission_number: s.admission_number },
    });
  }

  // Teachers
  const teachersRes = await supabase
    .from('teachers')
    .select('id, full_name, employee_number, department, status')
    .eq('school_id', schoolId)
    .or(`full_name.ilike.${ilike},employee_number.ilike.${ilike},tsc_number.ilike.${ilike}`)
    .limit(limit);
  if (teachersRes.error) return { data: null, error: teachersRes.error.message };
  for (const t of (teachersRes.data ?? []) as Array<{
    id: string;
    full_name: string;
    employee_number: string;
    department?: string | null;
    status: string;
  }>) {
    results.push({
      type: 'teacher',
      id: t.id,
      title: t.full_name,
      subtitle: `${t.employee_number} • ${t.department ?? 'Staff'}`,
      meta: { department: t.department, status: t.status },
    });
  }

  // Library books
  const booksRes = await supabase
    .from('library_books')
    .select('id, title, author, isbn, available_copies, total_copies')
    .eq('school_id', schoolId)
    .or(`title.ilike.${ilike},author.ilike.${ilike},isbn.ilike.${ilike}`)
    .limit(limit);
  if (booksRes.error) return { data: null, error: booksRes.error.message };
  for (const b of (booksRes.data ?? []) as Array<{
    id: string;
    title: string;
    author?: string | null;
    isbn?: string | null;
    available_copies: number;
    total_copies: number;
  }>) {
    results.push({
      type: 'book',
      id: b.id,
      title: b.title,
      subtitle: `${b.author ?? 'Unknown author'} • ${b.available_copies}/${b.total_copies} available`,
      meta: { isbn: b.isbn, available_copies: b.available_copies },
    });
  }

  // Announcements
  const announcementsRes = await supabase
    .from('announcements')
    .select('id, title, body, category, published_at')
    .eq('school_id', schoolId)
    .or(`title.ilike.${ilike},body.ilike.${ilike}`)
    .order('published_at', { ascending: false })
    .limit(limit);
  if (announcementsRes.error) return { data: null, error: announcementsRes.error.message };
  for (const a of (announcementsRes.data ?? []) as Array<{
    id: string;
    title: string;
    body?: string | null;
    category?: string | null;
    published_at: string;
  }>) {
    results.push({
      type: 'announcement',
      id: a.id,
      title: a.title,
      subtitle: a.body ? a.body.slice(0, 80) + (a.body.length > 80 ? '…' : '') : '',
      meta: { category: a.category, published_at: a.published_at },
    });
  }

  // Sort: best matches first (those whose title starts with the query)
  const lower = q.toLowerCase();
  results.sort((a, b) => {
    const aStarts = a.title.toLowerCase().startsWith(lower) ? 0 : 1;
    const bStarts = b.title.toLowerCase().startsWith(lower) ? 0 : 1;
    if (aStarts !== bStarts) return aStarts - bStarts;
    return a.title.localeCompare(b.title);
  });

  return { data: results.slice(0, limit), error: null };
}
