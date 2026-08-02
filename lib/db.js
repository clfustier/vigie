import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

export const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);

// Comparaison à temps constant (évite une fuite d'info par timing attack sur la clé admin)
function safeEqual(a, b) {
  const ba = Buffer.from(String(a ?? ''));
  const bb = Buffer.from(String(b ?? ''));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export function requireAdmin(req, res) {
  const key = req.headers['x-admin-key'] || req.query?.key;
  const isCron = req.headers['x-vercel-cron'] === '1' || req.headers['user-agent']?.includes('vercel-cron');
  if (!isCron && (!process.env.ADMIN_KEY || !safeEqual(key, process.env.ADMIN_KEY))) {
    res.status(401).json({ error: 'unauthorized' });
    return false;
  }
  return true;
}
