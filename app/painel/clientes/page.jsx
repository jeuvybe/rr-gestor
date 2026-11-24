'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  UserPlus, Search, Upload, FileSpreadsheet, BellOff, ChevronLeft, ChevronRight, Crown, Monitor, MessageCircle, Zap, AlertTriangle, Globe, Copy, Trash2, Send, KeyRound, Dices,
} from 'lucide-react';
import { usePainel, Titulo } from '@/components/AppShell';
import { Btn, Campo, Selecao, Modal, Vazio, Carregando, Interruptor, useToast } from '@/components/ui';
import OpcoesCliente, { SeloVencimento } from '@/components/OpcoesCliente';
import ImportarClientes from '@/components/ImportarClientes';
import { supabaseBrowser } from '@/lib/supabase/client';
import { buscarTudo, statusCliente } from '@/lib/dados';
import { hojeBR, gatilhoDoCliente, montaMensagem, GATILHOS, linkArea } from '@/lib/cobranca';
import { addDays, addMonths, brl, daysBetween, fmtData, fmtTelefone, int, msgErro, norm, normalizaTelefone } from '@/lib/format';

const ABAS = [
  ['todos', 'Todos'], ['ativos', 'Ativos'], ['hoje', 'Expiram hoje'], ['semana', 'Próximos 7 dias'], ['inadimplentes', 'Inadimplentes'], ['alerta', 'Com alerta'], ['desativados', 'Desativados'],
];
const ORDENS = [['venc', 'Vencimento mais próximo'], ['venc_desc', 'Vencimento mais distante'], ['nome', 'Nome (A–Z)'], ['recentes', 'Cadastrados por último']];
const VAZIO = { id: null, nome: '', usuario: '', senha_area: '', whatsapp: '', email: '', cidade: '', mac: '', servidor_id: '', plano_id: '', valor: '', vencimento: '', notificar: true, telas: 1, notas: '' };
const senhaAleatoria = () => Math.random().toString(36).slice(2, 8);

