'use client';
import { useEffect, useState } from 'react';
import { Check, Copy, MessageCircle, Lock, RefreshCw, LogOut } from 'lucide-react';
import Logo from '@/components/Logo';
import { Btn, BotaoTema, useToast } from '@/components/ui';
import { brl, fmtData, fmtTelefone, int } from '@/lib/format';

/** Única tela de uma conta desativada: escolher o plano, pagar e avisar o suporte. */
export default function TelaRenovacao({ sb, perfil, uso, sair, verificar }) {
  const toast = useToast();
  const [planos, setPlanos] = useState([]);
  const [cfg, setCfg] = useState(null);
  const [plano, setPlano] = useState(null);
  const [checando, setChecando] = useState(false);

  useEffect(() => {
    sb.from('plans').select('*').eq('ativo', true).gt('preco', 0).order('ordem').then(({ data }) => {
      const l = data || [];
      setPlanos(l);
      setPlano(l.find((p) => p.id === uso?.plano_id) || l.find((p) => p.destaque) || l[0] || null);
    });
    sb.from('app_settings').select('*').single().then(({ data }) => setCfg(data));
  }, [sb, uso?.plano_id]);

  const copiar = async (t) => { try { await navigator.clipboard.writeText(t); toast('Chave Pix copiada.'); } catch { toast('Não foi possível copiar.', false); } };
  const conta = perfil.empresa || perfil.nome || perfil.email || fmtTelefone(perfil.telefone);
  const zap = cfg?.whatsapp_suporte && plano
    ? `https://wa.me/${cfg.whatsapp_suporte.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! Quero renovar minha conta no RR Gestor no plano ${plano.nome} (${brl(plano.preco)}/mês). Conta: ${conta}${perfil.email ? ` (${perfil.email})` : ''}. Segue o comprovante.`)}`
    : null;
  async function checar() {
    setChecando(true);
    const liberada = await verificar();
    setChecando(false);
    if (!liberada) toast('Sua conta ainda está desativada. Assim que o pagamento for confirmado, ela é liberada.', false);
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-night">
      <header className="border-b border-line bg-white dark:border-night-line dark:bg-night-card">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 sm:px-6">
          <Logo className="h-7 w-9" /><span className="flex-1 font-display text-[17px] font-bold">RR Gestor</span>
          <BotaoTema />
          <button onClick={sair} className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-brand-navy dark:hover:bg-night-soft dark:hover:text-white"><LogOut className="h-4 w-4" />Sair</button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300"><Lock className="h-7 w-7" /></span>
          <h1 className="mt-4 font-display text-[clamp(24px,3vw,32px)] font-bold">Sua conta está desativada</h1>
          <p className="mx-auto mt-2 max-w-xl text-slate-500 dark:text-slate-400">
            Renove a assinatura para voltar a acessar seus clientes, cobranças e relatórios. Enquanto isso, as cobranças automáticas pelo WhatsApp ficam paradas.
          </p>
          <p className="mt-1 text-sm text-slate-400">Conta: <b className="text-brand-navy dark:text-white">{conta}</b>{perfil.plano_expira_em && <> · plano válido até {fmtData(perfil.plano_expira_em)}</>}</p>
        </div>

        <h2 className="mb-3 mt-8 font-display text-lg font-bold">1. Escolha o plano</h2>
        <div className={`grid gap-3 ${planos.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
          {planos.map((p) => {
            const sel = plano?.id === p.id;
            return (
              <button key={p.id} onClick={() => setPlano(p)} aria-pressed={sel}
                className={`card relative flex flex-col p-5 text-left transition ${sel ? 'ring-2 ring-brand-cyan' : 'hover:ring-1 hover:ring-brand-cyan/50'}`}>
                {p.id === uso?.plano_id && <span className="absolute -top-2.5 left-4 rounded-full bg-brand-navy px-2 py-0.5 text-[11px] font-bold text-white dark:bg-white dark:text-brand-navy">Seu plano</span>}
                <div className="flex items-center justify-between"><span className="font-display text-lg font-bold">{p.nome}</span><span className={`grid h-5 w-5 place-items-center rounded-full border-2 ${sel ? 'border-brand-cyan bg-brand-cyan text-brand-navy' : 'border-slate-300 dark:border-night-line'}`}>{sel && <Check className="h-3 w-3" />}</span></div>
                <div className="mt-1 font-display text-2xl font-bold tabular-nums">{brl(p.preco)}<span className="text-sm font-medium text-slate-500">/mês</span></div>
                <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">{p.limite_clientes == null ? 'Clientes ilimitados' : `Até ${int(p.limite_clientes)} clientes`}</div>
              </button>
            );
          })}
        </div>

        <h2 className="mb-3 mt-8 font-display text-lg font-bold">2. Pague e envie o comprovante</h2>
        <section className="card grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="whitespace-pre-line text-sm">{cfg?.instrucoes_pagamento}</p>
            {plano && <p className="mt-2 text-sm">Valor: <b className="tabular-nums">{brl(plano.preco)}</b> por mês (plano {plano.nome}).</p>}
            {cfg?.pix_chave ? (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 p-3 dark:bg-night-soft">
                <div className="min-w-0 flex-1"><div className="text-xs text-slate-500">Chave Pix</div><div className="truncate font-semibold">{cfg.pix_chave}</div></div>
                <Btn onClick={() => copiar(cfg.pix_chave)}><Copy className="h-4 w-4" />Copiar</Btn>
              </div>
            ) : <p className="mt-3 text-sm text-slate-500">Peça a chave Pix ao suporte.</p>}
          </div>
          <div className="flex flex-col gap-2 md:w-60">
            {zap ? <a href={zap} target="_blank" rel="noreferrer"><Btn variante="primario" className="w-full"><MessageCircle className="h-4 w-4" />Enviar comprovante</Btn></a>
              : <p className="text-sm text-slate-500">Fale com o suporte para enviar o comprovante.</p>}
            {cfg?.whatsapp_suporte && <p className="text-center text-xs text-slate-500">Suporte: {fmtTelefone(cfg.whatsapp_suporte.replace(/\D/g, ''))}</p>}
          </div>
        </section>

        <div className="mt-6 flex flex-col items-center gap-2 text-center text-sm text-slate-500 dark:text-slate-400">
          <span>Depois que o pagamento for confirmado, sua conta volta a funcionar com todos os dados.</span>
          <Btn onClick={checar} carregando={checando}><RefreshCw className="h-4 w-4" />Já paguei, verificar</Btn>
        </div>
      </main>
    </div>
  );
}
