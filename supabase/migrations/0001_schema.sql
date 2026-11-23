-- =====================================================================
-- RR Gestor — esquema do banco (Supabase / Postgres)
-- Rode este arquivo inteiro no SQL Editor do Supabase (uma vez).
-- =====================================================================


-- ---------------------------------------------------------------------
-- Planos do sistema (o que o ASSINANTE paga para usar o painel)
-- ---------------------------------------------------------------------
create table public.plans (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null,
  descricao       text,
  limite_clientes int check (limite_clientes is null or limite_clientes >= 0), -- null = ilimitado
  preco           numeric(10,2) not null default 0 check (preco >= 0),
  destaque        boolean not null default false,
  ativo           boolean not null default true,
  padrao          boolean not null default false, -- plano dado a quem se cadastra (e para quem o plano pago venceu)
  ordem           int not null default 0,
  created_at      timestamptz not null default now()
);
create unique index plans_um_padrao on public.plans (padrao) where padrao;

insert into public.plans (nome, descricao, limite_clientes, preco, padrao, destaque, ordem) values
  ('Grátis',       'Para começar a organizar suas cobranças', 5,    0,     true,  false, 1),
  ('Profissional', 'Para quem já tem uma carteira formada',   50,   29.90, false, true,  2),
  ('Ilimitado',    'Sem limite de clientes',                  null, 89.90, false, false, 3);

-- ---------------------------------------------------------------------
-- Configurações gerais (linha única)
-- ---------------------------------------------------------------------
create table public.app_settings (
  id                   int primary key default 1 check (id = 1),
  nome_sistema         text not null default 'RR Gestor',
  pix_chave            text,
  instrucoes_pagamento text default 'Faça o Pix com o valor do plano e envie o comprovante pelo WhatsApp do suporte. A liberação é feita em até 1 dia útil.',
  whatsapp_suporte     text,
  updated_at           timestamptz not null default now()
);
insert into public.app_settings (id) values (1);

-- ---------------------------------------------------------------------
-- Contas (assinantes). 1 usuário = 1 conta.
-- ---------------------------------------------------------------------
create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  nome             text,
  empresa          text,
  email            text,
  telefone         text,
  chave_pix        text,          -- usada na variável {pix} das mensagens de cobrança
  plan_id          uuid references public.plans (id) on delete set null,
  plano_expira_em  date,          -- null = sem vencimento (ex.: plano grátis)
  status           text not null default 'ativo' check (status in ('ativo', 'bloqueado')),
  is_admin         boolean not null default false,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Planos que o assinante vende para os clientes dele
-- ---------------------------------------------------------------------
create table public.client_plans (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  nome        text not null,
  valor       numeric(10,2) not null default 0 check (valor >= 0),
  ciclo_meses int not null default 1 check (ciclo_meses between 1 and 36),
  created_at  timestamptz not null default now()
);
create index on public.client_plans (owner_id);

-- ---------------------------------------------------------------------
-- Clientes do assinante
-- ---------------------------------------------------------------------
create table public.customers (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  nome        text not null,
  whatsapp    text not null,                 -- só dígitos, com DDI (ex.: 5585999999999)
  email       text,
  cidade      text,
  plano_id    uuid references public.client_plans (id) on delete set null,
  valor       numeric(10,2) not null default 0 check (valor >= 0),
  vencimento  date not null,
  status      text not null default 'ativo' check (status in ('ativo', 'desativado')),
  notificar   boolean not null default true,
  notas       text,
  created_at  timestamptz not null default now()
);
create index on public.customers (owner_id, vencimento);

-- ---------------------------------------------------------------------
-- Movimentações financeiras (ganhos e gastos)
-- ---------------------------------------------------------------------
create table public.transactions (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  tipo        text not null check (tipo in ('ganho', 'gasto')),
  categoria   text not null default 'Outros',
  descricao   text,
  valor       numeric(12,2) not null check (valor > 0),
  data        date not null default (now() at time zone 'America/Sao_Paulo')::date,
  forma       text not null default 'Pix',
  status      text not null default 'confirmado' check (status in ('confirmado', 'pendente', 'recusado')),
  created_at  timestamptz not null default now()
);
create index on public.transactions (owner_id, data);

