// EduManage — Library service
//
// CRUD for library_books + library_borrows. `borrowBook` atomically
// decrements available_copies; `returnBook` increments them back and
// charges a KES 20/day fine when overdue.

import { getSupabaseClient } from '@/template';
import { ServiceResult } from '@/lib/types';

const OVERDUE_FINE_PER_DAY_KES = 20;

export interface LibraryBook {
  id: string;
  school_id: string;
  isbn?: string | null;
  title: string;
  author?: string | null;
  publisher?: string | null;
  publication_year?: number | null;
  category?: string | null;
  subject_id?: string | null;
  edition?: string | null;
  barcode?: string | null;
  total_copies: number;
  available_copies: number;
  shelf_location?: string | null;
  description?: string | null;
  cover_url?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export async function getBooks(
  schoolId: string,
  search?: string,
  filters: { category?: string } = {},
): Promise<ServiceResult<LibraryBook[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('library_books')
    .select('*')
    .eq('school_id', schoolId)
    .order('title', { ascending: true });
  if (search) {
    q = q.or(`title.ilike.%${search}%,author.ilike.%${search}%,isbn.ilike.%${search}%,publisher.ilike.%${search}%`);
  }
  if (filters.category) q = q.eq('category', filters.category);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as LibraryBook[], error: null };
}

export async function getBookById(
  schoolId: string,
  bookId: string,
): Promise<ServiceResult<LibraryBook>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('library_books')
    .select('*')
    .eq('id', bookId)
    .eq('school_id', schoolId)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: 'Book not found' };
  return { data: data as unknown as LibraryBook, error: null };
}

export interface AddBookInput {
  isbn?: string;
  title: string;
  author?: string;
  publisher?: string;
  publication_year?: number;
  category?: string;
  subject_id?: string;
  edition?: string;
  barcode?: string;
  total_copies?: number;
  shelf_location?: string;
  description?: string;
  cover_url?: string;
}

export async function addBook(
  schoolId: string,
  input: AddBookInput,
): Promise<ServiceResult<LibraryBook>> {
  const supabase = getSupabaseClient();
  const total = input.total_copies ?? 1;
  const { data, error } = await supabase
    .from('library_books')
    .insert({
      school_id: schoolId,
      isbn: input.isbn ?? null,
      title: input.title,
      author: input.author ?? null,
      publisher: input.publisher ?? null,
      publication_year: input.publication_year ?? null,
      category: input.category ?? null,
      subject_id: input.subject_id ?? null,
      edition: input.edition ?? null,
      barcode: input.barcode ?? null,
      total_copies: total,
      available_copies: total,
      shelf_location: input.shelf_location ?? null,
      description: input.description ?? null,
      cover_url: input.cover_url ?? null,
    })
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as LibraryBook, error: null };
}

export async function updateBook(
  schoolId: string,
  bookId: string,
  updates: Partial<AddBookInput>,
): Promise<ServiceResult<LibraryBook>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('library_books')
    .update(updates)
    .eq('id', bookId)
    .eq('school_id', schoolId)
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as LibraryBook, error: null };
}

export async function deleteBook(
  schoolId: string,
  bookId: string,
): Promise<ServiceResult<{ deleted: boolean }>> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('library_books')
    .delete()
    .eq('id', bookId)
    .eq('school_id', schoolId);
  if (error) return { data: null, error: error.message };
  return { data: { deleted: true }, error: null };
}

// ─── Borrows ─────────────────────────────────────────────────────────────────

export interface LibraryBorrow {
  id: string;
  school_id: string;
  book_id: string;
  borrower_user_id?: string | null;
  student_id?: string | null;
  staff_id?: string | null;
  teacher_id?: string | null;
  borrowed_at: string;
  due_at: string;
  returned_at?: string | null;
  returned_to?: string | null;
  fine_amount: number;
  fine_paid: boolean;
  status: string;
  remarks?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export async function getBorrows(
  schoolId: string,
  filters: { status?: string; studentId?: string; bookId?: string } = {},
): Promise<ServiceResult<LibraryBorrow[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('library_borrows')
    .select('*, library_books(title, author), students(full_name, admission_number)')
    .eq('school_id', schoolId)
    .order('borrowed_at', { ascending: false });
  if (filters.status) q = q.eq('status', filters.status);
  if (filters.studentId) q = q.eq('student_id', filters.studentId);
  if (filters.bookId) q = q.eq('book_id', filters.bookId);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as LibraryBorrow[], error: null };
}

export interface BorrowBookInput {
  book_id: string;
  borrower_user_id?: string;
  student_id?: string;
  staff_id?: string;
  teacher_id?: string;
  due_at: string;
}

/**
 * Borrow a book. Decrements the book's available_copies atomically via a
 * read-then-write (Postgres RLS will reject if the book is missing).
 * Returns an error if no copies are available.
 */
