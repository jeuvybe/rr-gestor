'use client';
import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Package } from 'lucide-react';
import { usePainel, Titulo } from '@/components/AppShell';
import { Btn, Campo, Modal, Vazio, Carregando, useToast } from '@/components/ui';
import { supabaseBrowser } from '@/lib/supabase/client';
import { brl, int, msgErro } from '@/lib/format';

export default function Planos() {
  const sb = supabaseBrowser();
  const toast = useToast();
  const { perfil } = usePainel();
  const [planos, setPlanos] = useState(null);
  const [uso, setUso] = useState({});
  const [form, setForm] = useState(null);
  const [excluir, setExcluir] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    const [p, c] = await Promise.all([sb.from('client_plans').select('*').eq('owner_id', perfil.id).order('valor'), sb.from('customers').select('plano_id').eq('owner_id', perfil.id).neq('status', 'desativado')]);
    if (p.error) toast(msgErro(p.error), false);
    const u = {}; (c.data || []).forEach((x) => { if (x.plano_id) u[x.plano_id] = (u[x.plano_id] || 0) + 1; });
    setPlanos(p.data || []); setUso(u);
  }, [sb, toast, perfil.id]);
  useEffect(() => { carregar(); }, [carregar]);

  async function salvar(e) {
    e.preventDefault(); setSalvando(true);
    const reg = { nome: form.nome.trim(), valor: Number(String(form.valor).replace(',', '.')) || 0, ciclo_meses: Number(form.ciclo_meses) || 1 };
    const { error } = form.id ? await sb.from('client_plans').update(reg).eq('id', form.id) : await sb.from('client_plans').insert(reg);
    setSalvando(false);
    if (error) return toast(msgErro(error), false);
    toast('Plano salvo.'); setForm(null); carregar();
  }
  async function apagar() {
    const { error } = await sb.from('client_plans').delete().eq('id', excluir.id);
    if (error) return toast(msgErro(error), false);
    toast('Plano excluído.'); setExcluir(null); carregar();
  }

  if (!planos) return <Carregando />;
  return (
    <>
      <Titulo titulo="Planos" sub="Os planos que você vende. Ao escolher um plano no cadastro do cliente, o valor e o ciclo de renovação vêm daqui.">
        <Btn variante="primario" onClick={() => setForm({ id: null, nome: '', valor: '', ciclo_meses: 1 })}><Plus className="h-4 w-4" />Novo plano</Btn>
      </Titulo>
      {!planos.length ? (
        <div className="card"><Vazio msg="Nenhum plano cadastrado."><Btn variante="primario" onClick={() => setForm({ id: null, nome: '', valor: '', ciclo_meses: 1 })}><Plus className="h-4 w-4" />Criar o primeiro plano</Btn></Vazio></div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {planos.map((p) => (
            <div key={p.id} className="card flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-cyan/10 text-brand-cyan"><Package className="h-5 w-5" /></span>
                <div className="flex gap-1">
                  <button aria-label="Editar" title="Editar" onClick={() => setForm({ ...p, valor: String(p.valor).replace('.', ',') })} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-night-soft"><Pencil className="h-4 w-4" /></button>
                  <button aria-label="Excluir" title="Excluir" onClick={() => setExcluir(p)} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="mt-3 font-display text-lg font-bold">{p.nome}</div>
              <div className="mt-1 font-display text-2xl font-bold tabular-nums">{brl(p.valor)}<span className="text-sm font-medium text-slate-500"> / {p.ciclo_meses === 1 ? 'mês' : `${p.ciclo_meses} meses`}</span></div>
              <div className="mt-auto pt-4 text-sm text-slate-500 dark:text-slate-400">{int(uso[p.id] || 0)} clientes ativos · {brl((uso[p.id] || 0) * p.valor / p.ciclo_meses)} por mês</div>
            </div>
          ))}
        </div>
      )}
      <Modal aberto={!!form} onFechar={() => setForm(null)} titulo={form?.id ? 'Editar plano' : 'Novo plano'}
        rodape={<><Btn onClick={() => setForm(null)}>Cancelar</Btn><Btn variante="primario" type="submit" form="form-plano" carregando={salvando}>Salvar</Btn></>}>
        {form && (
          <form id="form-plano" onSubmit={salvar} className="grid gap-3.5 sm:grid-cols-2">
            <Campo rotulo="Nome do plano *" className="sm:col-span-2" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required autoFocus placeholder="Ex.: Mensal, Trimestral, Premium" />
            <Campo rotulo="Valor (R$) *" inputMode="decimal" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} required placeholder="0,00" />
            <Campo rotulo="Renova a cada (meses)" type="number" min={1} max={36} value={form.ciclo_meses} onChange={(e) => setForm({ ...form, ciclo_meses: e.target.value })} ajuda="1 = mensal, 3 = trimestral, 12 = anual" />
            {form.id && <p className="text-xs text-slate-500 sm:col-span-2">Mudar o valor aqui não altera o valor de quem já está cadastrado.</p>}
          </form>
        )}
      </Modal>
      <Modal aberto={!!excluir} onFechar={() => setExcluir(null)} titulo="Excluir plano?"
        rodape={<><Btn onClick={() => setExcluir(null)}>Cancelar</Btn><Btn variante="perigo" onClick={apagar}>Excluir</Btn></>}>
        <p className="text-sm">Os clientes do plano <b>{excluir?.nome}</b> continuam cadastrados, com o mesmo valor, mas ficam "sem plano".</p>
      </Modal>
    </>
  );
}
