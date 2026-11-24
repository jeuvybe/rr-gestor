// RR Gestor — versão de demonstração que roda inteira dentro de uma página (sem servidor).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Loader2, MessageCircle, X, RotateCcw, FlaskConical } from 'lucide-react';
import { iniciarBackend } from './backend.js';
import { RotaCtx } from './rotas.js';
import { supabaseBrowser } from '@/lib/supabase/client';
import AppShell from '@/components/AppShell';
import AreaCliente from '@/components/AreaCliente';
import AuthForm from '@/components/AuthForm';
import AuthLayout from '@/app/(auth)/layout.jsx';
import RecuperarSenha from '@/app/(auth)/recuperar-senha/page.jsx';
import RedefinirSenha from '@/app/(auth)/redefinir-senha/page.jsx';
import PDashboard from '@/app/painel/page.jsx';
import PClientes from '@/app/painel/clientes/page.jsx';
import PServidores from '@/app/painel/servidores/page.jsx';
import PFinanceiro from '@/app/painel/financeiro/page.jsx';
import PPlanos from '@/app/painel/planos/page.jsx';
import PWhatsapp from '@/app/painel/whatsapp/page.jsx';
import PConta from '@/app/painel/conta/page.jsx';
import AAssinantes from '@/app/admin/page.jsx';
import APlanos from '@/app/admin/planos/page.jsx';
import AConfig from '@/app/admin/configuracoes/page.jsx';
import { fmtTelefone } from '@/lib/format';

const PAGINAS = {
  '/painel': PDashboard, '/painel/clientes': PClientes, '/painel/servidores': PServidores, '/painel/financeiro': PFinanceiro,
  '/painel/planos': PPlanos, '/painel/whatsapp': PWhatsapp, '/painel/conta': PConta,
  '/admin': AAssinantes, '/admin/planos': APlanos, '/admin/configuracoes': AConfig,
};
const EMAILS = { assinante: 'assinante@demo.com', admin: 'admin@demo.com' };

// tema inicial
try { const t = localStorage.getItem('rr-tema') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); document.documentElement.classList.toggle('dark', t === 'dark'); } catch { /* sem storage */ }

function Carregando({ texto, erro }) {
  return (
    <div className="grid min-h-screen place-items-center bg-brand-navy p-6 text-white">
      <div className="max-w-sm text-center">
        <svg viewBox="0 0 120 92" className="mx-auto h-12 w-16" aria-hidden="true"><g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="14"><path d="M10 84V9h26a19 19 0 0 1 0 38H10M32 47l18 37M66 84V9h26a19 19 0 0 1 0 38H66" stroke="#fff" /><path d="M86 47l18 37" stroke="#00B8D9" /></g></svg>
        <div className="mt-5 font-display text-xl font-bold">RR Gestor · demonstração</div>
        {erro ? <p className="mt-3 text-sm text-rose-300">{erro}</p> : <p className="mt-3 flex items-center justify-center gap-2 text-sm text-cyan-100/80"><Loader2 className="h-4 w-4 animate-spin" />{texto}</p>}
        <p className="mt-6 text-xs text-cyan-100/50">Banco, login e WhatsApp simulados aqui mesmo, sem servidor. Nada sai desta página.</p>
      </div>
    </div>
  );
}

/** Painel e admin: exige login, carrega perfil e uso do plano */
function Protegido({ area, children, chave }) {
  const sb = supabaseBrowser();
  const [estado, setEstado] = useState(null);
  const ir = useIr();
  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return ir('/login');
      const [{ data: perfil }, { data: uso }] = await Promise.all([sb.from('profiles').select('*').eq('id', user.id).single(), sb.rpc('meu_uso')]);
      if (!perfil) return ir('/login');
      if (area === 'admin' && !perfil.is_admin) return ir('/painel');
      if (area === 'painel' && perfil.is_admin) return ir('/admin');
      if (vivo) setEstado({ perfil, uso: uso?.[0] || null });
    })();
    return () => { vivo = false; };
  }, [sb, area, chave]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!estado) return <div className="grid min-h-screen place-items-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  return <AppShell key={`${estado.perfil.id}-${area}`} perfil={estado.perfil} uso={estado.uso} area={area}>{children}</AppShell>;
}

let irGlobal = () => {};
const useIr = () => irGlobal;

