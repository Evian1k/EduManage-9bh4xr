// EduManage — School Marketplace service
// Second revenue stream: schools buy books, uniforms, software, LMS content,
// exam papers, teacher training from the marketplace.

import { getSupabaseClient } from '@/template';
import { ServiceResult } from '@/lib/types';

export interface MarketplaceProduct {
  id: string; title: string; description: string; category: string;
  price: number; currency: string; image_url?: string; rating: number;
  review_count: number; sales_count: number; stock_quantity: number;
  digital: boolean; vendor_name: string;
}

export async function getProducts(opts?: { category?: string; search?: string; limit?: number }): Promise<ServiceResult<MarketplaceProduct[]>> {
  const supabase = getSupabaseClient();
  let q = supabase.from('marketplace_products').select('*').eq('is_active', true).order('sales_count', { ascending: false });
  if (opts?.category) q = q.eq('category', opts.category);
  if (opts?.search) q = q.or(`title.ilike.%${opts.search}%,description.ilike.%${opts.search}%`);
  if (opts?.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  return { data: data as MarketplaceProduct[] | null, error: error?.message ?? null };
}

export async function getProductById(productId: string): Promise<ServiceResult<MarketplaceProduct>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('marketplace_products').select('*').eq('id', productId).single();
  return { data: data as MarketplaceProduct | null, error: error?.message ?? null };
}

export async function createProduct(product: Partial<MarketplaceProduct>): Promise<ServiceResult<MarketplaceProduct>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('marketplace_products').insert(product).select().single();
  return { data: data as MarketplaceProduct | null, error: error?.message ?? null };
}

export async function getCart(schoolId: string, userId: string): Promise<ServiceResult<any[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('marketplace_cart').select('*, marketplace_products(*)').eq('school_id', schoolId).eq('user_id', userId);
  return { data, error: error?.message ?? null };
}

export async function addToCart(schoolId: string, userId: string, productId: string, quantity: number = 1): Promise<ServiceResult<any>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('marketplace_cart').upsert({ school_id: schoolId, user_id: userId, product_id: productId, quantity }, { onConflict: 'school_id,user_id,product_id' }).select().single();
  return { data, error: error?.message ?? null };
}

export async function removeFromCart(cartId: string): Promise<ServiceResult<boolean>> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('marketplace_cart').delete().eq('id', cartId);
  return { data: !error, error: error?.message ?? null };
}

export async function placeOrder(schoolId: string, userId: string, items: { product_id: string; quantity: number }[], opts?: { shipping_address?: string; notes?: string }): Promise<ServiceResult<any>> {
  const supabase = getSupabaseClient();
  // Fetch product prices
  const productIds = items.map(i => i.product_id);
  const { data: products } = await supabase.from('marketplace_products').select('id, price, currency').in('id', productIds);
  const productMap = new Map((products || []).map((p: any) => [p.id, p]));
  const orderItems = items.map(i => {
    const p = productMap.get(i.product_id);
    return { product_id: i.product_id, quantity: i.quantity, unit_price: p?.price || 0, total_price: (p?.price || 0) * i.quantity };
  });
  const subtotal = orderItems.reduce((sum, i) => sum + Number(i.total_price), 0);
  const orderNumber = `MKT-${Date.now().toString().slice(-8)}`;
  const { data, error } = await supabase.from('marketplace_orders').insert({
    order_number: orderNumber, school_id: schoolId, ordered_by: userId,
    status: 'pending', subtotal, total_amount: subtotal,
    shipping_address: opts?.shipping_address, notes: opts?.notes,
  }).select().single();
  if (error) return { data: null, error: error.message };
  // Insert order items
  const itemsWithOrder = orderItems.map(i => ({ ...i, order_id: data.id }));
  await supabase.from('marketplace_order_items').insert(itemsWithOrder);
  // Clear cart
  await supabase.from('marketplace_cart').delete().eq('school_id', schoolId).eq('user_id', userId);
  return { data, error: null };
}

export async function getOrders(schoolId: string): Promise<ServiceResult<any[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('marketplace_orders').select('*, marketplace_order_items(*)').eq('school_id', schoolId).order('created_at', { ascending: false });
  return { data, error: error?.message ?? null };
}

export async function getAllOrders(): Promise<ServiceResult<any[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('marketplace_orders').select('*, schools(name), marketplace_order_items(*)').order('created_at', { ascending: false });
  return { data, error: error?.message ?? null };
}

export async function reviewProduct(productId: string, schoolId: string, userId: string, rating: number, title?: string, body?: string): Promise<ServiceResult<any>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('marketplace_reviews').insert({ product_id: productId, school_id: schoolId, reviewed_by: userId, rating, title, body }).select().single();
  return { data, error: error?.message ?? null };
}

export async function getMarketplaceStats(): Promise<ServiceResult<{ total_products: number; total_orders: number; total_revenue: number; pending_orders: number }>> {
  const supabase = getSupabaseClient();
  const [products, orders] = await Promise.all([
    supabase.from('marketplace_products').select('id', { count: 'exact', head: true }),
    supabase.from('marketplace_orders').select('total_amount, status'),
  ]);
  const totalRevenue = (orders.data || []).reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0);
  const pendingOrders = (orders.data || []).filter((o: any) => o.status === 'pending').length;
  return { data: { total_products: products.count || 0, total_orders: orders.data?.length || 0, total_revenue: totalRevenue, pending_orders: pendingOrders }, error: null };
}
