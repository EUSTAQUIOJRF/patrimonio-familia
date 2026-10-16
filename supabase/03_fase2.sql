-- Fase 2: ativos, posições, cotações e proventos
-- Rode uma vez no Supabase: SQL Editor -> New query -> colar -> Run.

-- Cadastro de ativos (um por ticker, compartilhado entre as pessoas)
create table if not exists public.ativos (
  id uuid primary key default gen_random_uuid(),
  ticker text not null unique,
  nome text,
  classe text not null check (classe in ('acao','etf','bdr','fii','cripto','exterior')),
  moeda text not null check (moeda in ('BRL','USD')),
  -- código usado para buscar o preço (ex.: PETR4.SA, AAPL, BTC-USD)
  simbolo_cotacao text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- Quanto cada pessoa tem de cada ativo
create table if not exists public.posicoes (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references public.pessoas(id) on delete cascade,
  ativo_id uuid not null references public.ativos(id) on delete cascade,
  quantidade numeric(24,8) not null check (quantidade >= 0),
  preco_medio numeric(18,6) not null default 0 check (preco_medio >= 0), -- na moeda do ativo
  updated_at timestamptz not null default now(),
  unique (pessoa_id, ativo_id)
);

-- Um preço por ativo por dia (a rotina noturna grava aqui; também aceita preço manual)
create table if not exists public.cotacoes (
  ativo_id uuid not null references public.ativos(id) on delete cascade,
  data date not null,
  preco numeric(18,6) not null check (preco >= 0),
  fonte text not null default 'yahoo',
  primary key (ativo_id, data)
);

-- Proventos recebidos (digitados à mão)
create table if not exists public.proventos (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references public.pessoas(id) on delete cascade,
  ativo_id uuid not null references public.ativos(id) on delete cascade,
  mes date not null check (extract(day from mes) = 1),
  tipo text not null check (tipo in ('dividendo','jcp','rendimento','outro')),
  valor numeric(18,2) not null check (valor >= 0), -- valor líquido recebido
  moeda text not null check (moeda in ('BRL','USD')),
  cambio_usd_brl numeric(12,6) not null check (cambio_usd_brl > 0),
  observacao text,
  criado_em timestamptz not null default now()
);
create index if not exists proventos_mes_idx on public.proventos (mes);
create index if not exists posicoes_pessoa_idx on public.posicoes (pessoa_id);

-- Último preço de cada ativo (a view respeita as regras de acesso de quem consulta)
create or replace view public.cotacoes_ultimas
with (security_invoker = true) as
select distinct on (ativo_id) ativo_id, data, preco, fonte
from public.cotacoes
order by ativo_id, data desc;

-- Segurança: só usuários logados, como nas outras tabelas
alter table public.ativos enable row level security;
alter table public.posicoes enable row level security;
alter table public.cotacoes enable row level security;
alter table public.proventos enable row level security;

drop policy if exists logados_tudo on public.ativos;
drop policy if exists logados_tudo on public.posicoes;
drop policy if exists logados_tudo on public.cotacoes;
drop policy if exists logados_tudo on public.proventos;
create policy logados_tudo on public.ativos for all to authenticated using (true) with check (true);
create policy logados_tudo on public.posicoes for all to authenticated using (true) with check (true);
create policy logados_tudo on public.cotacoes for all to authenticated using (true) with check (true);
create policy logados_tudo on public.proventos for all to authenticated using (true) with check (true);

revoke all on public.ativos, public.posicoes, public.cotacoes, public.proventos from anon;
revoke all on public.cotacoes_ultimas from anon;
grant select on public.cotacoes_ultimas to authenticated;

-- Atualiza updated_at nas posições (função criada na Fase 1 para os saldos, se existir)
create or replace function public.tocar_updated_at_posicoes() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
drop trigger if exists posicoes_updated_at on public.posicoes;
create trigger posicoes_updated_at before update on public.posicoes
for each row execute function public.tocar_updated_at_posicoes();
