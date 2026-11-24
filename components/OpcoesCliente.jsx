'use client';
import { useEffect, useState } from 'react';
import {
  RefreshCw, Send, Pencil, UserX, Receipt, User, ReceiptText, AlertTriangle, ArrowLeft, Copy, MessageCircle, Monitor, Server, CalendarDays, KeyRound, Trash2, CheckCircle2,
} from 'lucide-react';
import { Btn, Campo, Selecao, Modal, Badge, Interruptor, useToast } from '@/components/ui';
import { linkArea, GATILHOS } from '@/lib/cobranca';
import { addMonths, brl, daysBetween, fmtData, fmtTelefone, msgErro } from '@/lib/format';

export const FORMAS = ['Pix', 'Dinheiro', 'Cartão de crédito', 'Cartão de débito', 'Boleto', 'Transferência'];

/** Selo colorido de vencimento */
export function SeloVencimento({ c, hoje }) {
  if (c.status === 'desativado') return <span className="inline-flex rounded-md bg-slate-500/15 px-2 py-1 text-xs font-bold tabular-nums text-slate-500">{fmtData(c.vencimento)}</span>;
  const d = daysBetween(hoje, c.vencimento);
  const cor = d < 0 ? 'bg-rose-600 text-white' : d === 0 ? 'bg-brand-cyan text-brand-navy' : d <= 7 ? 'bg-amber-400 text-amber-950' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
  const dica = d < 0 ? `Vencido há ${-d} ${d === -1 ? 'dia' : 'dias'}` : d === 0 ? 'Vence hoje' : `Vence em ${d} ${d === 1 ? 'dia' : 'dias'}`;
  return <span title={dica} className={`inline-flex whitespace-nowrap rounded-md px-2 py-1 text-xs font-bold tabular-nums ${cor}`}>{fmtData(c.vencimento)}</span>;
}

const ACOES = [
  ['renovar', 'Renovar baseado no plano', RefreshCw, 'Registra o pagamento e avança o vencimento pelo ciclo do plano.'],
  ['cobranca', 'Enviar cobrança', Send, 'Manda a mensagem automática que combina com a situação do cliente.'],
  ['editar', 'Editar', Pencil, 'Altera os dados do cadastro.'],
  ['excluir', 'Excluir', UserX, 'Apaga o cliente.'],
  ['faturas', 'Faturas', Receipt, 'Mensalidade em aberto e pagamentos recebidos.'],
  ['perfil', 'Perfil', User, 'Dados completos, acesso à área do cliente e mensagens enviadas.'],
  ['recibo', 'Enviar recibo', ReceiptText, 'Manda o recibo do último pagamento pelo WhatsApp.'],
  ['alerta', 'Alerta', AlertTriangle, 'Marca o cliente com um aviso que aparece na lista.'],
];