-- ---------------------------------------------------------------------
-- WhatsApp: instância (Evolution API) de cada assinante
-- ---------------------------------------------------------------------
create table public.whatsapp_instances (
  owner_id      uuid primary key references public.profiles (id) on delete cascade,
  instance_name text not null unique,
  status        text not null default 'desconectado' check (status in ('desconectado', 'conectando', 'conectado')),
  numero        text,
  updated_at    timestamptz not null default now()
);

-- Modelos de mensagem de cobrança (3 gatilhos por conta)
create table public.message_templates (
  id        uuid primary key default gen_random_uuid(),
  owner_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  gatilho   text not null check (gatilho in ('antes', 'no_dia', 'depois')),
  dias      int not null default 0 check (dias between 0 and 60),
  texto     text not null,
  ativo     boolean not null default true,
  unique (owner_id, gatilho)
);

-- Histórico de envios
create table public.message_logs (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.profiles (id) on delete cascade,
  customer_id    uuid references public.customers (id) on delete cascade,
  gatilho        text not null check (gatilho in ('antes', 'no_dia', 'depois', 'manual', 'teste')),
  vencimento_ref date,
  telefone       text,
  texto          text,
  status         text not null check (status in ('enviado', 'erro')),
  erro           text,
  created_at     timestamptz not null default now()
);
create index on public.message_logs (owner_id, created_at desc);
-- impede cobrança automática duplicada do mesmo vencimento
create unique index message_logs_sem_duplicar on public.message_logs (customer_id, gatilho, vencimento_ref)
  where status = 'enviado' and gatilho in ('antes', 'no_dia', 'depois');

-- Pagamentos de assinatura registrados pelo administrador
create table public.subscription_payments (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  plan_id     uuid references public.plans (id) on delete set null,
  valor       numeric(10,2) not null default 0,
  meses       int not null default 1 check (meses between 1 and 36),
  pago_em     date not null default (now() at time zone 'America/Sao_Paulo')::date,
  valido_ate  date,
  obs         text,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);
create index on public.subscription_payments (profile_id, pago_em desc);

-- =====================================================================
-- Funções
-- =====================================================================
create or replace function public.hoje_br() returns date
language sql stable as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

-- plano válido hoje: se o plano pago venceu (ou não há plano), vale o plano padrão (grátis)
create or replace function public.plano_efetivo(uid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select case
           when p.plan_id is null or (p.plano_expira_em is not null and p.plano_expira_em < public.hoje_br())
             then (select id from public.plans where padrao limit 1)
           else p.plan_id
         end
  from public.profiles p where p.id = uid
$$;

create or replace function public.plano_limite(uid uuid) returns int
language sql stable security definer set search_path = public as $$
  select limite_clientes from public.plans where id = public.plano_efetivo(uid)
$$;

-- uso do plano para a conta logada
create or replace function public.meu_uso() returns table (
  plano_id uuid, plano_nome text, limite int, usados int, expira_em date, vencido boolean, status text
)
language sql stable security definer set search_path = public as $$
  select pl.id, pl.nome, pl.limite_clientes,
         (select count(*)::int from public.customers c where c.owner_id = p.id and c.status <> 'desativado'),
         p.plano_expira_em,
         (p.plano_expira_em is not null and p.plano_expira_em < public.hoje_br()),
         p.status
  from public.profiles p
  left join public.plans pl on pl.id = public.plano_efetivo(p.id)
  where p.id = auth.uid()
$$;

-- novo usuário -> cria conta, plano padrão e modelos de mensagem.
-- O PRIMEIRO cadastro do sistema vira administrador.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare primeiro boolean;
begin
  select not exists (select 1 from public.profiles) into primeiro;
  insert into public.profiles (id, nome, empresa, email, telefone, plan_id, is_admin)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'nome', ''),
    nullif(new.raw_user_meta_data ->> 'empresa', ''),
    new.email,
    nullif(new.phone, ''),
    (select id from public.plans where padrao limit 1),
    primeiro
  );
  insert into public.message_templates (owner_id, gatilho, dias, texto) values
    (new.id, 'antes', 3, E'Olá, {primeiro_nome}! 👋\n\nPassando para lembrar que sua mensalidade do plano *{plano}*, no valor de *{valor}*, vence em {dias} dias ({vencimento}).\n\nChave Pix: {pix}\n\nQualquer dúvida, é só responder esta mensagem.\n{empresa}'),
    (new.id, 'no_dia', 0, E'Olá, {primeiro_nome}! Sua mensalidade de *{valor}* vence *hoje* ({vencimento}).\n\nChave Pix: {pix}\n\nSe já pagou, pode desconsiderar. Obrigado!\n{empresa}'),
    (new.id, 'depois', 2, E'Olá, {primeiro_nome}. Identificamos que a mensalidade de *{valor}*, vencida em {vencimento}, ainda está em aberto.\n\nChave Pix: {pix}\n\nPara evitar a suspensão do serviço, regularize assim que possível. Se já pagou, envie o comprovante por aqui.\n{empresa}');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- mantém e-mail/telefone do perfil em dia quando o login muda
