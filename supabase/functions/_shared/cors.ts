// Shared CORS headers for all EduManage edge functions.
// Allow any origin (functions are token-authenticated) and the headers
// used by the Supabase JS client plus our internal x-cron-key header.
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};
