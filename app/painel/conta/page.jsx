'use client';
import { useEffect, useState } from 'react';
import { Check, Crown, Copy, MessageCircle, Save, KeyRound, Globe } from 'lucide-react';
import { linkArea } from '@/lib/cobranca';
import { usePainel, Titulo } from '@/components/AppShell';
import { Btn, Campo, Modal, Badge, useToast } from '@/components/ui';
import { supabaseBrowser } from '@/lib/supabase/client';
import { brl, fmtData, fmtTelefone, int, msgErro } from '@/lib/format';

export default function Conta() {
  const sb = supabaseBrowser();
  const { perfil, uso, recarregar } = usePainel();
  const toast = useToast();
  const [f, setF] = useState({ nome: perfil.nome || '', empresa: perfil.empresa || '', chave_pix: perfil.chave_pix || '' });
  const [planos, setPlanos] = useState([]);
  const [cfg, setCfg] = useState(null);
  const [hist, setHist] = useState([]);
  const [escolhido, setEscolhido] = useState(null);
  const [senha, setSenha] = useState('');
  const [salvando, setSalvando] = useState('');

  useEffect(() => {
    sb.from('plans').select('*').eq('ativo', true).order('ordem').then(({ data }) => setPlanos(data || []));
    sb.from('app_settings').select('*').single().then(({ data }) => setCfg(data));
    sb.from('subscription_payments').select('*, plans(nome)').eq('profile_id', perfil.id).order('pago_em', { ascending: false }).then(({ data }) => setHist(data || []));
  }, [sb, perfil.id]);

  async function salvar(e) {
    e.preventDefault(); setSalvando('perfil');
    const { error } = await sb.from('profiles').update({ nome: f.nome.trim() || null, empresa: f.empresa.trim() || null, chave_pix: f.chave_pix.trim() || null }).eq('id', perfil.id);
    setSalvando('');
    if (error) return toast(msgErro(error), false);
    toast('Dados salvos.'); recarregar();
  }
  async function trocarSenha(e) {
    e.preventDefault();
    if (senha.length < 6) return toast('A senha precisa ter pelo menos 6 caracteres.', false);
    setSalvando('senha');
    const { error } = await sb.auth.updateUser({ password: senha });
    setSalvando('');
    if (error) return toast(msgErro(error), false);
    setSenha(''); toast('Senha alterada.');
  }
  const copiar = async (t) => { try { await navigator.clipboard.writeText(t); toast('Copiado.'); } catch { toast('Não foi possível copiar.', false); } };
  const linkSuporte = (p) => cfg?.whatsapp_suporte
    ? `https://wa.me/${cfg.whatsapp_suporte.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! Quero assinar o plano ${p.nome} (${brl(p.preco)}/mês) do RR Gestor. Minha conta: ${perfil.email || fmtTelefone(perfil.telefone)}`)}`
    : null;

  return (
    <>
      <Titulo titulo="Conta e assinatura" />
      <div className="grid gap-5 xl:grid-cols-[1fr_1.4fr]">
        <div className="space-y-5">
          <section className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div><div className="text-sm text-slate-500 dark:text-slate-400">Seu plano</div><div className="font-display text-2xl font-bold">{uso?.plano_nome}</div></div>
              {uso?.status === 'bloqueado' ? <Badge tom="vermelho">Conta bloqueada</Badge> : uso?.vencido ? <Badge tom="ambar">Plano pago vencido</Badge> : <Badge tom="verde">Ativo</Badge>}
            </div>
            <div className="mt-4 text-sm">
              <div className="flex justify-between"><span>Clientes ativos</span><b>{int(uso?.usados || 0)}{uso?.limite != null ? ` de ${int(uso.limite)}` : ' (ilimitado)'}</b></div>
              {uso?.limite != null && <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-night-soft"><div className="h-full rounded-full bg-brand-cyan" style={{ width: `${Math.min(100, (uso.usados / uso.limite) * 100)}%` }} /></div>}
              {perfil.plano_expira_em && <div className="mt-3 flex justify-between"><span>Válido até</span><b>{fmtData(perfil.plano_expira_em)}</b></div>}
            </div>
          </section>

          <form onSubmit={salvar} className="card space-y-3.5 p-5">
            <h2 className="font-display text-base font-semibold">Seus dados</h2>
            <Campo rotulo="Nome" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
            <Campo rotulo="Empresa" value={f.empresa} onChange={(e) => setF({ ...f, empresa: e.target.value })} ajuda="Aparece na variável {empresa} das mensagens." />
            <Campo rotulo="Chave Pix para receber dos clientes" value={f.chave_pix} onChange={(e) => setF({ ...f, chave_pix: e.target.value })} ajuda="Aparece na variável {pix} das mensagens de cobrança." />
            <div className="grid gap-1 text-sm text-slate-500 dark:text-slate-400">{perfil.email && <span>E-mail de acesso: <b className="text-brand-navy dark:text-white">{perfil.email}</b></span>}{perfil.telefone && <span>Telefone de acesso: <b className="text-brand-navy dark:text-white">{fmtTelefone(perfil.telefone)}</b></span>}</div>
            <Btn variante="primario" type="submit" carregando={salvando === 'perfil'}><Save className="h-4 w-4" />Salvar</Btn>
          </form>

          <section className="card p-5">
            <div className="flex items-center gap-2 font-display text-base font-semibold"><Globe className="h-4 w-4 text-brand-cyan" />Área do cliente</div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Seus clientes entram com usuário e senha para ver vencimento, pagamentos e sua chave Pix.</p>
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 p-3 dark:bg-night-soft"><div className="min-w-0 flex-1 truncate text-sm font-semibold">{linkArea(perfil)}</div><Btn onClick={() => copiar(linkArea(perfil))}><Copy className="h-4 w-4" />Copiar</Btn></div>
          </section>

          {perfil.email && (
            <form onSubmit={trocarSenha} className="card flex flex-wrap items-end gap-2 p-5">
              <Campo rotulo="Nova senha" type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} className="min-w-[200px] flex-1" />
              <Btn type="submit" carregando={salvando === 'senha'}><KeyRound className="h-4 w-4" />Alterar senha</Btn>
            </form>
          )}
        </div>

        <div className="space-y-5">
          <section>
            <h2 className="mb-3 font-display text-lg font-bold">Planos</h2>
            <div className="grid gap-3 md:grid-cols-3">
              {planos.map((p) => {
                const atual = p.id === uso?.plano_id;
                return (
                  <div key={p.id} className={`card relative flex flex-col p-5 ${p.destaque ? 'ring-2 ring-brand-cyan' : ''}`}>
                    {p.destaque && <span className="absolute -top-2.5 left-4 rounded-full bg-brand-cyan px-2 py-0.5 text-[11px] font-bold text-brand-navy">Mais escolhido</span>}
                    <div className="font-display text-lg font-bold">{p.nome}</div>
                    <div className="mt-1 font-display text-2xl font-bold tabular-nums">{p.preco > 0 ? brl(p.preco) : 'Grátis'}{p.preco > 0 && <span className="text-sm font-medium text-slate-500">/mês</span>}</div>
                    <ul className="mt-3 space-y-1.5 text-sm">
                      <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-brand-cyan" />{p.limite_clientes == null ? 'Clientes ilimitados' : `Até ${int(p.limite_clientes)} clientes`}</li>
                      <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-brand-cyan" />Cobranças ilimitadas</li>
                      <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-brand-cyan" />WhatsApp e financeiro</li>
                    </ul>
                    <div className="mt-auto pt-4">
                      {atual ? <Btn className="w-full" disabled>Plano atual</Btn>
                        : p.preco > 0 ? <Btn variante={p.destaque ? 'primario' : 'secundario'} className="w-full" onClick={() => setEscolhido(p)}><Crown className="h-4 w-4" />Assinar</Btn> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="card overflow-hidden">
            <div className="p-4"><h2 className="font-display text-base font-semibold">Pagamentos da assinatura</h2></div>
            {!hist.length ? <p className="px-4 pb-4 text-sm text-slate-500">Nenhum pagamento registrado.</p> : (
              <table className="w-full text-sm"><tbody className="divide-y divide-line dark:divide-night-line">
                {hist.map((h) => <tr key={h.id}><td className="px-4 py-2.5 tabular-nums">{fmtData(h.pago_em)}</td><td className="px-4 py-2.5">{h.plans?.nome} · {h.meses} {h.meses === 1 ? 'mês' : 'meses'}</td><td className="px-4 py-2.5 text-slate-500">até {fmtData(h.valido_ate)}</td><td className="px-4 py-2.5 text-right font-semibold tabular-nums">{brl(h.valor)}</td></tr>)}
              </tbody></table>
            )}
          </section>
        </div>
      </div>

      <Modal aberto={!!escolhido} onFechar={() => setEscolhido(null)} titulo={`Assinar o plano ${escolhido?.nome}`} sub={escolhido && `${brl(escolhido.preco)} por mês`}
        rodape={<><Btn onClick={() => setEscolhido(null)}>Fechar</Btn>{escolhido && linkSuporte(escolhido) && <a href={linkSuporte(escolhido)} target="_blank" rel="noreferrer"><Btn variante="primario"><MessageCircle className="h-4 w-4" />Enviar comprovante</Btn></a>}</>}>
        <p className="whitespace-pre-line text-sm">{cfg?.instrucoes_pagamento}</p>
        {cfg?.pix_chave && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 p-3 dark:bg-night-soft">
            <div className="min-w-0 flex-1"><div className="text-xs text-slate-500">Chave Pix</div><div className="truncate font-semibold">{cfg.pix_chave}</div></div>
            <Btn onClick={() => copiar(cfg.pix_chave)}><Copy className="h-4 w-4" />Copiar</Btn>
          </div>
        )}
        {cfg?.whatsapp_suporte && <p className="mt-3 text-sm text-slate-500">Suporte: {fmtTelefone(cfg.whatsapp_suporte.replace(/\D/g, ''))}</p>}
      </Modal>
    </>
  );
}
