'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, BadgeCheck, Pencil, MessageCircle, Users, Wallet, CalendarClock, Smartphone } from 'lucide-react';
import { usePainel } from '@/components/AppShell';
import { Titulo } from '@/components/AppShell';
import { Btn, Campo, Selecao, Modal, Badge, Vazio, Carregando, Interruptor, useToast } from '@/components/ui';
import { supabaseBrowser } from '@/lib/supabase/client';
import { hojeBR } from '@/lib/cobranca';
import { addDays, brl, fmtData, fmtTelefone, int, msgErro, norm } from '@/lib/format';

export default function Admin() {
  const sb = supabaseBrowser();
  const toast = useToast();
  const { perfil: eu } = usePainel();
  const hoje = hojeBR();
  const [contas, setContas] = useState(null);
  const [planos, setPlanos] = useState([]);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('');
  const [pag, setPag] = useState(null);
  const [edit, setEdit] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    const [c, p] = await Promise.all([sb.rpc('admin_contas'), sb.from('plans').select('*').order('ordem')]);
    if (c.error) toast(msgErro(c.error), false);
    setContas(c.data || []); setPlanos(p.data || []);
  }, [sb, toast]);
  useEffect(() => { carregar(); }, [carregar]);

  const k = useMemo(() => {
    const l = contas || []; const em7 = addDays(hoje, 7);
    const pagos = l.filter((c) => c.preco > 0 && c.plano_expira_em && c.plano_expira_em >= hoje && c.status === 'ativo');
    const porPlano = {}; l.forEach((c) => { porPlano[c.plano_efetivo_nome] = (porPlano[c.plano_efetivo_nome] || 0) + 1; });
    return {
      total: l.length, mrr: pagos.reduce((a, c) => a + Number(c.preco), 0), pagos: pagos.length,
      vencendo: l.filter((c) => c.plano_expira_em && c.plano_expira_em >= hoje && c.plano_expira_em <= em7).length,
      vencidos: l.filter((c) => c.plano_expira_em && c.plano_expira_em < hoje).length,
      bloqueados: l.filter((c) => c.status === 'bloqueado').length, wa: l.filter((c) => c.whatsapp === 'conectado').length, porPlano,
      novos30: l.filter((c) => c.created_at >= new Date(Date.now() - 30 * 864e5).toISOString()).length,
    };
  }, [contas, hoje]);

  const lista = useMemo(() => {
    const q = norm(busca); const em7 = addDays(hoje, 7);
    return (contas || []).filter((c) => {
      if (filtro === 'pagos' && !(c.preco > 0 && c.plano_expira_em >= hoje)) return false;
      if (filtro === 'vencendo' && !(c.plano_expira_em && c.plano_expira_em >= hoje && c.plano_expira_em <= em7)) return false;
      if (filtro === 'vencidos' && !(c.plano_expira_em && c.plano_expira_em < hoje)) return false;
      if (filtro === 'bloqueados' && c.status !== 'bloqueado') return false;
      if (filtro === 'ativas' && c.status === 'bloqueado') return false;
      if (filtro === 'limite' && !(c.limite != null && c.clientes >= c.limite)) return false;
      return !q || norm(`${c.nome} ${c.empresa} ${c.email} ${c.telefone}`).includes(q);
    });
  }, [contas, busca, filtro, hoje]);

  async function registrar(e) {
    e.preventDefault(); setSalvando(true);
    const { data, error } = await sb.rpc('admin_registrar_assinatura', { p_profile: pag.c.id, p_plan: pag.plan_id, p_meses: Number(pag.meses), p_valor: Number(String(pag.valor).replace(',', '.')) || 0, p_obs: pag.obs || null });
    setSalvando(false);
    if (error) return toast(msgErro(error), false);
    toast(`Assinatura liberada até ${fmtData(data)}.`); setPag(null); carregar();
  }
  async function salvarEdicao(e) {
    e.preventDefault(); setSalvando(true);
    const { error } = await sb.from('profiles').update({ plan_id: edit.plan_id || null, plano_expira_em: edit.plano_expira_em || null, status: edit.status, is_admin: edit.is_admin, nome: edit.nome || null, empresa: edit.empresa || null }).eq('id', edit.id);
    setSalvando(false);
    if (error) return toast(msgErro(error), false);
    toast('Conta atualizada.'); setEdit(null); carregar();
  }
  async function alternarConta(c) {
    if (c.id === eu.id) return toast('Você não pode desativar a sua própria conta.', false);
    const novo = c.status === 'bloqueado' ? 'ativo' : 'bloqueado';
    setContas((l) => l.map((x) => (x.id === c.id ? { ...x, status: novo } : x)));
    const { error } = await sb.from('profiles').update({ status: novo }).eq('id', c.id);
    if (error) { toast(msgErro(error), false); return carregar(); }
    toast(novo === 'ativo' ? `${c.empresa || c.nome || 'Conta'} ativada.` : `${c.empresa || c.nome || 'Conta'} desativada: não cadastra clientes nem envia cobranças.`);
  }
  const planoMap = new Map(planos.map((p) => [p.id, p]));

  if (!contas) return <Carregando />;
  return (
    <>
      <Titulo titulo="Assinantes" sub="Contas que usam o sistema, planos e liberação de pagamentos." />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[[Users, 'Assinantes', int(k.total), `${int(k.novos30)} ${k.novos30 === 1 ? 'novo' : 'novos'} em 30 dias`], [Wallet, 'Receita mensal (planos pagos em dia)', brl(k.mrr), `${int(k.pagos)} ${k.pagos === 1 ? 'conta pagante' : 'contas pagantes'}`],
          [CalendarClock, 'Vencem em 7 dias', int(k.vencendo), `${int(k.vencidos)} ${k.vencidos === 1 ? 'já vencida' : 'já vencidas'}`], [Smartphone, 'WhatsApp conectado', int(k.wa), `${int(k.bloqueados)} ${k.bloqueados === 1 ? 'conta desativada' : 'contas desativadas'}`]].map(([I, r, v, s]) => (
          <div key={r} className="card p-4">
            <div className="flex items-center justify-between gap-2 text-sm text-slate-500 dark:text-slate-400"><span>{r}</span><I className="h-4 w-4 text-brand-cyan" /></div>
            <div className="mt-1 font-display text-[clamp(20px,2vw,26px)] font-bold tabular-nums">{v}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{s}</div>
          </div>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap gap-2 text-xs">{Object.entries(k.porPlano).map(([n, q]) => <Badge key={n} tom="ciano">{n}: {q}</Badge>)}</div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 p-3">
          <label className="relative min-w-[220px] flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome, empresa, e-mail ou telefone" className="campo pl-9" /></label>
          <Selecao value={filtro} onChange={(e) => setFiltro(e.target.value)} todos="Todas as contas" opcoes={[['pagos', 'Pagantes em dia'], ['vencendo', 'Vencem em 7 dias'], ['vencidos', 'Plano vencido'], ['limite', 'No limite de clientes'], ['ativas', 'Ativas'], ['bloqueados', 'Desativadas']]} className="w-56" />
        </div>
        {!lista.length ? <Vazio msg="Nenhuma conta encontrada." /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead><tr className="border-y border-line bg-slate-50 text-left text-xs font-semibold text-slate-500 dark:border-night-line dark:bg-night-soft/60">
                <th className="px-4 py-2.5">Conta</th><th className="px-4 py-2.5">Plano</th><th className="px-4 py-2.5">Clientes</th><th className="px-4 py-2.5">Validade</th><th className="px-4 py-2.5">WhatsApp</th><th className="px-4 py-2.5">Desde</th><th className="px-4 py-2.5 text-right">Ações</th>
              </tr></thead>
              <tbody className="divide-y divide-line dark:divide-night-line">
                {lista.map((c) => {
                  const venc = c.plano_expira_em && c.plano_expira_em < hoje; const lim = c.limite != null && c.clientes >= c.limite;
                  const tel = (c.telefone || '').replace(/\D/g, '');
                  return (
                    <tr key={c.id} className={`hover:bg-slate-50 dark:hover:bg-night-soft/50 ${c.status === 'bloqueado' ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <button role="switch" aria-checked={c.status !== 'bloqueado'} disabled={c.id === eu.id} onClick={() => alternarConta(c)}
                            title={c.id === eu.id ? 'Sua conta' : c.status === 'bloqueado' ? 'Ativar conta' : 'Desativar conta'} aria-label={`${c.status === 'bloqueado' ? 'Ativar' : 'Desativar'} ${c.empresa || c.nome || 'conta'}`}
                            className={`h-5 w-9 shrink-0 rounded-full p-0.5 transition disabled:opacity-40 ${c.status !== 'bloqueado' ? 'bg-brand-cyan' : 'bg-slate-300 dark:bg-night-line'}`}>
                            <span className={`block h-4 w-4 rounded-full bg-white shadow transition-transform ${c.status !== 'bloqueado' ? 'translate-x-4' : ''}`} />
                          </button>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 font-semibold">{c.empresa || c.nome || '—'}{c.is_admin && <Badge tom="ciano">admin</Badge>}{c.status === 'bloqueado' && <Badge tom="vermelho">desativada</Badge>}</div>
                            <div className="text-xs text-slate-500">{[c.nome !== c.empresa && c.nome, c.email, c.telefone && fmtTelefone(c.telefone)].filter(Boolean).join(' · ')}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><div className="font-medium">{c.plano_efetivo_nome}</div>{c.plano_nome !== c.plano_efetivo_nome && <div className="text-xs text-amber-600">contratado: {c.plano_nome}</div>}</td>
                      <td className="px-4 py-3 tabular-nums"><span className={lim ? 'font-semibold text-amber-600' : ''}>{int(c.clientes)}{c.limite != null ? ` / ${int(c.limite)}` : ''}</span></td>
                      <td className="whitespace-nowrap px-4 py-3">{c.plano_expira_em ? <span className={venc ? 'font-semibold text-rose-600' : ''}>{fmtData(c.plano_expira_em)}</span> : <span className="text-slate-400">sem vencimento</span>}{c.ultimo_pagamento && <div className="text-xs text-slate-500">pago em {fmtData(c.ultimo_pagamento)}</div>}</td>
                      <td className="px-4 py-3">{c.whatsapp === 'conectado' ? <Badge tom="verde">conectado</Badge> : <Badge>desconectado</Badge>}</td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-500">{fmtData(hojeBR(new Date(c.created_at)))}</td>
                      <td className="px-4 py-3"><div className="flex justify-end gap-1">
                        <Ic t="Registrar pagamento" onClick={() => { const atual = planoMap.get(c.plan_id); const p = atual?.preco > 0 ? atual : planos.find((x) => x.preco > 0); setPag({ c, plan_id: p?.id || '', meses: 1, valor: String(p?.preco || 0).replace('.', ','), obs: '' }); }}><BadgeCheck className="h-4 w-4 text-emerald-600" /></Ic>
                        <Ic t="Editar conta" onClick={() => setEdit({ ...c, plan_id: c.plan_id || '', plano_expira_em: c.plano_expira_em || '' })}><Pencil className="h-4 w-4" /></Ic>
                        {tel && <a href={`https://wa.me/${tel}`} target="_blank" rel="noreferrer" title="Abrir conversa no WhatsApp" className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-night-soft"><MessageCircle className="h-4 w-4" /></a>}
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal aberto={!!pag} onFechar={() => setPag(null)} titulo="Registrar pagamento da assinatura" sub={pag && (pag.c.empresa || pag.c.nome || pag.c.email)}
        rodape={<><Btn onClick={() => setPag(null)}>Cancelar</Btn><Btn variante="primario" type="submit" form="form-pag" carregando={salvando}>Liberar plano</Btn></>}>
        {pag && (
          <form id="form-pag" onSubmit={registrar} className="grid gap-3.5 sm:grid-cols-2">
            <Selecao rotulo="Plano" value={pag.plan_id} required opcoes={planos.map((p) => [p.id, `${p.nome} — ${brl(p.preco)}/mês`])}
              onChange={(e) => { const p = planoMap.get(e.target.value); setPag({ ...pag, plan_id: e.target.value, valor: String(((p?.preco || 0) * pag.meses).toFixed(2)).replace('.', ',') }); }} />
            <Campo rotulo="Meses pagos" type="number" min={1} max={36} value={pag.meses} required
              onChange={(e) => { const p = planoMap.get(pag.plan_id); setPag({ ...pag, meses: e.target.value, valor: String(((p?.preco || 0) * (Number(e.target.value) || 1)).toFixed(2)).replace('.', ',') }); }} />
            <Campo rotulo="Valor recebido (R$)" inputMode="decimal" value={pag.valor} onChange={(e) => setPag({ ...pag, valor: e.target.value })} />
            <Campo rotulo="Observação" value={pag.obs} onChange={(e) => setPag({ ...pag, obs: e.target.value })} placeholder="Ex.: Pix de 23/11" />
            <p className="text-xs text-slate-500 sm:col-span-2">A validade soma os meses a partir da validade atual (ou de hoje, se já venceu ou se o plano mudou), e a conta é ativada.</p>
          </form>
        )}
      </Modal>

      <Modal aberto={!!edit} onFechar={() => setEdit(null)} titulo="Editar conta"
        rodape={<><Btn onClick={() => setEdit(null)}>Cancelar</Btn><Btn variante="primario" type="submit" form="form-edit" carregando={salvando}>Salvar</Btn></>}>
        {edit && (
          <form id="form-edit" onSubmit={salvarEdicao} className="grid gap-3.5 sm:grid-cols-2">
            <Campo rotulo="Nome" value={edit.nome || ''} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} />
            <Campo rotulo="Empresa" value={edit.empresa || ''} onChange={(e) => setEdit({ ...edit, empresa: e.target.value })} />
            <Selecao rotulo="Plano" value={edit.plan_id} onChange={(e) => setEdit({ ...edit, plan_id: e.target.value })} todos="Plano padrão" opcoes={planos.map((p) => [p.id, p.nome])} />
            <Campo rotulo="Válido até" type="date" value={edit.plano_expira_em} onChange={(e) => setEdit({ ...edit, plano_expira_em: e.target.value })} ajuda="Vazio = sem vencimento" />
            <Selecao rotulo="Situação" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })} opcoes={[['ativo', 'Ativa'], ['bloqueado', 'Desativada']]} />
            <div className="flex items-end pb-1"><Interruptor ligado={edit.is_admin} onChange={(v) => setEdit({ ...edit, is_admin: v })} rotulo="Administrador" desc="Acessa este painel" /></div>
          </form>
        )}
      </Modal>
    </>
  );
}
const Ic = ({ t, children, ...p }) => <button title={t} aria-label={t} {...p} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-night-soft">{children}</button>;
