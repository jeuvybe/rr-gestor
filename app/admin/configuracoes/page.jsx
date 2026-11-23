'use client';
import { useEffect, useState } from 'react';
import { Save, MessageCircle, CheckCircle2, Circle, Play } from 'lucide-react';
import { Titulo } from '@/components/AppShell';
import ConexaoWhatsApp from '@/components/ConexaoWhatsApp';
import { Btn, Campo, Carregando, useToast } from '@/components/ui';
import { supabaseBrowser } from '@/lib/supabase/client';
import { msgErro } from '@/lib/format';

export default function Configuracoes() {
  const sb = supabaseBrowser();
  const toast = useToast();
  const [cfg, setCfg] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [waSistema, setWaSistema] = useState('');
  const [rodando, setRodando] = useState(false);
  const [resumo, setResumo] = useState(null);
  async function rodar() {
    setRodando(true); setResumo(null);
    const r = await fetch('/api/admin/rodar-cobrancas', { method: 'POST' });
    const j = await r.json().catch(() => ({}));
    setRodando(false);
    if (!r.ok) return toast(j.erro || 'Falha ao rodar as cobranças.', false);
    setResumo(j); toast(`${j.enviados} mensagens enviadas.`);
  }
  useEffect(() => { sb.from('app_settings').select('*').single().then(({ data }) => setCfg(data)); }, [sb]);

  async function salvar(e) {
    e.preventDefault(); setSalvando(true);
    const { error } = await sb.from('app_settings').update({ nome_sistema: cfg.nome_sistema, pix_chave: cfg.pix_chave || null, instrucoes_pagamento: cfg.instrucoes_pagamento, whatsapp_suporte: (cfg.whatsapp_suporte || '').replace(/\D/g, '') || null, updated_at: new Date().toISOString() }).eq('id', 1);
    setSalvando(false);
    toast(error ? msgErro(error) : 'Configurações salvas.', !error);
  }
  if (!cfg) return <Carregando />;
  const passos = [
    ['Dados de pagamento preenchidos', !!cfg.pix_chave && !!cfg.whatsapp_suporte],
    ['WhatsApp do sistema conectado (códigos de login por telefone)', waSistema === 'conectado'],
  ];
  return (
    <>
      <Titulo titulo="Configurações" sub="Como os assinantes pagam e o WhatsApp que envia os códigos de login." />
      <div className="grid gap-5 xl:grid-cols-2">
        <form onSubmit={salvar} className="card space-y-3.5 p-5">
          <h2 className="font-display text-base font-semibold">Pagamento das assinaturas</h2>
          <Campo rotulo="Chave Pix para receber as assinaturas" value={cfg.pix_chave || ''} onChange={(e) => setCfg({ ...cfg, pix_chave: e.target.value })} />
          <Campo rotulo="WhatsApp do suporte (com DDD)" value={cfg.whatsapp_suporte || ''} onChange={(e) => setCfg({ ...cfg, whatsapp_suporte: e.target.value })} placeholder="5585999999999" ajuda="Recebe os comprovantes. Use DDI + DDD + número." />
          <Campo rotulo="Instruções mostradas ao assinar"><textarea rows={4} value={cfg.instrucoes_pagamento || ''} onChange={(e) => setCfg({ ...cfg, instrucoes_pagamento: e.target.value })} className="campo h-auto py-2" /></Campo>
          <Btn variante="primario" type="submit" carregando={salvando}><Save className="h-4 w-4" />Salvar</Btn>
        </form>
        <div className="space-y-5">
          <section className="card p-5">
            <h2 className="mb-4 flex items-center gap-2 font-display text-base font-semibold"><MessageCircle className="h-4 w-4 text-brand-cyan" />WhatsApp do sistema</h2>
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Este número envia o código de 6 dígitos de quem entra ou se cadastra pelo telefone. Use um número da RR, separado do WhatsApp de cobranças.</p>
            <ConexaoWhatsApp escopo="sistema" aoMudar={setWaSistema} />
          </section>
          <section className="card p-5">
            <h2 className="mb-3 font-display text-base font-semibold">Checklist</h2>
            <ul className="space-y-2 text-sm">{passos.map(([t, ok]) => <li key={t} className="flex items-center gap-2">{ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4 text-slate-400" />}{t}</li>)}</ul>
            <div className="mt-4 border-t border-line pt-4 dark:border-night-line">
              <div className="text-sm font-semibold">Cobranças automáticas</div>
              <p className="mt-1 text-xs text-slate-500">Rodam sozinhas todo dia às 9h. Use o botão para rodar agora (não repete quem já foi cobrado hoje).</p>
              <Btn className="mt-3" onClick={rodar} carregando={rodando}><Play className="h-4 w-4" />Rodar cobranças agora</Btn>
              {resumo && <p className="mt-2 text-sm">{resumo.contas} {resumo.contas === 1 ? 'conta' : 'contas'} com WhatsApp conectado · <b>{resumo.enviados} {resumo.enviados === 1 ? 'mensagem enviada' : 'mensagens enviadas'}</b> · {resumo.erros} {resumo.erros === 1 ? 'erro' : 'erros'}{resumo.pulados?.length ? ` · ${resumo.pulados.length} ${resumo.pulados.length === 1 ? 'conta pulada' : 'contas puladas'} (${[...new Set(resumo.pulados.map((p) => p.motivo))].join(', ')})` : ''}</p>}
            </div>
            <p className="mt-3 text-xs text-slate-500">Login por telefone, cron de cobranças e variáveis de ambiente: veja o README do repositório.</p>
          </section>
        </div>
      </div>
    </>
  );
}
