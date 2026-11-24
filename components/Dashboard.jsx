'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  Users, UserX, UserCheck, CalendarClock, Wallet, TrendingUp, TrendingDown, Receipt, Landmark, FileText,
  Search, ChevronLeft, ChevronRight, BarChart3, PieChart as PieIcon, Table2, Activity, RotateCcw, FileSpreadsheet,
  ArrowUp, ArrowDown, ArrowDownLeft, ArrowUpRight, Info, ChevronDown, SlidersHorizontal, CreditCard, Layers, Printer,
} from 'lucide-react';
import Logo from '@/components/Logo';
import { useToast } from '@/components/ui';
import {
  addDays, addMonths, monthStart, monthEnd, daysBetween, fmtData, fmtDiaMes, fmtMesAno, brl, brlC, int, pct, variacao, norm,
  MESES, MESES_LONGOS, DIAS_SEM, toD,
} from '@/lib/format';

// ------------------------------------------------------------------ tema
const TEMAS = {
  light: {
    ganho: '#00B8D9', gasto: '#E5484D', saldo: '#0A1F3A', grid: '#E6EDF2', muted: '#64748B', cursor: 'rgba(10,31,58,0.05)',
    ativo: '#16A34A', inad: '#E5484D', canc: '#94A3B8', exp: '#F59E0B',
    cats: ['#00B8D9', '#0A1F3A', '#5B8DEF', '#F59E0B', '#E5484D', '#14B8A6', '#94A3B8', '#7DD3FC'],
  },
  dark: {
    ganho: '#22CCEB', gasto: '#FF6B6F', saldo: '#E6EEF5', grid: '#1A3150', muted: '#8FA3BA', cursor: 'rgba(255,255,255,0.05)',
    ativo: '#34D399', inad: '#FF6B6F', canc: '#94A3B8', exp: '#FBBF24',
    cats: ['#22CCEB', '#5B8DEF', '#93C5FD', '#FBBF24', '#FF6B6F', '#2DD4BF', '#94A3B8', '#C7D2FE'],
  },
};

const PRESETS = [
  ['mes', 'Este mês'], ['mesAnterior', 'Mês anterior'], ['30', 'Últimos 30 dias'], ['90', 'Últimos 90 dias'],
  ['ano', 'Este ano'], ['tudo', 'Todo o histórico'], ['custom', 'Personalizado'],
];
const FILTROS_PADRAO = { preset: 'mes', ini: '', fim: '', plano: '', statusCliente: '', cidade: '', tipo: '', categoria: '', forma: '', status: 'Confirmado' };
const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
const soma = (arr) => arr.reduce((a, m) => a + m.valor, 0);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function resolvePeriodo(f, ref, minData) {
  const y = +ref.slice(0, 4);
  switch (f.preset) {
    case 'mesAnterior': {
      const ini = monthStart(addMonths(ref, -1)); const pIni = monthStart(addMonths(ini, -1));
      return { ini, fim: monthEnd(ini), pIni, pFim: monthEnd(pIni), cmp: `vs. ${MESES_LONGOS[+pIni.slice(5, 7) - 1]}`, nome: fmtMesAno(ini) };
    }
    case '30': case '90': {
      const n = +f.preset; const ini = addDays(ref, -(n - 1)); const pFim = addDays(ini, -1);
      return { ini, fim: ref, pIni: addDays(pFim, -(n - 1)), pFim, cmp: `vs. ${n} dias anteriores`, nome: `últimos ${n} dias` };
    }
    case 'ano': return { ini: `${y}-01-01`, fim: ref, pIni: `${y - 1}-01-01`, pFim: `${y - 1}${ref.slice(4)}`, cmp: `vs. mesmo período de ${y - 1}`, nome: `${y} até ${fmtDiaMes(ref)}` };
    case 'tudo': return { ini: minData, fim: ref, pIni: null, pFim: null, cmp: null, nome: 'todo o histórico' };
    case 'custom': {
      let ini = f.ini || monthStart(ref), fim = f.fim || ref; if (ini > fim) [ini, fim] = [fim, ini];
      const n = daysBetween(ini, fim) + 1; const pFim = addDays(ini, -1);
      return { ini, fim, pIni: addDays(pFim, -(n - 1)), pFim, cmp: 'vs. período anterior', nome: `${fmtData(ini)} a ${fmtData(fim)}` };
    }
    default: {
      const pIni = monthStart(addMonths(ref, -1)); const pFim = addMonths(ref, -1);
      return { ini: monthStart(ref), fim: ref, pIni, pFim, cmp: `vs. ${fmtDiaMes(pIni)}–${fmtDiaMes(pFim)}`, nome: fmtMesAno(ref) };
    }
  }
}


function Delta({ v, inverso, cmp }) {
  if (v === undefined) return null;
  if (v === null) return <span className="text-xs font-medium text-slate-500 dark:text-slate-400">sem base anterior</span>;
  const bom = inverso ? v <= 0 : v >= 0;
  const Icone = v >= 0 ? ArrowUp : ArrowDown;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-xs" title={cmp || ''}>
      <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold tabular-nums ${Math.abs(v) < 0.05 ? 'bg-slate-500/10 text-slate-600 dark:text-slate-300' : bom ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-700 dark:text-rose-400'}`}>
        <Icone className="h-3 w-3" strokeWidth={2.5} />{pct(Math.abs(v)).replace('+', '')}
      </span>
      {cmp && <span className="text-slate-500 dark:text-slate-400">{cmp}</span>}
    </span>
  );
}

const CARD = 'rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(10,31,58,0.04)] transition-colors duration-300 dark:border-night-line dark:bg-night-card';

function ClienteCard({ valor, rotulo, Icone, faixa, delta, cmp, inverso, sub, onClick }) {
  return (
    <button onClick={onClick} className={`${CARD} group flex flex-col overflow-hidden text-left hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan transition-all`}>
      <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
        <div className="min-w-0">
          <div className="font-display text-3xl font-bold tabular-nums text-brand-navy dark:text-white">{valor}</div>
          <div className="mt-1.5 min-h-[20px]"><Delta v={delta} cmp={cmp} inverso={inverso} /></div>
        </div>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500 dark:bg-night-soft dark:text-slate-300"><Icone className="h-5 w-5" /></span>
      </div>
      <div className="px-4 pb-3 text-xs text-slate-500 dark:text-slate-400">{sub}</div>
      <div className={`mt-auto flex items-center justify-between px-4 py-2.5 text-sm font-semibold text-white ${faixa}`}>
        {rotulo}<ArrowUpRight className="h-4 w-4 opacity-80 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </div>
    </button>
  );
}

