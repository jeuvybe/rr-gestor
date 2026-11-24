-- =====================================================================
-- RR Gestor — 0002: servidores, campos extras do cliente, modelos de
-- mensagem (com FAST e modelo por plano), alerta e área do cliente.
-- Rode no SQL Editor do Supabase DEPOIS do 0001.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Servidores (com cor, para identificar o cliente na lista)
-- ---------------------------------------------------------------------
create table public.servers (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  nome       text not null,
  cor        text not null default '#00B8D9' check (cor ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now()
);
create index on public.servers (owner_id);
alter table public.servers enable row level security;
create policy dono on public.servers for all using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------
-- Campos extras do cliente
-- ---------------------------------------------------------------------
alter table public.customers
  add column usuario     text,                                    -- login do cliente
  add column senha_area  text,                                    -- senha da área do cliente
  add column mac         text,                                    -- MAC ou ID externo
  add column telas       int not null default 1 check (telas between 1 and 20),
  add column servidor_id uuid references public.servers (id) on delete set null,
  add column alerta      text;                                    -- aviso destacado no cadastro
create index on public.customers (owner_id, lower(usuario));

-- ---------------------------------------------------------------------
-- Modelos de mensagem livres (BLOQUEIO, Cobranças, Recibos…)
-- ---------------------------------------------------------------------
create table public.message_models (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  nome       text not null,
  texto      text not null,
  tipo       text not null default 'outro' check (tipo in ('cobranca', 'recibo', 'bloqueio', 'outro')),
  fast       boolean not null default false,                      -- botão FAST da lista de clientes
  created_at timestamptz not null default now()
);
create index on public.message_models (owner_id);
create unique index message_models_um_fast on public.message_models (owner_id) where fast;
alter table public.message_models enable row level security;
create policy dono on public.message_models for all using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());

-- modelo de mensagem do plano (botão de WhatsApp da lista de clientes)
alter table public.client_plans add column modelo_id uuid references public.message_models (id) on delete set null;

-- histórico aceita os novos tipos de envio
alter table public.message_logs drop constraint if exists message_logs_gatilho_check;
alter table public.message_logs add constraint message_logs_gatilho_check
  check (gatilho in ('antes', 'no_dia', 'depois', 'manual', 'teste', 'modelo', 'recibo'));

-- ---------------------------------------------------------------------
-- Endereço da área do cliente de cada conta: /c/<slug>
-- ---------------------------------------------------------------------
alter table public.profiles add column slug text unique;

create or replace function public.gera_slug(base text) returns text
language plpgsql volatile as $$
declare s text;
begin
  s := lower(translate(coalesce(nullif(base, ''), 'conta'), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ', 'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn'));
  s := trim(both '-' from regexp_replace(s, '[^a-z0-9]+', '-', 'g'));
  s := left(s, 30);
  return s || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 4);
end $$;

update public.profiles set slug = public.gera_slug(coalesce(empresa, nome)) where slug is null;

-- novos perfis: slug + modelos de mensagem padrão
create or replace function public.perfil_criado() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.slug is null then
    update public.profiles set slug = public.gera_slug(coalesce(new.empresa, new.nome)) where id = new.id;
  end if;
  perform public.cria_modelos_padrao(new.id);
  return new;
end $$;

create or replace function public.cria_modelos_padrao(uid uuid) returns void
language sql security definer set search_path = public as $$
  insert into public.message_models (owner_id, nome, tipo, fast, texto)
  select uid, m.nome, m.tipo, m.fast, m.texto from (values
    ('Cobranças', 'cobranca', true, E'Olá, {primeiro_nome}! 👋\n\nSua mensalidade do plano *{plano}* ({valor}) vence em {vencimento}.\n\nChave Pix: {pix}\n\nAcesse sua área do cliente: {link_area}\n{empresa}'),
    ('Recibos', 'recibo', false, E'Olá, {primeiro_nome}! ✅\n\nRecebemos seu pagamento de *{valor_pago}* em {data_pagamento}.\nPlano: {plano} · {telas} tela(s)\nPróximo vencimento: *{vencimento}*.\n\nObrigado!\n{empresa}'),
    ('BLOQUEIO', 'bloqueio', false, E'Olá, {primeiro_nome}. Seu acesso (usuário *{usuario}*) foi *bloqueado* por falta de pagamento da mensalidade vencida em {vencimento}.\n\nPara liberar, faça o Pix de {valor} na chave {pix} e envie o comprovante por aqui.\n{empresa}')
  ) as m(nome, tipo, fast, texto)
  where not exists (select 1 from public.message_models x where x.owner_id = uid);
$$;

create trigger perfil_criado after insert on public.profiles
  for each row execute function public.perfil_criado();

-- contas que já existem também ganham os modelos padrão
select public.cria_modelos_padrao(id) from public.profiles;

-- ---------------------------------------------------------------------
-- Área do cliente: o cliente entra com usuário (ou WhatsApp) + senha.
-- Função pública, mas só devolve dados com a senha certa.
-- ---------------------------------------------------------------------
create or replace function public.area_cliente_entrar(p_slug text, p_login text, p_senha text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare p public.profiles; c public.customers; digitos text;
begin
  if coalesce(p_senha, '') = '' or coalesce(p_login, '') = '' then return null; end if;
  select * into p from public.profiles where slug = p_slug and status = 'ativo';
  if not found then return null; end if;
  digitos := regexp_replace(p_login, '\D', '', 'g');
  select * into c from public.customers
   where owner_id = p.id and senha_area = p_senha and status = 'ativo'
     and (lower(usuario) = lower(trim(p_login))
          or (length(digitos) >= 10 and (whatsapp = digitos or whatsapp = '55' || digitos)))
   limit 1;
  if not found then return null; end if;
  return jsonb_build_object(
    'cliente', jsonb_build_object(
      'nome', c.nome, 'usuario', c.usuario, 'vencimento', c.vencimento, 'valor', c.valor, 'telas', c.telas,
      'plano', (select nome from public.client_plans where id = c.plano_id),
      'servidor', (select nome from public.servers where id = c.servidor_id),
      'dias', c.vencimento - public.hoje_br()),
    'empresa', jsonb_build_object(
      'nome', coalesce(p.empresa, p.nome), 'pix', p.chave_pix,
      'whatsapp', coalesce((select numero from public.whatsapp_instances w where w.owner_id = p.id and w.status = 'conectado'), p.telefone)),
    'faturas', coalesce((
      select jsonb_agg(jsonb_build_object('data', t.data, 'valor', t.valor, 'forma', t.forma, 'descricao', t.descricao) order by t.data desc)
      from (select * from public.transactions t where t.customer_id = c.id and t.tipo = 'ganho' and t.status = 'confirmado' order by t.data desc limit 24) t
    ), '[]'::jsonb)
  );
end $$;

-- nome da empresa na tela de login da área do cliente (sem dados sensíveis)
create or replace function public.area_cliente_empresa(p_slug text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('nome', coalesce(empresa, nome)) from public.profiles where slug = p_slug and status = 'ativo'
$$;

grant execute on function public.area_cliente_entrar(text, text, text), public.area_cliente_empresa(text) to anon, authenticated;
