'use client';
import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Star } from 'lucide-react';
import { Titulo } from '@/components/AppShell';
import { Btn, Campo, Modal, Badge, Carregando, Interruptor, useToast } from '@/components/ui';
import { supabaseBrowser } from '@/lib/supabase/client';
import { brl, int, msgErro } from '@/lib/format';

const NOVO = { id: null, nome: '', descricao: '', limite_clientes: '', preco: '', destaque: false, ativo: true, padrao: false, ordem: 0 };

export default function PlanosSistema() {
  const sb = supabaseBrowser();
  const toast = useToast();
  const [planos, setPlanos] = useState(null);
  const [contas, setContas] = useState({});
  const [form, setForm] = useState(null);
  const [excluir, setExcluir] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    const [p, c] = await Promise.all([sb.from('plans').select('*').order('ordem'), sb.from('profiles').select('plan_id')]);
    const n = {}; (c.data || []).forEach((x) => { n[x.plan_id] = (n[x.plan_id] || 0) + 1; });
    setPlanos(p.data || []); setContas(n);
  }, [sb]);
  useEffect(() => { carregar(); }, [carregar]);

  async function salvar(e) {
    e.preventDefault(); setSalvando(true);
    const reg = {
      nome: form.nome.trim(), descricao: form.descricao.trim() || null, limite_clientes: form.limite_clientes === '' ? null : Number(form.limite_clientes),
      preco: Number(String(form.preco).replace(',', '.')) || 0, destaque: form.destaque, ativo: form.ativo, padrao: form.padrao, ordem: Number(form.ordem) || 0,
    };
    if (reg.padrao) await sb.from('plans').update({ padrao: false }).neq('id', form.id || '00000000-0000-0000-0000-000000000000');
    const { error } = form.id ? await sb.from('plans').update(reg).eq('id', form.id) : await sb.from('plans').insert(reg);
    setSalvando(false);
    if (error) return toast(msgErro(error), false);
    toast('Plano salvo.'); setForm(null); carregar();
  }
  async function apagar() {
    const { error } = await sb.from('plans').delete().eq('id', excluir.id);
    if (error) return toast(msgErro(error), false);
    toast('Plano excluído.'); setExcluir(null); carregar();
  }

  if (!planos) return <Carregando />;
  return (
    <>
      <Titulo titulo="Planos do sistema" sub="O que os assinantes pagam para usar o RR Gestor. O limite conta só clientes ativos (desativados não entram).">
        <Btn variante="primario" onClick={() => setForm({ ...NOVO, ordem: planos.length + 1 })}><Plus className="h-4 w-4" />Novo plano</Btn>
      </Titulo>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {planos.map((p) => (
          <div key={p.id} className={`card flex flex-col p-5 ${p.ativo ? '' : 'opacity-60'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-wrap gap-1">{p.padrao && <Badge tom="ciano">Padrão no cadastro</Badge>}{p.destaque && <Badge tom="ambar"><Star className="h-3 w-3" />Destaque</Badge>}{!p.ativo && <Badge>Oculto</Badge>}</div>
              <div className="flex gap-1">
                <button aria-label="Editar" title="Editar" onClick={() => setForm({ ...p, descricao: p.descricao || '', limite_clientes: p.limite_clientes ?? '', preco: String(p.preco).replace('.', ',') })} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-night-soft"><Pencil className="h-4 w-4" /></button>
                <button aria-label="Excluir" title="Excluir" onClick={() => setExcluir(p)} disabled={p.padrao} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 dark:hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="mt-2 font-display text-xl font-bold">{p.nome}</div>
            <div className="font-display text-2xl font-bold tabular-nums">{p.preco > 0 ? brl(p.preco) : 'Grátis'}{p.preco > 0 && <span className="text-sm font-medium text-slate-500">/mês</span>}</div>
            <div className="mt-2 text-sm">{p.limite_clientes == null ? 'Clientes ilimitados' : `Até ${int(p.limite_clientes)} clientes`}</div>
            {p.descricao && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{p.descricao}</p>}
            <div className="mt-auto pt-4 text-xs text-slate-500">{int(contas[p.id] || 0)} contas neste plano</div>
          </div>
        ))}
      </div>
      <Modal aberto={!!form} onFechar={() => setForm(null)} titulo={form?.id ? 'Editar plano' : 'Novo plano'}
        rodape={<><Btn onClick={() => setForm(null)}>Cancelar</Btn><Btn variante="primario" type="submit" form="form-ps" carregando={salvando}>Salvar</Btn></>}>
        {form && (
          <form id="form-ps" onSubmit={salvar} className="grid gap-3.5 sm:grid-cols-2">
            <Campo rotulo="Nome *" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required autoFocus />
            <Campo rotulo="Preço mensal (R$)" inputMode="decimal" value={form.preco} onChange={(e) => setForm({ ...form, preco: e.target.value })} placeholder="0,00" />
            <Campo rotulo="Limite de clientes" type="number" min={0} value={form.limite_clientes} onChange={(e) => setForm({ ...form, limite_clientes: e.target.value })} ajuda="Deixe vazio para ilimitado" />
            <Campo rotulo="Ordem na lista" type="number" value={form.ordem} onChange={(e) => setForm({ ...form, ordem: e.target.value })} />
            <Campo rotulo="Descrição" className="sm:col-span-2" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            <Interruptor ligado={form.ativo} onChange={(v) => setForm({ ...form, ativo: v })} rotulo="Visível" desc="Aparece na página de preços e na conta" />
            <Interruptor ligado={form.destaque} onChange={(v) => setForm({ ...form, destaque: v })} rotulo="Destaque" desc="Marca como mais escolhido" />
            <div className="sm:col-span-2"><Interruptor ligado={form.padrao} onChange={(v) => setForm({ ...form, padrao: v })} rotulo="Plano padrão" desc="Dado a quem se cadastra e a quem deixa de pagar. Deve ser o grátis." /></div>
          </form>
        )}
      </Modal>
      <Modal aberto={!!excluir} onFechar={() => setExcluir(null)} titulo="Excluir plano?"
        rodape={<><Btn onClick={() => setExcluir(null)}>Cancelar</Btn><Btn variante="perigo" onClick={apagar}>Excluir</Btn></>}>
        <p className="text-sm">As {int(contas[excluir?.id] || 0)} contas do plano <b>{excluir?.nome}</b> passam para o plano padrão. Para só esconder o plano, edite e desligue “Visível”.</p>
      </Modal>
    </>
  );
}