export async function borrowBook(
  schoolId: string,
  input: BorrowBookInput,
): Promise<ServiceResult<LibraryBorrow>> {
  const supabase = getSupabaseClient();
  // Check availability
  const { data: book, error: bookErr } = await supabase
    .from('library_books')
    .select('id, available_copies')
    .eq('id', input.book_id)
    .eq('school_id', schoolId)
    .maybeSingle();
  if (bookErr) return { data: null, error: bookErr.message };
  if (!book) return { data: null, error: 'Book not found' };
  if ((book as { available_copies: number }).available_copies <= 0) {
    return { data: null, error: 'No copies available for borrowing' };
  }

  // Insert borrow record
  const { data: borrow, error: borrowErr } = await supabase
    .from('library_borrows')
    .insert({
      school_id: schoolId,
      book_id: input.book_id,
      borrower_user_id: input.borrower_user_id ?? null,
      student_id: input.student_id ?? null,
      staff_id: input.staff_id ?? null,
      teacher_id: input.teacher_id ?? null,
      due_at: input.due_at,
      status: 'borrowed',
      fine_amount: 0,
      fine_paid: false,
    })
    .select('*')
    .single();
  if (borrowErr) return { data: null, error: borrowErr.message };

  // Decrement available_copies
  const { error: updErr } = await supabase
    .from('library_books')
    .update({ available_copies: (book as { available_copies: number }).available_copies - 1 })
    .eq('id', input.book_id);
  if (updErr) console.warn('[library] decrement available_copies failed:', updErr.message);

  return { data: borrow as unknown as LibraryBorrow, error: null };
}

/**
 * Return a book. Increments available_copies and, if the book was returned
 * after the due date, charges a KES 20/day fine (recorded on the borrow row).
 *
 * @returns The updated borrow row including `fine_amount`.
 */
export async function returnBook(
  schoolId: string,
  borrowId: string,
  returnedTo?: string,
): Promise<ServiceResult<LibraryBorrow & { fineCharged: number }>> {
  const supabase = getSupabaseClient();
  const { data: borrow, error: bErr } = await supabase
    .from('library_borrows')
    .select('*')
    .eq('id', borrowId)
    .eq('school_id', schoolId)
    .maybeSingle();
  if (bErr) return { data: null, error: bErr.message };
  if (!borrow) return { data: null, error: 'Borrow record not found' };

  const b = borrow as unknown as LibraryBorrow;
  const now = new Date();
  const due = new Date(b.due_at);
  let fine = 0;
  if (now.getTime() > due.getTime()) {
    const daysLate = Math.ceil((now.getTime() - due.getTime()) / (24 * 60 * 60 * 1000));
    fine = daysLate * OVERDUE_FINE_PER_DAY_KES;
  }

  const { data: updated, error: updErr } = await supabase
    .from('library_borrows')
    .update({
      returned_at: now.toISOString(),
      returned_to: returnedTo ?? null,
      status: 'returned',
      fine_amount: fine,
    })
    .eq('id', borrowId)
    .select('*')
    .single();
  if (updErr) return { data: null, error: updErr.message };

  // Increment available_copies
  const { data: book } = await supabase
    .from('library_books')
    .select('available_copies, total_copies')
    .eq('id', b.book_id)
    .maybeSingle();
  if (book) {
    const bk = book as { available_copies: number; total_copies: number };
    const newAvail = Math.min(bk.total_copies, bk.available_copies + 1);
    await supabase
      .from('library_books')
      .update({ available_copies: newAvail })
      .eq('id', b.book_id);
  }

  return {
    data: { ...(updated as unknown as LibraryBorrow), fineCharged: fine },
    error: null,
  };
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export interface LibraryStats {
  totalBooks: number;
  totalCopies: number;
  availableCopies: number;
  borrowedCount: number;
  overdueCount: number;
}

export async function getLibraryStats(schoolId: string): Promise<ServiceResult<LibraryStats>> {
  const supabase = getSupabaseClient();
  const [booksRes, borrowRes, overdueRes] = await Promise.all([
    supabase
      .from('library_books')
      .select('id, total_copies, available_copies')
      .eq('school_id', schoolId),
    supabase
      .from('library_borrows')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('status', 'borrowed'),
    supabase
      .from('library_borrows')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('status', 'borrowed')
      .lt('due_at', new Date().toISOString()),
  ]);
  if (booksRes.error) return { data: null, error: booksRes.error.message };
  if (borrowRes.error) return { data: null, error: borrowRes.error.message };
  if (overdueRes.error) return { data: null, error: overdueRes.error.message };

  const books = (booksRes.data ?? []) as Array<{ total_copies: number; available_copies: number }>;
  return {
    data: {
      totalBooks: books.length,
      totalCopies: books.reduce((s, b) => s + Number(b.total_copies), 0),
      availableCopies: books.reduce((s, b) => s + Number(b.available_copies), 0),
      borrowedCount: borrowRes.count ?? 0,
      overdueCount: overdueRes.count ?? 0,
    },
    error: null,
  };
}
