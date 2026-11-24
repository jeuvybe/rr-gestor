'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Search, FileSpreadsheet } from 'lucide-react';
import { usePainel, Titulo } from '@/components/AppShell';
import { Btn, Campo, Selecao, Modal, Badge, Vazio, Carregando, useToast } from '@/components/ui';
import { supabaseBrowser } from '@/lib/supabase/client';
import { buscarTudo } from '@/lib/dados';
import { hojeBR } from '@/lib/cobranca';
import { addMonths, brl, fmtData, fmtMesAno, int, monthEnd, monthStart, msgErro, norm } from '@/lib/format';

const FORMAS = ['Pix', 'Dinheiro', 'Cartão de crédito', 'Cartão de débito', 'Boleto', 'Transferência'];
const CAT_GANHO = ['Mensalidade', 'Serviço avulso', 'Instalação', 'Venda', 'Outros'];
const CAT_GASTO = ['Pessoal', 'Infraestrutura', 'Software', 'Marketing', 'Impostos', 'Aluguel', 'Outros'];
const STATUS = [['confirmado', 'Confirmado'], ['pendente', 'Pendente'], ['recusado', 'Recusado']];
const TOM = { confirmado: 'verde', pendente: 'ambar', recusado: 'vermelho' };

export default function Financeiro() {
  const sb = supabaseBrowser();
  const toast = useToast();
  const { perfil } = usePainel();
  const hoje = hojeBR();
  const [mes, setMes] = useState(monthStart(hoje));
  const [movs, setMovs] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [tipo, setTipo] = useState('');
  const [busca, setBusca] = useState('');
  const [form, setForm] = useState(null);
  const [excluir, setExcluir] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setMovs(null);
    try {
      const [m, c] = await Promise.all([
        buscarTudo(() => sb.from('transactions').select('*').eq('owner_id', perfil.id).gte('data', mes).lte('data', monthEnd(mes)).order('data', { ascending: false }).order('created_at', { ascending: false })),
        sb.from('customers').select('id, nome').eq('owner_id', perfil.id).order('nome'),
      ]);
      setMovs(m); setClientes(c.data || []);
    } catch (e) { toast(msgErro(e), false); setMovs([]); }
  }, [sb, mes, toast, perfil.id]);
  useEffect(() => { carregar(); }, [carregar]);

  const cliNome = useMemo(() => new Map(clientes.map((c) => [c.id, c.nome])), [clientes]);
  const lista = useMemo(() => {
    const q = norm(busca);
    return (movs || []).filter((m) => (!tipo || m.tipo === tipo) && (!q || norm(`${m.descricao} ${m.categoria} ${cliNome.get(m.customer_id) || ''} ${m.forma}`).includes(q)));
  }, [movs, tipo, busca, cliNome]);
  const conf = (movs || []).filter((m) => m.status === 'confirmado');
  const ganhos = conf.filter((m) => m.tipo === 'ganho').reduce((a, m) => a + Number(m.valor), 0);
  const gastos = conf.filter((m) => m.tipo === 'gasto').reduce((a, m) => a + Number(m.valor), 0);
  const pendente = (movs || []).filter((m) => m.status === 'pendente' && m.tipo === 'ganho').reduce((a, m) => a + Number(m.valor), 0);

  async function salvar(e) {
    e.preventDefault(); setSalvando(true);
    const reg = {
      tipo: form.tipo, categoria: form.categoria.trim() || 'Outros', descricao: form.descricao.trim() || null, valor: Number(String(form.valor).replace(/\./g, '').replace(',', '.')),
      data: form.data, forma: form.forma, status: form.status, customer_id: form.customer_id || null,
    };
    if (!(reg.valor > 0)) { setSalvando(false); return toast('Informe um valor maior que zero.', false); }
    const { error } = form.id ? await sb.from('transactions').update(reg).eq('id', form.id) : await sb.from('transactions').insert(reg);
    setSalvando(false);
    if (error) return toast(msgErro(error), false);
    toast('Movimentação salva.'); setForm(null); carregar();
  }
  async function apagar() {
    const { error } = await sb.from('transactions').delete().eq('id', excluir.id);
    if (error) return toast(msgErro(error), false);
    toast('Movimentação excluída.'); setExcluir(null); carregar();
  }
  function exportar() {
    const cel = (v) => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const l = [['Data', 'Tipo', 'Categoria', 'Descrição', 'Cliente', 'Forma', 'Status', 'Valor'], ...lista.map((m) => [fmtData(m.data), m.tipo, m.categoria, m.descricao, cliNome.get(m.customer_id) || '', m.forma, m.status, (m.tipo === 'gasto' ? -m.valor : +m.valor).toFixed(2).replace('.', ',')])];
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + l.map((x) => x.map(cel).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' })); a.download = `financeiro_${mes.slice(0, 7)}.csv`; a.click();
  }
  const novo = (t) => setForm({ id: null, tipo: t, categoria: t === 'ganho' ? 'Mensalidade' : 'Outros', descricao: '', valor: '', data: mes === monthStart(hoje) ? hoje : mes, forma: 'Pix', status: 'confirmado', customer_id: '' });

  return (
    <>
      <Titulo titulo="Financeiro" sub="Ganhos e gastos do mês. Pagamentos registrados em Clientes entram aqui automaticamente.">
        <Btn onClick={exportar} disabled={!lista.length}><FileSpreadsheet className="h-4 w-4" />Exportar</Btn>
        <Btn onClick={() => novo('gasto')}><ArrowUpRight className="h-4 w-4 text-rose-500" />Novo gasto</Btn>
        <Btn variante="primario" onClick={() => novo('ganho')}><Plus className="h-4 w-4" />Novo ganho</Btn>
      </Titulo>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Btn onClick={() => setMes(addMonths(mes, -1))} aria-label="Mês anterior"><ChevronLeft className="h-4 w-4" /></Btn>
        <div className="min-w-[180px] text-center font-display text-lg font-bold capitalize">{fmtMesAno(mes)}</div>
        <Btn onClick={() => setMes(addMonths(mes, 1))} disabled={mes >= monthStart(hoje)} aria-label="Próximo mês"><ChevronRight className="h-4 w-4" /></Btn>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[['Ganhos confirmados', ganhos, 'text-[#007F98] dark:text-brand-cyan'], ['Gastos confirmados', gastos, 'text-rose-600 dark:text-rose-400'], ['Saldo do mês', ganhos - gastos, ganhos - gastos < 0 ? 'text-rose-600' : ''], ['A receber (pendente)', pendente, 'text-amber-600 dark:text-amber-300']].map(([r, v, c]) => (
          <div key={r} className="card p-4"><div className="text-sm text-slate-500 dark:text-slate-400">{r}</div><div className={`mt-1 font-display text-[clamp(18px,2vw,24px)] font-bold tabular-nums ${c}`}>{brl(v)}</div></div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 p-3">
          <label className="relative min-w-[200px] flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar descrição, categoria, cliente" className="campo pl-9" /></label>
          <div className="flex rounded-lg border border-line p-0.5 text-sm font-semibold dark:border-night-line">
            {[['', 'Todos'], ['ganho', 'Ganhos'], ['gasto', 'Gastos']].map(([k, r]) => <button key={k} onClick={() => setTipo(k)} className={`h-9 rounded-md px-3 ${tipo === k ? 'bg-brand-navy text-white dark:bg-brand-cyan dark:text-brand-navy' : 'text-slate-500'}`}>{r}</button>)}
          </div>
        </div>
        {!movs ? <Carregando /> : !lista.length ? <Vazio msg="Nenhuma movimentação neste mês." /> : (<>
          <ul className="border-t border-line md:grid md:grid-cols-2 xl:hidden dark:border-night-line">
            {lista.map((m) => (
              <li key={m.id} className="flex items-start gap-3 border-b border-line px-4 py-3 md:odd:border-r dark:border-night-line">
                <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${m.tipo === 'ganho' ? 'bg-brand-cyan/10 text-[#0095B0] dark:text-brand-cyan' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>{m.tipo === 'ganho' ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 break-words font-medium">{m.descricao || m.categoria}</span>
                    <span className={`shrink-0 whitespace-nowrap font-semibold tabular-nums ${m.tipo === 'gasto' ? 'text-rose-600 dark:text-rose-400' : ''}`}>{m.tipo === 'gasto' ? '−' : '+'}{brl(m.valor)}</span>
                  </div>
                  {m.customer_id && <div className="truncate text-xs text-slate-500">{cliNome.get(m.customer_id)}</div>}
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{fmtData(m.data)} · {m.categoria} · {m.forma}</div>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <Badge tom={TOM[m.status]}>{STATUS.find((s) => s[0] === m.status)?.[1]}</Badge>
                    <div className="flex gap-1">
                      <button title="Editar" aria-label="Editar" onClick={() => setForm({ ...m, descricao: m.descricao || '', valor: String(m.valor).replace('.', ','), customer_id: m.customer_id || '' })} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-night-soft"><Pencil className="h-4 w-4" /></button>
                      <button title="Excluir" aria-label="Excluir" onClick={() => setExcluir(m)} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto xl:block">
            <table className="w-full min-w-[760px] text-sm">
              <thead><tr className="border-y border-line bg-slate-50 text-left text-xs font-semibold text-slate-500 dark:border-night-line dark:bg-night-soft/60 dark:text-slate-400">
                <th className="px-4 py-2.5">Data</th><th className="px-4 py-2.5">Descrição</th><th className="px-4 py-2.5">Categoria</th><th className="px-4 py-2.5">Forma</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5 text-right">Valor</th><th className="w-24" />
              </tr></thead>
              <tbody className="divide-y divide-line dark:divide-night-line">
                {lista.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-night-soft/50">
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{fmtData(m.data)}</td>
                    <td className="px-4 py-2.5"><div className="flex items-center gap-2">{m.tipo === 'ganho' ? <ArrowDownLeft className="h-4 w-4 shrink-0 text-brand-cyan" /> : <ArrowUpRight className="h-4 w-4 shrink-0 text-rose-500" />}<span className="font-medium">{m.descricao || m.categoria}</span></div>{m.customer_id && <div className="pl-6 text-xs text-slate-500">{cliNome.get(m.customer_id)}</div>}</td>
                    <td className="px-4 py-2.5">{m.categoria}</td>
                    <td className="whitespace-nowrap px-4 py-2.5">{m.forma}</td>
                    <td className="px-4 py-2.5"><Badge tom={TOM[m.status]}>{STATUS.find((s) => s[0] === m.status)?.[1]}</Badge></td>
                    <td className={`whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums ${m.tipo === 'gasto' ? 'text-rose-600 dark:text-rose-400' : ''}`}>{m.tipo === 'gasto' ? '−' : '+'}{brl(m.valor)}</td>
                    <td className="px-2 py-2.5"><div className="flex justify-end gap-1">
                      <button title="Editar" aria-label="Editar" onClick={() => setForm({ ...m, descricao: m.descricao || '', valor: String(m.valor).replace('.', ','), customer_id: m.customer_id || '' })} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-night-soft"><Pencil className="h-4 w-4" /></button>
                      <button title="Excluir" aria-label="Excluir" onClick={() => setExcluir(m)} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>)}
        {movs && lista.length > 0 && <div className="border-t border-line px-4 py-3 text-sm text-slate-500 dark:border-night-line">{int(lista.length)} lançamentos</div>}
      </div>

      <Modal aberto={!!form} onFechar={() => setForm(null)} titulo={`${form?.id ? 'Editar' : 'Novo'} ${form?.tipo === 'gasto' ? 'gasto' : 'ganho'}`}
        rodape={<><Btn onClick={() => setForm(null)}>Cancelar</Btn><Btn variante="primario" type="submit" form="form-mov" carregando={salvando}>Salvar</Btn></>}>
        {form && (
          <form id="form-mov" onSubmit={salvar} className="grid gap-3.5 sm:grid-cols-2">
            <div className="flex rounded-lg border border-line p-0.5 text-sm font-semibold sm:col-span-2 dark:border-night-line">
              {[['ganho', 'Ganho'], ['gasto', 'Gasto']].map(([k, r]) => <button type="button" key={k} onClick={() => setForm({ ...form, tipo: k })} className={`h-9 flex-1 rounded-md ${form.tipo === k ? (k === 'ganho' ? 'bg-brand-cyan text-brand-navy' : 'bg-rose-600 text-white') : 'text-slate-500'}`}>{r}</button>)}
            </div>
            <Campo rotulo="Valor (R$) *" inputMode="decimal" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} required autoFocus placeholder="0,00" />
            <Campo rotulo="Data *" type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} required />
            <Campo rotulo="Categoria"><input list="cats" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className="campo" /><datalist id="cats">{(form.tipo === 'ganho' ? CAT_GANHO : CAT_GASTO).map((c) => <option key={c} value={c} />)}</datalist></Campo>
            <Selecao rotulo="Forma" value={form.forma} onChange={(e) => setForm({ ...form, forma: e.target.value })} opcoes={FORMAS} />
            <Campo rotulo="Descrição" className="sm:col-span-2" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            <Selecao rotulo="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} opcoes={STATUS} />
            <Selecao rotulo="Cliente (opcional)" value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} todos="Nenhum" opcoes={clientes.map((c) => [c.id, c.nome])} />
          </form>
        )}
      </Modal>
      <Modal aberto={!!excluir} onFechar={() => setExcluir(null)} titulo="Excluir movimentação?"
        rodape={<><Btn onClick={() => setExcluir(null)}>Cancelar</Btn><Btn variante="perigo" onClick={apagar}>Excluir</Btn></>}>
        <p className="text-sm">{excluir && <>{excluir.descricao || excluir.categoria} · <b>{brl(excluir.valor)}</b> em {fmtData(excluir.data)}. Não dá para desfazer.</>}</p>
      </Modal>
    </>
  );
}
