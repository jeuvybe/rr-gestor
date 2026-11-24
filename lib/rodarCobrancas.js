import 'server-only';
import { supabaseAdmin } from './supabase/admin';
import { enviarTexto, estado } from './evolution';
import { hojeBR, montaMensagem } from './cobranca';
import { planejarEnvios } from './envios';

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

/** Cobrança automática do dia para todas as contas com WhatsApp conectado. */
export async function rodarCobrancas({ intervaloMs = [2500, 5000] } = {}) {
  const sb = supabaseAdmin();
  const hoje = hojeBR();
  const inicio = Date.now();
  const resumo = { hoje, contas: 0, enviados: 0, erros: 0, pulados: [] };

  const { data: instancias } = await sb.from('whatsapp_instances').select('owner_id, instance_name, status').eq('status', 'conectado');
  for (const inst of instancias || []) {
    if (Date.now() - inicio > 270_000) { resumo.pulados.push({ conta: inst.owner_id, motivo: 'tempo esgotado' }); continue; }
    const { data: perfil } = await sb.from('profiles').select('*').eq('id', inst.owner_id).single();
    if (!perfil || perfil.status === 'bloqueado') continue;
    // confere a conexão de verdade antes de enviar
    const st = await estado(inst.instance_name).catch(() => 'close');
    if (st !== 'open') {
      await sb.from('whatsapp_instances').update({ status: 'desconectado', updated_at: new Date().toISOString() }).eq('owner_id', inst.owner_id);
      resumo.pulados.push({ conta: inst.owner_id, motivo: 'WhatsApp desconectado' });
      continue;
    }
    resumo.contas++;
    const [{ data: modelos }, { data: clientes }, { data: planos }, { data: logs }, { data: servidores }] = await Promise.all([
      sb.from('message_templates').select('*').eq('owner_id', inst.owner_id),
      sb.from('customers').select('*').eq('owner_id', inst.owner_id).eq('status', 'ativo').eq('notificar', true),
      sb.from('client_plans').select('id, nome').eq('owner_id', inst.owner_id),
      sb.from('message_logs').select('customer_id, gatilho, vencimento_ref, created_at').eq('owner_id', inst.owner_id).eq('status', 'enviado').gte('created_at', new Date(Date.now() - 70 * 864e5).toISOString()),
      sb.from('servers').select('id, nome').eq('owner_id', inst.owner_id),
    ]);
    const servMap = new Map((servidores || []).map((x) => [x.id, x]));
    const jaEnviados = new Set((logs || []).map((l) => `${l.customer_id}|${l.gatilho}|${l.vencimento_ref}`));
    const contatadosHoje = new Set((logs || []).filter((l) => l.customer_id && hojeBR(new Date(l.created_at)) === hoje).map((l) => l.customer_id));
    const planoMap = new Map((planos || []).map((p) => [p.id, p]));
    const envios = planejarEnvios({ hoje, modelos: modelos || [], clientes: clientes || [], jaEnviados, contatadosHoje });
    for (const { cliente, modelo, alvo } of envios) {
      const texto = montaMensagem(modelo.texto, { cliente, plano: planoMap.get(cliente.plano_id), perfil, hoje, envio: true, servidor: servMap.get(cliente.servidor_id) });
      const log = { owner_id: inst.owner_id, customer_id: cliente.id, gatilho: modelo.gatilho, vencimento_ref: alvo, telefone: cliente.whatsapp, texto };
      try {
        await enviarTexto(inst.instance_name, cliente.whatsapp, texto);
        await sb.from('message_logs').insert({ ...log, status: 'enviado' });
        resumo.enviados++;
      } catch (e) {
        await sb.from('message_logs').insert({ ...log, status: 'erro', erro: String(e.message).slice(0, 500) });
        resumo.erros++;
      }
      await pausa(intervaloMs[0] + Math.random() * (intervaloMs[1] - intervaloMs[0])); // intervalo para não parecer disparo em massa
    }
  }
  return resumo;
}
