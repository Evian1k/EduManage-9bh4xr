import { getSupabaseClient } from '@/template';

export interface LibraryBook {
  id: string;
  school_id: string;
  title: string;
  author: string;
  isbn?: string;
  category: string;
  total_copies: number;
  available_copies: number;
  location?: string;
  description?: string;
  published_year?: number;
  created_at: string;
}

export interface BorrowRecord {
  id: string;
  book_id: string;
  student_id?: string;
  borrower_name?: string;
  borrowed_at: string;
  due_date: string;
  returned_at?: string;
  fine_amount: number;
  fine_paid: boolean;
  status: string;
  library_books?: { title: string; author: string };
  students?: { first_name: string; last_name: string };
}

export async function getLibraryBooks(schoolId: string, search?: string) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('library_books')
    .select('*')
    .eq('school_id', schoolId)
    .order('title');
  if (search) {
    query = query.or(`title.ilike.%${search}%,author.ilike.%${search}%,isbn.ilike.%${search}%`);
  }
  return query;
}

export async function createBook(schoolId: string, book: Partial<LibraryBook>) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('library_books')
    .insert({ ...book, school_id: schoolId, available_copies: book.total_copies ?? 1 })
    .select()
    .single();
  return { data, error };
}

export async function updateBook(bookId: string, updates: Partial<LibraryBook>) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('library_books')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', bookId)
    .select()
    .single();
  return { data, error };
}

export async function getBorrowRecords(schoolId: string, status?: string) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('borrow_records')
    .select('*, library_books(title, author), students(first_name, last_name, admission_number)')
    .eq('school_id', schoolId)
    .order('borrowed_at', { ascending: false });
  if (status) query = query.eq('status', status);
  return query;
}

export async function borrowBook(schoolId: string, data: {
  book_id: string;
  student_id?: string;
  borrower_name?: string;
  due_date: string;
}) {
  const supabase = getSupabaseClient();
  // Decrement available copies directly
  const { data: bookData } = await supabase
    .from('library_books')
    .select('available_copies')
    .eq('id', data.book_id)
    .single();
  if (!bookData || bookData.available_copies <= 0) {
    return { data: null, error: new Error('No copies available') };
  }
  const { data: record, error } = await supabase
    .from('borrow_records')
    .insert({ ...data, school_id: schoolId, status: 'borrowed' })
    .select()
    .single();
  if (!error) {
    await supabase
      .from('library_books')
      .update({ available_copies: bookData.available_copies - 1 })
      .eq('id', data.book_id);
  }
  return { data: record, error };
}

export async function returnBook(recordId: string, bookId: string) {
  const supabase = getSupabaseClient();
  const { data: record, error } = await supabase
    .from('borrow_records')
    .update({ returned_at: new Date().toISOString(), status: 'returned' })
    .eq('id', recordId)
    .select()
    .single();
  if (!error) {
    // Increment available copies on return
    const { data: bookData } = await supabase
      .from('library_books')
      .select('available_copies, total_copies')
      .eq('id', bookId)
      .single();
    if (bookData) {
      await supabase
        .from('library_books')
        .update({ available_copies: Math.min(bookData.total_copies, bookData.available_copies + 1) })
        .eq('id', bookId);
    }
  }
  return { data: record, error };
}

export async function getLibraryStats(schoolId: string) {
  const supabase = getSupabaseClient();
  const [booksRes, borrowRes, overdueRes] = await Promise.all([
    supabase.from('library_books').select('id, total_copies, available_copies').eq('school_id', schoolId),
    supabase.from('borrow_records').select('id').eq('school_id', schoolId).eq('status', 'borrowed'),
    supabase.from('borrow_records').select('id').eq('school_id', schoolId).eq('status', 'borrowed').lt('due_date', new Date().toISOString()),
  ]);
  const books = booksRes.data || [];
  return {
    totalBooks: books.length,
    totalCopies: books.reduce((s, b) => s + b.total_copies, 0),
    availableCopies: books.reduce((s, b) => s + b.available_copies, 0),
    borrowedCount: borrowRes.data?.length || 0,
    overdueCount: overdueRes.data?.length || 0,
  };
}
