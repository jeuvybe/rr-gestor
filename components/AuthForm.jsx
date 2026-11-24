'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Smartphone, ArrowLeft, MessageCircle } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { normalizaTelefone, fmtTelefone, msgErro } from '@/lib/format';
import { Btn, Campo, useToast } from '@/components/ui';

export default function AuthForm({ modo }) {
  const cadastro = modo === 'cadastro';
  const sb = supabaseBrowser();
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [via, setVia] = useState('email');
  const [f, setF] = useState({ nome: '', empresa: '', email: '', senha: '', senha2: '', telefone: '', codigo: '' });
  const [etapa, setEtapa] = useState('form'); // form | codigo | confirmar-email
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const set = (k) => (e) => setF((o) => ({ ...o, [k]: e.target.value }));
  const tel = normalizaTelefone(f.telefone);
  const entrar = () => { router.replace(params.get('volta') || '/painel'); router.refresh(); };

  async function enviar(e) {
    e.preventDefault(); setErro('');
    if (cadastro && !f.nome.trim()) return setErro('Informe seu nome.');
    setCarregando(true);
    try {
      if (via === 'email') {
        if (cadastro) {
          if (f.senha.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');
          if (f.senha !== f.senha2) throw new Error('As senhas não conferem.');
          const { data, error } = await sb.auth.signUp({
            email: f.email.trim(), password: f.senha,
            options: { data: { nome: f.nome.trim(), empresa: f.empresa.trim() }, emailRedirectTo: `${location.origin}/auth/callback` },
          });
          if (error) throw error;
          if (data.session) entrar(); else setEtapa('confirmar-email');
        } else {
          const { error } = await sb.auth.signInWithPassword({ email: f.email.trim(), password: f.senha });
          if (error) throw error;
          entrar();
        }
      } else {
        if (tel.length < 12) throw new Error('Informe o celular com DDD.');
        const { error } = await sb.auth.signInWithOtp({
          phone: `+${tel}`,
          options: { shouldCreateUser: cadastro, data: cadastro ? { nome: f.nome.trim(), empresa: f.empresa.trim() } : undefined },
        });
        if (error) throw error;
        setEtapa('codigo'); toast('Código enviado pelo WhatsApp.');
      }
    } catch (e2) { setErro(msgErro(e2)); } finally { setCarregando(false); }
  }

  async function verificar(e) {
    e.preventDefault(); setErro(''); setCarregando(true);
    const { error } = await sb.auth.verifyOtp({ phone: `+${tel}`, token: f.codigo.trim(), type: 'sms' });
    setCarregando(false);
    if (error) return setErro(msgErro(error));
    if (cadastro) await sb.from('profiles').update({ nome: f.nome.trim(), empresa: f.empresa.trim() || null }).eq('id', (await sb.auth.getUser()).data.user.id);
    entrar();
  }

  if (etapa === 'confirmar-email') {
    return (
      <div className="text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-cyan/10 text-brand-cyan"><Mail className="h-7 w-7" /></div>
        <h1 className="mt-4 font-display text-2xl font-bold">Confirme seu e-mail</h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400">Enviamos um link para <b className="text-brand-navy dark:text-white">{f.email}</b>. Abra o link para ativar a conta e entrar no painel.</p>
        <Link href="/login" className="mt-6 inline-block text-sm font-semibold text-[#007F98] dark:text-brand-cyan">Ir para o login</Link>
      </div>
    );
  }

  if (etapa === 'codigo') {
    return (
      <form onSubmit={verificar}>
        <button type="button" onClick={() => setEtapa('form')} className="mb-6 inline-flex items-center gap-1 text-sm font-semibold text-slate-500"><ArrowLeft className="h-4 w-4" />Voltar</button>
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600"><MessageCircle className="h-6 w-6" /></div>
        <h1 className="mt-4 font-display text-2xl font-bold">Digite o código</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">Enviamos um código de 6 dígitos pelo WhatsApp para <b className="text-brand-navy dark:text-white">{fmtTelefone(tel)}</b>.</p>
        <input autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={f.codigo} onChange={(e) => setF((o) => ({ ...o, codigo: e.target.value.replace(/\D/g, '') }))}
          className="campo mt-6 h-14 text-center font-display text-2xl tracking-[0.5em]" placeholder="000000" aria-label="Código de verificação" />
        {erro && <p className="mt-3 text-sm font-medium text-rose-600">{erro}</p>}
        <Btn variante="primario" type="submit" carregando={carregando} disabled={f.codigo.length < 6} className="mt-4 w-full">Confirmar e entrar</Btn>
        <button type="button" onClick={enviar} className="mt-4 w-full text-sm font-semibold text-slate-500 hover:text-brand-navy dark:hover:text-white">Reenviar código</button>
      </form>
    );
  }

  return (
    <form onSubmit={enviar}>
      {process.env.NEXT_PUBLIC_DEMO === '1' && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          <div className="font-semibold">Modo demonstração</div>
          <p className="mt-1">Banco e WhatsApp simulados no seu computador. Qualquer senha funciona; no telefone, o código é 123456.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href="/demo?como=assinante" className="inline-flex h-9 items-center rounded-lg bg-brand-navy px-3 font-semibold text-white">Entrar como assinante</a>
            <a href="/demo?como=admin" className="inline-flex h-9 items-center rounded-lg border border-amber-400 px-3 font-semibold">Entrar como admin</a>
          </div>
        </div>
      )}
      <h1 className="font-display text-[28px] font-bold leading-tight">{cadastro ? 'Crie sua conta' : 'Entrar no painel'}</h1>
      <p className="mt-1 text-slate-500 dark:text-slate-400">{cadastro ? 'Comece no plano grátis, sem cartão.' : 'Use seu e-mail ou o celular cadastrado.'}</p>

      <div className="mt-6 grid grid-cols-2 rounded-xl border border-line p-1 dark:border-night-line" role="tablist">
        {[['email', 'E-mail', Mail], ['telefone', 'Telefone', Smartphone]].map(([k, r, I]) => (
          <button key={k} type="button" role="tab" aria-selected={via === k} onClick={() => { setVia(k); setErro(''); }}
            className={`flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition ${via === k ? 'bg-brand-navy text-white dark:bg-brand-cyan dark:text-brand-navy' : 'text-slate-500'}`}><I className="h-4 w-4" />{r}</button>
        ))}
      </div>

      <div className="mt-5 space-y-3.5">
        {cadastro && (
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Campo rotulo="Seu nome" value={f.nome} onChange={set('nome')} autoComplete="name" required />
            <Campo rotulo="Empresa (opcional)" value={f.empresa} onChange={set('empresa')} autoComplete="organization" />
          </div>
        )}
        {via === 'email' ? (
          <>
            <Campo rotulo="E-mail" type="email" value={f.email} onChange={set('email')} autoComplete="email" required />
            <Campo rotulo="Senha" type="password" value={f.senha} onChange={set('senha')} autoComplete={cadastro ? 'new-password' : 'current-password'} required minLength={6} />
            {cadastro && <Campo rotulo="Confirme a senha" type="password" value={f.senha2} onChange={set('senha2')} autoComplete="new-password" required />}
            {!cadastro && <div className="text-right"><Link href="/recuperar-senha" className="inline-block text-sm font-semibold touch:py-2.5 text-[#007F98] dark:text-brand-cyan">Esqueci a senha</Link></div>}
          </>
        ) : (
          <Campo rotulo="Celular com DDD" ajuda="O código chega no seu WhatsApp.">
            <div className="flex">
              <span className="grid h-10 place-items-center rounded-l-lg border border-r-0 border-line bg-slate-50 px-3 text-sm font-semibold text-slate-500 dark:border-night-line dark:bg-night-soft">+55</span>
              <input type="tel" inputMode="tel" autoComplete="tel-national" placeholder="(85) 99999-9999" value={f.telefone} onChange={set('telefone')} className="campo rounded-l-none" required />
            </div>
          </Campo>
        )}
      </div>

      {erro && <p className="mt-3 text-sm font-medium text-rose-600" role="alert">{erro}</p>}
      <Btn variante="primario" type="submit" carregando={carregando} className="mt-5 w-full">
        {via === 'telefone' ? 'Enviar código pelo WhatsApp' : cadastro ? 'Criar conta' : 'Entrar'}
      </Btn>
      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        {cadastro ? 'Já tem conta? ' : 'Ainda não tem conta? '}
        <Link href={cadastro ? '/login' : '/cadastro'} className="inline-block font-semibold touch:py-2.5 text-[#007F98] dark:text-brand-cyan">{cadastro ? 'Entrar' : 'Criar conta grátis'}</Link>
      </p>
    </form>
  );
}
