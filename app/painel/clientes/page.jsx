'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import {
  UserPlus, Search, Pencil, Trash2, Send, BadgeCheck, Power, Upload, FileSpreadsheet, Bell, BellOff, ChevronLeft, ChevronRight, Crown, MoreHorizontal,
} from 'lucide-react';
import { usePainel, Titulo } from '@/components/AppShell';
import { Btn, Campo, Selecao, Modal, Badge, Vazio, Carregando, Interruptor, useToast } from '@/components/ui';
import { supabaseBrowser } from '@/lib/supabase/client';
import { buscarTudo, statusCliente } from '@/lib/dados';
import { hojeBR, gatilhoDoCliente, montaMensagem, GATILHOS } from '@/lib/cobranca';
import { addDays, addMonths, brl, daysBetween, fmtData, fmtTelefone, int, msgErro, norm, normalizaTelefone, key } from '@/lib/format';

const ABAS = [
  ['todos', 'Todos'], ['ativos', 'Ativos'], ['hoje', 'Expiram hoje'], ['semana', 'Próximos 7 dias'], ['inadimplentes', 'Inadimplentes'], ['desativados', 'Desativados'],
];
const FORMAS = ['Pix', 'Dinheiro', 'Cartão de crédito', 'Cartão de débito', 'Boleto', 'Transferência'];
const VAZIO = { id: null, nome: '', whatsapp: '', email: '', cidade: '', plano_id: '', valor: '', vencimento: '', notificar: true, notas: '' };

