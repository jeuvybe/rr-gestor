'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { MessageCircle, Save, AlertTriangle } from 'lucide-react';
import { usePainel, Titulo } from '@/components/AppShell';
import ConexaoWhatsApp from '@/components/ConexaoWhatsApp';
import { Btn, Badge, Interruptor, Vazio, useToast } from '@/components/ui';
import { supabaseBrowser } from '@/lib/supabase/client';
import { GATILHOS, VARIAVEIS, hojeBR, montaMensagem } from '@/lib/cobranca';
import { addDays, fmtTelefone, msgErro } from '@/lib/format';

const ORDEM = ['antes', 'no_dia', 'depois'];

export default function WhatsApp() {
  const sb = supabaseBrowser();
  const { perfil, uso } = usePainel();
  const toast = useToast();
  const hoje = hojeBR();
  const [modelos, setModelos] = useState([]);
  const [logs, setLogs] = useState(null);
  const [nomes, setNomes] = useState(new Map());
  const [salvando, setSalvando] = useState('');
  const [foco, setFoco] = useState({});

  const carregar = useCallback(async () => {
    const [m, l, c] = await Promise.all([
      sb.from('message_templates').select('*').eq('owner_id', perfil.id),
      sb.from('message_logs').select('*').eq('owner_id', perfil.id).order('created_at', { ascending: false }).limit(60),
      sb.from('customers').select('id, nome').eq('owner_id', perfil.id),
    ]);
    setModelos(ORDEM.map((g) => m.data?.find((x) => x.gatilho === g)).filter(Boolean));
    setLogs(l.data || []); setNomes(new Map((c.data || []).map((x) => [x.id, x.nome])));
  }, [sb, perfil.id]);
  useEffect(() => { carregar(); }, [carregar]);

  const muda = (id, campo, v) => setModelos((ms) => ms.map((m) => (m.id === id ? { ...m, [campo]: v, _alterado: true } : m)));
  async function salvar(m) {
    setSalvando(m.id);
    const { error } = await sb.from('message_templates').update({ texto: m.texto, dias: Number(m.dias) || 0, ativo: m.ativo }).eq('id', m.id);
    setSalvando('');
    if (error) return toast(msgErro(error), false);
    toast('Mensagem salva.'); setModelos((ms) => ms.map((x) => (x.id === m.id ? { ...x, _alterado: false } : x)));
  }
  function inserir(m, v) {
    const el = document.getElementById(`txt-${m.id}`);
    const p = el?.selectionStart ?? m.texto.length;
    muda(m.id, 'texto', m.texto.slice(0, p) + v + m.texto.slice(el?.selectionEnd ?? p));
    setTimeout(() => { el?.focus(); el?.setSelectionRange(p + v.length, p + v.length); });
  }
  const exemplo = useMemo(() => ({ nome: 'Maria Souza', valor: 99.9 }), []);

  return (
    <>
      <Titulo titulo="WhatsApp e cobranças" sub="Conecte o número que vai enviar as cobranças e personalize as mensagens automáticas." />

      <section className="card mb-5 p-5">
        <h2 className="mb-4 flex items-center gap-2 font-display text-base font-semibold"><MessageCircle className="h-4 w-4 text-brand-cyan" />Conexão</h2>
        <ConexaoWhatsApp bloqueado={uso?.status === 'bloqueado'} />
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />A conexão por QR Code não é a API oficial do WhatsApp. Para reduzir o risco de bloqueio do número, envie só para clientes que já falam com você e evite textos idênticos em massa.</p>
      </section>

      <section className="mb-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div><h2 className="font-display text-lg font-bold">Mensagens automáticas</h2><p className="text-sm text-slate-500 dark:text-slate-400">Enviadas todo dia às 9h para clientes ativos com notificação ligada. Cada cliente recebe no máximo uma por dia.</p></div>
          {!perfil.chave_pix && <Link href="/painel/conta" className="text-sm font-semibold text-amber-700 underline dark:text-amber-300">Cadastre sua chave Pix para usar {'{pix}'}</Link>}
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          {modelos.map((m) => {
            const venc = m.gatilho === 'antes' ? addDays(hoje, Number(m.dias) || 0) : m.gatilho === 'depois' ? addDays(hoje, -(Number(m.dias) || 0)) : hoje;
            return (
              <div key={m.id} className={`card flex flex-col p-4 ${m.ativo ? '' : 'opacity-70'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div><div className="font-semibold">{GATILHOS[m.gatilho].nome}</div>
                    <div className="mt-1 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                      {m.gatilho === 'no_dia' ? 'No dia do vencimento' : (<>
                        <input type="number" min={1} max={60} value={m.dias} onChange={(e) => muda(m.id, 'dias', e.target.value)} className="campo h-8 w-16 px-2 text-center" aria-label="Dias" />
                        {m.gatilho === 'antes' ? 'dias antes' : 'dias depois'}</>)}
                    </div>
                  </div>
                  <Interruptor ligado={m.ativo} onChange={(v) => muda(m.id, 'ativo', v)} rotulo="" />
                </div>
                <textarea id={`txt-${m.id}`} value={m.texto} onChange={(e) => muda(m.id, 'texto', e.target.value)} onFocus={() => setFoco({ ...foco, [m.id]: true })} rows={8} className="campo mt-3 h-auto py-2 text-sm" />
                <div className="mt-2 flex flex-wrap gap-1">{VARIAVEIS.map(([v, d]) => <button key={v} type="button" title={d} onClick={() => inserir(m, v)} className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600 hover:bg-brand-cyan/15 dark:bg-night-soft dark:text-slate-300">{v}</button>)}</div>
                <div className="mt-3 rounded-xl bg-[#E7F8EE] p-3 text-[13px] leading-snug text-[#1F2C34] dark:bg-[#0B3B2E] dark:text-emerald-50">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide opacity-60">Pré-visualização</div>
                  <div className="whitespace-pre-wrap">{montaMensagem(m.texto, { cliente: { ...exemplo, vencimento: venc }, plano: { nome: 'Mensal' }, perfil, hoje })}</div>
                </div>
                <Btn variante={m._alterado ? 'primario' : 'secundario'} className="mt-3" onClick={() => salvar(m)} carregando={salvando === m.id} disabled={!m._alterado}><Save className="h-4 w-4" />{m._alterado ? 'Salvar alterações' : 'Salvo'}</Btn>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="p-4"><h2 className="font-display text-base font-semibold">Histórico de envios</h2><p className="text-xs text-slate-500">Últimas 60 mensagens</p></div>
        {!logs ? null : !logs.length ? <Vazio msg="Nenhuma mensagem enviada ainda." /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead><tr className="border-y border-line bg-slate-50 text-left text-xs font-semibold text-slate-500 dark:border-night-line dark:bg-night-soft/60"><th className="px-4 py-2.5">Quando</th><th className="px-4 py-2.5">Cliente</th><th className="px-4 py-2.5">Tipo</th><th className="px-4 py-2.5">Mensagem</th><th className="px-4 py-2.5">Status</th></tr></thead>
              <tbody className="divide-y divide-line dark:divide-night-line">
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{new Date(l.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td className="px-4 py-2.5">{nomes.get(l.customer_id) || fmtTelefone(l.telefone)}</td>
                    <td className="px-4 py-2.5">{GATILHOS[l.gatilho]?.curto || (l.gatilho === 'manual' ? 'Manual' : 'Teste')}</td>
                    <td className="max-w-[360px] truncate px-4 py-2.5 text-slate-500" title={l.texto}>{l.texto}</td>
                    <td className="px-4 py-2.5">{l.status === 'enviado' ? <Badge tom="verde">Enviado</Badge> : <Badge tom="vermelho" >Erro</Badge>}{l.erro && <div className="max-w-[200px] truncate text-xs text-rose-600" title={l.erro}>{l.erro}</div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
