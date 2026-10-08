-- =====================================================================
-- Patrimônio Família — complementos da Fase 1
-- Rode no Supabase: SQL Editor -> New query -> Run. Seguro rodar mais de uma vez.
-- (Precisa ter rodado antes o 01_schema_fase1.sql)
-- =====================================================================

-- Função de "batida de coração": uma consulta mínima ao banco que pode ser chamada
-- sem login. Ela não lê nenhum dado seu; serve só para o projeto gratuito do Supabase
-- registrar atividade e não ser pausado por inatividade.
create or replace function public.ping()
returns int
language sql
security definer
set search_path = public
as $$
  select 1;
$$;

revoke all on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;
