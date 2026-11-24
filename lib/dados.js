'use client';
import { hojeBR } from './cobranca';

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Busca todas as linhas, de 1000 em 1000 (limite padrão do Supabase). */
export async function buscarTudo(fazerQuery) {
  const passo = 1000; let de = 0; const tudo = [];
  for (;;) {
    const { data, error } = await fazerQuery().range(de, de + passo - 1);
    if (error) throw error;
    tudo.push(...data);
    if (data.length < passo) break;
    de += passo;
  }
  return tudo;
}

export const dataBR = (ts) => hojeBR(new Date(ts));

export function statusCliente(c, hoje) {
  if (c.status === 'desativado') return 'Desativado';
  if (c.vencimento < hoje) return 'Inadimplente';
  return 'Ativo';
}

/** Clientes, planos e movimentações no formato usado pelo dashboard. */
export async function carregarBase(sb, dono) {
  const hoje = hojeBR();
  const [clientes, planos, movs] = await Promise.all([
    buscarTudo(() => sb.from('customers').select('*').eq('owner_id', dono).order('created_at')),
    buscarTudo(() => sb.from('client_plans').select('*').eq('owner_id', dono).order('nome')),
    buscarTudo(() => sb.from('transactions').select('*').eq('owner_id', dono).order('data', { ascending: false }).order('created_at', { ascending: false })),
  ]);
  const planoNome = new Map(planos.map((p) => [p.id, p.nome]));
  const cliMap = new Map();
  const cl = clientes.map((c) => {
    const o = {
      id: c.id, nome: c.nome, whatsapp: c.whatsapp, plano: planoNome.get(c.plano_id) || 'Sem plano',
      status: statusCliente(c, hoje), cidade: c.cidade || 'Não informada', cadastro: dataBR(c.created_at), vencimento: c.vencimento, valor: Number(c.valor) || 0,
    };
    cliMap.set(c.id, o); return o;
  });
  const mv = movs.map((m) => {
    const c = m.customer_id ? cliMap.get(m.customer_id) : null;
    return {
      id: m.id, data: m.data, tipo: m.tipo === 'gasto' ? 'Gasto' : 'Ganho', categoria: m.categoria || 'Outros', descricao: m.descricao || '',
      valor: Number(m.valor) || 0, cliente: c?.nome || '', clienteId: m.customer_id || '', plano: c && c.plano !== 'Sem plano' ? c.plano : '',
      forma: m.forma || 'Não informado', status: cap(m.status) || 'Confirmado',
    };
  });
  return { clientes: cl, movs: mv, ref: hoje, brutos: { clientes, planos, movs } };
}