create or replace function public.sync_user_contacts() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set email = coalesce(new.email, email), telefone = coalesce(nullif(new.phone, ''), telefone) where id = new.id;
  return new;
end $$;
create trigger on_auth_user_updated
  after update of email, phone on auth.users
  for each row execute function public.sync_user_contacts();

-- assinante não pode mudar o próprio plano, vencimento, status ou virar admin
create or replace function public.protege_perfil() returns trigger
language plpgsql as $$
begin
  if current_user = 'authenticated' and not public.is_admin() then
    new.plan_id := old.plan_id;
    new.plano_expira_em := old.plano_expira_em;
    new.status := old.status;
    new.is_admin := old.is_admin;
  end if;
  return new;
end $$;
create trigger protege_perfil before update on public.profiles
  for each row execute function public.protege_perfil();

-- limite de clientes do plano + conta bloqueada
create or replace function public.checa_limite_clientes() returns trigger
language plpgsql security definer set search_path = public as $$
declare lim int; total int; st text;
begin
  if tg_op = 'UPDATE' and not (old.status = 'desativado' and new.status <> 'desativado') then
    return new;
  end if;
  if new.status = 'desativado' then return new; end if;
  select status into st from public.profiles where id = new.owner_id;
  if st = 'bloqueado' then
    raise exception 'CONTA_BLOQUEADA' using hint = 'Sua conta está bloqueada. Fale com o suporte.';
  end if;
  lim := public.plano_limite(new.owner_id);
  if lim is not null then
    select count(*) into total from public.customers
      where owner_id = new.owner_id and status <> 'desativado' and id <> new.id;
    if total >= lim then
      raise exception 'LIMITE_PLANO' using hint = format('Seu plano permite %s clientes ativos. Faça upgrade para cadastrar mais.', lim);
    end if;
  end if;
  return new;
end $$;
create trigger checa_limite_clientes before insert or update of status on public.customers
  for each row execute function public.checa_limite_clientes();

-- registrar pagamento de um cliente: lança o ganho e avança o vencimento
create or replace function public.registrar_pagamento(
  p_customer uuid, p_valor numeric, p_forma text default 'Pix', p_data date default null, p_avancar boolean default true
) returns date
language plpgsql security invoker set search_path = public as $$
declare c public.customers; ciclo int; novo date; nome_plano text;
begin
  select * into c from public.customers where id = p_customer;
  if not found then raise exception 'Cliente não encontrado'; end if;
  select coalesce(cp.ciclo_meses, 1), cp.nome into ciclo, nome_plano from public.client_plans cp where cp.id = c.plano_id;
  ciclo := coalesce(ciclo, 1);
  insert into public.transactions (owner_id, customer_id, tipo, categoria, descricao, valor, data, forma, status)
  values (c.owner_id, c.id, 'ganho', 'Mensalidade',
          'Mensalidade ' || coalesce(nome_plano, '') || ' — ' || c.nome, p_valor, coalesce(p_data, public.hoje_br()), coalesce(p_forma, 'Pix'), 'confirmado');
  novo := c.vencimento;
  if p_avancar then
    novo := (c.vencimento + make_interval(months => ciclo))::date;
    update public.customers set vencimento = novo where id = c.id;
  end if;
  return novo;
