import { createClient } from '@supabase/supabase-js';

export const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);

export function requireAdmin(req, res) {
  const key = req.headers['x-admin-key'] || req.query?.key;
  const isCron = req.headers['x-vercel-cron'] === '1' || req.headers['user-agent']?.includes('vercel-cron');
  if (!isCron && key !== process.env.ADMIN_KEY) {
    res.status(401).json({ error: 'unauthorized' });
    return false;
  }
  return true;
}
