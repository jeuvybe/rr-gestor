import { exigirLogin, json, falha } from '@/lib/servidor';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { enviarTexto, nomeInstancia } from '@/lib/evolution';
import { gatilhoDoCliente, hojeBR } from '@/lib/cobranca';

export const runtime = 'nodejs';

// Envio manual de cobrança para um cliente
export async function POST(req) {
  const s = await exigirLogin(); if (s.resposta) return s.resposta;
  if (s.perfil.status === 'bloqueado') return falha('Conta bloqueada.', 403);
  const { customerId, texto } = await req.json().catch(() => ({}));
  if (!customerId || !String(texto || '').trim()) return falha('Mensagem vazia.');
  const { data: cliente } = await s.sb.from('customers').select('*').eq('id', customerId).eq('owner_id', s.user.id).single();
  if (!cliente) return falha('Cliente não encontrado.', 404);
  const { data: inst } = await s.sb.from('whatsapp_instances').select('*').eq('owner_id', s.user.id).maybeSingle();
  if (inst?.status !== 'conectado') return falha('Conecte seu WhatsApp na página WhatsApp antes de enviar.', 409);
  const log = { owner_id: s.user.id, customer_id: cliente.id, gatilho: 'manual', vencimento_ref: cliente.vencimento, telefone: cliente.whatsapp, texto };
  try {
    await enviarTexto(inst.instance_name || nomeInstancia(s.user.id), cliente.whatsapp, texto);
    await supabaseAdmin().from('message_logs').insert({ ...log, status: 'enviado' });
    return json({ ok: true, gatilho: gatilhoDoCliente(cliente.vencimento, hojeBR()) });
  } catch (e) {
    await supabaseAdmin().from('message_logs').insert({ ...log, status: 'erro', erro: e.message });
    return falha(`Não foi possível enviar: ${e.message}`, 502);
  }
}