end $$;

-- ---------------------------------------------------------------------
-- Funções do administrador
-- ---------------------------------------------------------------------
create or replace function public.admin_contas() returns table (
  id uuid, nome text, empresa text, email text, telefone text, plan_id uuid, plano_nome text, plano_efetivo_nome text,
  limite int, preco numeric, plano_expira_em date, status text, is_admin boolean, created_at timestamptz,
  clientes int, whatsapp text, ultimo_pagamento date
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  return query
  select p.id, p.nome, p.empresa, p.email, p.telefone, p.plan_id, pl.nome, pe.nome, pe.limite_clientes, pl.preco,
         p.plano_expira_em, p.status, p.is_admin, p.created_at,
         (select count(*)::int from public.customers c where c.owner_id = p.id and c.status <> 'desativado'),
         coalesce(w.status, 'desconectado'),
         (select max(sp.pago_em) from public.subscription_payments sp where sp.profile_id = p.id)
  from public.profiles p
  left join public.plans pl on pl.id = p.plan_id
  left join public.plans pe on pe.id = public.plano_efetivo(p.id)
  left join public.whatsapp_instances w on w.owner_id = p.id
  order by p.created_at desc;
end $$;

-- registra pagamento de assinatura: troca o plano e estende a validade
create or replace function public.admin_registrar_assinatura(
  p_profile uuid, p_plan uuid, p_meses int, p_valor numeric, p_obs text default null
) returns date
language plpgsql security definer set search_path = public as $$
declare base date; ate date;
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  select greatest(coalesce(plano_expira_em, public.hoje_br()), public.hoje_br()) into base from public.profiles where id = p_profile;
  -- trocando de plano: a validade conta a partir de hoje
  if (select plan_id from public.profiles where id = p_profile) is distinct from p_plan then base := public.hoje_br(); end if;
  ate := (base + make_interval(months => p_meses))::date;
  update public.profiles set plan_id = p_plan, plano_expira_em = ate, status = 'ativo' where id = p_profile;
  insert into public.subscription_payments (profile_id, plan_id, valor, meses, valido_ate, obs)
  values (p_profile, p_plan, coalesce(p_valor, 0), p_meses, ate, p_obs);
  return ate;
end $$;

-- =====================================================================
-- Segurança (RLS)
-- =====================================================================
alter table public.plans                 enable row level security;
alter table public.app_settings          enable row level security;
alter table public.profiles              enable row level security;
alter table public.client_plans          enable row level security;
alter table public.customers             enable row level security;
alter table public.transactions          enable row level security;
alter table public.whatsapp_instances    enable row level security;
alter table public.message_templates     enable row level security;
alter table public.message_logs          enable row level security;
alter table public.subscription_payments enable row level security;

-- planos: todos leem os ativos (página de preços); admin gerencia
create policy plans_ler   on public.plans for select using (ativo or public.is_admin());
create policy plans_admin on public.plans for all using (public.is_admin()) with check (public.is_admin());

create policy settings_ler   on public.app_settings for select using (true);
create policy settings_admin on public.app_settings for update using (public.is_admin()) with check (public.is_admin());

create policy profiles_ler    on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy profiles_editar on public.profiles for update using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
create policy profiles_apagar on public.profiles for delete using (public.is_admin());

-- tabelas do assinante: cada um vê só o que é seu; admin vê tudo
create policy dono on public.client_plans      for all using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());
create policy dono on public.customers         for all using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());
create policy dono on public.transactions      for all using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());
create policy dono on public.message_templates for all using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());

-- só leitura para o assinante; quem grava é o servidor (service role)
create policy ler on public.whatsapp_instances    for select using (owner_id = auth.uid() or public.is_admin());
create policy ler on public.message_logs          for select using (owner_id = auth.uid() or public.is_admin());
create policy ler on public.subscription_payments for select using (profile_id = auth.uid() or public.is_admin());

grant execute on function public.meu_uso(), public.registrar_pagamento(uuid, numeric, text, date, boolean),
  public.admin_contas(), public.admin_registrar_assinatura(uuid, uuid, int, numeric, text), public.is_admin() to authenticated;