function FinCard({ rotulo, valor, Icone, delta, cmp, inverso, sub, destaque }) {
  if (destaque) {
    return (
      <div className="relative col-span-2 overflow-hidden rounded-2xl bg-brand-navy p-5 text-white shadow-lg dark:bg-[#0F2A4D]">
        <svg className="pointer-events-none absolute -right-6 -top-10 h-48 w-48 opacity-[0.12]" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="none" stroke="#00B8D9" strokeWidth="10" /><circle cx="50" cy="50" r="22" fill="#00B8D9" /></svg>
        <div className="relative flex items-center gap-2 text-sm font-medium text-cyan-200"><Icone className="h-4 w-4" />{rotulo}</div>
        <div className={`relative mt-2 font-display text-[clamp(28px,3.4vw,40px)] font-bold leading-none tabular-nums ${valor < 0 ? 'text-rose-300' : ''}`}>{brl(valor)}</div>
        <div className="relative mt-3 flex flex-wrap items-center gap-2 text-xs">
          {delta !== undefined && (delta === null ? <span className="text-cyan-100/80">sem base anterior</span> : (
            <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-semibold ${(inverso ? delta <= 0 : delta >= 0) ? 'bg-emerald-400/20 text-emerald-200' : 'bg-rose-400/20 text-rose-200'}`}>
              {delta >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}{pct(Math.abs(delta)).replace('+', '')}
            </span>))}
          {cmp && <span className="text-cyan-100/80">{cmp}</span>}
        </div>
        <div className="relative mt-4 border-t border-white/10 pt-3 text-sm text-cyan-50/90">{sub}</div>
      </div>
    );
  }
  return (
    <div className={`${CARD} flex flex-col p-4`}>
      <div className="flex items-center justify-between gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
        <span>{rotulo}</span><span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-cyan/10 text-brand-cyan"><Icone className="h-4 w-4" /></span>
      </div>
      <div className="mt-2 font-display text-[clamp(20px,2vw,26px)] font-bold tabular-nums text-brand-navy dark:text-white">{brl(valor)}</div>
      <div className="mt-2"><Delta v={delta} cmp={cmp} inverso={inverso} /></div>
      {sub && <div className="mt-auto pt-3 text-xs text-slate-500 dark:text-slate-400">{sub}</div>}
    </div>
  );
}

function Painel({ titulo, sub, Icone, acao, children, className = '' }) {
  return (
    <section className={`${CARD} flex flex-col p-4 sm:p-5 ${className}`} data-pdf-block>
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 font-display text-[15px] font-semibold text-brand-navy dark:text-white">{Icone && <Icone className="h-4 w-4 text-brand-cyan" />}{titulo}</h3>
          {sub && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sub}</p>}
        </div>
        {acao}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

const Vazio = ({ msg = 'Sem dados para os filtros selecionados.' }) => (
  <div className="grid h-full min-h-[180px] place-items-center text-center text-sm text-slate-400"><div><Info className="mx-auto mb-2 h-5 w-5" />{msg}</div></div>
);

function Dica({ active, payload, label, linhas, titulo }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="min-w-[200px] rounded-xl border border-line bg-white/95 px-3 py-2.5 text-[13px] shadow-xl backdrop-blur dark:border-night-line dark:bg-night-card/95">
      <div className="mb-1.5 font-semibold text-brand-navy dark:text-white">{titulo ? titulo(d, label) : label}</div>
      {linhas(d).map(([k, v, c]) => (
        <div key={k} className="flex items-center justify-between gap-6 py-0.5">
          <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">{c && <i className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />}{k}</span>
          <b className="tabular-nums text-brand-navy dark:text-white">{v}</b>
        </div>
      ))}
    </div>
  );
}

function Sel({ rotulo, value, onChange, opcoes, todos = 'Todos' }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
      {rotulo}
      <span className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)}
          className={`h-10 w-full appearance-none truncate rounded-lg border bg-white pl-3 pr-8 text-sm font-medium text-brand-navy outline-none transition focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30 dark:bg-night-soft dark:text-white ${value ? 'border-brand-cyan' : 'border-line dark:border-night-line'}`}>
          {todos !== null && <option value="">{todos}</option>}
          {opcoes.map((o) => (Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o} value={o}>{o}</option>))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </span>
    </label>
  );
}

const Btn = ({ children, primario, ...p }) => (
  <button {...p} className={`inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg px-3.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan disabled:opacity-50 ${primario ? 'bg-brand-cyan text-brand-navy hover:bg-[#19C6E5]' : 'border border-line bg-white text-brand-navy hover:border-brand-cyan dark:border-night-line dark:bg-night-soft dark:text-white'} ${p.className || ''}`}>{children}</button>
);

const STATUS_COR = { Confirmado: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400', Pendente: 'bg-amber-500/15 text-amber-700 dark:text-amber-300', Recusado: 'bg-rose-500/10 text-rose-700 dark:text-rose-400' };

// ------------------------------------------------------------------ CSV
const celula = (v) => { if (typeof v === 'number') return v.toFixed(2).replace('.', ','); const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const gerarCSV = (cols, rows) => '﻿' + [cols.map((c) => c[0]).join(';'), ...rows.map((r) => cols.map((c) => celula(c[1](r))).join(';'))].join('\r\n');

// ================================================================== APP
// colunas da tabela de lançamentos que somem em telas menores (data, cliente e valor ficam sempre)
const VIS_COL = { tipo: 'hidden sm:table-cell', categoria: 'hidden md:table-cell', descricao: 'hidden lg:table-cell', plano: 'hidden xl:table-cell', forma: 'hidden xl:table-cell', status: 'hidden sm:table-cell' };

export default function Dashboard({ dados, empresa }) {
  const [f, setF] = useState(FILTROS_PADRAO);
  const [escuroUI, setEscuroUI] = useState(false);
  const [imprimindo, setImprimindo] = useState(false);
  const toast = useToast();
  const [menuCsv, setMenuCsv] = useState(false);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState({ col: 'data', dir: -1 });
  const [pagina, setPagina] = useState(0);
  const [visaoCat, setVisaoCat] = useState('Gasto');
  const relRef = useRef(null);

  // acompanha o botão de tema do cabeçalho
  useEffect(() => {
    const el = document.documentElement;
    const ler = () => setEscuroUI(el.classList.contains('dark'));
    ler();
    const mo = new MutationObserver(ler); mo.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, []);
  const escuro = escuroUI && !imprimindo;
  const C = TEMAS[escuro ? 'dark' : 'light'];
  const anim = !imprimindo;
  useEffect(() => setPagina(0), [f, busca, dados]);

  const set = (k) => (v) => setF((o) => ({ ...o, [k]: v }));
  const { clientes, movs, ref } = dados;


  // ---------------- opções dos filtros
  const op = useMemo(() => ({
    planos: uniq([...clientes.map((c) => c.plano), ...movs.map((m) => m.plano)]),
    cidades: uniq(clientes.map((c) => c.cidade)),
    categorias: uniq(movs.filter((m) => !f.tipo || m.tipo === f.tipo).map((m) => m.categoria)),
    formas: uniq(movs.map((m) => m.forma)),
  }), [clientes, movs, f.tipo]);

  const minData = useMemo(() => movs.reduce((a, m) => (m.data < a ? m.data : a), ref), [movs, ref]);
  const P = useMemo(() => resolvePeriodo(f, ref, minData), [f, ref, minData]);
  const cliMap = useMemo(() => new Map(clientes.map((c) => [c.id, c])), [clientes]);
  const filtroCliente = !!(f.plano || f.statusCliente || f.cidade);

  const passa = useMemo(() => (m) => {
    if (f.tipo && m.tipo !== f.tipo) return false;
    if (f.categoria && m.categoria !== f.categoria) return false;
    if (f.forma && m.forma !== f.forma) return false;
    if (f.status && m.status !== f.status) return false;
    if (filtroCliente && m.tipo === 'Ganho') {
      const c = cliMap.get(m.clienteId);
      if (f.plano && (m.plano || c?.plano) !== f.plano) return false;
      if (f.statusCliente && c?.status !== f.statusCliente) return false;
      if (f.cidade && c?.cidade !== f.cidade) return false;
    }
    return true;
  }, [f, cliMap, filtroCliente]);

  const base = useMemo(() => movs.filter(passa), [movs, passa]);
  const entre = (a, b) => base.filter((m) => m.data >= a && m.data <= b);
  const atual = useMemo(() => entre(P.ini, P.fim), [base, P]);
  const anterior = useMemo(() => (P.pIni ? entre(P.pIni, P.pFim) : null), [base, P]);

  // ---------------- KPIs financeiros
  const fin = useMemo(() => {
    const calc = (arr) => {
      const g = arr.filter((m) => m.tipo === 'Ganho'); const s = arr.filter((m) => m.tipo === 'Gasto');
      const ganhos = soma(g), gastos = soma(s);
      return { ganhos, gastos, saldo: ganhos - gastos, ticket: g.length ? ganhos / g.length : 0, qtd: g.length };
    };
    const a = calc(atual); const b = anterior ? calc(anterior) : null;
    const mAnt = monthStart(addMonths(P.fim, -1)); const mAnt2 = monthStart(addMonths(P.fim, -2));
    const fech = calc(entre(mAnt, monthEnd(mAnt))); const fech2 = calc(entre(mAnt2, monthEnd(mAnt2)));
    const v = (k) => (b ? variacao(a[k], b[k]) : undefined);
    return { a, b, v, fech, fech2, mAnt, mAnt2 };
  }, [atual, anterior, P, base]);

  // ---------------- KPIs de clientes
  const cli = useMemo(() => {
    const cl = clientes.filter((c) => (!f.plano || c.plano === f.plano) && (!f.statusCliente || c.status === f.statusCliente) && (!f.cidade || c.cidade === f.cidade));
    const b = cl.filter((c) => c.cadastro <= P.fim);
    const pb = P.pFim ? cl.filter((c) => c.cadastro <= P.pFim) : null;
    const cont = (arr, s) => arr.filter((c) => c.status === s).length;
    const carteira = (arr) => cont(arr, 'Ativo') + cont(arr, 'Inadimplente');
    const expHoje = cl.filter((c) => c.status !== 'Desativado' && c.vencimento === ref);
    const exp7 = cl.filter((c) => c.status !== 'Desativado' && c.vencimento > ref && c.vencimento <= addDays(ref, 7));
    return {
      lista: cl, total: b.length, ativos: cont(b, 'Ativo'), inad: cont(b, 'Inadimplente'), canc: cont(b, 'Desativado'),
      novos: b.filter((c) => c.cadastro >= P.ini).length, carteira: carteira(b),
      vTotal: pb ? variacao(b.length, pb.length) : undefined,
      vAtivos: pb ? variacao(cont(b, 'Ativo'), cont(pb, 'Ativo')) : undefined,
      vInad: pb ? variacao(cont(b, 'Inadimplente'), cont(pb, 'Inadimplente')) : undefined,
      expHoje: expHoje.length, exp7: exp7.length,
    };
  }, [clientes, f.plano, f.statusCliente, f.cidade, P, ref]);

  // ---------------- séries
  const serie = useMemo(() => {
    const n = daysBetween(P.ini, P.fim) + 1;
    const gran = n <= 45 ? 'dia' : n <= 190 ? 'semana' : 'mes';
    const bk = [];
    if (gran === 'dia') for (let d = P.ini; d <= P.fim; d = addDays(d, 1)) bk.push({ k: d, rot: fmtDiaMes(d), ini: d, fim: d });
    else if (gran === 'semana') for (let d = P.ini; d <= P.fim; d = addDays(d, 7)) { const e = addDays(d, 6) < P.fim ? addDays(d, 6) : P.fim; bk.push({ k: d, rot: fmtDiaMes(d), ini: d, fim: e }); }
    else for (let d = monthStart(P.ini); d <= P.fim; d = addMonths(d, 1)) bk.push({ k: d.slice(0, 7), rot: `${MESES[+d.slice(5, 7) - 1]}/${d.slice(2, 4)}`, ini: d < P.ini ? P.ini : d, fim: monthEnd(d) < P.fim ? monthEnd(d) : P.fim });
    const idx = new Map(bk.map((b, i) => [b.k, i]));
    const out = bk.map((b) => ({ ...b, ganhos: 0, gastos: 0, qtd: 0 }));
    for (const m of atual) {
      const i = gran === 'dia' ? idx.get(m.data) : gran === 'semana' ? Math.floor(daysBetween(P.ini, m.data) / 7) : idx.get(m.data.slice(0, 7));
      if (out[i] == null) continue;
      if (m.tipo === 'Ganho') { out[i].ganhos += m.valor; out[i].qtd++; } else out[i].gastos += m.valor;
    }
    let ac = 0;
    out.forEach((o) => { ac += o.ganhos - o.gastos; o.saldo = ac; });
    return { pontos: out, gran };
  }, [atual, P]);

  const anual = useMemo(() => {
    const y = P.fim.slice(0, 4);
    const out = MESES.map((m, i) => ({ rot: m, mes: i, ganhos: 0, gastos: 0, futuro: `${y}-${String(i + 1).padStart(2, '0')}` > ref.slice(0, 7) }));
    for (const m of base) if (m.data.slice(0, 4) === y) out[+m.data.slice(5, 7) - 1][m.tipo === 'Ganho' ? 'ganhos' : 'gastos'] += m.valor;
    out.forEach((o) => { o.saldo = o.ganhos - o.gastos; o.margem = o.ganhos ? (o.saldo / o.ganhos) * 100 : null; if (o.futuro) { o.ganhos = null; o.gastos = null; } });
    return { y, pontos: out };
  }, [base, P.fim, ref]);

  const oitoDias = useMemo(() => {
    const out = [];
    for (let i = 7; i >= 0; i--) { const d = addDays(ref, -i); out.push({ d, rot: `${DIAS_SEM[toD(d).getUTCDay()]} ${d.slice(8, 10)}`, ganhos: 0, gastos: 0 }); }
    const ix = new Map(out.map((o, i) => [o.d, i]));
    for (const m of base) { const i = ix.get(m.data); if (i != null) out[i][m.tipo === 'Ganho' ? 'ganhos' : 'gastos'] += m.valor; }
    return out;
  }, [base, ref]);

  const porCategoria = useMemo(() => {
    const arr = atual.filter((m) => m.tipo === visaoCat);
    const tot = soma(arr); const mp = new Map();
    arr.forEach((m) => mp.set(m.categoria, (mp.get(m.categoria) || 0) + m.valor));
    let l = [...mp].map(([name, value]) => ({ name, value, pct: tot ? (value / tot) * 100 : 0 })).sort((a, b) => b.value - a.value);
    if (l.length > 7) { const resto = l.slice(6); l = [...l.slice(0, 6), { name: 'Demais', value: resto.reduce((a, b) => a + b.value, 0), pct: resto.reduce((a, b) => a + b.pct, 0), outros: true }]; }
    return { l, tot };
  }, [atual, visaoCat]);

  const porPlano = useMemo(() => {
    const mp = new Map();
    cli.lista.filter((c) => c.cadastro <= P.fim).forEach((c) => {
      const o = mp.get(c.plano) || { plano: c.plano, Ativo: 0, Inadimplente: 0, Desativado: 0, receita: 0 };
      o[c.status]++; mp.set(c.plano, o);
    });
    atual.filter((m) => m.tipo === 'Ganho' && m.plano).forEach((m) => { const o = mp.get(m.plano); if (o) o.receita += m.valor; });
    return [...mp.values()].sort((a, b) => (b.Ativo + b.Inadimplente) - (a.Ativo + a.Inadimplente));
  }, [cli.lista, atual, P.fim]);

  const porForma = useMemo(() => {
    const g = atual.filter((m) => m.tipo === 'Ganho'); const tot = soma(g); const mp = new Map();
    g.forEach((m) => { const o = mp.get(m.forma) || { forma: m.forma, valor: 0, qtd: 0 }; o.valor += m.valor; o.qtd++; mp.set(m.forma, o); });
    return { l: [...mp.values()].sort((a, b) => b.valor - a.valor), tot };
  }, [atual]);

  // ---------------- tabela
  const tabela = useMemo(() => {
    const q = norm(busca);
    let l = q ? atual.filter((m) => norm(`${m.descricao} ${m.cliente} ${m.categoria} ${m.plano} ${m.forma}`).includes(q)) : atual;
    const { col, dir } = ordem;
    l = [...l].sort((a, b) => (a[col] < b[col] ? -dir : a[col] > b[col] ? dir : 0));
    return l;
  }, [atual, busca, ordem]);
  const POR_PAG = 12;
  const totPag = Math.max(1, Math.ceil(tabela.length / POR_PAG));
  const linhas = imprimindo ? tabela.slice(0, 25) : tabela.slice(pagina * POR_PAG, pagina * POR_PAG + POR_PAG);

  // ---------------- ações
  const salvar = (filename, data) => {
    const blob = new Blob([data], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast(`Download de ${filename} iniciado.`);
  };

  const exportarCSV = (qual) => {
    setMenuCsv(false);
    if (qual === 'movs') {
      const cols = [['Data', (m) => fmtData(m.data)], ['Tipo', (m) => m.tipo], ['Categoria', (m) => m.categoria], ['Descrição', (m) => m.descricao], ['Cliente', (m) => m.cliente], ['Plano', (m) => m.plano], ['Forma de pagamento', (m) => m.forma], ['Status', (m) => m.status], ['Valor (R$)', (m) => (m.tipo === 'Gasto' ? -m.valor : m.valor)]];
      salvar(`movimentacoes_${P.ini}_a_${P.fim}.csv`, gerarCSV(cols, tabela));
    } else {
      const lista = cli.lista.filter((c) => c.cadastro <= P.fim);
      const cols = [['Nome', (c) => c.nome], ['WhatsApp', (c) => c.whatsapp], ['Plano', (c) => c.plano], ['Status', (c) => c.status], ['Cidade', (c) => c.cidade], ['Cadastro', (c) => fmtData(c.cadastro)], ['Vencimento', (c) => fmtData(c.vencimento)], ['Valor (R$)', (c) => c.valor]];
      salvar(`clientes_${P.fim}.csv`, gerarCSV(cols, lista));
    }
  };

  // PDF / impressão: força o tema claro, sem animação, e abre a janela de impressão (Salvar como PDF)
  const imprimir = () => {
    setImprimindo(true);
    const fim = () => { setImprimindo(false); window.removeEventListener('afterprint', fim); };
    window.addEventListener('afterprint', fim);
    setTimeout(() => { window.print(); setTimeout(fim, 500); }, 350);
  };
  useEffect(() => {
    if (!imprimindo) return;
    const el = document.documentElement; const tinha = el.classList.contains('dark');
    el.classList.remove('dark');
    return () => { if (tinha) el.classList.add('dark'); };
  }, [imprimindo]);

  const filtrosAtivos = ['plano', 'statusCliente', 'cidade', 'tipo', 'categoria', 'forma'].filter((k) => f[k]).length + (f.status !== 'Confirmado' ? 1 : 0) + (f.preset !== 'mes' ? 1 : 0);
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const resumoFiltros = [
    `Período: ${P.nome}`, f.plano && `Plano: ${f.plano}`, f.statusCliente && `Status do cliente: ${f.statusCliente}`, f.cidade && `Cidade: ${f.cidade}`,
    f.tipo && `Tipo: ${f.tipo}`, f.categoria && `Categoria: ${f.categoria}`, f.forma && `Forma: ${f.forma}`, `Pagamentos: ${f.status || 'todos os status'}`,
  ].filter(Boolean);

  const eixo = { tick: { fill: C.muted, fontSize: 11 }, axisLine: false, tickLine: false };
  const semDadosCli = !clientes.length;

  return (
    <div>
      <section id="visao" className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[clamp(22px,2.6vw,30px)] font-bold leading-tight">{saudacao}! Aqui está o resumo de {P.nome}.</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Saldo de <b className={fin.a.saldo < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-brand-navy dark:text-white'}>{brl(fin.a.saldo)}</b> com margem de {fin.a.ganhos ? pct((fin.a.saldo / fin.a.ganhos) * 100).replace('+', '') : '—'} · {int(cli.inad)} clientes inadimplentes · {int(cli.expHoje)} vencem hoje.
          </p>
        </div>
        <div className="no-print flex flex-wrap items-center gap-2" data-pdf-ignore>
          <div className="relative">
            <Btn onClick={() => setMenuCsv((v) => !v)} aria-expanded={menuCsv}><FileSpreadsheet className="h-4 w-4" />Exportar CSV<ChevronDown className="h-3.5 w-3.5" /></Btn>
            {menuCsv && (
              <div className="absolute right-0 z-40 mt-1 w-64 overflow-hidden rounded-xl border border-line bg-white p-1 shadow-xl dark:border-night-line dark:bg-night-card">
                <button onClick={() => exportarCSV('movs')} className="flex w-full flex-col rounded-lg px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-night-soft"><span className="text-sm font-semibold">Movimentações filtradas</span><span className="text-xs text-slate-500">{int(tabela.length)} linhas · {P.nome}</span></button>
                <button onClick={() => exportarCSV('cli')} className="flex w-full flex-col rounded-lg px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-night-soft"><span className="text-sm font-semibold">Clientes filtrados</span><span className="text-xs text-slate-500">{int(cli.total)} clientes</span></button>
              </div>
            )}
          </div>
          <Btn onClick={imprimir}><Printer className="h-4 w-4" />Exportar PDF / Imprimir</Btn>
        </div>
      </section>

        {/* filtros */}
        <div className="no-print sticky top-16 z-10 -mx-3 border-y border-line bg-brand-bg/90 backdrop-blur transition-colors duration-300 sm:-mx-6 dark:border-night-line dark:bg-night-bg/85" data-pdf-ignore>
          <div className="mx-auto max-w-[90rem] px-3 py-3 sm:px-6 min-[1920px]:max-w-[105rem]">
            <button className="flex h-10 w-full items-center justify-between rounded-lg border border-line bg-white px-3 text-sm font-semibold md:hidden dark:border-night-line dark:bg-night-soft" onClick={() => setFiltrosAbertos((v) => !v)}>
              <span className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-brand-cyan" />Filtros{filtrosAtivos ? ` (${filtrosAtivos})` : ''}</span><ChevronDown className={`h-4 w-4 transition ${filtrosAbertos ? 'rotate-180' : ''}`} />
            </button>
            <div className={`${filtrosAbertos ? 'grid' : 'hidden'} mt-3 grid-cols-2 gap-2.5 md:mt-0 md:grid md:grid-cols-4 xl:grid-cols-[1.3fr_repeat(7,minmax(0,1fr))_auto]`}>
              <Sel rotulo="Período" value={f.preset} onChange={set('preset')} opcoes={PRESETS} todos={null} />
              <Sel rotulo="Plano" value={f.plano} onChange={set('plano')} opcoes={op.planos} />
              <Sel rotulo="Status do cliente" value={f.statusCliente} onChange={set('statusCliente')} opcoes={['Ativo', 'Inadimplente', 'Desativado']} />
              <Sel rotulo="Cidade" value={f.cidade} onChange={set('cidade')} opcoes={op.cidades} todos="Todas" />
              <Sel rotulo="Tipo" value={f.tipo} onChange={(v) => setF((o) => ({ ...o, tipo: v, categoria: '' }))} opcoes={[['Ganho', 'Ganhos'], ['Gasto', 'Gastos']]} />
              <Sel rotulo="Categoria" value={f.categoria} onChange={set('categoria')} opcoes={op.categorias} todos="Todas" />
              <Sel rotulo="Forma de pagamento" value={f.forma} onChange={set('forma')} opcoes={op.formas} todos="Todas" />
              <Sel rotulo="Status do pagamento" value={f.status} onChange={set('status')} opcoes={['Confirmado', 'Pendente', 'Recusado']} />
              <div className="flex items-end">
                <button onClick={() => { setF(FILTROS_PADRAO); setBusca(''); }} disabled={!filtrosAtivos} className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-slate-500 transition hover:text-brand-navy disabled:opacity-40 dark:hover:text-white"><RotateCcw className="h-4 w-4" />Limpar</button>
              </div>
              {f.preset === 'custom' && (
                <div className="col-span-2 flex flex-wrap gap-2.5 md:col-span-4 xl:col-span-9">
                  {[['ini', 'De'], ['fim', 'Até']].map(([k, r]) => (
                    <label key={k} className="flex flex-col gap-1 text-[11px] font-semibold text-slate-500">{r}
                      <input type="date" value={f[k] || (k === 'ini' ? P.ini : P.fim)} max={ref} onChange={(e) => set(k)(e.target.value)} className="h-10 rounded-lg border border-line bg-white px-3 text-sm text-brand-navy dark:border-night-line dark:bg-night-soft dark:text-white dark:[color-scheme:dark]" />
                    </label>
                  ))}
                </div>
              )}
            </div>
            {filtroCliente && <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"><Info className="h-3.5 w-3.5" />Filtros de cliente (plano, status, cidade) recortam as receitas; os gastos gerais da empresa continuam no cálculo do saldo.</p>}
          </div>
        </div>

        {/* relatório */}
        <div ref={relRef} className="space-y-5 pt-5">
          {imprimindo && (
            <div className="flex items-start justify-between gap-6 border-b border-line pb-4" data-pdf-block>
              <div className="flex items-center gap-3"><Logo className="h-9 w-11" /><div><div className="font-display text-xl font-bold">Relatório de gestão</div><div className="text-sm text-slate-500">{empresa} · {P.nome} · gerado em {fmtData(ref)}</div></div></div>
              <div className="max-w-[55%] text-right text-xs text-slate-500">{resumoFiltros.join(' · ')}</div>
            </div>
          )}

          {/* KPIs de clientes */}
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4" data-pdf-block>
            <ClienteCard valor={semDadosCli ? '—' : int(cli.total)} rotulo="Total de clientes" Icone={Users} faixa="bg-brand-navy dark:bg-[#1E4E8C]" delta={semDadosCli ? undefined : cli.vTotal} cmp={P.cmp}
              sub={semDadosCli ? 'Cadastre seus clientes' : `${int(cli.novos)} novos no período · ${int(cli.canc)} desativados`} onClick={() => setF((o) => ({ ...o, statusCliente: '' }))} />
            <ClienteCard valor={semDadosCli ? '—' : int(cli.inad)} rotulo="Inadimplentes" Icone={UserX} faixa="bg-gradient-to-r from-[#E5484D] to-[#F06A4A]" delta={semDadosCli ? undefined : cli.vInad} cmp={P.cmp} inverso
              sub={semDadosCli ? '—' : `${cli.carteira ? pct((cli.inad / cli.carteira) * 100).replace('+', '') : '0%'} da carteira`} onClick={() => setF((o) => ({ ...o, statusCliente: 'Inadimplente' }))} />
            <ClienteCard valor={semDadosCli ? '—' : int(cli.ativos)} rotulo="Ativos" Icone={UserCheck} faixa="bg-gradient-to-r from-[#0F9F6E] to-[#16A34A]" delta={semDadosCli ? undefined : cli.vAtivos} cmp={P.cmp}
              sub={semDadosCli ? '—' : `${cli.total ? pct((cli.ativos / cli.total) * 100).replace('+', '') : '0%'} da base`} onClick={() => setF((o) => ({ ...o, statusCliente: 'Ativo' }))} />
            <ClienteCard valor={semDadosCli ? '—' : int(cli.expHoje)} rotulo="Expiram hoje" Icone={CalendarClock} faixa="bg-gradient-to-r from-[#F59E0B] to-[#F97316]"
              sub={semDadosCli ? '—' : `+${int(cli.exp7)} nos próximos 7 dias`} onClick={() => setF((o) => ({ ...o, statusCliente: '' }))} />
          </div>

          {/* KPIs financeiros */}
          <div id="financeiro" className="grid scroll-mt-28 grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6" data-pdf-block>
            <FinCard destaque rotulo={`Saldo · ${P.nome}`} valor={fin.a.saldo} Icone={Wallet} delta={fin.v('saldo')} cmp={P.cmp}
              sub={<span className="flex flex-wrap gap-x-4 gap-y-1"><span>Ganhos <b className="text-white">{brl(fin.a.ganhos)}</b></span><span>Gastos <b className="text-white">{brl(fin.a.gastos)}</b></span></span>} />
            <FinCard rotulo="Ganhos" valor={fin.a.ganhos} Icone={TrendingUp} delta={fin.v('ganhos')} cmp={P.cmp} sub={`${int(fin.a.qtd)} recebimentos`} />
            <FinCard rotulo="Gastos" valor={fin.a.gastos} Icone={TrendingDown} delta={fin.v('gastos')} cmp={P.cmp} inverso sub={fin.a.ganhos ? `${pct((fin.a.gastos / fin.a.ganhos) * 100).replace('+', '')} da receita` : ''} />
            <FinCard rotulo="Ticket médio" valor={fin.a.ticket} Icone={Receipt} delta={fin.v('ticket')} cmp={P.cmp} sub="por recebimento no período" />
            <FinCard rotulo={`Fechamento de ${MESES_LONGOS[+fin.mAnt.slice(5, 7) - 1]}`} valor={fin.fech.saldo} Icone={Landmark} delta={variacao(fin.fech.saldo, fin.fech2.saldo)} cmp={`vs. ${MESES_LONGOS[+fin.mAnt2.slice(5, 7) - 1]}`} sub="resultado do mês anterior" />
          </div>

          {/* linha 1 de gráficos */}
          <div className="grid gap-3 xl:grid-cols-3" data-pdf-block>
            <Painel className="xl:col-span-2" Icone={Activity}
              titulo={serie.gran === 'dia' ? `Receita por dia — ${P.nome}` : serie.gran === 'semana' ? `Receita por semana — ${P.nome}` : `Receita por mês — ${P.nome}`}
              sub="Barras: ganhos e gastos · linha: saldo acumulado no período">
              {atual.length ? (
                <div className="h-[350px]">
                  <ResponsiveContainer>
                    <ComposedChart data={serie.pontos} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                      <defs><linearGradient id="gGanho" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.ganho} stopOpacity={1} /><stop offset="100%" stopColor={C.ganho} stopOpacity={0.55} /></linearGradient></defs>
                      <CartesianGrid stroke={C.grid} vertical={false} />
                      <XAxis dataKey="rot" {...eixo} interval="preserveStartEnd" minTickGap={14} />
                      <YAxis yAxisId="v" {...eixo} tickFormatter={brlC} width={64} />
                      <YAxis yAxisId="s" orientation="right" {...eixo} tickFormatter={brlC} width={64} hide={serie.pontos.length < 2} />
                      <Tooltip cursor={{ fill: C.cursor }} content={<Dica titulo={(d) => (serie.gran === 'dia' ? `${DIAS_SEM[toD(d.ini).getUTCDay()]}, ${fmtData(d.ini)}` : `${fmtData(d.ini)} a ${fmtData(d.fim)}`)}
                        linhas={(d) => [['Ganhos', brl(d.ganhos), C.ganho], ['Gastos', brl(d.gastos), C.gasto], ['Resultado', brl(d.ganhos - d.gastos)], ['Saldo acumulado', brl(d.saldo), C.saldo], ['Recebimentos', int(d.qtd)]]} />} />
                      <Bar yAxisId="v" dataKey="ganhos" name="Ganhos" fill="url(#gGanho)" radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={anim} />
                      <Bar yAxisId="v" dataKey="gastos" name="Gastos" fill={C.gasto} fillOpacity={0.85} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={anim} />
                      <Line yAxisId="s" dataKey="saldo" name="Saldo acumulado" stroke={C.saldo} strokeWidth={2.2} dot={false} activeDot={{ r: 4 }} isAnimationActive={anim} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: C.muted, paddingTop: 6 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : <Vazio />}
            </Painel>

            <Painel Icone={Activity} titulo="Atividade recente" sub="Últimas movimentações com os filtros atuais">
              {atual.length ? (
                <ul className="-mx-1 divide-y divide-line dark:divide-night-line">
                  {atual.slice(0, 7).map((m) => (
                    <li key={m.id} className="flex items-center gap-3 px-1 py-2.5">
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${m.tipo === 'Ganho' ? 'bg-brand-cyan/10 text-brand-cyan' : 'bg-rose-500/10 text-rose-500'}`}>{m.tipo === 'Ganho' ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{m.descricao || m.categoria}</div>
                        <div className="truncate text-xs text-slate-500 dark:text-slate-400">{fmtData(m.data)} · {m.cliente || m.categoria}</div>
                      </div>
                      <div className="text-right">
                        <div className={`whitespace-nowrap text-sm font-semibold tabular-nums ${m.tipo === 'Gasto' ? 'text-rose-600 dark:text-rose-400' : ''}`}>{m.tipo === 'Gasto' ? '−' : '+'}{brl(m.valor)}</div>
                        <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${STATUS_COR[m.status]}`}>{m.status}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <Vazio msg="Nenhuma atividade recente." />}
            </Painel>
          </div>

          {/* linha 2 */}
          <div className="grid gap-3 xl:grid-cols-3" data-pdf-block>
            <Painel className="xl:col-span-2" Icone={BarChart3} titulo={`Ganhos e gastos — ${anual.y}`} sub="Por mês, com os filtros atuais (exceto período)">
              {base.some((m) => m.data.startsWith(anual.y)) ? (
                <div className="h-[290px]">
                  <ResponsiveContainer>
                    <ComposedChart data={anual.pontos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs><linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.ganho} stopOpacity={0.28} /><stop offset="100%" stopColor={C.ganho} stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid stroke={C.grid} vertical={false} />
                      <XAxis dataKey="rot" {...eixo} />
                      <YAxis {...eixo} tickFormatter={brlC} width={64} />
                      <Tooltip cursor={{ stroke: C.grid, strokeWidth: 1 }} content={<Dica titulo={(d) => `${MESES_LONGOS[d.mes]} de ${anual.y}`}
                        linhas={(d) => (d.futuro ? [['Mês ainda não iniciado', '']] : [['Ganhos', brl(d.ganhos), C.ganho], ['Gastos', brl(d.gastos), C.gasto], ['Saldo', brl(d.saldo)], ['Margem', d.margem == null ? '—' : pct(d.margem).replace('+', '')]])} />} />
                      <Area dataKey="ganhos" name="Ganhos" stroke={C.ganho} strokeWidth={2.5} fill="url(#gArea)" dot={{ r: 3, fill: C.ganho, strokeWidth: 0 }} activeDot={{ r: 5 }} isAnimationActive={anim} connectNulls={false} />
                      <Line dataKey="gastos" name="Gastos" stroke={C.gasto} strokeWidth={2.5} dot={{ r: 3, fill: C.gasto, strokeWidth: 0 }} activeDot={{ r: 5 }} isAnimationActive={anim} connectNulls={false} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: C.muted, paddingTop: 6 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : <Vazio msg={`Sem movimentações em ${anual.y}.`} />}
            </Painel>
            <Painel Icone={BarChart3} titulo="Ganhos — últimos 8 dias" sub={`${fmtData(addDays(ref, -7))} a ${fmtData(ref)}`}>
              <div className="h-[290px]">
                <ResponsiveContainer>
                  <BarChart data={oitoDias} margin={{ top: 8, right: 0, left: 0, bottom: 0 }} barGap={2}>
                    <CartesianGrid stroke={C.grid} vertical={false} />
                    <XAxis dataKey="rot" {...eixo} interval={0} tick={{ fill: C.muted, fontSize: 10 }} />
                    <YAxis {...eixo} tickFormatter={brlC} width={56} />
                    <Tooltip cursor={{ fill: C.cursor }} content={<Dica titulo={(d) => `${DIAS_SEM[toD(d.d).getUTCDay()]}, ${fmtData(d.d)}`} linhas={(d) => [['Ganhos', brl(d.ganhos), C.ganho], ['Gastos', brl(d.gastos), C.gasto], ['Resultado', brl(d.ganhos - d.gastos)]]} />} />
                    <Bar dataKey="ganhos" name="Ganhos" fill={C.ganho} radius={[4, 4, 0, 0]} isAnimationActive={anim} />
                    <Bar dataKey="gastos" name="Gastos" fill={C.gasto} radius={[4, 4, 0, 0]} isAnimationActive={anim} />
                    <Legend iconType="square" iconSize={9} wrapperStyle={{ fontSize: 12, color: C.muted, paddingTop: 6 }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Painel>
          </div>

          {/* linha 3 */}
          <div id="clientes" className="grid scroll-mt-28 gap-3 md:grid-cols-2 xl:grid-cols-3" data-pdf-block>
            <Painel Icone={PieIcon} titulo={visaoCat === 'Gasto' ? 'Gastos por categoria' : 'Receitas por categoria'} sub="Clique numa fatia para filtrar"
              acao={<div className="flex rounded-lg border border-line p-0.5 text-xs font-semibold dark:border-night-line" data-pdf-ignore>{[['Gasto', 'Gastos'], ['Ganho', 'Receitas']].map(([k, r]) => <button key={k} onClick={() => setVisaoCat(k)} className={`rounded-md px-2.5 py-1 transition touch:px-3 touch:py-2 ${visaoCat === k ? 'bg-brand-navy text-white dark:bg-brand-cyan dark:text-brand-navy' : 'text-slate-500'}`}>{r}</button>)}</div>}>
              {porCategoria.l.length ? (
                <div className="flex flex-col items-center gap-3 sm:flex-row xl:flex-col 2xl:flex-row">
                  <div className="relative h-[190px] w-[190px] shrink-0">
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={porCategoria.l} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={2} stroke="none" isAnimationActive={anim}
                          onClick={(d) => { if (!d?.payload?.outros && !d?.outros) setF((o) => ({ ...o, tipo: visaoCat, categoria: d.name ?? d.payload?.name })); }} style={{ cursor: 'pointer' }}>
                          {porCategoria.l.map((e, i) => <Cell key={e.name} fill={C.cats[i % C.cats.length]} opacity={f.categoria && f.categoria !== e.name ? 0.35 : 1} />)}
                        </Pie>
                        <Tooltip content={<Dica titulo={(d) => d.name} linhas={(d) => [['Valor', brl(d.value)], ['Participação', pct(d.pct).replace('+', '')]]} />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 grid place-items-center text-center"><div><div className="text-[11px] text-slate-500">Total</div><div className="font-display text-sm font-bold tabular-nums">{brlC(porCategoria.tot)}</div></div></div>
                  </div>
                  <ul className="w-full space-y-1.5 text-sm">
                    {porCategoria.l.map((e, i) => (
                      <li key={e.name} className="flex items-center gap-2"><i className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: C.cats[i % C.cats.length] }} /><span className="min-w-0 flex-1 truncate">{e.name}</span><span className="tabular-nums text-slate-500">{pct(e.pct, 0).replace('+', '')}</span><b className="w-[84px] text-right tabular-nums">{brlC(e.value)}</b></li>
                    ))}
                  </ul>
                </div>
              ) : <Vazio />}
            </Painel>

            <Painel Icone={Layers} titulo="Carteira por plano" sub="Clientes por status · clique para filtrar o plano">
              {porPlano.length ? (
                <>
                  <div style={{ height: Math.max(150, porPlano.length * 46 + 40) }}>
                    <ResponsiveContainer>
                      <BarChart data={porPlano} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }} barSize={18}>
                        <CartesianGrid stroke={C.grid} horizontal={false} />
                        <XAxis type="number" {...eixo} allowDecimals={false} />
                        <YAxis type="category" dataKey="plano" {...eixo} width={92} tick={{ fill: C.muted, fontSize: 12 }} />
                        <Tooltip cursor={{ fill: C.cursor }} content={<Dica titulo={(d) => `Plano ${d.plano}`} linhas={(d) => [['Ativos', int(d.Ativo), C.ativo], ['Inadimplentes', int(d.Inadimplente), C.inad], ['Desativados', int(d.Desativado), C.canc], ['Receita no período', brl(d.receita)]]} />} />
                        {[['Ativo', C.ativo], ['Inadimplente', C.inad], ['Desativado', C.canc]].map(([k, c], i) => (
                          <Bar key={k} dataKey={k} name={k === 'Ativo' ? 'Ativos' : k === 'Inadimplente' ? 'Inadimplentes' : 'Desativados'} stackId="s" fill={c} radius={i === 2 ? [0, 4, 4, 0] : 0} isAnimationActive={anim}
                            onClick={(d) => setF((o) => ({ ...o, plano: d.plano ?? d.payload?.plano }))} style={{ cursor: 'pointer' }} />
                        ))}
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: C.muted }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : <Vazio msg={semDadosCli ? 'Cadastre clientes para ver a carteira.' : undefined} />}
            </Painel>

            <Painel Icone={CreditCard} titulo="Receita por forma de pagamento" sub={`${P.nome} · clique para filtrar`}>
              {porForma.l.length ? (
                <ul className="space-y-3.5">
                  {porForma.l.map((o, i) => (
                    <li key={o.forma}>
                      <button className="w-full text-left" onClick={() => setF((x) => ({ ...x, forma: x.forma === o.forma ? '' : o.forma }))}>
                        <div className="mb-1 flex items-baseline justify-between gap-2 text-sm"><span className="font-medium">{o.forma}</span><span className="whitespace-nowrap tabular-nums"><b>{brl(o.valor)}</b> <span className="text-xs text-slate-500">· {int(o.qtd)}</span></span></div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-night-soft"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${porForma.tot ? (o.valor / porForma.tot) * 100 : 0}%`, background: C.cats[i % C.cats.length] }} /></div>
                        <div className="mt-0.5 text-xs text-slate-500">{pct(porForma.tot ? (o.valor / porForma.tot) * 100 : 0).replace('+', '')} da receita · ticket {brl(o.valor / o.qtd)}</div>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : <Vazio />}
            </Painel>
          </div>

          {/* tabela */}
          <section id="movimentacoes" className={`${CARD} scroll-mt-28 overflow-hidden`} data-pdf-block>
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
              <div>
                <h3 className="flex items-center gap-2 font-display text-[15px] font-semibold"><Table2 className="h-4 w-4 text-brand-cyan" />Movimentações</h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{int(tabela.length)} lançamentos · {P.nome}{imprimindo && tabela.length > 25 ? ' · exibindo os 25 primeiros (CSV traz todos)' : ''}</p>
              </div>
              <label className="relative w-full sm:w-72" data-pdf-ignore>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente, descrição, categoria…" className="h-10 w-full rounded-lg border border-line bg-white pl-9 pr-3 text-[16px] outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30 sm:text-sm dark:border-night-line dark:bg-night-soft" />
              </label>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm xl:min-w-[860px]">
                <thead>
                  <tr className="border-y border-line bg-slate-50 text-left text-xs font-semibold text-slate-500 dark:border-night-line dark:bg-night-soft/60 dark:text-slate-400">
                    {[['data', 'Data'], ['tipo', 'Tipo'], ['categoria', 'Categoria'], ['descricao', 'Descrição'], ['cliente', 'Cliente'], ['plano', 'Plano'], ['forma', 'Forma'], ['status', 'Status'], ['valor', 'Valor']].map(([k, r]) => (
                      <th key={k} className={`px-3 py-2.5 sm:px-4 ${k === 'valor' ? 'text-right' : ''} ${VIS_COL[k] || ''}`}>
                        <button onClick={() => setOrdem((o) => ({ col: k, dir: o.col === k ? -o.dir : k === 'valor' || k === 'data' ? -1 : 1 }))} className="alvo inline-flex items-center gap-1 hover:text-brand-navy dark:hover:text-white">
                          {r}{ordem.col === k && (ordem.dir > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line dark:divide-night-line">
                  {linhas.map((m) => (
                    <tr key={m.id} className="transition hover:bg-slate-50 dark:hover:bg-night-soft/50">
                      <td className="whitespace-nowrap px-3 py-2.5 tabular-nums sm:px-4">{fmtData(m.data)}</td>
                      <td className={`px-4 py-2.5 ${VIS_COL.tipo}`}><span className={`inline-flex items-center gap-1 text-xs font-semibold ${m.tipo === 'Ganho' ? 'text-[#0095B0] dark:text-brand-cyan' : 'text-rose-600 dark:text-rose-400'}`}>{m.tipo === 'Ganho' ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}{m.tipo}</span></td>
                      <td className={`px-4 py-2.5 ${VIS_COL.categoria}`}>{m.categoria}</td>
                      <td className={`max-w-[240px] truncate px-4 py-2.5 text-slate-600 dark:text-slate-300 ${VIS_COL.descricao}`} title={m.descricao}>{m.descricao || '—'}</td>
                      <td className="max-w-[180px] truncate px-3 py-2.5 sm:px-4">{m.cliente || '—'}</td>
                      <td className={`px-4 py-2.5 ${VIS_COL.plano}`}>{m.plano || '—'}</td>
                      <td className={`whitespace-nowrap px-4 py-2.5 ${VIS_COL.forma}`}>{m.forma}</td>
                      <td className={`px-4 py-2.5 ${VIS_COL.status}`}><span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${STATUS_COR[m.status]}`}>{m.status}</span></td>
                      <td className={`whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums sm:px-4 ${m.tipo === 'Gasto' ? 'text-rose-600 dark:text-rose-400' : ''}`}>{m.tipo === 'Gasto' ? '−' : ''}{brl(m.valor)}</td>
                    </tr>
                  ))}
                  {!linhas.length && <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400">Nenhuma movimentação encontrada.</td></tr>}
                </tbody>
              </table>
            </div>
            {!!tabela.length && (
              <div className="flex flex-wrap items-baseline justify-end gap-x-3 border-t border-line px-3 py-3 text-sm sm:px-4 dark:border-night-line">
                <span className="text-slate-500">Resultado dos {int(tabela.length)} lançamentos</span>
                <span className="whitespace-nowrap font-display font-bold tabular-nums">{brl(tabela.reduce((a, m) => a + (m.tipo === 'Gasto' ? -m.valor : m.valor), 0))}</span>
              </div>
            )}
            {!imprimindo && totPag > 1 && (
              <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm dark:border-night-line" data-pdf-ignore>
                <span className="text-slate-500">Página {pagina + 1} de {totPag}</span>
                <div className="flex gap-2">
                  <Btn onClick={() => setPagina((p) => Math.max(0, p - 1))} disabled={!pagina} aria-label="Página anterior"><ChevronLeft className="h-4 w-4" /></Btn>
                  <Btn onClick={() => setPagina((p) => Math.min(totPag - 1, p + 1))} disabled={pagina >= totPag - 1} aria-label="Próxima página"><ChevronRight className="h-4 w-4" /></Btn>
                </div>
              </div>
            )}
          </section>
        </div>
      {menuCsv && <div className="fixed inset-0 z-10" onClick={() => setMenuCsv(false)} />}
    </div>
  );
}
