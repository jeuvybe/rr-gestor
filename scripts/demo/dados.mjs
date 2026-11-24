// Dados de exemplo do modo demonstração (fictícios, gerados com datas relativas a hoje)

export const USUARIOS_DEMO = {
  admin: { id: '11111111-1111-4111-8111-111111111111', email: 'admin@demo.com', nome: 'Rafael Rocha', empresa: 'RR Tecnologia' },
  assinante: { id: '22222222-2222-4222-8222-222222222222', email: 'assinante@demo.com', nome: 'Beatriz Alves', empresa: 'Bia Net Provedor' },
};

function rng(seed) {
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hojeBR = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const dia = (base, n) => { const d = new Date(base + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const mes = (base, n) => { const d = new Date(base + 'T12:00:00Z'); const dd = d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n); const ult = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(); d.setUTCDate(Math.min(dd, ult)); return d.toISOString().slice(0, 10); };

const NOMES = ['Ana', 'Bruno', 'Carla', 'Diego', 'Eduarda', 'Felipe', 'Gabriela', 'Heitor', 'Isabela', 'João', 'Karina', 'Lucas', 'Mariana', 'Nicolas', 'Olívia', 'Pedro', 'Rafaela', 'Samuel', 'Tatiane', 'Vinícius', 'Yasmin', 'Leonardo', 'Beatriz', 'Gustavo', 'Larissa', 'Thiago', 'Camila', 'Rodrigo', 'Juliana', 'Matheus'];
const SOBRENOMES = ['Almeida', 'Barbosa', 'Cardoso', 'Duarte', 'Ferreira', 'Gomes', 'Lima', 'Machado', 'Nogueira', 'Oliveira', 'Pereira', 'Ribeiro', 'Santos', 'Teixeira', 'Vieira', 'Moura', 'Rocha', 'Costa'];
const CIDADES = ['Fortaleza', 'Caucaia', 'Maracanaú', 'Eusébio', 'Aquiraz'];

export async function semear(db) {
  const r = rng(2026);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const hoje = hojeBR();
  const q = (sql, p) => db.query(sql, p);
  const planos = Object.fromEntries((await q('select id, nome from public.plans')).rows.map((p) => [p.nome, p.id]));

  // ---- contas
  const contas = [
    { ...USUARIOS_DEMO.admin, plano: 'Ilimitado', expira: null },
    { ...USUARIOS_DEMO.assinante, plano: 'Profissional', expira: dia(hoje, 18), pix: 'pix@bianet.com.br', clientes: 38, meses: 9 },
    { id: '33333333-3333-4333-8333-333333333333', email: 'carlos@techfix.com', nome: 'Carlos Menezes', empresa: 'TechFix Assistência', plano: 'Grátis', expira: null, clientes: 5, meses: 2 },
    { id: '44444444-4444-4444-8444-444444444444', email: 'julia@studiojs.com', nome: 'Júlia Sampaio', empresa: 'Studio JS Pilates', plano: 'Profissional', expira: dia(hoje, 4), clientes: 22, meses: 5 },
    { id: '55555555-5555-4555-8555-555555555555', email: 'marcos@netmais.com', nome: 'Marcos Lopes', empresa: 'NetMais Fibra', plano: 'Ilimitado', expira: dia(hoje, 41), clientes: 64, meses: 7 },
    { id: '66666666-6666-4666-8666-666666666666', email: 'paula@contabil.com', nome: 'Paula Ferraz', empresa: 'Ferraz Contabilidade', plano: 'Profissional', expira: dia(hoje, -6), clientes: 12, meses: 4 },
    { id: '77777777-7777-4777-8777-777777777777', email: 'andre@academia.com', nome: 'André Brito', empresa: 'Academia Força Total', plano: 'Grátis', expira: null, clientes: 3, meses: 1, bloqueado: true },
  ];
  for (const c of contas) {
    await q(`insert into auth.users (id, email, raw_user_meta_data, created_at) values ($1, $2, $3, now() - make_interval(days => $4))`, [c.id, c.email, JSON.stringify({ nome: c.nome, empresa: c.empresa }), Math.round((c.meses || 10) * 30 + 5)]);
    // durante a carga o plano é ilimitado; o plano real é aplicado no fim (senão o limite barra a carga)
    await q(`update public.profiles set plan_id = $2, chave_pix = $3, is_admin = $4, created_at = now() - make_interval(days => $5) where id = $1`,
      [c.id, planos['Ilimitado'], c.pix || null, c.id === USUARIOS_DEMO.admin.id, Math.round((c.meses || 10) * 30 + 5)]);
    if (c.plano !== 'Grátis' && c.expira) {
      await q(`insert into public.subscription_payments (profile_id, plan_id, valor, meses, pago_em, valido_ate, obs) values ($1, $2, (select preco from public.plans where id = $2), 1, least($3::date - 30, public.hoje_br()), $3, 'Pix')`, [c.id, planos[c.plano], c.expira]);
    }
    if (!c.clientes) continue;

    // ---- planos próprios do assinante
    const meus = [];
    for (const [nome, valor, ciclo] of [['Mensal', 99.9, 1], ['Premium', 149.9, 1], ['Trimestral', 269.9, 3]]) {
      meus.push((await q(`insert into public.client_plans (owner_id, nome, valor, ciclo_meses) values ($1, $2, $3, $4) returning *`, [c.id, nome, valor, ciclo])).rows[0]);
    }
    // ---- clientes e pagamentos
    for (let i = 0; i < c.clientes; i++) {
      const pl = r() < 0.55 ? meus[0] : r() < 0.7 ? meus[1] : meus[2];
      const nome = `${pick(NOMES)} ${pick(SOBRENOMES)}`;
      const diasCad = Math.floor(10 + Math.sqrt(r()) * c.meses * 30);
      const cadastro = dia(hoje, -diasCad);
      const x = r();
      const desativado = x < 0.08;
      // vencimentos espalhados: alguns atrasados, alguns hoje, a maioria no futuro
      let venc = x < 0.2 ? dia(hoje, -Math.floor(1 + r() * 20)) : x < 0.27 ? hoje : dia(hoje, Math.floor(1 + r() * 30 * pl.ciclo_meses));
      if (i < 2) venc = hoje;
      if (i === 2) venc = dia(hoje, 3);
      const tel = `55859${String(8000 + Math.floor(r() * 1999)).padStart(4, '0')}${String(Math.floor(r() * 10000)).padStart(4, '0')}`;
      const cli = (await q(`insert into public.customers (owner_id, nome, whatsapp, email, cidade, plano_id, valor, vencimento, status, notificar, created_at)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::date + time '10:00') returning id`,
        [c.id, nome, tel, r() < 0.5 ? `${nome.split(' ')[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}@email.com` : null, pick(CIDADES), pl.id, pl.valor, venc,
          desativado ? 'desativado' : 'ativo', r() > 0.07, cadastro])).rows[0];
      // histórico de mensalidades pagas desde o cadastro até o último vencimento passado
      let v = venc; const pagos = [];
      while (true) { v = mes(v, -pl.ciclo_meses); if (v < cadastro) break; pagos.push(v); }
      for (const d of pagos) {
        if (desativado && d > dia(hoje, -45)) continue;
        const data = dia(d, Math.floor(r() * 3) - 1);
        if (data > hoje) continue;
        await q(`insert into public.transactions (owner_id, customer_id, tipo, categoria, descricao, valor, data, forma, status) values ($1, $2, 'ganho', 'Mensalidade', $3, $4, $5, $6, $7)`,
          [c.id, cli.id, `Mensalidade ${pl.nome} — ${nome}`, pl.valor, data, pick(['Pix', 'Pix', 'Pix', 'Cartão de crédito', 'Boleto', 'Dinheiro']), r() < 0.03 ? 'recusado' : 'confirmado']);
      }
    }
    // ---- gastos mensais e serviços avulsos
    for (let m = 0; m <= c.meses; m++) {
      const base = mes(hoje.slice(0, 8) + '01', -m);
      const lanc = [
        ['gasto', 'Pessoal', 'Ajudante técnico', 700 + c.clientes * 12, 5],
        ['gasto', 'Infraestrutura', 'Internet, servidores e energia', 380 + r() * 220, 10],
        ['gasto', 'Software', 'Licenças e sistemas', 90 + r() * 60, 12],
        ['gasto', 'Marketing', pick(['Anúncios Instagram', 'Anúncios Google', 'Panfletos']), 150 + r() * 350, 14 + Math.floor(r() * 10)],
        ['gasto', 'Impostos', 'DAS Simples Nacional', 60 + c.clientes * 4, 20],
        ['ganho', 'Serviço avulso', pick(['Instalação', 'Visita técnica', 'Configuração de equipamento']), 80 + Math.round(r() * 220), 3 + Math.floor(r() * 24)],
      ];
      for (const [tipo, categoria, descricao, valor, d] of lanc) {
        const data = dia(base, d - 1);
        if (data > hoje) continue;
        await q(`insert into public.transactions (owner_id, tipo, categoria, descricao, valor, data, forma, status) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [c.id, tipo, categoria, descricao, Math.round(valor * 100) / 100, data, tipo === 'gasto' ? pick(['Pix', 'Cartão de crédito', 'Boleto']) : 'Pix', data > dia(hoje, -3) && tipo === 'gasto' ? 'pendente' : 'confirmado']);
      }
    }
  }
  for (const c of contas) {
    await q(`update public.profiles set plan_id = $2, plano_expira_em = $3, status = $4 where id = $1`, [c.id, planos[c.plano], c.expira, c.bloqueado ? 'bloqueado' : 'ativo']);
  }
  // WhatsApp de duas contas já "conectado" (o do assinante demo fica desconectado para você testar o QR Code)
  for (const id of ['44444444-4444-4444-8444-444444444444', '55555555-5555-4555-8555-555555555555']) {
    await q(`insert into public.whatsapp_instances (owner_id, instance_name, status, numero) values ($1, $2, 'conectado', '5585900001111')`, [id, `rr_${id.replace(/-/g, '').slice(0, 20)}`]);
  }
}
