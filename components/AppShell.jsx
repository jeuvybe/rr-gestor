'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Users, Server, Wallet, Package, MessageCircle, UserCircle2, Shield, LogOut, Menu, X, Crown, AlertTriangle, Lock, Settings,
} from 'lucide-react';
import Logo from '@/components/Logo';
import { BotaoTema, ToastProvider } from '@/components/ui';
import { supabaseBrowser } from '@/lib/supabase/client';
import { fmtData, int } from '@/lib/format';

const Ctx = createContext(null);
export const usePainel = () => useContext(Ctx);

const NAV = [
  ['/painel', 'Dashboard', LayoutDashboard],
  ['/painel/clientes', 'Clientes', Users],
  ['/painel/servidores', 'Servidores', Server],
  ['/painel/financeiro', 'Financeiro', Wallet],
  ['/painel/planos', 'Planos', Package],
  ['/painel/whatsapp', 'WhatsApp', MessageCircle],
  ['/painel/conta', 'Conta e assinatura', UserCircle2],
];
const NAV_ADMIN = [
  ['/admin', 'Assinantes', Shield],
  ['/admin/planos', 'Planos do sistema', Crown],
  ['/admin/configuracoes', 'Configurações', Settings],
];

export default function AppShell({ perfil: perfilInicial, uso: usoInicial, area = 'painel', children }) {
  const sb = supabaseBrowser();
  const path = usePathname();
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [perfil, setPerfil] = useState(perfilInicial);
  const [uso, setUso] = useState(usoInicial);
  useEffect(() => setAberto(false), [path]);

  const recarregar = useCallback(async () => {
    const [{ data: u }, { data: p }] = await Promise.all([sb.rpc('meu_uso'), sb.from('profiles').select('*').eq('id', perfil.id).single()]);
    if (u?.[0]) setUso(u[0]);
    if (p) setPerfil(p);
  }, [sb, perfil.id]);

  const sair = async () => { await sb.auth.signOut(); router.replace('/login'); router.refresh(); };
  const ativo = (href) => (href === '/painel' || href === '/admin' ? path === href : path.startsWith(href));
  const pctUso = uso?.limite ? Math.min(100, (uso.usados / uso.limite) * 100) : 0;
  const nome = perfil.nome || perfil.email || perfil.telefone || 'Minha conta';

  const Item = ([href, rot, I]) => (
    <Link key={href} href={href} className={`flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${ativo(href) ? 'bg-brand-cyan/15 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}>
      <I className={`h-[18px] w-[18px] ${ativo(href) ? 'text-brand-cyan' : ''}`} />{rot}
      {ativo(href) && <span className="ml-auto h-5 w-1 rounded-full bg-brand-cyan" />}
    </Link>
  );

  const lateral = (
    <div className="flex h-full flex-col bg-brand-navy px-3 py-5 dark:bg-[#040D18]">
      <Link href="/painel" className="mb-6 flex items-center gap-2.5 px-2"><Logo claro className="h-7 w-9" /><span className="font-display text-[17px] font-bold text-white">RR Gestor</span></Link>
      <nav className="space-y-1">{NAV.map(Item)}</nav>
      {perfil.is_admin && (
        <>
          <div className="mb-2 mt-6 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Administração</div>
          <nav className="space-y-1">{NAV_ADMIN.map(Item)}</nav>
        </>
      )}
      {uso && (
        <Link href="/painel/conta" className="mt-auto block rounded-xl bg-white/5 p-3.5 text-white transition hover:bg-white/10">
          <div className="flex items-center justify-between text-xs"><span className="font-semibold">Plano {uso.plano_nome}</span><span className="text-slate-400">{uso.limite == null ? 'ilimitado' : `${int(uso.usados)}/${int(uso.limite)}`}</span></div>
          {uso.limite != null && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${pctUso >= 90 ? 'bg-amber-400' : 'bg-brand-cyan'}`} style={{ width: `${pctUso}%` }} /></div>}
          <div className="mt-2 text-[11px] text-slate-400">{uso.limite == null ? `${int(uso.usados)} clientes ativos` : pctUso >= 80 ? 'Quase no limite — ver planos' : 'clientes ativos no plano'}</div>
        </Link>
      )}
    </div>
  );

  return (
    <ToastProvider>
      <Ctx.Provider value={{ perfil, uso, recarregar, area }}>
        <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-[248px] lg:block">{lateral}</aside>
        {aberto && (
          <div className="no-print fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-brand-navy/60 backdrop-blur-sm" onClick={() => setAberto(false)} />
            <div className="absolute inset-y-0 left-0 w-[264px] shadow-2xl">{lateral}</div>
            <button onClick={() => setAberto(false)} aria-label="Fechar menu" className="absolute left-[272px] top-4 grid h-10 w-10 place-items-center rounded-full bg-white text-brand-navy"><X className="h-5 w-5" /></button>
          </div>
        )}
        <div className="print-full lg:pl-[248px]">
          <header data-app className="no-print sticky top-0 z-20 border-b border-line bg-white/85 backdrop-blur transition-colors dark:border-night-line dark:bg-night-card/80">
            <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 sm:px-6">
              <button onClick={() => setAberto(true)} aria-label="Abrir menu" className="grid h-10 w-10 place-items-center rounded-lg border border-line lg:hidden dark:border-night-line"><Menu className="h-5 w-5" /></button>
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-[15px] font-bold">{perfil.empresa || nome}</div>
                <div className="truncate text-xs text-slate-500 dark:text-slate-400">{area === 'admin' ? 'Painel administrador' : 'Painel de gestão'}</div>
              </div>
              <BotaoTema />
              <button onClick={sair} className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-brand-navy dark:hover:bg-night-soft dark:hover:text-white"><LogOut className="h-4 w-4" /><span className="hidden sm:inline">Sair</span></button>
            </div>
          </header>
          {area === 'painel' && uso?.status === 'bloqueado' && (
            <Aviso tom="vermelho" I={Lock}>Sua conta está bloqueada: você consegue consultar os dados, mas não cadastrar clientes nem enviar cobranças. Fale com o suporte.</Aviso>
          )}
          {area === 'painel' && uso?.vencido && uso?.status !== 'bloqueado' && (
            <Aviso tom="ambar" I={AlertTriangle}>Seu plano pago venceu em {fmtData(uso.expira_em)}. Até a renovação, vale o limite do plano {uso.plano_nome} ({uso.limite ?? '∞'} clientes). <Link href="/painel/conta" className="font-semibold underline">Renovar</Link></Aviso>
          )}
          <main className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6">{children}</main>
        </div>
      </Ctx.Provider>
    </ToastProvider>
  );
}

function Aviso({ tom, I, children }) {
  const c = tom === 'vermelho' ? 'bg-rose-600 text-white' : 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200';
  return <div className={`no-print flex items-center gap-2 px-4 py-2.5 text-sm sm:px-6 ${c}`}><I className="h-4 w-4 shrink-0" /><span>{children}</span></div>;
}

/** Cabeçalho de página padrão */
export function Titulo({ titulo, sub, children }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="font-display text-[clamp(22px,2.4vw,28px)] font-bold leading-tight">{titulo}</h1>{sub && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{sub}</p>}</div>
      {children && <div className="no-print flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
