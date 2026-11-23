// Planejamento das cobranças automáticas (função pura, testável)
import { vencimentoAlvo } from './cobranca.js';

/**
 * Decide quem recebe mensagem hoje.
 * modelos: [{gatilho, dias, texto, ativo}]
 * clientes: [{id, vencimento, status, notificar, ...}]
 * jaEnviados: Set de `${customer_id}|${gatilho}|${vencimento_ref}`
 */
export function planejarEnvios({ hoje, modelos, clientes, jaEnviados = new Set(), contatadosHoje = new Set() }) {
  const envios = [];
  const ocupados = new Set(contatadosHoje); // quem já recebeu mensagem hoje (ex.: cobrança manual)
  // ordem: atraso > dia > lembrete, e um cliente recebe no máximo 1 mensagem por dia
  const ordem = { depois: 0, no_dia: 1, antes: 2 };
  for (const m of [...modelos].filter((x) => x.ativo).sort((a, b) => ordem[a.gatilho] - ordem[b.gatilho])) {
    const alvo = vencimentoAlvo(m.gatilho, m.dias, hoje);
    if (m.gatilho === 'antes' && m.dias === 0) continue; // "0 dias antes" seria o mesmo que no dia
    for (const c of clientes) {
      if (c.status === 'desativado' || !c.notificar || c.vencimento !== alvo) continue;
      if (ocupados.has(c.id) || jaEnviados.has(`${c.id}|${m.gatilho}|${alvo}`)) continue;
      ocupados.add(c.id);
      envios.push({ cliente: c, modelo: m, alvo });
    }
  }
  return envios;
}
