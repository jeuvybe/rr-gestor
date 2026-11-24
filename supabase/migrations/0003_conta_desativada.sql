-- =====================================================================
-- Conta desativada não consulta nada
-- Quando o administrador desativa um assinante (profiles.status = 'bloqueado'),
-- ele deixa de ler e de alterar os próprios dados. Só continuam visíveis o
-- perfil, os planos, as configurações de pagamento e o histórico da assinatura,
-- que a tela de renovação usa. O administrador continua vendo tudo.
-- =====================================================================

create or replace function public.conta_liberada() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select status <> 'bloqueado' or is_admin from public.profiles where id = auth.uid()), false)
$$;
grant execute on function public.conta_liberada() to authenticated;

drop policy if exists dono on public.client_plans;
drop policy if exists dono on public.customers;
drop policy if exists dono on public.transactions;
drop policy if exists dono on public.message_templates;
drop policy if exists dono on public.servers;
drop policy if exists dono on public.message_models;
drop policy if exists ler  on public.whatsapp_instances;
drop policy if exists ler  on public.message_logs;

create policy dono on public.client_plans      for all using ((owner_id = auth.uid() and public.conta_liberada()) or public.is_admin()) with check ((owner_id = auth.uid() and public.conta_liberada()) or public.is_admin());
create policy dono on public.customers         for all using ((owner_id = auth.uid() and public.conta_liberada()) or public.is_admin()) with check ((owner_id = auth.uid() and public.conta_liberada()) or public.is_admin());
create policy dono on public.transactions      for all using ((owner_id = auth.uid() and public.conta_liberada()) or public.is_admin()) with check ((owner_id = auth.uid() and public.conta_liberada()) or public.is_admin());
create policy dono on public.message_templates for all using ((owner_id = auth.uid() and public.conta_liberada()) or public.is_admin()) with check ((owner_id = auth.uid() and public.conta_liberada()) or public.is_admin());
create policy dono on public.servers           for all using ((owner_id = auth.uid() and public.conta_liberada()) or public.is_admin()) with check ((owner_id = auth.uid() and public.conta_liberada()) or public.is_admin());
create policy dono on public.message_models    for all using ((owner_id = auth.uid() and public.conta_liberada()) or public.is_admin()) with check ((owner_id = auth.uid() and public.conta_liberada()) or public.is_admin());
create policy ler  on public.whatsapp_instances for select using ((owner_id = auth.uid() and public.conta_liberada()) or public.is_admin());
create policy ler  on public.message_logs       for select using ((owner_id = auth.uid() and public.conta_liberada()) or public.is_admin());
