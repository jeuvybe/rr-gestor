import { exigirLogin, json, falha } from '@/lib/servidor';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { nomeInstancia, conectarOuQr, estado, detalhes, desconectar, enviarTexto } from '@/lib/evolution';
import { normalizaTelefone } from '@/lib/format';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAPA = { open: 'conectado', connecting: 'conectando', close: 'desconectado' };

async function contexto(req) {
  const sistema = new URL(req.url).searchParams.get('escopo') === 'sistema';
  const s = await exigirLogin({ admin: sistema });
  if (s.resposta) return s;
  const instancia = sistema ? process.env.EVOLUTION_SYSTEM_INSTANCE || 'rr-sistema' : nomeInstancia(s.user.id);
  const gravar = async (status, numero) => {
    if (sistema) return;
    await supabaseAdmin().from('whatsapp_instances').upsert({ owner_id: s.user.id, instance_name: instancia, status, numero: numero ?? null, updated_at: new Date().toISOString() });
  };
  return { ...s, sistema, instancia, gravar };
}

async function lerEstado(instancia) {
  try { return await estado(instancia); } catch (e) { if (e.status === 404) return 'close'; throw e; }
}

export async function GET(req, { params }) {
  const { acao } = await params;
  if (acao !== 'status') return falha('Ação inválida', 404);
  const c = await contexto(req); if (c.resposta) return c.resposta;
  try {
    const st = await lerEstado(c.instancia);
    let numero = null, perfil = null;
    if (st === 'open') ({ numero, perfil } = await detalhes(c.instancia).catch(() => ({})));
    await c.gravar(MAPA[st] || 'desconectado', numero);
    return json({ status: MAPA[st] || 'desconectado', numero, perfil });
  } catch (e) {
    return falha(`Servidor do WhatsApp indisponível: ${e.message}`, 502);
  }
}

export async function POST(req, { params }) {
  const { acao } = await params;
  const c = await contexto(req); if (c.resposta) return c.resposta;
  try {
    if (acao === 'conectar') {
      if (c.perfil.status === 'bloqueado' && !c.sistema) return falha('Conta bloqueada.', 403);
      const r = await conectarOuQr(c.instancia);
      await c.gravar(r.estado === 'open' ? 'conectado' : 'conectando');
      return json({ status: r.estado === 'open' ? 'conectado' : 'conectando', qr: r.qr, codigo: r.codigo || null });
    }
    if (acao === 'desconectar') {
      await desconectar(c.instancia).catch((e) => { if (e.status !== 404) throw e; });
      await c.gravar('desconectado');
      return json({ status: 'desconectado' });
    }
    if (acao === 'teste') {
      const { telefone, texto } = await req.json();
      const numero = normalizaTelefone(telefone);
      if (numero.length < 10) return falha('Telefone inválido.');
      await enviarTexto(c.instancia, numero, texto || 'Teste de envio do RR Gestor ✅');
      if (!c.sistema) await supabaseAdmin().from('message_logs').insert({ owner_id: c.user.id, gatilho: 'teste', telefone: numero, texto: texto || 'Teste', status: 'enviado' });
      return json({ ok: true });
    }
    return falha('Ação inválida', 404);
  } catch (e) {
    return falha(e.message || 'Falha no servidor do WhatsApp', 502);
  }
}
