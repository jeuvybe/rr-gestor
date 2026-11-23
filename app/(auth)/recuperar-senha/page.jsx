'use client';
import { useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase/client';
import { msgErro } from '@/lib/format';
import { Btn, Campo } from '@/components/ui';

export default function Page() {
  const [email, setEmail] = useState('');
  const [ok, setOk] = useState(false);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  async function enviar(e) {
    e.preventDefault(); setCarregando(true); setErro('');
    const { error } = await supabaseBrowser().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/auth/callback?next=/redefinir-senha` });
    setCarregando(false);
    if (error) setErro(msgErro(error)); else setOk(true);
  }
  return ok ? (
    <div><h1 className="font-display text-2xl font-bold">Verifique seu e-mail</h1><p className="mt-2 text-slate-500 dark:text-slate-400">Se existir uma conta com <b>{email}</b>, você vai receber um link para criar uma nova senha.</p><Link href="/login" className="mt-6 inline-block text-sm font-semibold text-[#007F98] dark:text-brand-cyan">Voltar ao login</Link></div>
  ) : (
    <form onSubmit={enviar}>
      <h1 className="font-display text-[28px] font-bold">Recuperar senha</h1>
      <p className="mt-1 text-slate-500 dark:text-slate-400">Informe o e-mail da conta. Quem entra por telefone não usa senha: é só pedir um novo código no login.</p>
      <Campo rotulo="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-6" />
      {erro && <p className="mt-3 text-sm font-medium text-rose-600">{erro}</p>}
      <Btn variante="primario" type="submit" carregando={carregando} className="mt-5 w-full">Enviar link</Btn>
      <Link href="/login" className="mt-5 block text-center text-sm font-semibold text-slate-500">Voltar ao login</Link>
    </form>
  );
}