export default function Clientes() {
  const sb = supabaseBrowser();
  const { perfil, uso, recarregar } = usePainel();
  const toast = useToast();
  const hoje = hojeBR();
  const [lista, setLista] = useState(null);
  const [planos, setPlanos] = useState([]);
  const [modelosAuto, setModelosAuto] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [servidores, setServidores] = useState([]);
  const [aba, setAba] = useState('todos');
  const [servFiltro, setServFiltro] = useState('');
  const [ordem, setOrdem] = useState('venc');
  const [busca, setBusca] = useState('');
  const [porPag, setPorPag] = useState(25);
  const [pag, setPag] = useState(0);
  const [form, setForm] = useState(null);
  const [opcoes, setOpcoes] = useState(null);
  const [envio, setEnvio] = useState(null);
  const [importar, setImportar] = useState(false);
  const [verArea, setVerArea] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [enviandoFast, setEnviandoFast] = useState('');

  const carregar = useCallback(async () => {
    try {
      const [c, p, ma, mm, sv] = await Promise.all([
        buscarTudo(() => sb.from('customers').select('*').eq('owner_id', perfil.id).order('vencimento')),
        sb.from('client_plans').select('*').eq('owner_id', perfil.id).order('nome'),
        sb.from('message_templates').select('*').eq('owner_id', perfil.id),
        sb.from('message_models').select('*').eq('owner_id', perfil.id).order('nome'),
        sb.from('servers').select('*').eq('owner_id', perfil.id).order('nome'),
      ]);
      setLista(c); setPlanos(p.data || []); setModelosAuto(ma.data || []); setModelos(mm.data || []); setServidores(sv.data || []);
      setOpcoes((o) => (o ? c.find((x) => x.id === o.id) || null : o));
    } catch (e) { toast(msgErro(e), false); setLista([]); }
  }, [sb, toast, perfil.id]);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { if (new URLSearchParams(location.search).get('novo')) setForm({ ...VAZIO, vencimento: addMonths(hoje, 1) }); }, [hoje]);
  useEffect(() => setPag(0), [aba, busca, porPag, servFiltro, ordem]);

  const planoMap = useMemo(() => new Map(planos.map((p) => [p.id, p])), [planos]);
  const servMap = useMemo(() => new Map(servidores.map((s) => [s.id, s])), [servidores]);
  const modeloMap = useMemo(() => new Map(modelos.map((m) => [m.id, m])), [modelos]);
  const fast = modelos.find((m) => m.fast);

  const passaAba = useCallback((c, k) => {
    const ativo = c.status !== 'desativado'; const em7 = addDays(hoje, 7);
    if (k === 'ativos') return ativo && c.vencimento >= hoje;
    if (k === 'hoje') return ativo && c.vencimento === hoje;
    if (k === 'semana') return ativo && c.vencimento > hoje && c.vencimento <= em7;
    if (k === 'inadimplentes') return ativo && c.vencimento < hoje;
    if (k === 'alerta') return !!c.alerta;
    if (k === 'desativados') return !ativo;
    return true;
  }, [hoje]);
  const cont = useMemo(() => Object.fromEntries(ABAS.map(([k]) => [k, (lista || []).filter((c) => passaAba(c, k)).length])), [lista, passaAba]);
  const contServ = useMemo(() => { const m = {}; (lista || []).forEach((c) => { m[c.servidor_id || '_'] = (m[c.servidor_id || '_'] || 0) + 1; }); return m; }, [lista]);

  const filtrados = useMemo(() => {
    const q = norm(busca); const qd = busca.replace(/\D/g, '');
    const l = (lista || []).filter((c) => passaAba(c, aba)
      && (!servFiltro || (servFiltro === '_' ? !c.servidor_id : c.servidor_id === servFiltro))
      && (!q || norm(`${c.nome} ${c.usuario || ''} ${c.email || ''} ${c.cidade || ''} ${c.mac || ''} ${planoMap.get(c.plano_id)?.nome || ''} ${c.notas || ''}`).includes(q) || (qd.length >= 3 && c.whatsapp.includes(qd))));
    const cmp = { venc: (a, b) => (a.vencimento < b.vencimento ? -1 : 1), venc_desc: (a, b) => (a.vencimento > b.vencimento ? -1 : 1), nome: (a, b) => a.nome.localeCompare(b.nome, 'pt-BR'), recentes: (a, b) => (a.created_at > b.created_at ? -1 : 1) }[ordem];
    // desativados sempre no fim da lista
    return l.sort((a, b) => (a.status === 'desativado') - (b.status === 'desativado') || cmp(a, b));
  }, [lista, aba, busca, servFiltro, ordem, planoMap, passaAba]);
  const totPag = Math.max(1, Math.ceil(filtrados.length / porPag));
  const pagina = filtrados.slice(pag * porPag, pag * porPag + porPag);
  const noLimite = uso?.limite != null && uso.usados >= uso.limite;
  const bloqueado = uso?.status === 'bloqueado';
  const link = linkArea(perfil);

  // ---------- ações
  const novo = () => setForm({ ...VAZIO, vencimento: addMonths(hoje, 1), senha_area: senhaAleatoria() });
  const editar = (c) => setForm({ ...VAZIO, ...c, usuario: c.usuario || '', senha_area: c.senha_area || '', email: c.email || '', cidade: c.cidade || '', mac: c.mac || '', notas: c.notas || '', plano_id: c.plano_id || '', servidor_id: c.servidor_id || '', valor: String(c.valor).replace('.', ','), whatsapp: c.whatsapp.startsWith('55') ? fmtTelefone(c.whatsapp) : `+${c.whatsapp}` });

  async function salvar(e) {
    e.preventDefault();
    const tel = normalizaTelefone(form.whatsapp);
    if (tel.length < 10) return toast('Informe um WhatsApp válido com DDD.', false);
    setSalvando(true);
    const reg = {
      nome: form.nome.trim(), usuario: form.usuario.trim() || null, senha_area: form.senha_area.trim() || null, whatsapp: tel, email: form.email.trim() || null,
      cidade: form.cidade.trim() || null, mac: form.mac.trim() || null, servidor_id: form.servidor_id || null, plano_id: form.plano_id || null,
      valor: Number(String(form.valor).replace(/\./g, '').replace(',', '.')) || 0, vencimento: form.vencimento, notificar: form.notificar, telas: Number(form.telas) || 1, notas: form.notas.trim() || null,
    };
    const { error } = form.id ? await sb.from('customers').update(reg).eq('id', form.id) : await sb.from('customers').insert(reg);
    setSalvando(false);
    if (error) return toast(msgErro(error), false);
    toast(form.id ? 'Cliente atualizado.' : 'Cliente cadastrado.');
    setForm(null); carregar(); recarregar();
  }

  async function alternarStatus(c) {
    const { error } = await sb.from('customers').update({ status: c.status === 'desativado' ? 'ativo' : 'desativado' }).eq('id', c.id);
    if (error) return toast(msgErro(error), false);
    toast(c.status === 'desativado' ? `${c.nome} reativado.` : `${c.nome} desativado: não recebe cobranças e não conta no limite do plano.`);
    carregar(); recarregar();
  }

  const texto = (m, c, extra = {}) => montaMensagem(m?.texto || '', { cliente: c, plano: planoMap.get(c.plano_id), perfil, hoje, envio: true, servidor: servMap.get(c.servidor_id), ...extra });
  async function enviar(c, msg, gatilho = 'modelo') {
    const r = await fetch('/api/cobrar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerId: c.id, texto: msg, gatilho }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { toast(j.erro || 'Não foi possível enviar.', false); return false; }
    toast(`Mensagem enviada para ${c.nome}.`); return true;
  }
  /** Botão de WhatsApp: modelo do plano (abre pré-visualização) */
  function msgDoPlano(c) {
    const m = modeloMap.get(planoMap.get(c.plano_id)?.modelo_id) || modelos.find((x) => x.tipo === 'cobranca');
    if (!m) return toast('Crie um modelo de mensagem em WhatsApp › Modelos.', false);
    setEnvio({ c, titulo: `Mensagem do plano · ${m.nome}`, texto: texto(m, c), gatilho: 'modelo' });
  }
  /** Botão FAST: envia na hora o modelo marcado como FAST */
  async function msgFast(c) {
    if (!fast) return toast('Marque um modelo como FAST em WhatsApp › Modelos.', false);
    setEnviandoFast(c.id); await enviar(c, texto(fast, c)); setEnviandoFast('');
  }
  function cobranca(c) {
    const g = gatilhoDoCliente(c.vencimento, hoje);
    const m = modelosAuto.find((x) => x.gatilho === g);
    setEnvio({ c, titulo: `Enviar cobrança · ${GATILHOS[g].nome}`, texto: texto(m, c), gatilho: 'manual' });
  }

  function exportar() {
    const cel = (v) => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const linhas = [['Nome', 'Usuário', 'WhatsApp', 'E-mail', 'Servidor', 'Plano', 'Telas', 'Valor', 'Vencimento', 'Situação', 'MAC/ID externo', 'Cidade', 'Notificar', 'Alerta', 'Notas'],
      ...filtrados.map((c) => [c.nome, c.usuario, c.whatsapp, c.email, servMap.get(c.servidor_id)?.nome || '', planoMap.get(c.plano_id)?.nome || '', c.telas, Number(c.valor).toFixed(2).replace('.', ','), fmtData(c.vencimento), statusCliente(c, hoje), c.mac, c.cidade, c.notificar ? 'Sim' : 'Não', c.alerta, c.notas])];
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + linhas.map((l) => l.map(cel).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' })); a.download = `clientes_${hoje}.csv`; a.click();
  }
  const copiar = async (t) => { try { await navigator.clipboard.writeText(t); toast('Copiado.'); } catch { toast('Não foi possível copiar.', false); } };

  if (!lista) return <Carregando />;

  const BotoesMsg = ({ c }) => (
    <div className="flex items-center gap-1">
      <button title="Envia a mensagem no modelo do plano" aria-label={`Mensagem do plano para ${c.nome}`} onClick={() => msgDoPlano(c)} disabled={bloqueado}
        className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-500 text-white transition hover:bg-emerald-600 disabled:opacity-40"><MessageCircle className="h-4 w-4" /></button>
      <button title={fast ? `Envia na hora o modelo FAST (${fast.nome})` : 'Nenhum modelo marcado como FAST'} aria-label={`Mensagem FAST para ${c.nome}`} onClick={() => msgFast(c)} disabled={bloqueado || enviandoFast === c.id}
        className="inline-flex h-9 items-center gap-1 rounded-lg bg-brand-navy px-2 text-[11px] font-bold text-white transition hover:bg-[#12305a] disabled:opacity-40 dark:bg-brand-cyan dark:text-brand-navy"><Zap className={`h-3.5 w-3.5 ${enviandoFast === c.id ? 'animate-pulse' : ''}`} />FAST</button>
    </div>
  );
  const Toggle = ({ c }) => (
    <button role="switch" aria-checked={c.status !== 'desativado'} title={c.status === 'desativado' ? 'Reativar cliente' : 'Desativar cliente'} onClick={() => alternarStatus(c)}
      className={`h-5 w-9 shrink-0 rounded-full p-0.5 transition ${c.status !== 'desativado' ? 'bg-brand-cyan' : 'bg-slate-300 dark:bg-night-line'}`}>
      <span className={`block h-4 w-4 rounded-full bg-white shadow transition-transform ${c.status !== 'desativado' ? 'translate-x-4' : ''}`} />
    </button>
  );
  const Ponto = ({ c }) => { const s = servMap.get(c.servidor_id); return <span title={s ? `Servidor ${s.nome}` : 'Sem servidor'} className="h-3 w-3 shrink-0 rounded-full ring-2 ring-white dark:ring-night-card" style={{ background: s?.cor || '#CBD5E1' }} />; };
  const Plano = ({ c }) => <span className="inline-flex items-center gap-1.5">{planoMap.get(c.plano_id)?.nome || <span className="text-slate-400">—</span>}<span className="inline-flex items-center gap-0.5 text-xs text-slate-500" title={`${c.telas} tela(s)`}><Monitor className="h-3 w-3" />{c.telas}</span></span>;

  return (
    <>
      <Titulo titulo="Clientes" sub={uso?.limite != null ? `${int(uso.usados)} de ${int(uso.limite)} clientes ativos no plano ${uso.plano_nome}` : `${int(uso?.usados || 0)} clientes ativos · plano ${uso?.plano_nome || ''}`}>
        <Btn onClick={() => setVerArea(true)}><Globe className="h-4 w-4" />Área do cliente</Btn>
        <Btn onClick={exportar} disabled={!filtrados.length}><FileSpreadsheet className="h-4 w-4" />Exportar</Btn>
        <Btn onClick={() => setImportar(true)} disabled={bloqueado}><Upload className="h-4 w-4" />Importar</Btn>
        <Btn variante="primario" onClick={novo} disabled={noLimite || bloqueado}><UserPlus className="h-4 w-4" />Adicionar novo</Btn>
      </Titulo>

      {noLimite && !bloqueado && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <Crown className="h-4 w-4" /><span className="flex-1">Você atingiu o limite de {uso.limite} clientes do plano {uso.plano_nome}. Desative clientes inativos ou faça upgrade.</span>
          <Link href="/painel/conta" className="font-semibold underline">Ver planos</Link>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="flex flex-wrap gap-2 border-b border-line p-3 dark:border-night-line" role="tablist">
          {ABAS.map(([k, r]) => (
            <button key={k} role="tab" aria-selected={aba === k} onClick={() => setAba(k)}
              className={`inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition ${aba === k
                ? 'border-brand-cyan bg-brand-cyan/15 text-brand-navy dark:text-white'
                : 'border-line text-slate-600 hover:border-brand-cyan/60 hover:text-brand-navy dark:border-night-line dark:text-slate-300 dark:hover:text-white'}`}>
              {r}<span className={`min-w-[22px] rounded-full px-1.5 text-center text-[11px] tabular-nums ${(k === 'inadimplentes' || k === 'alerta') && cont[k] ? 'bg-rose-500/15 text-rose-600 dark:text-rose-300' : k === 'hoje' && cont[k] ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300' : aba === k ? 'bg-brand-cyan/25' : 'bg-slate-500/15'}`}>{cont[k]}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3 p-3">
          <label className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar nome, usuário, WhatsApp, MAC, plano ou notas" className="campo pl-9" />
          </label>
          <Selecao value={ordem} onChange={(e) => setOrdem(e.target.value)} opcoes={ORDENS} className="w-56" />
          <label className="flex items-center gap-2 text-sm text-slate-500">Mostrar
            <select value={porPag} onChange={(e) => setPorPag(+e.target.value)} className="campo w-20">{[10, 25, 50, 100].map((n) => <option key={n}>{n}</option>)}</select>
          </label>
        </div>
        {servidores.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-3 pb-3">
            <span className="mr-1 text-xs font-semibold text-slate-500">Servidores:</span>
            {servidores.map((s) => (
              <button key={s.id} onClick={() => setServFiltro(servFiltro === s.id ? '' : s.id)} style={{ background: s.cor }}
                className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-bold text-white shadow-sm transition [text-shadow:0_1px_1px_rgba(0,0,0,.35)] ${servFiltro && servFiltro !== s.id ? 'opacity-35' : ''} ${servFiltro === s.id ? 'ring-2 ring-offset-2 ring-brand-cyan dark:ring-offset-night-card' : ''}`}>
                {s.nome}<span className="rounded bg-black/20 px-1 text-[10px]">{contServ[s.id] || 0}</span>
              </button>
            ))}
            {contServ._ > 0 && <button onClick={() => setServFiltro(servFiltro === '_' ? '' : '_')} className={`inline-flex h-7 items-center gap-1.5 rounded-md border border-line px-2.5 text-xs font-semibold text-slate-500 dark:border-night-line ${servFiltro === '_' ? 'ring-2 ring-brand-cyan' : ''}`}>Sem servidor<span className="text-[10px]">{contServ._}</span></button>}
          </div>
        )}

        {!filtrados.length ? (
          <Vazio msg={lista.length ? 'Nenhum cliente encontrado com esses filtros.' : 'Nenhum cliente cadastrado ainda.'}>
            {!lista.length && <Btn variante="primario" onClick={novo} disabled={bloqueado}><UserPlus className="h-4 w-4" />Cadastrar o primeiro</Btn>}
          </Vazio>
        ) : (
          <>
            <ul className="divide-y divide-line border-t border-line md:hidden dark:divide-night-line dark:border-night-line">
              {pagina.map((c) => (
                <li key={c.id} className={`px-4 py-3 ${c.status === 'desativado' ? 'opacity-60' : ''}`}>
                  <div className="flex items-start gap-2.5">
                    <div className="pt-1"><Toggle c={c} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 font-semibold"><Ponto c={c} /><span className="truncate">{c.nome}</span>{c.alerta && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-500" />}</div>
                      <div className="truncate text-xs text-slate-500">{c.usuario ? `${c.usuario} · ` : ''}{fmtTelefone(c.whatsapp)}</div>
                      <div className="mt-1 text-xs"><Plano c={c} /> · {brl(c.valor)}</div>
                    </div>
                    <SeloVencimento c={c} hoje={hoje} />
                  </div>
                  <div className="mt-2 flex items-center justify-end gap-2">
                    <Btn className="h-9" onClick={() => setOpcoes(c)}>Opções</Btn><BotoesMsg c={c} />
                  </div>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[960px] text-sm">
                <thead>
                  <tr className="bg-brand-navy text-left text-xs font-semibold text-white dark:bg-[#0F2A4D]">
                    <th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Vencimento</th><th className="px-4 py-3">WhatsApp</th><th className="px-4 py-3">Plano</th>
                    <th className="px-4 py-3 text-right">Valor</th><th className="px-4 py-3 text-center">Opções</th><th className="px-4 py-3">Mensagem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line dark:divide-night-line">
                  {pagina.map((c) => (
                    <tr key={c.id} className={`transition odd:bg-slate-50/60 hover:bg-brand-cyan/5 dark:odd:bg-night-soft/30 ${c.status === 'desativado' ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Toggle c={c} /><Ponto c={c} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 font-semibold"><span className="max-w-[240px] truncate">{c.nome}</span>{!c.notificar && <BellOff className="h-3.5 w-3.5 text-slate-400" aria-label="Sem notificação" />}{c.alerta && <AlertTriangle className="h-3.5 w-3.5 text-rose-500" aria-label="Com alerta" title={c.alerta} />}</div>
                            <div className="max-w-[260px] truncate text-xs text-slate-500 dark:text-slate-400">{[c.usuario, servMap.get(c.servidor_id)?.nome].filter(Boolean).join(' · ') || c.cidade || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5"><SeloVencimento c={c} hoje={hoje} /></td>
                      <td className="whitespace-nowrap px-4 py-2.5 tabular-nums"><a href={`https://wa.me/${c.whatsapp}`} target="_blank" rel="noreferrer" className="text-[#007F98] hover:underline dark:text-brand-cyan">{fmtTelefone(c.whatsapp)}</a></td>
                      <td className="px-4 py-2.5"><Plano c={c} /></td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums">{brl(c.valor)}</td>
                      <td className="px-4 py-2.5 text-center"><button onClick={() => setOpcoes(c)} className="h-9 rounded-lg bg-brand-navy px-3.5 text-sm font-semibold text-white hover:bg-[#12305a] dark:bg-white/10 dark:hover:bg-white/20">Opções</button></td>
                      <td className="px-4 py-2.5"><BotoesMsg c={c} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {filtrados.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm dark:border-night-line">
            <span className="text-slate-500">Mostrando {pag * porPag + 1} até {Math.min(filtrados.length, (pag + 1) * porPag)} de {int(filtrados.length)} clientes</span>
            <div className="flex gap-2">
              <Btn onClick={() => setPag((p) => Math.max(0, p - 1))} disabled={!pag} aria-label="Página anterior"><ChevronLeft className="h-4 w-4" /></Btn>
              <Btn onClick={() => setPag((p) => Math.min(totPag - 1, p + 1))} disabled={pag >= totPag - 1} aria-label="Próxima página"><ChevronRight className="h-4 w-4" /></Btn>
            </div>
          </div>
        )}
      </div>

      {/* cadastro / edição */}
      <Modal aberto={!!form} onFechar={() => setForm(null)} titulo={form?.id ? 'Editar cliente' : 'Adicionar cliente'} largura="max-w-3xl"
        rodape={<><Btn onClick={() => setForm(null)}>Fechar</Btn><Btn variante="primario" type="submit" form="form-cliente" carregando={salvando}>{form?.id ? 'Salvar' : 'Adicionar'}</Btn></>}>
        {form && (
          <form id="form-cliente" onSubmit={salvar} className="grid gap-3.5 sm:grid-cols-2">
            <Campo rotulo="Nome *" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required autoFocus placeholder="Nome do cliente" />
            <Campo rotulo="Usuário (login)" value={form.usuario} onChange={(e) => setForm({ ...form, usuario: e.target.value })} placeholder="Ex.: thiago1490" />
            <Campo rotulo="WhatsApp com DDD *" type="tel" inputMode="tel" placeholder="(85) 99999-9999" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} required ajuda="De outro país: comece com + e o código do país." />
            <Campo rotulo="Senha da área do cliente">
              <div className="flex gap-2">
                <input value={form.senha_area} onChange={(e) => setForm({ ...form, senha_area: e.target.value })} className="campo" placeholder="Sem senha = sem acesso" />
                <button type="button" title="Gerar senha" aria-label="Gerar senha" onClick={() => setForm({ ...form, senha_area: senhaAleatoria() })} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-line text-slate-500 hover:border-brand-cyan dark:border-night-line"><Dices className="h-4 w-4" /></button>
              </div>
            </Campo>
            <Campo rotulo="Data de vencimento *" type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} required />
            <Selecao rotulo="Servidor" value={form.servidor_id} onChange={(e) => setForm({ ...form, servidor_id: e.target.value })} todos={servidores.length ? 'Sem servidor' : 'Nenhum servidor cadastrado'} opcoes={servidores.map((s) => [s.id, s.nome])} />
            <Selecao rotulo="Plano" value={form.plano_id} todos="Selecionar plano" opcoes={planos.map((p) => [p.id, `${p.nome} — ${brl(p.valor)}${p.ciclo_meses > 1 ? ` / ${p.ciclo_meses} meses` : '/mês'}`])}
              onChange={(e) => { const p = planoMap.get(e.target.value); setForm({ ...form, plano_id: e.target.value, valor: p ? String(p.valor).replace('.', ',') : form.valor }); }} />
            <Campo rotulo="Valor da mensalidade (R$) *" inputMode="decimal" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} required placeholder="0,00" />
            <Selecao rotulo="Número de telas" value={form.telas} onChange={(e) => setForm({ ...form, telas: e.target.value })} opcoes={[1, 2, 3, 4, 5, 6, 8, 10].map((n) => [n, `${n} ${n === 1 ? 'tela' : 'telas'}`])} />
            <Selecao rotulo="Notificação WhatsApp *" value={form.notificar ? 's' : 'n'} onChange={(e) => setForm({ ...form, notificar: e.target.value === 's' })} opcoes={[['s', 'Notificar via WhatsApp'], ['n', 'Não notificar via WhatsApp']]} />
            <Campo rotulo="MAC / ID externo" value={form.mac} onChange={(e) => setForm({ ...form, mac: e.target.value })} placeholder="Opcional" />
            <Campo rotulo="E-mail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Opcional" />
            <Campo rotulo="Cidade" value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} placeholder="Opcional" />
            <Campo rotulo="Notas" className="sm:col-span-2"><textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} rows={3} className="campo h-auto py-2" /></Campo>
            {(!planos.length || !servidores.length) && <p className="text-xs text-slate-500 sm:col-span-2">Dica: cadastre {!planos.length && <Link href="/painel/planos" className="font-semibold text-[#007F98] dark:text-brand-cyan">planos</Link>}{!planos.length && !servidores.length && ' e '}{!servidores.length && <Link href="/painel/servidores" className="font-semibold text-[#007F98] dark:text-brand-cyan">servidores</Link>} para escolher aqui.</p>}
          </form>
        )}
      </Modal>

      {/* pré-visualização de envio */}
      <Modal aberto={!!envio} onFechar={() => setEnvio(null)} titulo={envio?.titulo} sub={envio && `${envio.c.nome} · ${fmtTelefone(envio.c.whatsapp)}`}
        rodape={<><Btn onClick={() => setEnvio(null)}>Cancelar</Btn><Btn variante="primario" carregando={salvando} onClick={async () => { setSalvando(true); const ok = await enviar(envio.c, envio.texto, envio.gatilho); setSalvando(false); if (ok) setEnvio(null); }}><Send className="h-4 w-4" />Enviar agora</Btn></>}>
        {envio && <><textarea value={envio.texto} onChange={(e) => setEnvio({ ...envio, texto: e.target.value })} rows={10} className="campo h-auto py-2" /><p className="mt-2 text-xs text-slate-500">Sai pelo WhatsApp conectado em <Link href="/painel/whatsapp" className="font-semibold">WhatsApp</Link>. Dá para editar antes de enviar.</p></>}
      </Modal>

      {/* área do cliente */}
      <Modal aberto={verArea} onFechar={() => setVerArea(false)} titulo="Área do cliente" sub="Página onde cada cliente vê o vencimento, as faturas e o Pix para pagar.">
        <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 dark:bg-night-soft">
          <div className="min-w-0 flex-1"><div className="text-xs text-slate-500">Link da sua área do cliente</div><div className="truncate font-semibold">{link}</div></div>
          <Btn onClick={() => copiar(link)}><Copy className="h-4 w-4" />Copiar</Btn>
        </div>
        <ul className="mt-4 space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
          <li>• O cliente entra com o <b>usuário</b> (ou o WhatsApp) e a <b>senha da área do cliente</b> do cadastro.</li>
          <li>• Clientes sem senha cadastrada não conseguem entrar.</li>
          <li>• Use a variável <code className="rounded bg-slate-100 px-1 dark:bg-night-soft">{'{link_area}'}</code> nas mensagens para mandar o link, e <code className="rounded bg-slate-100 px-1 dark:bg-night-soft">{'{usuario}'}</code>/<code className="rounded bg-slate-100 px-1 dark:bg-night-soft">{'{senha}'}</code> para mandar o acesso.</li>
          <li>• {int(lista.filter((c) => c.senha_area && c.status !== 'desativado').length)} de {int(lista.filter((c) => c.status !== 'desativado').length)} clientes ativos têm senha.</li>
        </ul>
        <a href={link} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#007F98] dark:text-brand-cyan"><KeyRound className="h-4 w-4" />Abrir a área do cliente</a>
      </Modal>

      {opcoes && (
        <OpcoesCliente c={opcoes} hoje={hoje} perfil={perfil} sb={sb} plano={planoMap.get(opcoes.plano_id)} servidor={servMap.get(opcoes.servidor_id)} modelos={modelos} bloqueado={bloqueado}
          onFechar={() => setOpcoes(null)} onEditar={() => { editar(opcoes); setOpcoes(null); }} onCobranca={() => cobranca(opcoes)} onMudou={() => { carregar(); recarregar(); }}
          enviar={enviar} texto={texto} />
      )}
      {importar && <ImportarClientes onFechar={() => setImportar(false)} planos={planos} servidores={servidores} existentes={lista} sb={sb} aoConcluir={() => { carregar(); recarregar(); }} hoje={hoje} />}
    </>
  );
}