export default function Clientes() {
  const sb = supabaseBrowser();
  const { perfil, uso, recarregar } = usePainel();
  const toast = useToast();
  const hoje = hojeBR();
  const [lista, setLista] = useState(null);
  const [planos, setPlanos] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [aba, setAba] = useState('todos');
  const [busca, setBusca] = useState('');
  const [porPag, setPorPag] = useState(25);
  const [pag, setPag] = useState(0);
  const [form, setForm] = useState(null);
  const [pagto, setPagto] = useState(null);
  const [cobrar, setCobrar] = useState(null);
  const [excluir, setExcluir] = useState(null);
  const [importar, setImportar] = useState(false);
  const [menu, setMenu] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const [c, p, m] = await Promise.all([
        buscarTudo(() => sb.from('customers').select('*').order('vencimento')),
        sb.from('client_plans').select('*').order('nome'),
        sb.from('message_templates').select('*'),
      ]);
      setLista(c); setPlanos(p.data || []); setModelos(m.data || []);
    } catch (e) { toast(msgErro(e), false); setLista([]); }
  }, [sb, toast]);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { if (new URLSearchParams(location.search).get('novo')) setForm({ ...VAZIO, vencimento: addMonths(hoje, 1) }); }, [hoje]);
  useEffect(() => setPag(0), [aba, busca, porPag]);

  const planoMap = useMemo(() => new Map(planos.map((p) => [p.id, p])), [planos]);
  const cont = useMemo(() => {
    const l = lista || []; const em7 = addDays(hoje, 7);
    const at = l.filter((c) => c.status !== 'desativado');
    return {
      todos: l.length, ativos: at.filter((c) => c.vencimento >= hoje).length, hoje: at.filter((c) => c.vencimento === hoje).length,
      semana: at.filter((c) => c.vencimento > hoje && c.vencimento <= em7).length, inadimplentes: at.filter((c) => c.vencimento < hoje).length,
      desativados: l.length - at.length,
    };
  }, [lista, hoje]);

  const filtrados = useMemo(() => {
    const q = norm(busca); const qd = busca.replace(/\D/g, ''); const em7 = addDays(hoje, 7);
    return (lista || []).filter((c) => {
      const ativo = c.status !== 'desativado';
      if (aba === 'ativos' && !(ativo && c.vencimento >= hoje)) return false;
      if (aba === 'hoje' && !(ativo && c.vencimento === hoje)) return false;
      if (aba === 'semana' && !(ativo && c.vencimento > hoje && c.vencimento <= em7)) return false;
      if (aba === 'inadimplentes' && !(ativo && c.vencimento < hoje)) return false;
      if (aba === 'desativados' && ativo) return false;
      if (q && !(norm(`${c.nome} ${c.email || ''} ${c.cidade || ''} ${planoMap.get(c.plano_id)?.nome || ''}`).includes(q) || (qd.length >= 3 && c.whatsapp.includes(qd)))) return false;
      return true;
    });
  }, [lista, aba, busca, hoje, planoMap]);
  const totPag = Math.max(1, Math.ceil(filtrados.length / porPag));
  const pagina = filtrados.slice(pag * porPag, pag * porPag + porPag);
  const noLimite = uso?.limite != null && uso.usados >= uso.limite;
  const bloqueado = uso?.status === 'bloqueado';

  // ---------- ações
  async function salvar(e) {
    e.preventDefault();
    const tel = normalizaTelefone(form.whatsapp);
    if (tel.length < 10) return toast('Informe um WhatsApp válido com DDD.', false);
    setSalvando(true);
    const reg = {
      nome: form.nome.trim(), whatsapp: tel, email: form.email.trim() || null, cidade: form.cidade.trim() || null,
      plano_id: form.plano_id || null, valor: Number(String(form.valor).replace(',', '.')) || 0, vencimento: form.vencimento, notificar: form.notificar, notas: form.notas.trim() || null,
    };
    const { error } = form.id ? await sb.from('customers').update(reg).eq('id', form.id) : await sb.from('customers').insert(reg);
    setSalvando(false);
    if (error) return toast(msgErro(error), false);
    toast(form.id ? 'Cliente atualizado.' : 'Cliente cadastrado.');
    setForm(null); carregar(); recarregar();
  }

  async function alternarStatus(c) {
    setMenu(null);
    const { error } = await sb.from('customers').update({ status: c.status === 'desativado' ? 'ativo' : 'desativado' }).eq('id', c.id);
    if (error) return toast(msgErro(error), false);
    toast(c.status === 'desativado' ? 'Cliente reativado.' : 'Cliente desativado: ele não recebe cobranças e não conta no limite do plano.');
    carregar(); recarregar();
  }

  async function apagar() {
    const { error } = await sb.from('customers').delete().eq('id', excluir.id);
    if (error) return toast(msgErro(error), false);
    toast('Cliente excluído.'); setExcluir(null); carregar(); recarregar();
  }

  async function registrarPagamento(e) {
    e.preventDefault(); setSalvando(true);
    const { data, error } = await sb.rpc('registrar_pagamento', {
      p_customer: pagto.c.id, p_valor: Number(String(pagto.valor).replace(',', '.')), p_forma: pagto.forma, p_data: pagto.data, p_avancar: pagto.avancar,
    });
    setSalvando(false);
    if (error) return toast(msgErro(error), false);
    toast(pagto.avancar ? `Pagamento registrado. Próximo vencimento: ${fmtData(data)}.` : 'Pagamento registrado.');
    setPagto(null); carregar();
  }

  const editar = (c) => setForm({ ...VAZIO, ...c, email: c.email || '', cidade: c.cidade || '', notas: c.notas || '', plano_id: c.plano_id || '', valor: String(c.valor).replace('.', ','), whatsapp: c.whatsapp.startsWith('55') ? fmtTelefone(c.whatsapp) : `+${c.whatsapp}` });

  function abrirCobranca(c) {
    setMenu(null);
    const g = gatilhoDoCliente(c.vencimento, hoje);
    const modelo = modelos.find((m) => m.gatilho === g);
    setCobrar({ c, gatilho: g, texto: montaMensagem(modelo?.texto || '', { cliente: c, plano: planoMap.get(c.plano_id), perfil, hoje, envio: true }) });
  }
  async function enviarCobranca(e) {
    e.preventDefault(); setSalvando(true);
    const r = await fetch('/api/cobrar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerId: cobrar.c.id, texto: cobrar.texto }) });
    const j = await r.json().catch(() => ({}));
    setSalvando(false);
    if (!r.ok) return toast(j.erro || 'Não foi possível enviar.', false);
    toast(`Mensagem enviada para ${cobrar.c.nome}.`); setCobrar(null);
  }

  function exportar() {
    const cel = (v) => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const linhas = [['Nome', 'WhatsApp', 'E-mail', 'Cidade', 'Plano', 'Valor', 'Vencimento', 'Situação', 'Notificar', 'Notas'],
      ...filtrados.map((c) => [c.nome, c.whatsapp, c.email, c.cidade, planoMap.get(c.plano_id)?.nome || '', Number(c.valor).toFixed(2).replace('.', ','), fmtData(c.vencimento), statusCliente(c, hoje), c.notificar ? 'Sim' : 'Não', c.notas])];
    const blob = new Blob(['﻿' + linhas.map((l) => l.map(cel).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `clientes_${hoje}.csv`; a.click();
  }

  if (!lista) return <Carregando />;

  return (
    <>
      <Titulo titulo="Clientes" sub={uso?.limite != null ? `${int(uso.usados)} de ${int(uso.limite)} clientes ativos no plano ${uso.plano_nome}` : `${int(uso?.usados || 0)} clientes ativos · plano ${uso?.plano_nome || ''}`}>
        <Btn onClick={exportar} disabled={!filtrados.length}><FileSpreadsheet className="h-4 w-4" />Exportar</Btn>
        <Btn onClick={() => setImportar(true)} disabled={bloqueado}><Upload className="h-4 w-4" />Importar</Btn>
        <Btn variante="primario" onClick={() => setForm({ ...VAZIO, vencimento: addMonths(hoje, 1) })} disabled={noLimite || bloqueado}><UserPlus className="h-4 w-4" />Novo cliente</Btn>
      </Titulo>

      {noLimite && !bloqueado && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <Crown className="h-4 w-4" /><span className="flex-1">Você atingiu o limite de {uso.limite} clientes do plano {uso.plano_nome}. Desative clientes inativos ou faça upgrade.</span>
          <Link href="/painel/conta" className="font-semibold underline">Ver planos</Link>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="flex gap-1 overflow-x-auto border-b border-line px-3 pt-3 dark:border-night-line" role="tablist">
          {ABAS.map(([k, r]) => (
            <button key={k} role="tab" aria-selected={aba === k} onClick={() => setAba(k)}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-3 pb-2.5 pt-1 text-sm font-semibold transition ${aba === k ? 'border-brand-cyan text-brand-navy dark:text-white' : 'border-transparent text-slate-500 hover:text-brand-navy dark:hover:text-white'}`}>
              {r}<span className={`rounded-full px-1.5 text-[11px] ${k === 'inadimplentes' && cont[k] ? 'bg-rose-500/15 text-rose-600' : k === 'hoje' && cont[k] ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-slate-500/10'}`}>{cont[k]}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 p-3">
          <label className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, WhatsApp, e-mail, cidade ou plano" className="campo pl-9" />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-500">Mostrar
            <select value={porPag} onChange={(e) => setPorPag(+e.target.value)} className="campo w-20">{[10, 25, 50, 100].map((n) => <option key={n}>{n}</option>)}</select>
          </label>
        </div>

        {!filtrados.length ? (
          <Vazio msg={lista.length ? 'Nenhum cliente encontrado com esses filtros.' : 'Nenhum cliente cadastrado ainda.'}>
            {!lista.length && <Btn variante="primario" onClick={() => setForm({ ...VAZIO, vencimento: addMonths(hoje, 1) })} disabled={bloqueado}><UserPlus className="h-4 w-4" />Cadastrar o primeiro</Btn>}
          </Vazio>
        ) : (
          <>
          {/* celular: cartões */}
          <ul className="divide-y divide-line md:hidden dark:divide-night-line">
            {pagina.map((c) => {
              const st = statusCliente(c, hoje); const d = daysBetween(hoje, c.vencimento);
              return (
                <li key={c.id} className={`px-4 py-3 ${st === 'Desativado' ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><div className="truncate font-semibold">{c.nome}</div><div className="text-xs text-slate-500">{fmtTelefone(c.whatsapp)} · {planoMap.get(c.plano_id)?.nome || 'sem plano'}</div></div>
                    <div className="text-right"><div className="font-semibold tabular-nums">{brl(c.valor)}</div><div className="text-xs tabular-nums text-slate-500">{fmtData(c.vencimento)}</div></div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    {st === 'Desativado' ? <Badge>Desativado</Badge> : d === 0 ? <Badge tom="ambar">Vence hoje</Badge> : d < 0 ? <Badge tom="vermelho">Atrasado há {-d} {d === -1 ? 'dia' : 'dias'}</Badge> : <Badge tom={d <= 7 ? 'ciano' : 'verde'}>Em {d} {d === 1 ? 'dia' : 'dias'}</Badge>}
                    <div className="flex gap-1">
                      <Acao titulo="Registrar pagamento" onClick={() => setPagto({ c, valor: String(c.valor).replace('.', ','), forma: 'Pix', data: hoje, avancar: true })}><BadgeCheck className="h-4 w-4 text-emerald-600" /></Acao>
                      <Acao titulo="Cobrar pelo WhatsApp" onClick={() => abrirCobranca(c)} disabled={bloqueado}><Send className="h-4 w-4 text-brand-cyan" /></Acao>
                      <Acao titulo="Editar" onClick={() => editar(c)}><Pencil className="h-4 w-4" /></Acao>
                      <Acao titulo={c.status === 'desativado' ? 'Reativar' : 'Desativar'} onClick={() => alternarStatus(c)}><Power className="h-4 w-4" /></Acao>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-y border-line bg-slate-50 text-left text-xs font-semibold text-slate-500 dark:border-night-line dark:bg-night-soft/60 dark:text-slate-400">
                  <th className="px-4 py-2.5">Cliente</th><th className="px-4 py-2.5">WhatsApp</th><th className="px-4 py-2.5">Plano</th>
                  <th className="px-4 py-2.5 text-right">Valor</th><th className="px-4 py-2.5">Vencimento</th><th className="px-4 py-2.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line dark:divide-night-line">
                {pagina.map((c) => {
                  const st = statusCliente(c, hoje); const d = daysBetween(hoje, c.vencimento);
                  return (
                    <tr key={c.id} className={`transition hover:bg-slate-50 dark:hover:bg-night-soft/50 ${st === 'Desativado' ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 font-semibold">{c.nome}{!c.notificar && <BellOff className="h-3.5 w-3.5 text-slate-400" aria-label="Sem notificação" />}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{[c.cidade, c.email].filter(Boolean).join(' · ') || '—'}</div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums">{fmtTelefone(c.whatsapp)}</td>
                      <td className="px-4 py-3">{planoMap.get(c.plano_id)?.nome || <span className="text-slate-400">—</span>}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">{brl(c.valor)}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="tabular-nums">{fmtData(c.vencimento)}</div>
                        {st === 'Desativado' ? <Badge>Desativado</Badge> : d === 0 ? <Badge tom="ambar">Vence hoje</Badge> : d < 0 ? <Badge tom="vermelho">Atrasado há {-d} {d === -1 ? 'dia' : 'dias'}</Badge> : <Badge tom={d <= 7 ? 'ciano' : 'verde'}>Em {d} {d === 1 ? 'dia' : 'dias'}</Badge>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Acao titulo="Registrar pagamento" onClick={() => setPagto({ c, valor: String(c.valor).replace('.', ','), forma: 'Pix', data: hoje, avancar: true })}><BadgeCheck className="h-4 w-4 text-emerald-600" /></Acao>
                          <Acao titulo="Cobrar pelo WhatsApp" onClick={() => abrirCobranca(c)} disabled={bloqueado}><Send className="h-4 w-4 text-brand-cyan" /></Acao>
                          <Acao titulo="Editar" onClick={() => editar(c)}><Pencil className="h-4 w-4" /></Acao>
                          <div className="relative">
                            <Acao titulo="Mais opções" onClick={() => setMenu(menu === c.id ? null : c.id)}><MoreHorizontal className="h-4 w-4" /></Acao>
                            {menu === c.id && (
                              <div className="absolute right-0 z-20 mt-1 w-48 rounded-xl border border-line bg-white p-1 shadow-xl dark:border-night-line dark:bg-night-card">
                                <button onClick={() => alternarStatus(c)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-night-soft"><Power className="h-4 w-4" />{c.status === 'desativado' ? 'Reativar' : 'Desativar'}</button>
                                <button onClick={() => { setMenu(null); setExcluir(c); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 className="h-4 w-4" />Excluir</button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
        {filtrados.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm dark:border-night-line">
            <span className="text-slate-500">Mostrando {pag * porPag + 1} a {Math.min(filtrados.length, (pag + 1) * porPag)} de {int(filtrados.length)} clientes</span>
            <div className="flex gap-2">
              <Btn onClick={() => setPag((p) => Math.max(0, p - 1))} disabled={!pag} aria-label="Página anterior"><ChevronLeft className="h-4 w-4" /></Btn>
              <Btn onClick={() => setPag((p) => Math.min(totPag - 1, p + 1))} disabled={pag >= totPag - 1} aria-label="Próxima página"><ChevronRight className="h-4 w-4" /></Btn>
            </div>
          </div>
        )}
      </div>
      {menu && <div className="fixed inset-0 z-10" onClick={() => setMenu(null)} />}

      {/* cadastro / edição */}
      <Modal aberto={!!form} onFechar={() => setForm(null)} titulo={form?.id ? 'Editar cliente' : 'Novo cliente'} largura="max-w-2xl"
        rodape={<><Btn onClick={() => setForm(null)}>Cancelar</Btn><Btn variante="primario" type="submit" form="form-cliente" carregando={salvando}>{form?.id ? 'Salvar' : 'Cadastrar'}</Btn></>}>
        {form && (
          <form id="form-cliente" onSubmit={salvar} className="grid gap-3.5 sm:grid-cols-2">
            <Campo rotulo="Nome *" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required autoFocus />
            <Campo rotulo="WhatsApp com DDD *" type="tel" inputMode="tel" placeholder="(85) 99999-9999" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} required ajuda="Número de outro país: comece com + e o código do país." />
            <Selecao rotulo="Plano" value={form.plano_id} todos="Sem plano" opcoes={planos.map((p) => [p.id, `${p.nome} — ${brl(p.valor)}${p.ciclo_meses > 1 ? ` / ${p.ciclo_meses} meses` : '/mês'}`])}
              onChange={(e) => { const p = planoMap.get(e.target.value); setForm({ ...form, plano_id: e.target.value, valor: p ? String(p.valor).replace('.', ',') : form.valor }); }} />
            <Campo rotulo="Valor da mensalidade (R$) *" inputMode="decimal" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} required placeholder="0,00" />
            <Campo rotulo="Próximo vencimento *" type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} required />
            <Campo rotulo="E-mail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Campo rotulo="Cidade" value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
            <div className="flex items-end pb-1"><Interruptor ligado={form.notificar} onChange={(v) => setForm({ ...form, notificar: v })} rotulo="Cobrança automática no WhatsApp" desc="Envia os lembretes configurados em WhatsApp." /></div>
            <Campo rotulo="Notas" className="sm:col-span-2"><textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} rows={3} className="campo h-auto py-2" /></Campo>
            {!planos.length && <p className="text-xs text-slate-500 sm:col-span-2">Dica: cadastre seus planos em <Link href="/painel/planos" className="font-semibold text-[#007F98] dark:text-brand-cyan">Planos</Link> para preencher o valor automaticamente.</p>}
          </form>
        )}
      </Modal>

      {/* pagamento */}
      <Modal aberto={!!pagto} onFechar={() => setPagto(null)} titulo="Registrar pagamento" sub={pagto?.c.nome}
        rodape={<><Btn onClick={() => setPagto(null)}>Cancelar</Btn><Btn variante="primario" type="submit" form="form-pagto" carregando={salvando}>Registrar</Btn></>}>
        {pagto && (
          <form id="form-pagto" onSubmit={registrarPagamento} className="grid gap-3.5 sm:grid-cols-2">
            <Campo rotulo="Valor recebido (R$)" inputMode="decimal" value={pagto.valor} onChange={(e) => setPagto({ ...pagto, valor: e.target.value })} required />
            <Selecao rotulo="Forma de pagamento" value={pagto.forma} onChange={(e) => setPagto({ ...pagto, forma: e.target.value })} opcoes={FORMAS} />
            <Campo rotulo="Data do pagamento" type="date" value={pagto.data} onChange={(e) => setPagto({ ...pagto, data: e.target.value })} required />
            <div className="flex items-end pb-1">
              <Interruptor ligado={pagto.avancar} onChange={(v) => setPagto({ ...pagto, avancar: v })} rotulo="Renovar vencimento"
                desc={`De ${fmtData(pagto.c.vencimento)} para ${fmtData(addMonths(pagto.c.vencimento, planoMap.get(pagto.c.plano_id)?.ciclo_meses || 1))}`} />
            </div>
            <p className="text-xs text-slate-500 sm:col-span-2">O valor entra no Financeiro como ganho confirmado da categoria Mensalidade.</p>
          </form>
        )}
      </Modal>

      {/* cobrança manual */}
      <Modal aberto={!!cobrar} onFechar={() => setCobrar(null)} titulo="Cobrar pelo WhatsApp" sub={cobrar && `${cobrar.c.nome} · ${fmtTelefone(cobrar.c.whatsapp)} · modelo "${GATILHOS[cobrar.gatilho].nome}"`}
        rodape={<><Btn onClick={() => setCobrar(null)}>Cancelar</Btn><Btn variante="primario" type="submit" form="form-cobrar" carregando={salvando}><Send className="h-4 w-4" />Enviar agora</Btn></>}>
        {cobrar && (
          <form id="form-cobrar" onSubmit={enviarCobranca}>
            <textarea value={cobrar.texto} onChange={(e) => setCobrar({ ...cobrar, texto: e.target.value })} rows={9} className="campo h-auto py-2 font-[inherit]" required />
            <p className="mt-2 text-xs text-slate-500">A mensagem sai do WhatsApp conectado em <Link href="/painel/whatsapp" className="font-semibold">WhatsApp</Link>. Você pode editar o texto antes de enviar.</p>
          </form>
        )}
      </Modal>

      <Modal aberto={!!excluir} onFechar={() => setExcluir(null)} titulo="Excluir cliente?"
        rodape={<><Btn onClick={() => setExcluir(null)}>Cancelar</Btn><Btn variante="perigo" onClick={apagar}><Trash2 className="h-4 w-4" />Excluir</Btn></>}>
        <p className="text-sm">O cadastro de <b>{excluir?.nome}</b> e o histórico de mensagens dele serão apagados. Os pagamentos continuam no Financeiro, sem o vínculo com o cliente. <b>Não dá para desfazer.</b> Se a ideia é só parar de cobrar, use <i>Desativar</i>.</p>
      </Modal>

      {importar && <Importar onFechar={() => setImportar(false)} planos={planos} sb={sb} aoConcluir={() => { carregar(); recarregar(); }} hoje={hoje} />}
    </>
  );
}

const Acao = ({ titulo, children, ...p }) => (
  <button title={titulo} aria-label={titulo} {...p} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-night-soft">{children}</button>
);

// ---------------- importação de planilha
const ALIAS = {
  nome: ['nome', 'cliente', 'nomecliente', 'name', 'razaosocial'],
  whatsapp: ['whatsapp', 'telefone', 'celular', 'fone', 'phone', 'contato', 'numero', 'whats'],
  email: ['email', 'e-mail', 'mail'],
  cidade: ['cidade', 'city', 'municipio'],
  plano: ['plano', 'produto', 'servico', 'pacote'],
  valor: ['valor', 'mensalidade', 'preco', 'valormensal'],
  vencimento: ['vencimento', 'datavencimento', 'proximovencimento', 'expira', 'expiraem', 'validade'],
  notas: ['notas', 'observacao', 'obs', 'observacoes'],
};
function dataPlanilha(v) {
  if (v instanceof Date && !isNaN(v)) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  if (typeof v === 'number' && v > 20000) return new Date(Date.UTC(1899, 11, 30) + v * 864e5).toISOString().slice(0, 10);
  const s = String(v || '').trim(); let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[0] : null;
}
const numPlanilha = (v) => { if (typeof v === 'number') return v; let s = String(v || '').replace(/[^\d.,-]/g, ''); if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); return Number(s) || 0; };

function Importar({ onFechar, planos, sb, aoConcluir, hoje }) {
  const toast = useToast();
  const [linhas, setLinhas] = useState(null);
  const [prog, setProg] = useState(null);
  async function ler(file) {
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      if (!rows.length) return toast('A planilha está vazia.', false);
      const cab = Object.keys(rows[0]); const mapa = {};
      for (const [campo, nomes] of Object.entries(ALIAS)) { const h = cab.find((c) => nomes.includes(key(c))); if (h) mapa[campo] = h; }
      if (!mapa.nome || !mapa.whatsapp) return toast('A planilha precisa ter as colunas "nome" e "whatsapp" (ou telefone/celular).', false);
      const porNome = new Map(planos.map((p) => [key(p.nome), p]));
      setLinhas(rows.map((r) => {
        const pl = mapa.plano ? porNome.get(key(r[mapa.plano])) : null;
        return {
          nome: String(r[mapa.nome]).trim(), whatsapp: normalizaTelefone(r[mapa.whatsapp]), email: mapa.email ? String(r[mapa.email]).trim() || null : null,
          cidade: mapa.cidade ? String(r[mapa.cidade]).trim() || null : null, plano_id: pl?.id || null,
          valor: mapa.valor ? numPlanilha(r[mapa.valor]) : Number(pl?.valor || 0), vencimento: (mapa.vencimento && dataPlanilha(r[mapa.vencimento])) || addMonths(hoje, 1),
          notas: mapa.notas ? String(r[mapa.notas]).trim() || null : null,
        };
      }).filter((r) => r.nome && r.whatsapp.length >= 10));
    } catch { toast('Não consegui ler esse arquivo.', false); }
  }
  async function importar() {
    let ok = 0, erro = null;
    for (let i = 0; i < linhas.length; i++) {
      setProg(`${i + 1} de ${linhas.length}`);
      const { error } = await sb.from('customers').insert(linhas[i]);
      if (error) { erro = msgErro(error); if (/limite|bloquead/i.test(erro)) break; } else ok++;
    }
    setProg(null); aoConcluir();
    toast(erro ? `${ok} clientes importados. Parou em: ${erro}` : `${ok} clientes importados.`, !erro);
    onFechar();
  }
  return (
    <Modal aberto onFechar={onFechar} titulo="Importar clientes" sub="Planilha Excel ou CSV, primeira aba." largura="max-w-2xl"
      rodape={<><Btn onClick={onFechar}>Cancelar</Btn><Btn variante="primario" onClick={importar} disabled={!linhas?.length} carregando={!!prog}>{prog ? `Importando ${prog}` : `Importar ${linhas?.length || ''} clientes`}</Btn></>}>
      <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files[0] && ler(e.target.files[0])} className="block w-full text-sm file:mr-3 file:h-10 file:rounded-lg file:border-0 file:bg-brand-navy file:px-4 file:font-semibold file:text-white dark:file:bg-brand-cyan dark:file:text-brand-navy" />
      <p className="mt-3 text-xs text-slate-500">Colunas reconhecidas: <b>nome</b> e <b>whatsapp</b> (obrigatórias), e-mail, cidade, plano (pelo nome cadastrado em Planos), valor, vencimento (dd/mm/aaaa) e notas. Sem vencimento, fica para daqui a 1 mês.</p>
      {linhas && (
        <div className="mt-4 max-h-64 overflow-auto rounded-lg border border-line dark:border-night-line">
          <table className="w-full text-xs"><thead><tr className="bg-slate-50 text-left dark:bg-night-soft"><th className="px-2 py-1.5">Nome</th><th className="px-2 py-1.5">WhatsApp</th><th className="px-2 py-1.5">Valor</th><th className="px-2 py-1.5">Vencimento</th></tr></thead>
            <tbody>{linhas.slice(0, 50).map((l, i) => <tr key={i} className="border-t border-line dark:border-night-line"><td className="px-2 py-1">{l.nome}</td><td className="px-2 py-1">{fmtTelefone(l.whatsapp)}</td><td className="px-2 py-1">{brl(l.valor)}</td><td className="px-2 py-1">{fmtData(l.vencimento)}</td></tr>)}</tbody></table>
          {linhas.length > 50 && <p className="px-2 py-1.5 text-xs text-slate-500">… e mais {linhas.length - 50}</p>}
        </div>
      )}
    </Modal>
  );
}