function EntrarDemo({ como }) {
  const ir = useIr();
  useEffect(() => {
    supabaseBrowser().auth.signInWithPassword({ email: EMAILS[como] || EMAILS.assinante, password: 'demo' })
      .then(() => ir(como === 'admin' ? '/admin' : '/painel'));
  }, [como]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="grid min-h-screen place-items-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>;
}

function Celular({ msgs, aberto, setAberto }) {
  return (
    <>
      <button data-demo-flutuante onClick={() => setAberto(!aberto)} aria-label="WhatsApp simulado" className="fixed bottom-4 right-4 z-[70] inline-flex h-12 items-center gap-2 rounded-full bg-emerald-500 px-3.5 font-semibold sm:px-4 text-white shadow-2xl hover:bg-emerald-600" aria-expanded={aberto}>
        <MessageCircle className="h-5 w-5" /><span className="hidden sm:inline [@media(max-height:500px)]:!hidden">WhatsApp simulado</span>{msgs.length > 0 && <span className="rounded-full bg-white px-2 text-xs font-bold text-emerald-700">{msgs.length}</span>}
      </button>
      {aberto && (
        <div className="fixed bottom-20 right-4 z-[70] flex max-h-[70vh] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl bg-[#0B141A] shadow-2xl ring-1 ring-black/20">
          <div className="flex items-center justify-between bg-[#202C33] px-4 py-3 text-white">
            <div><div className="font-semibold">Mensagens enviadas</div><div className="text-xs text-white/60">O que sairia pelo WhatsApp de verdade</div></div>
            <button onClick={() => setAberto(false)} aria-label="Fechar" className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10"><X className="h-4 w-4" /></button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto bg-[#0B141A] p-3">
            {!msgs.length && <p className="p-6 text-center text-sm text-white/50">Nenhuma mensagem ainda. Conecte o WhatsApp em <b>WhatsApp</b> e use os botões de mensagem dos clientes.</p>}
            {[...msgs].reverse().map((m) => (
              <div key={m.id}>
                <div className="mb-1 text-[11px] text-white/50">Para {fmtTelefone(m.numero)} · {m.hora}</div>
                <div className="ml-auto max-w-[92%] whitespace-pre-wrap rounded-xl rounded-tr-sm bg-[#005C4B] px-3 py-2 text-[13px] leading-snug text-white">{m.texto}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function App() {
  const [rota, setRota] = useState({ caminho: '/login', busca: '' });
  const [chave, setChave] = useState(0);
  const [msgs, setMsgs] = useState([]);
  const [celular, setCelular] = useState(false);

  const ir = useCallback((destino) => {
    const d = String(destino || '/').replace(/^https:\/\/demo\.local/, '');
    const [caminho, busca = ''] = d.split('?');
    setRota({ caminho: caminho || '/', busca });
    window.scrollTo(0, 0);
  }, []);
  irGlobal = ir;
  const atualizar = useCallback(() => setChave((k) => k + 1), []);
  const ctx = useMemo(() => ({ ...rota, ir, atualizar }), [rota, ir, atualizar]);

  useEffect(() => {
    window.__rrMensagem = (m) => { setMsgs((l) => [...l, { ...m, id: Date.now() + Math.random(), hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }]); };
    // links internos (incluindo os da área do cliente) navegam dentro da página
    const clique = (e) => {
      const a = e.target.closest?.('a[href]'); if (!a) return;
      const h = a.getAttribute('href');
      if (h.startsWith('https://demo.local') || (h.startsWith('/') && !h.startsWith('//'))) { e.preventDefault(); ir(h); }
    };
    document.addEventListener('click', clique, true);
    return () => document.removeEventListener('click', clique, true);
  }, [ir]);

  const { caminho, busca } = rota;
  let tela;
  if (caminho === '/demo') tela = <EntrarDemo key={busca} como={new URLSearchParams(busca).get('como')} />;
  else if (caminho === '/' || caminho === '/login') tela = <AuthLayout><AuthForm modo="login" /></AuthLayout>;
  else if (caminho === '/cadastro') tela = <AuthLayout><AuthForm modo="cadastro" /></AuthLayout>;
  else if (caminho === '/recuperar-senha') tela = <AuthLayout><RecuperarSenha /></AuthLayout>;
  else if (caminho === '/redefinir-senha') tela = <AuthLayout><RedefinirSenha /></AuthLayout>;
  else if (caminho.startsWith('/c/')) tela = <AreaCliente key={caminho} slug={caminho.slice(3)} />;
  else if (PAGINAS[caminho]) { const P = PAGINAS[caminho]; tela = <Protegido area={caminho.startsWith('/admin') ? 'admin' : 'painel'} chave={chave}><P key={caminho} /></Protegido>; }
  else tela = <div className="grid min-h-screen place-items-center"><button onClick={() => ir('/login')} className="font-semibold text-[#007F98]">Página não encontrada · voltar ao login</button></div>;

  return (
    <RotaCtx.Provider value={ctx}>
      {tela}
      <div data-demo-flutuante className="fixed bottom-5 right-[250px] z-[70] hidden items-center gap-2 rounded-full bg-amber-400 px-3 py-2 text-xs font-bold text-amber-950 shadow-lg sm:inline-flex [@media(max-height:500px)]:!hidden">
        <FlaskConical className="h-3.5 w-3.5" />Demonstração · dados simulados
        <button onClick={() => location.reload()} title="Apaga tudo e recomeça com os dados de exemplo" className="inline-flex items-center gap-1 rounded-full bg-amber-950/10 px-2 py-0.5 hover:bg-amber-950/20"><RotateCcw className="h-3 w-3" />Recomeçar</button>
      </div>
      <Celular msgs={msgs} aberto={celular} setAberto={setCelular} />
    </RotaCtx.Provider>
  );
}

function Raiz() {
  const [pronto, setPronto] = useState(false);
  const [texto, setTexto] = useState('Preparando…');
  const [erro, setErro] = useState('');
  useEffect(() => {
    iniciarBackend({ progresso: setTexto, aoEnviar: (m) => window.__rrMensagem?.(m) })
      .then(() => setPronto(true))
      .catch((e) => { console.error(e); setErro(`Não foi possível iniciar a demonstração neste navegador: ${e.message}`); });
  }, []);
  return pronto ? <App /> : <Carregando texto={texto} erro={erro} />;
}

createRoot(document.getElementById('root')).render(<Raiz />);
