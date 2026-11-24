'use client';
import { useEffect, useState } from 'react';
import { LogIn, LogOut, Copy, MessageCircle, CalendarClock, Monitor, Package, Server, Receipt, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { BotaoTema, Btn, Campo, ToastProvider, useToast } from '@/components/ui';
import { supabaseBrowser } from '@/lib/supabase/client';
import { brl, fmtData } from '@/lib/format';

export default function AreaCliente({ slug }) {
  return <ToastProvider><Conteudo slug={slug} /></ToastProvider>;
}

function Conteudo({ slug }) {
  const sb = supabaseBrowser();
  const toast = useToast();
  const chave = `rr-area-${slug}`;
  const [empresa, setEmpresa] = useState(undefined);
  const [dados, setDados] = useState(null);
  const [f, setF] = useState({ login: '', senha: '' });
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function entrar(cred, silencioso) {
    setCarregando(true); setErro('');
    const { data, error } = await sb.rpc('area_cliente_entrar', { p_slug: slug, p_login: cred.login.trim(), p_senha: cred.senha });
    setCarregando(false);
    if (error || !data) {
      try { sessionStorage.removeItem(chave); } catch { /* ok */ }
      if (!silencioso) setErro(error ? 'Não foi possível entrar agora. Tente de novo em instantes.' : 'Usuário ou senha incorretos.');
      return;
    }
    try { sessionStorage.setItem(chave, JSON.stringify(cred)); } catch { /* ok */ }
    setDados(data);
  }
  useEffect(() => {
    sb.rpc('area_cliente_empresa', { p_slug: slug }).then(({ data }) => setEmpresa(data || null));
    try { const s = JSON.parse(sessionStorage.getItem(chave) || 'null'); if (s) entrar(s, true); } catch { /* ok */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);
  const sair = () => { try { sessionStorage.removeItem(chave); } catch { /* ok */ } setDados(null); setF({ login: '', senha: '' }); };
  const copiar = async (t) => { try { await navigator.clipboard.writeText(t); toast('Chave Pix copiada.'); } catch { toast('Não foi possível copiar. Selecione e copie a chave.', false); } };

  if (empresa === undefined) return <div className="grid min-h-screen place-items-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (empresa === null) return <div className="grid min-h-screen place-items-center p-6 text-center"><div><div className="font-display text-2xl font-bold">Endereço não encontrado</div><p className="mt-2 text-slate-500">Confira o link que você recebeu.</p></div></div>;

  const topo = (
    <header className="flex items-center gap-3 border-b border-line bg-white/85 px-4 py-3 backdrop-blur sm:px-6 dark:border-night-line dark:bg-night-card/80">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-navy font-display font-bold text-white dark:bg-brand-cyan dark:text-brand-navy">{empresa.nome.charAt(0).toUpperCase()}</span>
      <div className="min-w-0 flex-1"><div className="truncate font-display font-bold">{empresa.nome}</div><div className="text-xs text-slate-500 dark:text-slate-400">Área do cliente</div></div>
      <BotaoTema />
      {dados && <button onClick={sair} className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-night-soft"><LogOut className="h-4 w-4" />Sair</button>}
    </header>
  );

  if (!dados) {
    return (
      <div className="min-h-screen">{topo}
        <form onSubmit={(e) => { e.preventDefault(); entrar(f); }} className="mx-auto mt-[8vh] w-full max-w-sm px-5">
          <h1 className="font-display text-[28px] font-bold leading-tight">Entrar</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">Use o usuário (ou seu WhatsApp) e a senha que {empresa.nome} enviou para você.</p>
          <div className="mt-6 space-y-3.5">
            <Campo rotulo="Usuário ou WhatsApp" value={f.login} onChange={(e) => setF({ ...f, login: e.target.value })} autoComplete="username" required />
            <Campo rotulo="Senha" type="password" value={f.senha} onChange={(e) => setF({ ...f, senha: e.target.value })} autoComplete="current-password" required />
          </div>
          {erro && <p className="mt-3 text-sm font-medium text-rose-600" role="alert">{erro}</p>}
          <Btn variante="primario" type="submit" carregando={carregando} className="mt-5 w-full"><LogIn className="h-4 w-4" />Entrar</Btn>
          <p className="mt-6 text-center text-xs text-slate-400">Esqueceu a senha? Fale com {empresa.nome} pelo WhatsApp.</p>
        </form>
      </div>
    );
  }

  const { cliente: c, empresa: e, faturas } = dados;
  const d = c.dias;
  const [cor, I, frase] = d < 0 ? ['bg-rose-600 text-white', AlertTriangle, `Sua mensalidade venceu há ${-d} ${d === -1 ? 'dia' : 'dias'}`]
    : d === 0 ? ['bg-amber-400 text-amber-950', CalendarClock, 'Sua mensalidade vence hoje']
      : d <= 7 ? ['bg-brand-cyan text-brand-navy', CalendarClock, `Sua mensalidade vence em ${d} ${d === 1 ? 'dia' : 'dias'}`]
        : ['bg-brand-navy text-white dark:bg-[#0F2A4D]', CheckCircle2, `Tudo em dia: vence em ${d} dias`];
  const wa = e.whatsapp ? `https://wa.me/${String(e.whatsapp).replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! Sou ${c.nome}${c.usuario ? ` (usuário ${c.usuario})` : ''}. Segue o comprovante da mensalidade de ${brl(c.valor)} com vencimento em ${fmtData(c.vencimento)}.`)}` : null;

  return (
    <div className="min-h-screen">{topo}
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-6">
        <h1 className="font-display text-[clamp(22px,4vw,28px)] font-bold">Olá, {c.nome.split(' ')[0]}!</h1>
        <section className={`rounded-2xl p-5 shadow-lg ${cor}`}>
          <div className="flex items-center gap-2 text-sm font-semibold opacity-90"><I className="h-4 w-4" />{frase}</div>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <div><div className="font-display text-[clamp(30px,6vw,40px)] font-bold leading-none tabular-nums">{brl(c.valor)}</div><div className="mt-1 text-sm opacity-90">Vencimento: {fmtData(c.vencimento)}</div></div>
          </div>
        </section>

        {e.pix && (
          <section className="card p-5">
            <div className="text-sm font-semibold">Pague com Pix</div>
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3 dark:bg-night-soft">
              <div className="min-w-0 flex-1"><div className="text-xs text-slate-500">Chave Pix de {e.nome}</div><div className="break-all font-semibold">{e.pix}</div></div>
              <Btn onClick={() => copiar(e.pix)}><Copy className="h-4 w-4" />Copiar</Btn>
            </div>
            {wa && <a href={wa} target="_blank" rel="noreferrer" className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 font-semibold text-white hover:bg-emerald-600"><MessageCircle className="h-4 w-4" />Já paguei: enviar comprovante</a>}
          </section>
        )}

        <section className="card grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
          {[[Package, 'Plano', c.plano || '—'], [Monitor, 'Telas', c.telas], [Server, 'Servidor', c.servidor || '—'], [LogIn, 'Usuário', c.usuario || '—']].map(([Ic, r, v]) => (
            <div key={r}><div className="flex items-center gap-1.5 text-xs text-slate-500"><Ic className="h-3.5 w-3.5" />{r}</div><div className="mt-1 truncate font-semibold">{v}</div></div>
          ))}
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center gap-2 p-4 text-sm font-semibold"><Receipt className="h-4 w-4 text-brand-cyan" />Pagamentos recebidos</div>
          {!faturas.length ? <p className="px-4 pb-4 text-sm text-slate-500">Nenhum pagamento registrado ainda.</p> : (
            <ul className="divide-y divide-line border-t border-line dark:divide-night-line dark:border-night-line">
              {faturas.map((t, i) => <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"><span className="tabular-nums">{fmtData(t.data)}<span className="ml-2 text-xs text-slate-500">{t.forma}</span></span><b className="tabular-nums">{brl(t.valor)}</b></li>)}
            </ul>
          )}
        </section>
        {!e.pix && wa && <a href={wa} target="_blank" rel="noreferrer" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 font-semibold text-white"><MessageCircle className="h-4 w-4" />Falar com {e.nome}</a>}
      </main>
    </div>
  );
}