export default function OpcoesCliente({ c, hoje, perfil, sb, plano, servidor, modelos, bloqueado, onFechar, onEditar, onCobranca, onMudou, enviar, texto }) {
  const toast = useToast();
  const [tela, setTela] = useState('menu');
  const [ocupado, setOcupado] = useState(false);
  const [modeloId, setModeloId] = useState('');
  const [msg, setMsg] = useState('');
  const [pg, setPg] = useState({ valor: String(plano?.valor ?? c.valor).replace('.', ','), forma: 'Pix', data: hoje, avancar: true });
  const [faturas, setFaturas] = useState(null);
  const [logs, setLogs] = useState(null);
  const [recibo, setRecibo] = useState(null);
  const [alerta, setAlerta] = useState(c.alerta || '');
  const ciclo = plano?.ciclo_meses || 1;
  const link = linkArea(perfil);

  useEffect(() => {
    if (tela === 'faturas' || tela === 'recibo') {
      sb.from('transactions').select('*').eq('owner_id', perfil.id).eq('customer_id', c.id).eq('tipo', 'ganho').order('data', { ascending: false }).limit(50)
        .then(({ data }) => {
          setFaturas(data || []);
          if (tela === 'recibo') {
            const ult = (data || []).find((t) => t.status === 'confirmado');
            const m = modelos.find((x) => x.tipo === 'recibo');
            setRecibo({ ult, modelo: m, texto: ult && m ? texto(m, c, { pagamento: ult }) : '' });
          }
        });
    }
    if (tela === 'perfil') sb.from('message_logs').select('*').eq('owner_id', perfil.id).eq('customer_id', c.id).order('created_at', { ascending: false }).limit(15).then(({ data }) => setLogs(data || []));
  }, [tela, sb, perfil.id, c, modelos, texto]);

  function acao(k) {
    if (k === 'editar') return onEditar();
    if (k === 'cobranca') return onCobranca();
    setTela(k);
  }
  async function renovar(e) {
    e.preventDefault(); setOcupado(true);
    const { data, error } = await sb.rpc('registrar_pagamento', { p_customer: c.id, p_valor: Number(String(pg.valor).replace(/\./g, '').replace(',', '.')), p_forma: pg.forma, p_data: pg.data, p_avancar: pg.avancar });
    setOcupado(false);
    if (error) return toast(msgErro(error), false);
    toast(pg.avancar ? `Renovado até ${fmtData(data)}.` : 'Pagamento registrado.');
    onMudou(); setTela('recibo');
  }
  async function salvarAlerta(valor) {
    setOcupado(true);
    const { error } = await sb.from('customers').update({ alerta: valor.trim() || null }).eq('id', c.id);
    setOcupado(false);
    if (error) return toast(msgErro(error), false);
    toast(valor.trim() ? 'Alerta salvo.' : 'Alerta removido.'); onMudou(); setTela('menu');
  }
  async function excluir() {
    setOcupado(true);
    const { error } = await sb.from('customers').delete().eq('id', c.id);
    setOcupado(false);
    if (error) return toast(msgErro(error), false);
    toast('Cliente excluído.'); onMudou(); onFechar();
  }
  async function mandar(textoMsg, gatilho) {
    setOcupado(true); const ok = await enviar(c, textoMsg, gatilho); setOcupado(false);
    if (ok && tela !== 'menu') setTela('menu');
    if (ok) { setModeloId(''); setMsg(''); }
  }
  const copiar = async (t) => { try { await navigator.clipboard.writeText(t); toast('Copiado.'); } catch { toast('Não foi possível copiar.', false); } };
  const acesso = `Acesse sua área do cliente: ${link}\nUsuário: ${c.usuario || c.whatsapp}\nSenha: ${c.senha_area || '(sem senha cadastrada)'}`;

  const Voltar = () => <button onClick={() => setTela('menu')} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-brand-navy dark:hover:text-white"><ArrowLeft className="h-4 w-4" />Voltar às opções</button>;
  const titulo = { menu: 'Opções do cliente', renovar: 'Renovar baseado no plano', faturas: 'Faturas', perfil: 'Perfil do cliente', recibo: 'Enviar recibo', alerta: 'Alerta', excluir: 'Excluir cliente' }[tela];

  return (
    <Modal aberto onFechar={onFechar} titulo={titulo} largura="max-w-3xl">
      {/* cabeçalho com os dados principais */}
      <div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl border border-line p-4 dark:border-night-line">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full font-display text-xl font-bold text-white" style={{ background: servidor?.cor || '#0A1F3A' }}>{c.nome.trim().charAt(0).toUpperCase()}</span>
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="truncate font-display text-lg font-bold">{c.nome}</div>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-slate-500 dark:text-slate-400">
            {c.usuario && <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5" />{c.usuario}</span>}
            <a href={`https://wa.me/${c.whatsapp}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#007F98] dark:text-brand-cyan"><MessageCircle className="h-3.5 w-3.5" />{fmtTelefone(c.whatsapp)}</a>
            {servidor && <span className="inline-flex items-center gap-1"><Server className="h-3.5 w-3.5" />{servidor.nome}</span>}
          </div>
        </div>
        <div className="space-y-1 text-right text-sm">
          <div className="font-semibold">{plano?.nome || 'Sem plano'} · {brl(c.valor)}</div>
          <div className="inline-flex items-center gap-2"><span className="inline-flex items-center gap-1 text-xs text-slate-500"><Monitor className="h-3.5 w-3.5" />{c.telas}</span><SeloVencimento c={c} hoje={hoje} /></div>
        </div>
        {c.alerta && <div className="flex w-full items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-500/10 dark:text-rose-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{c.alerta}</div>}
      </div>

      {tela === 'menu' && (
        <>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {ACOES.map(([k, r, I, dica]) => (
              <button key={k} title={dica} onClick={() => acao(k)} disabled={bloqueado && ['cobranca', 'recibo'].includes(k)}
                className={`group flex flex-col items-center justify-center gap-2 rounded-xl border border-line p-4 text-center text-sm font-semibold transition hover:-translate-y-0.5 hover:border-brand-cyan hover:shadow-md disabled:opacity-40 dark:border-night-line ${k === 'excluir' ? 'hover:border-rose-400' : ''}`}>
                <I className={`h-7 w-7 ${k === 'excluir' || k === 'alerta' ? 'text-rose-500' : 'text-brand-navy dark:text-white'} transition group-hover:scale-110`} strokeWidth={1.75} />{r}
              </button>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-line p-4 dark:border-night-line">
            <div className="flex flex-wrap items-end gap-2">
              <Selecao rotulo="Enviar mensagem para este cliente" value={modeloId} className="min-w-[220px] flex-1" todos="Escolher modelo"
                opcoes={modelos.map((m) => [m.id, `${m.nome}${m.fast ? ' (FAST)' : ''}`])}
                onChange={(e) => { setModeloId(e.target.value); const m = modelos.find((x) => x.id === e.target.value); setMsg(m ? texto(m, c) : ''); }} />
              <Btn variante="primario" disabled={!msg.trim() || bloqueado} carregando={ocupado} onClick={() => mandar(msg, 'modelo')}><Send className="h-4 w-4" />Enviar mensagem</Btn>
            </div>
            {modeloId && <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={7} className="campo mt-3 h-auto py-2" aria-label="Texto da mensagem" />}
          </div>
        </>
      )}

      {tela === 'renovar' && (
        <form onSubmit={renovar}>
          <Voltar />
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Campo rotulo="Valor recebido (R$)" inputMode="decimal" value={pg.valor} onChange={(e) => setPg({ ...pg, valor: e.target.value })} required />
            <Selecao rotulo="Forma de pagamento" value={pg.forma} onChange={(e) => setPg({ ...pg, forma: e.target.value })} opcoes={FORMAS} />
            <Campo rotulo="Data do pagamento" type="date" value={pg.data} onChange={(e) => setPg({ ...pg, data: e.target.value })} required />
            <div className="flex items-end pb-1"><Interruptor ligado={pg.avancar} onChange={(v) => setPg({ ...pg, avancar: v })} rotulo="Avançar o vencimento" desc={`De ${fmtData(c.vencimento)} para ${fmtData(addMonths(c.vencimento, ciclo))} (${ciclo === 1 ? 'ciclo mensal' : `ciclo de ${ciclo} meses`})`} /></div>
          </div>
          <p className="mt-3 text-xs text-slate-500">O valor entra no Financeiro como ganho confirmado. Depois de renovar, você pode mandar o recibo.</p>
          <div className="mt-4 flex justify-end"><Btn variante="primario" type="submit" carregando={ocupado}><RefreshCw className="h-4 w-4" />Renovar</Btn></div>
        </form>
      )}

      {tela === 'faturas' && (
        <div>
          <Voltar />
          {c.status !== 'desativado' && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 p-3 text-sm dark:bg-amber-500/10">
              <div><div className="font-semibold">Mensalidade em aberto</div><div className="text-slate-600 dark:text-slate-300">Vencimento {fmtData(c.vencimento)} · {brl(c.valor)}</div></div>
              <Btn variante="primario" onClick={() => setTela('renovar')}><CheckCircle2 className="h-4 w-4" />Registrar pagamento</Btn>
            </div>
          )}
          {!faturas ? <p className="text-sm text-slate-500">Carregando…</p> : !faturas.length ? <p className="text-sm text-slate-500">Nenhum pagamento registrado para este cliente.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line text-left text-xs text-slate-500 dark:border-night-line"><th className="py-2">Data</th><th className="py-2">Descrição</th><th className="py-2">Forma</th><th className="py-2">Status</th><th className="py-2 text-right">Valor</th></tr></thead>
              <tbody className="divide-y divide-line dark:divide-night-line">
                {faturas.map((t) => <tr key={t.id}><td className="py-2 tabular-nums">{fmtData(t.data)}</td><td className="py-2">{t.descricao || t.categoria}</td><td className="py-2">{t.forma}</td><td className="py-2"><Badge tom={t.status === 'confirmado' ? 'verde' : t.status === 'pendente' ? 'ambar' : 'vermelho'}>{t.status === 'confirmado' ? 'Pago' : t.status === 'pendente' ? 'Pendente' : 'Recusado'}</Badge></td><td className="py-2 text-right font-semibold tabular-nums">{brl(t.valor)}</td></tr>)}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tela === 'perfil' && (
        <div>
          <Voltar />
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {[['Nome', c.nome], ['Usuário', c.usuario], ['WhatsApp', fmtTelefone(c.whatsapp)], ['E-mail', c.email], ['Plano', plano?.nome], ['Valor', brl(c.valor)], ['Telas', c.telas], ['Servidor', servidor?.nome],
              ['Vencimento', fmtData(c.vencimento)], ['MAC / ID externo', c.mac], ['Cidade', c.cidade], ['Cobrança automática', c.notificar ? 'Ligada' : 'Desligada'], ['Situação', c.status === 'desativado' ? 'Desativado' : 'Ativo'], ['Cadastrado em', fmtData(String(c.created_at).slice(0, 10))]].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-line py-1.5 dark:border-night-line"><dt className="text-slate-500">{k}</dt><dd className="text-right font-medium">{v ?? '—'}</dd></div>
            ))}
          </dl>
          {c.notas && <div className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm dark:bg-night-soft"><div className="mb-1 text-xs font-semibold text-slate-500">Notas</div>{c.notas}</div>}
          <div className="mt-4 rounded-xl border border-line p-3 dark:border-night-line">
            <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="h-4 w-4 text-brand-cyan" />Acesso à área do cliente</div>
              <div className="flex gap-2"><Btn onClick={() => copiar(acesso)}><Copy className="h-4 w-4" />Copiar</Btn><Btn variante="primario" disabled={!c.senha_area || bloqueado} carregando={ocupado} onClick={() => mandar(`Olá, ${c.nome.split(' ')[0]}! 👋\n\n${acesso}`, 'modelo')}><Send className="h-4 w-4" />Enviar no WhatsApp</Btn></div></div>
            <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-300">{acesso}</pre>
          </div>
          <h3 className="mb-2 mt-4 text-sm font-semibold">Mensagens enviadas</h3>
          {!logs ? null : !logs.length ? <p className="text-sm text-slate-500">Nenhuma mensagem ainda.</p> : (
            <ul className="space-y-1.5 text-sm">
              {logs.map((l) => <li key={l.id} className="flex items-start justify-between gap-3"><span className="min-w-0 truncate" title={l.texto}><b className="mr-1">{GATILHOS[l.gatilho]?.curto || { manual: 'Manual', modelo: 'Modelo', recibo: 'Recibo', teste: 'Teste' }[l.gatilho]}</b>{l.texto}</span><span className="shrink-0 text-xs text-slate-500">{new Date(l.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} {l.status === 'erro' && <Badge tom="vermelho">erro</Badge>}</span></li>)}
            </ul>
          )}
        </div>
      )}

      {tela === 'recibo' && (
        <div>
          <Voltar />
          {!recibo ? <p className="text-sm text-slate-500">Carregando…</p> : !recibo.ult ? (
            <div className="rounded-xl bg-slate-50 p-4 text-sm dark:bg-night-soft">Este cliente ainda não tem pagamento registrado. <button className="font-semibold text-[#007F98] underline dark:text-brand-cyan" onClick={() => setTela('renovar')}>Registrar pagamento</button></div>
          ) : !recibo.modelo ? (
            <p className="text-sm text-slate-500">Crie um modelo do tipo Recibo em WhatsApp › Modelos de mensagem.</p>
          ) : (
            <>
              <p className="mb-2 text-sm text-slate-500">Recibo do pagamento de {brl(recibo.ult.valor)} em {fmtData(recibo.ult.data)} · modelo “{recibo.modelo.nome}”</p>
              <textarea value={recibo.texto} onChange={(e) => setRecibo({ ...recibo, texto: e.target.value })} rows={9} className="campo h-auto py-2" />
              <div className="mt-3 flex justify-end"><Btn variante="primario" disabled={bloqueado} carregando={ocupado} onClick={() => mandar(recibo.texto, 'recibo')}><Send className="h-4 w-4" />Enviar recibo</Btn></div>
            </>
          )}
        </div>
      )}

      {tela === 'alerta' && (
        <div>
          <Voltar />
          <Campo rotulo="Aviso sobre este cliente"><textarea value={alerta} onChange={(e) => setAlerta(e.target.value)} rows={4} className="campo h-auto py-2" placeholder="Ex.: pediu para pagar dia 15; trocar aparelho; cliente com desconto…" autoFocus /></Campo>
          <p className="mt-2 text-xs text-slate-500">Clientes com alerta ganham um ícone vermelho na lista e aparecem na aba “Com alerta”.</p>
          <div className="mt-4 flex justify-end gap-2">
            {c.alerta && <Btn onClick={() => salvarAlerta('')} carregando={ocupado}><Trash2 className="h-4 w-4" />Remover alerta</Btn>}
            <Btn variante="primario" onClick={() => salvarAlerta(alerta)} disabled={!alerta.trim()} carregando={ocupado}><AlertTriangle className="h-4 w-4" />Salvar alerta</Btn>
          </div>
        </div>
      )}

      {tela === 'excluir' && (
        <div>
          <Voltar />
          <p className="text-sm">O cadastro de <b>{c.nome}</b> e o histórico de mensagens dele serão apagados. Os pagamentos continuam no Financeiro, sem o vínculo com o cliente. <b>Não dá para desfazer.</b> Se a ideia é só parar de cobrar, use o botão de ativar/desativar na lista.</p>
          <div className="mt-4 flex justify-end gap-2"><Btn onClick={() => setTela('menu')}>Cancelar</Btn><Btn variante="perigo" onClick={excluir} carregando={ocupado}><Trash2 className="h-4 w-4" />Excluir</Btn></div>
        </div>
      )}
    </Modal>
  );
}
