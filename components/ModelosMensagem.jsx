'use client';
import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Zap, MessageSquareText } from 'lucide-react';
import { Btn, Campo, Selecao, Modal, Badge, Interruptor, useToast } from '@/components/ui';
import { VARIAVEIS, hojeBR, montaMensagem } from '@/lib/cobranca';
import { addDays, msgErro } from '@/lib/format';

const TIPOS = [['cobranca', 'Cobrança'], ['recibo', 'Recibo'], ['bloqueio', 'Bloqueio'], ['outro', 'Outro']];
const TOM = { cobranca: 'ciano', recibo: 'verde', bloqueio: 'vermelho', outro: 'cinza' };

/** Modelos livres: usados no botão do plano, no FAST, no "Enviar mensagem" e no recibo */
export default function ModelosMensagem({ sb, perfil }) {
  const toast = useToast();
  const hoje = hojeBR();
  const [lista, setLista] = useState([]);
  const [form, setForm] = useState(null);
  const [excluir, setExcluir] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const carregar = useCallback(async () => {
    const { data } = await sb.from('message_models').select('*').eq('owner_id', perfil.id).order('nome');
    setLista(data || []);
  }, [sb, perfil.id]);
  useEffect(() => { carregar(); }, [carregar]);

  async function salvar(e) {
    e.preventDefault(); setSalvando(true);
    if (form.fast) await sb.from('message_models').update({ fast: false }).eq('owner_id', perfil.id).eq('fast', true);
    const reg = { nome: form.nome.trim(), tipo: form.tipo, texto: form.texto, fast: form.fast };
    const { error } = form.id ? await sb.from('message_models').update(reg).eq('id', form.id) : await sb.from('message_models').insert(reg);
    setSalvando(false);
    if (error) return toast(msgErro(error), false);
    toast('Modelo salvo.'); setForm(null); carregar();
  }
  async function apagar() {
    const { error } = await sb.from('message_models').delete().eq('id', excluir.id);
    if (error) return toast(msgErro(error), false);
    toast('Modelo excluído.'); setExcluir(null); carregar();
  }
  function inserir(v) {
    const el = document.getElementById('txt-modelo'); const p = el?.selectionStart ?? form.texto.length;
    setForm({ ...form, texto: form.texto.slice(0, p) + v + form.texto.slice(el?.selectionEnd ?? p) });
    setTimeout(() => { el?.focus(); el?.setSelectionRange(p + v.length, p + v.length); });
  }
  const exemplo = { nome: 'Thiago Moura', valor: 35, vencimento: addDays(hoje, 3), usuario: 'thiago1490', senha_area: '0.5pajs', telas: 1 };

  return (
    <section className="mb-5">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div><h2 className="font-display text-lg font-bold">Modelos de mensagem</h2><p className="text-sm text-slate-500 dark:text-slate-400">Usados no botão de WhatsApp do plano, no botão <b>FAST</b>, no recibo e em “Enviar mensagem” das Opções do cliente.</p></div>
        <Btn variante="primario" onClick={() => setForm({ id: null, nome: '', tipo: 'outro', texto: '', fast: false })}><Plus className="h-4 w-4" />Novo modelo</Btn>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {lista.map((m) => (
          <div key={m.id} className="card flex flex-col p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2"><MessageSquareText className="h-4 w-4 shrink-0 text-brand-cyan" /><span className="truncate font-semibold">{m.nome}</span></div>
              <div className="flex shrink-0 gap-1">
                <button aria-label="Editar" title="Editar" onClick={() => setForm({ ...m })} className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-night-soft"><Pencil className="h-4 w-4" /></button>
                <button aria-label="Excluir" title="Excluir" onClick={() => setExcluir(m)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="mt-1 flex gap-1"><Badge tom={TOM[m.tipo]}>{TIPOS.find((t) => t[0] === m.tipo)?.[1]}</Badge>{m.fast && <Badge tom="ambar"><Zap className="h-3 w-3" />FAST</Badge>}</div>
            <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm text-slate-500 dark:text-slate-400">{m.texto}</p>
          </div>
        ))}
      </div>
      <Modal aberto={!!form} onFechar={() => setForm(null)} titulo={form?.id ? 'Editar modelo' : 'Novo modelo'} largura="max-w-2xl"
        rodape={<><Btn onClick={() => setForm(null)}>Cancelar</Btn><Btn variante="primario" type="submit" form="form-modelo" carregando={salvando}>Salvar</Btn></>}>
        {form && (
          <form id="form-modelo" onSubmit={salvar} className="space-y-3.5">
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Campo rotulo="Nome *" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required autoFocus placeholder="Ex.: Cobranças, Recibos, BLOQUEIO" />
              <Selecao rotulo="Tipo" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} opcoes={TIPOS} />
            </div>
            <Campo rotulo="Texto *"><textarea id="txt-modelo" value={form.texto} onChange={(e) => setForm({ ...form, texto: e.target.value })} rows={8} className="campo h-auto py-2" required /></Campo>
            <div className="flex flex-wrap gap-1 touch:gap-1.5">{VARIAVEIS.map(([v, d]) => <button type="button" key={v} title={d} onClick={() => inserir(v)} className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600 hover:bg-brand-cyan/15 touch:px-2.5 touch:py-2 touch:text-xs dark:bg-night-soft dark:text-slate-300">{v}</button>)}</div>
            <Interruptor ligado={form.fast} onChange={(v) => setForm({ ...form, fast: v })} rotulo="Marcar como FAST" desc="O botão FAST da lista de clientes envia este modelo na hora. Só um modelo pode ser FAST." />
            <div className="rounded-xl bg-[#E7F8EE] p-3 text-[13px] leading-snug text-[#1F2C34] dark:bg-[#0B3B2E] dark:text-emerald-50">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide opacity-60">Pré-visualização</div>
              <div className="whitespace-pre-wrap">{montaMensagem(form.texto, { cliente: exemplo, plano: { nome: 'SERVIÇO 35-M' }, perfil, hoje, servidor: { nome: 'ZEUS' }, pagamento: { valor: 35, data: hoje } })}</div>
            </div>
          </form>
        )}
      </Modal>
      <Modal aberto={!!excluir} onFechar={() => setExcluir(null)} titulo="Excluir modelo?"
        rodape={<><Btn onClick={() => setExcluir(null)}>Cancelar</Btn><Btn variante="perigo" onClick={apagar}>Excluir</Btn></>}>
        <p className="text-sm">O modelo <b>{excluir?.nome}</b> deixa de existir. Planos que usavam este modelo passam a usar o modelo de cobrança padrão.</p>
      </Modal>
    </section>
  );
}
