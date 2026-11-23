import 'server-only';
import { sessaoAtual } from './supabase/server';

export const json = (dados, status = 200) => Response.json(dados, { status });
export const falha = (erro, status = 400) => Response.json({ erro }, { status });

/** Exige login. Devolve { sb, user, perfil } ou uma Response de erro. */
export async function exigirLogin({ admin = false } = {}) {
  const s = await sessaoAtual();
  if (!s.user || !s.perfil) return { resposta: falha('Faça login novamente.', 401) };
  if (admin && !s.perfil.is_admin) return { resposta: falha('Acesso restrito ao administrador.', 403) };
  return s;
}
