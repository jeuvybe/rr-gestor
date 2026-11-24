'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Pencil, Trash2, Server, Check } from 'lucide-react';
import { usePainel, Titulo } from '@/components/AppShell';
import { Btn, Campo, Modal, Vazio, Carregando, useToast } from '@/components/ui';
import { supabaseBrowser } from '@/lib/supabase/client';
import { int, msgErro } from '@/lib/format';

const CORES = ['#22C55E', '#7C3AED', '#7C2D12', '#A3A3A3', '#111111', '#00B8D9', '#2563EB', '#E5484D', '#F59E0B', '#EC4899', '#14B8A6', '#0A1F3A'];

export default function Servidores() {
  const sb = supabaseBrowser();
  const { perfil } = usePainel();
  const toast = useToast();
  const [lista, setLista] = useState(null);
  const [uso, setUso] = useState({});
  const [form, setForm] = useState(null);
  const [excluir, setExcluir] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    const [s, c] = await Promise.all([
      sb.from('servers').select('*').eq('owner_id', perfil.id).order('nome'),
      sb.from('customers').select('servidor_id, status').eq('owner_id', perfil.id),
    ]);
    if (s.error) toast(msgErro(s.error), false);
    const u = {}; (c.data || []).forEach((x) => { if (x.servidor_id) { u[x.servidor_id] = u[x.servidor_id] || { t: 0, a: 0 }; u[x.servidor_id].t++; if (x.status !== 'desativado') u[x.servidor_id].a++; } });
    setLista(s.data || []); setUso(u);
  }, [sb, toast, perfil.id]);
  useEffect(() => { carregar(); }, [carregar]);

  async function salvar(e) {
    e.preventDefault(); setSalvando(true);
    const reg = { nome: form.nome.trim(), cor: form.cor };
    const { error } = form.id ? await sb.from('servers').update(reg).eq('id', form.id) : await sb.from('servers').insert(reg);
    setSalvando(false);
    if (error) return toast(msgErro(error), false);
    toast('Servidor salvo.'); setForm(null); carregar();
  }
  async function apagar() {
    const { error } = await sb.from('servers').delete().eq('id', excluir.id);
    if (error) return toast(msgErro(error), false);
    toast('Servidor excluído.'); setExcluir(null); carregar();
  }
  const novo = () => setForm({ id: null, nome: '', cor: CORES[(lista?.length || 0) % CORES.length] });

  if (!lista) return <Carregando />;
  return (
    <>
      <Titulo titulo="Servidores" sub="Cada cliente pode ficar ligado a um servidor. A cor aparece na lista de clientes e serve de filtro.">
        <Btn variante="primario" onClick={novo}><Plus className="h-4 w-4" />Novo servidor</Btn>
      </Titulo>
      {!lista.length ? (
        <div className="card"><Vazio msg="Nenhum servidor cadastrado."><Btn variante="primario" onClick={novo}><Plus className="h-4 w-4" />Cadastrar o primeiro</Btn></Vazio></div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {lista.map((s) => (
            <div key={s.id} className="card flex items-center gap-3 p-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white" style={{ background: s.cor }}><Server className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-display font-bold">{s.nome}</div>
                <Link href={`/painel/clientes`} className="inline-block text-xs text-slate-500 hover:underline touch:py-2.5">{int(uso[s.id]?.a || 0)} ativos · {int(uso[s.id]?.t || 0)} no total</Link>
              </div>
              <button aria-label="Editar" title="Editar" onClick={() => setForm({ ...s })} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-night-soft"><Pencil className="h-4 w-4" /></button>
              <button aria-label="Excluir" title="Excluir" onClick={() => setExcluir(s)} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}
      <Modal aberto={!!form} onFechar={() => setForm(null)} titulo={form?.id ? 'Editar servidor' : 'Novo servidor'}
        rodape={<><Btn onClick={() => setForm(null)}>Cancelar</Btn><Btn variante="primario" type="submit" form="form-serv" carregando={salvando}>Salvar</Btn></>}>
        {form && (
          <form id="form-serv" onSubmit={salvar} className="space-y-4">
            <Campo rotulo="Nome *" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required autoFocus placeholder="Ex.: ZEUS, UNITV, IMPERIAL" />
            <div>
              <span className="rotulo">Cor</span>
              <div className="flex flex-wrap items-center gap-2">
                {CORES.map((c) => (
                  <button type="button" key={c} onClick={() => setForm({ ...form, cor: c })} aria-label={`Cor ${c}`} className="grid h-9 w-9 place-items-center rounded-lg ring-offset-2 transition dark:ring-offset-night-card" style={{ background: c, boxShadow: form.cor === c ? '0 0 0 2px #00B8D9' : 'none' }}>
                    {form.cor === c && <Check className="h-4 w-4 text-white" />}
                  </button>
                ))}
                <label className="ml-1 flex items-center gap-2 text-xs text-slate-500">Outra<input type="color" value={form.cor} onChange={(e) => setForm({ ...form, cor: e.target.value.toUpperCase() })} className="h-9 w-12 cursor-pointer rounded border border-line bg-transparent dark:border-night-line" /></label>
              </div>
            </div>
            <div><span className="rotulo">Prévia</span><span className="inline-flex h-7 items-center rounded-md px-2.5 text-xs font-bold text-white [text-shadow:0_1px_1px_rgba(0,0,0,.35)]" style={{ background: form.cor }}>{form.nome || 'SERVIDOR'}</span></div>
          </form>
        )}
      </Modal>
      <Modal aberto={!!excluir} onFechar={() => setExcluir(null)} titulo="Excluir servidor?"
        rodape={<><Btn onClick={() => setExcluir(null)}>Cancelar</Btn><Btn variante="perigo" onClick={apagar}>Excluir</Btn></>}>
        <p className="text-sm">Os {int(uso[excluir?.id]?.t || 0)} clientes do servidor <b>{excluir?.nome}</b> continuam cadastrados, mas ficam sem servidor.</p>
      </Modal>
    </>
  );
}
