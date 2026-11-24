import { supabaseBrowser } from './supabase-client.js';
export async function supabaseServer() { return supabaseBrowser(); }
export async function sessaoAtual() {
  const sb = supabaseBrowser();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { sb, user: null, perfil: null };
  const { data: perfil } = await sb.from('profiles').select('*').eq('id', user.id).single();
  return { sb, user, perfil };
}
