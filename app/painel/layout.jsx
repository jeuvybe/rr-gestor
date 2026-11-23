import { redirect } from 'next/navigation';
import { sessaoAtual } from '@/lib/supabase/server';
import AppShell from '@/components/AppShell';

export const dynamic = 'force-dynamic';

export default async function PainelLayout({ children }) {
  const { sb, user, perfil } = await sessaoAtual();
  if (!user || !perfil) redirect('/login');
  const { data: uso } = await sb.rpc('meu_uso');
  return <AppShell perfil={perfil} uso={uso?.[0] || null} area="painel">{children}</AppShell>;
}
