import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (lista) => {
        try { lista.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* chamado de Server Component: o middleware renova */ }
      },
    },
  });
}

/** Usuário logado + perfil (ou null). */
export async function sessaoAtual() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { sb, user: null, perfil: null };
  const { data: perfil } = await sb.from('profiles').select('*').eq('id', user.id).single();
  return { sb, user, perfil };
}
