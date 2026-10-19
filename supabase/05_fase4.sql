-- Fase 4: metas de patrimônio e de ativos
-- Rode uma vez no Supabase: SQL Editor -> New query -> colar -> Run.

create table if not exists public.metas (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('patrimonio','ativo')),
  nome text,
  -- de quem é a meta; vazio (null) = a Família toda
  pessoa_id uuid references public.pessoas(id) on delete cascade,
  -- só nas metas de ativo
  ativo_id uuid references public.ativos(id) on delete cascade,
  alvo_valor numeric(20,2) check (alvo_valor > 0),
  alvo_quantidade numeric(24,8) check (alvo_quantidade > 0),
  moeda_alvo text not null default 'BRL' check (moeda_alvo in ('BRL','USD')),
  prazo date,
  criado_em timestamptz not null default now(),
  check (
    (tipo = 'patrimonio' and alvo_valor is not null)
    or (tipo = 'ativo' and ativo_id is not null and (alvo_valor is not null or alvo_quantidade is not null))
  )
);

alter table public.metas enable row level security;
drop policy if exists logados_tudo on public.metas;
create policy logados_tudo on public.metas for all to authenticated using (true) with check (true);
revoke all on public.metas from anon;
