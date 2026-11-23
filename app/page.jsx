import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { Check, MessageCircle, Users, Wallet, BarChart3, FileSpreadsheet, ShieldCheck, ArrowRight } from 'lucide-react';
import Logo from '@/components/Logo';
import { BotaoTema } from '@/components/ui';
import { brl, int } from '@/lib/format';

export const revalidate = 300;

async function planos() {
  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { data } = await sb.from('plans').select('*').eq('ativo', true).order('ordem');
    return data || [];
  } catch { return []; }
}

const RECURSOS = [
  [Users, 'Cadastro de clientes', 'Nome, WhatsApp, plano, valor e vencimento. Abas para ativos, vencendo hoje e inadimplentes.'],
  [MessageCircle, 'Cobrança automática', 'Lembrete antes, no dia e depois do vencimento, com o seu texto e sua chave Pix.'],
  [Wallet, 'Financeiro', 'Ganhos e gastos do mês, pagamentos registrados com um clique e renovação do vencimento.'],
  [BarChart3, 'Dashboard', 'Saldo, ticket médio, inadimplência e receita por dia com filtros e comparação mensal.'],
  [FileSpreadsheet, 'Importe e exporte', 'Traga sua planilha de clientes e baixe relatórios em CSV ou PDF.'],
  [ShieldCheck, 'Seus dados separados', 'Cada conta vê só os próprios clientes. Login por e-mail ou código no WhatsApp.'],
];

export default async function Home() {
  const lista = await planos();
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-[1200px] items-center gap-3 px-5 py-5">
        <Link href="/" className="flex flex-1 items-center gap-2.5"><Logo className="h-7 w-9" /><span className="font-display text-lg font-bold">RR Gestor</span></Link>
        <BotaoTema />
        <Link href="/login" className="hidden h-10 items-center rounded-lg px-3 text-sm font-semibold sm:inline-flex">Entrar</Link>
        <Link href="/cadastro" className="inline-flex h-10 items-center rounded-lg bg-brand-cyan px-4 text-sm font-semibold text-brand-navy">Teste grátis</Link>
      </header>

      <section className="bg-brand-navy text-white">
        <div className="mx-auto grid max-w-[1200px] items-center gap-10 px-5 py-16 md:grid-cols-[1.1fr_1fr] md:py-20">
          <div>
            <h1 className="font-display text-[clamp(34px,5vw,52px)] font-bold leading-[1.05] [text-wrap:balance]">Seus clientes pagam em dia. O WhatsApp lembra por você.</h1>
            <p className="mt-5 max-w-xl text-lg text-cyan-50/85">Cadastre clientes, acompanhe o financeiro e envie cobranças automáticas antes, no dia e depois do vencimento.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/cadastro" className="inline-flex h-12 items-center gap-2 rounded-xl bg-brand-cyan px-6 font-semibold text-brand-navy">Criar conta grátis<ArrowRight className="h-4 w-4" /></Link>
              <Link href="/login" className="inline-flex h-12 items-center rounded-xl border border-white/20 px-6 font-semibold">Já tenho conta</Link>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-sm">
            <div className="rounded-[28px] bg-[#0B141A] p-3 shadow-2xl ring-1 ring-white/10">
              <div className="rounded-2xl bg-[#ECE5DD] p-4 text-[14px] leading-snug text-[#111B21]">
                <div className="mb-3 text-center text-[11px] text-slate-500">hoje</div>
                <div className="ml-auto max-w-[85%] rounded-xl rounded-tr-sm bg-[#D9FDD3] px-3 py-2 shadow-sm">Olá, Maria! 👋 Sua mensalidade de <b>R$ 99,90</b> vence em 3 dias (26/11).<br /><br />Chave Pix: pix@suaempresa.com<div className="mt-1 text-right text-[10px] text-slate-500">09:00 ✓✓</div></div>
                <div className="mt-2 max-w-[70%] rounded-xl rounded-tl-sm bg-white px-3 py-2 shadow-sm">Pago! Segue o comprovante 🙏<div className="mt-1 text-right text-[10px] text-slate-500">09:12</div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-5 py-16">
        <h2 className="font-display text-[clamp(26px,3vw,36px)] font-bold">Tudo o que a cobrança precisa</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {RECURSOS.map(([I, t, d]) => (
            <div key={t} className="card p-5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-cyan/10 text-brand-cyan"><I className="h-5 w-5" /></span><h3 className="mt-3 font-semibold">{t}</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{d}</p></div>
          ))}
        </div>
      </section>

      <section id="planos" className="border-t border-line bg-white py-16 dark:border-night-line dark:bg-night-card">
        <div className="mx-auto max-w-[1200px] px-5">
          <h2 className="font-display text-[clamp(26px,3vw,36px)] font-bold">Planos pelo tamanho da sua carteira</h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400">Todos com cobranças ilimitadas, WhatsApp, financeiro e dashboard. Muda só o número de clientes.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {lista.map((p) => (
              <div key={p.id} className={`card relative flex flex-col p-6 ${p.destaque ? 'ring-2 ring-brand-cyan' : ''}`}>
                {p.destaque && <span className="absolute -top-3 left-6 rounded-full bg-brand-cyan px-3 py-0.5 text-xs font-bold text-brand-navy">Mais escolhido</span>}
                <div className="font-display text-xl font-bold">{p.nome}</div>
                {p.descricao && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{p.descricao}</p>}
                <div className="mt-4 font-display text-4xl font-bold tabular-nums">{p.preco > 0 ? brl(p.preco) : 'R$ 0'}<span className="text-base font-medium text-slate-500">/mês</span></div>
                <ul className="mt-5 space-y-2 text-sm">
                  {[p.limite_clientes == null ? 'Clientes ilimitados' : `Até ${int(p.limite_clientes)} clientes`, 'Cobranças ilimitadas no WhatsApp', 'Financeiro e dashboard', 'Importação e exportação'].map((t) => <li key={t} className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-brand-cyan" />{t}</li>)}
                </ul>
                <Link href="/cadastro" className={`mt-6 inline-flex h-11 items-center justify-center rounded-xl font-semibold ${p.destaque ? 'bg-brand-cyan text-brand-navy' : 'border border-line dark:border-night-line'}`}>{p.preco > 0 ? 'Começar' : 'Criar conta grátis'}</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-5 py-8 text-sm text-slate-500">
        <span className="flex items-center gap-2"><Logo className="h-5 w-7" />RR Tecnologia</span>
        <span>© {new Date().getFullYear()} RR Gestor</span>
      </footer>
    </div>
  );
}
