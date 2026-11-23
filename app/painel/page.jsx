'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { UserPlus, MessageCircle, Wallet, ArrowRight } from 'lucide-react';
import Dashboard from '@/components/Dashboard';
import { usePainel } from '@/components/AppShell';
import { Carregando, useToast } from '@/components/ui';
import { supabaseBrowser } from '@/lib/supabase/client';
import { carregarBase } from '@/lib/dados';
import { msgErro } from '@/lib/format';

export default function Page() {
  const { perfil } = usePainel();
  const toast = useToast();
  const [dados, setDados] = useState(null);
  const [wa, setWa] = useState(null);

  useEffect(() => {
    const sb = supabaseBrowser();
    carregarBase(sb).then(setDados).catch((e) => toast(msgErro(e), false));
    sb.from('whatsapp_instances').select('status').maybeSingle().then(({ data }) => setWa(data?.status || 'desconectado'));
  }, [toast]);

  if (!dados) return <Carregando />;
  const passos = [
    !dados.clientes.length && ['/painel/clientes?novo=1', UserPlus, 'Cadastre seu primeiro cliente', 'Nome, WhatsApp, plano e vencimento.'],
    wa && wa !== 'conectado' && ['/painel/whatsapp', MessageCircle, 'Conecte seu WhatsApp', 'Leia o QR Code para ativar as cobranças automáticas.'],
    !perfil.chave_pix && ['/painel/conta', Wallet, 'Informe sua chave Pix', 'Ela entra nas mensagens de cobrança.'],
  ].filter(Boolean);

  return (
    <>
      {passos.length > 0 && (
        <div className="no-print mb-5 grid gap-3 md:grid-cols-3">
          {passos.map(([href, I, t, d]) => (
            <Link key={href} href={href} className="card group flex items-center gap-3 p-4 hover:border-brand-cyan">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-cyan/10 text-brand-cyan"><I className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{t}</span><span className="block text-xs text-slate-500 dark:text-slate-400">{d}</span></span>
              <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      )}
      <Dashboard dados={dados} empresa={perfil.empresa || perfil.nome || 'RR Gestor'} />
    </>
  );
}
