'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, X, Loader2, Info, ArrowUp, ArrowDown, Sun, Moon, ChevronDown } from 'lucide-react';
import { pct } from '@/lib/format';

export function Btn({ children, variante = 'secundario', carregando, className = '', ...p }) {
  const v = {
    primario: 'bg-brand-cyan text-brand-navy hover:bg-[#19C6E5]',
    escuro: 'bg-brand-navy text-white hover:bg-[#12305a] dark:bg-white dark:text-brand-navy dark:hover:bg-slate-200',
    secundario: 'border border-line bg-white text-brand-navy hover:border-brand-cyan dark:border-night-line dark:bg-night-soft dark:text-white',
    perigo: 'bg-rose-600 text-white hover:bg-rose-700',
    fantasma: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-night-soft',
  }[variante];
  return (
    <button {...p} disabled={p.disabled || carregando}
      className={`inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan disabled:cursor-not-allowed disabled:opacity-50 ${v} ${className}`}>
      {carregando && <Loader2 className="h-4 w-4 animate-spin" />}{children}
    </button>
  );
}

export function Campo({ rotulo, erro, ajuda, className = '', children, ...p }) {
  return (
    <label className={`block ${className}`}>
      {rotulo && <span className="rotulo">{rotulo}</span>}
      {children || <input {...p} className={`campo ${erro ? 'border-rose-500' : ''}`} />}
      {ajuda && !erro && <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{ajuda}</span>}
      {erro && <span className="mt-1 block text-xs font-medium text-rose-600">{erro}</span>}
    </label>
  );
}

export function Selecao({ rotulo, opcoes, todos, className = '', ...p }) {
  return (
    <Campo rotulo={rotulo} className={className}>
      <span className="relative block">
        <select {...p} className="campo appearance-none truncate pr-8">
          {todos !== undefined && <option value="">{todos}</option>}
          {opcoes.map((o) => (Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o} value={o}>{o}</option>))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </span>
    </Campo>
  );
}

export function Modal({ titulo, sub, aberto, onFechar, children, rodape, largura = 'max-w-lg' }) {
  useEffect(() => {
    if (!aberto) return;
    const k = (e) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [aberto, onFechar]);
  if (!aberto) return null;
  return (
    <div className="no-print fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-brand-navy/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <div role="dialog" aria-modal="true" className={`flex max-h-[100dvh] w-full flex-col ${largura} rounded-t-2xl border border-line bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl dark:border-night-line dark:bg-night-card`}>
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-4 py-3 sm:px-5 sm:py-4 dark:border-night-line">
          <div><h2 className="font-display text-lg font-bold">{titulo}</h2>{sub && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{sub}</p>}</div>
          <button onClick={onFechar} aria-label="Fechar" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg hover:bg-slate-100 dark:hover:bg-night-soft"><X className="h-5 w-5" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">{children}</div>
        {rodape && <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-line px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 dark:border-night-line">{rodape}</div>}
      </div>
    </div>
  );
}

const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [t, setT] = useState(null);
  const mostrar = useCallback((msg, ok = true) => setT({ msg, ok, id: Date.now() }), []);
  useEffect(() => { if (!t) return; const x = setTimeout(() => setT(null), 4500); return () => clearTimeout(x); }, [t]);
  return (
    <ToastCtx.Provider value={mostrar}>
      {children}
      {t && (
        <div role="status" className={`no-print fixed bottom-5 left-1/2 z-[60] flex max-w-[92vw] -translate-x-1/2 items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-2xl ${t.ok ? 'bg-brand-navy dark:bg-[#123A66]' : 'bg-rose-600'}`}>
          {t.ok ? <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-cyan" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}{t.msg}
        </div>
      )}
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

export function Badge({ children, tom = 'cinza' }) {
  const c = {
    verde: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    vermelho: 'bg-rose-500/10 text-rose-700 dark:text-rose-400',
    ambar: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    ciano: 'bg-brand-cyan/10 text-[#007F98] dark:text-brand-cyan',
    cinza: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
  }[tom];
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${c}`}>{children}</span>;
}

export const Vazio = ({ msg = 'Sem dados para os filtros selecionados.', children }) => (
  <div className="grid min-h-[180px] place-items-center px-4 py-8 text-center text-sm text-slate-400"><div><Info className="mx-auto mb-2 h-5 w-5" />{msg}{children && <div className="mt-3">{children}</div>}</div></div>
);

export const Carregando = () => (
  <div className="grid min-h-[50vh] place-items-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
);

export function Delta({ v, inverso, cmp }) {
  if (v === undefined) return null;
  if (v === null) return <span className="text-xs text-slate-500 dark:text-slate-400">sem base anterior</span>;
  const bom = inverso ? v <= 0 : v >= 0;
  const I = v >= 0 ? ArrowUp : ArrowDown;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-xs">
      <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold tabular-nums ${Math.abs(v) < 0.05 ? 'bg-slate-500/10 text-slate-600 dark:text-slate-300' : bom ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-700 dark:text-rose-400'}`}>
        <I className="h-3 w-3" strokeWidth={2.5} />{pct(Math.abs(v)).replace('+', '')}
      </span>
      {cmp && <span className="text-slate-500 dark:text-slate-400">{cmp}</span>}
    </span>
  );
}

export function useTema() {
  const [escuro, setEscuro] = useState(false);
  useEffect(() => setEscuro(document.documentElement.classList.contains('dark')), []);
  const alternar = () => {
    const n = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', n);
    try { localStorage.setItem('rr-tema', n ? 'dark' : 'light'); } catch { /* ok */ }
    setEscuro(n);
  };
  return [escuro, alternar];
}

export function BotaoTema() {
  const [escuro, alternar] = useTema();
  return (
    <button onClick={alternar} aria-label={escuro ? 'Ativar modo claro' : 'Ativar modo escuro'} title={escuro ? 'Modo claro' : 'Modo escuro'}
      className="relative grid h-10 w-[68px] shrink-0 items-center rounded-full border border-line bg-slate-100 p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan dark:border-night-line dark:bg-night-soft">
      <span className={`grid h-8 w-8 place-items-center rounded-full bg-white text-amber-500 shadow transition-transform duration-300 dark:bg-brand-navy dark:text-brand-cyan ${escuro ? 'translate-x-[26px]' : ''}`}>{escuro ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</span>
    </button>
  );
}

export function Interruptor({ ligado, onChange, rotulo, desc }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button type="button" role="switch" aria-checked={ligado} onClick={() => onChange(!ligado)}
        className={`alvo mt-0.5 h-6 w-11 shrink-0 rounded-full p-0.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan ${ligado ? 'bg-brand-cyan' : 'bg-slate-300 dark:bg-night-line'}`}>
        <span className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${ligado ? 'translate-x-5' : ''}`} />
      </button>
      <span><span className="block text-sm font-semibold">{rotulo}</span>{desc && <span className="block text-xs text-slate-500 dark:text-slate-400">{desc}</span>}</span>
    </label>
  );
}
