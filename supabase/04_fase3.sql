-- Fase 3: favoritos (cotações ao vivo e notícias)
-- Rode uma vez no Supabase: SQL Editor -> New query -> colar -> Run.
-- Os favoritos usam a tabela "ativos" da Fase 2 (um favorito é um ativo marcado para acompanhar).

create table if not exists public.favoritos (
  ativo_id uuid primary key references public.ativos(id) on delete cascade,
  ordem integer not null default 0,
  criado_em timestamptz not null default now()
);

alter table public.favoritos enable row level security;
drop policy if exists logados_tudo on public.favoritos;
create policy logados_tudo on public.favoritos for all to authenticated using (true) with check (true);
revoke all on public.favoritos from anon;
