// Regras das mensagens de cobrança (usadas no servidor e na pré-visualização do navegador)
import { addDays, brl, fmtData, daysBetween } from './format.js';

export const GATILHOS = {
  antes: { nome: 'Antes do vencimento', curto: 'Lembrete' },
  no_dia: { nome: 'No dia do vencimento', curto: 'Vence hoje' },
  depois: { nome: 'Depois do vencimento', curto: 'Em atraso' },
};

export const VARIAVEIS = [
  ['{nome}', 'Nome completo do cliente'],
  ['{primeiro_nome}', 'Primeiro nome'],
  ['{valor}', 'Valor da mensalidade'],
  ['{vencimento}', 'Data do vencimento'],
  ['{dias}', 'Dias até/desde o vencimento'],
  ['{plano}', 'Plano do cliente'],
  ['{empresa}', 'Nome da sua empresa'],
  ['{pix}', 'Sua chave Pix'],
  ['{usuario}', 'Usuário (login) do cliente'],
  ['{senha}', 'Senha da área do cliente'],
  ['{telas}', 'Número de telas'],
  ['{servidor}', 'Servidor do cliente'],
  ['{link_area}', 'Link da área do cliente'],
  ['{valor_pago}', 'Valor do último pagamento'],
  ['{data_pagamento}', 'Data do último pagamento'],
];

/** Endereço da área do cliente da conta */
export function linkArea(perfil, origem) {
  const base = (origem || process.env.NEXT_PUBLIC_SITE_URL || (typeof location !== 'undefined' ? location.origin : '')).replace(/\/$/, '');
  return perfil?.slug ? `${base}/c/${perfil.slug}` : '';
}

/** Data de hoje no fuso de Brasília (yyyy-mm-dd). */
export function hojeBR(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** Vencimento que cada gatilho cobra hoje. */
export function vencimentoAlvo(gatilho, dias, hoje) {
  if (gatilho === 'antes') return addDays(hoje, dias);
  if (gatilho === 'depois') return addDays(hoje, -dias);
  return hoje;
}

/** Gatilho adequado para uma cobrança manual, conforme a situação do cliente. */
export function gatilhoDoCliente(vencimento, hoje) {
  if (vencimento > hoje) return 'antes';
  if (vencimento < hoje) return 'depois';
  return 'no_dia';
}

export function montaMensagem(texto, { cliente, plano, perfil, hoje, envio = false, servidor, pagamento, origem }) {
  const dias = Math.abs(daysBetween(hoje, cliente.vencimento));
  const nome = (cliente.nome || '').trim();
  const valores = {
    '{nome}': nome,
    '{primeiro_nome}': nome.split(/\s+/)[0] || nome,
    '{valor}': brl(Number(cliente.valor) || 0),
    '{vencimento}': fmtData(cliente.vencimento),
    '{dias}': String(dias),
    '{plano}': plano?.nome || 'contratado',
    '{empresa}': perfil?.empresa || perfil?.nome || '',
    '{pix}': perfil?.chave_pix || (envio ? '' : '(informe sua chave Pix em Conta)'),
    '{usuario}': cliente.usuario || '',
    '{senha}': cliente.senha_area || '',
    '{telas}': String(cliente.telas || 1),
    '{servidor}': servidor?.nome || '',
    '{link_area}': linkArea(perfil, origem),
    '{valor_pago}': pagamento ? brl(Number(pagamento.valor) || 0) : brl(Number(cliente.valor) || 0),
    '{data_pagamento}': pagamento ? fmtData(pagamento.data) : fmtData(hoje),
  };
  let base = String(texto || '');
  // sem chave Pix cadastrada, a linha da chave sai da mensagem real
  if (envio && !perfil?.chave_pix) base = base.split('\n').filter((l) => !l.includes('{pix}')).join('\n').replace(/\n{3,}/g, '\n\n');
  return base.replace(/\{[a-z_]+\}/g, (v) => (v in valores ? valores[v] : v)).trim();
}
