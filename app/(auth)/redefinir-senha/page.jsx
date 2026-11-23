'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { msgErro } from '@/lib/format';
import { Btn, Campo } from '@/components/ui';

export default function Page() {
  const router = useRouter();
  const [s, setS] = useState({ a: '', b: '' });
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  async function salvar(e) {
    e.preventDefault(); setErro('');
    if (s.a.length < 6) return setErro('A senha precisa ter pelo menos 6 caracteres.');
    if (s.a !== s.b) return setErro('As senhas não conferem.');
    setCarregando(true);
    const { error } = await supabaseBrowser().auth.updateUser({ password: s.a });
    setCarregando(false);
    if (error) return setErro(msgErro(error));
    router.replace('/painel'); router.refresh();
  }
  return (
    <form onSubmit={salvar}>
      <h1 className="font-display text-[28px] font-bold">Nova senha</h1>
      <div className="mt-6 space-y-3.5">
        <Campo rotulo="Nova senha" type="password" autoComplete="new-password" value={s.a} onChange={(e) => setS({ ...s, a: e.target.value })} required />
        <Campo rotulo="Confirme a nova senha" type="password" autoComplete="new-password" value={s.b} onChange={(e) => setS({ ...s, b: e.target.value })} required />
      </div>
      {erro && <p className="mt-3 text-sm font-medium text-rose-600">{erro}</p>}
      <Btn variante="primario" type="submit" carregando={carregando} className="mt-5 w-full">Salvar e entrar</Btn>
    </form>
  );
}
