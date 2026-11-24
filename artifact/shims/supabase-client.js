import { createClient } from '@supabase/supabase-js';
// Sessão guardada em memória (a página publicada pode não ter cookies nem localStorage)
const memoria = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };
let cliente;
export function supabaseBrowser() {
  if (!cliente) cliente = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { storage: memoria(), persistSession: true, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'rr-demo' } });
  return cliente;
}
let admin;
export function supabaseAdmin() {
  if (!admin) admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { storage: memoria(), persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'rr-demo-admin' } });
  return admin;
}
