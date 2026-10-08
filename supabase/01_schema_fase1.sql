-- =====================================================================
-- Patrimônio Família — Esquema da Fase 0/1
-- Cole este arquivo inteiro no Supabase: SQL Editor -> New query -> Run.
-- É seguro rodar mais de uma vez (usa IF NOT EXISTS / DROP POLICY IF EXISTS).
-- =====================================================================

-- ---------- Função utilitária: atualiza updated_at ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- Pessoas (você, esposa, filho, filha) ----------
create table if not exists public.pessoas (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null,
  entra_na_familia boolean not null default true,  -- false = só monitoramento (fora da soma)
  ordem            int not null default 0,
  created_at       timestamptz not null default now()
);

-- ---------- Instituições (bancos, corretoras, exchanges) ----------
create table if not exists public.instituicoes (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  tipo       text not null default 'banco'
             check (tipo in ('banco', 'corretora', 'exchange', 'outro')),
  pais       text not null default 'BR',
  ativa      boolean not null default true,
  created_at timestamptz not null default now(),
  unique (nome)
);

-- ---------- Saldos: um "retrato" mensal por pessoa, instituição e moeda ----------
create table if not exists public.saldos (
  id              uuid primary key default gen_random_uuid(),
  pessoa_id       uuid not null references public.pessoas(id) on delete cascade,
  instituicao_id  uuid not null references public.instituicoes(id) on delete restrict,
  mes             date not null check (extract(day from mes) = 1),  -- sempre dia 1 do mês
  valor           numeric(18, 2) not null,
  moeda           text not null check (moeda in ('BRL', 'USD')),
  cambio_usd_brl  numeric(12, 4) not null check (cambio_usd_brl > 0), -- dólar no dia do lançamento
  observacao      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (pessoa_id, instituicao_id, mes, moeda)
);

create index if not exists saldos_mes_idx on public.saldos (mes desc);
create index if not exists saldos_pessoa_idx on public.saldos (pessoa_id);

drop trigger if exists saldos_updated_at on public.saldos;
create trigger saldos_updated_at
  before update on public.saldos
  for each row execute function public.set_updated_at();

-- ---------- Câmbio: histórico do dólar (BRL por 1 USD) ----------
create table if not exists public.cambio (
  data       date primary key,
  taxa       numeric(12, 4) not null check (taxa > 0),
  fonte      text,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- SEGURANÇA (RLS)
-- Regra: só usuários LOGADOS acessam, e logados veem tudo de todos.
-- IMPORTANTE: no painel do Supabase, desative o cadastro público
-- (Authentication -> Sign In / Providers -> desligue "Allow new users to sign up"),
-- assim só existem as duas contas que você criar.
-- =====================================================================
alter table public.pessoas       enable row level security;
alter table public.instituicoes  enable row level security;
alter table public.saldos        enable row level security;
alter table public.cambio        enable row level security;

drop policy if exists "logados_tudo" on public.pessoas;
create policy "logados_tudo" on public.pessoas
  for all to authenticated using (true) with check (true);

drop policy if exists "logados_tudo" on public.instituicoes;
create policy "logados_tudo" on public.instituicoes
  for all to authenticated using (true) with check (true);

drop policy if exists "logados_tudo" on public.saldos;
create policy "logados_tudo" on public.saldos
  for all to authenticated using (true) with check (true);

drop policy if exists "logados_tudo" on public.cambio;
create policy "logados_tudo" on public.cambio
  for all to authenticated using (true) with check (true);

-- Nenhum acesso para visitantes não logados (role "anon"):
revoke all on public.pessoas, public.instituicoes, public.saldos, public.cambio from anon;

-- =====================================================================
-- DADOS INICIAIS
-- Os nomes são provisórios: você pode renomear depois no app ou aqui.
-- =====================================================================
insert into public.pessoas (nome, entra_na_familia, ordem)
select v.nome, v.entra, v.ordem
from (values
  ('Eu',     true,  1),
  ('Esposa', true,  2),
  ('Filho',  true,  3),
  ('Filha',  false, 4)   -- só monitoramento, fora da soma da Família
) as v(nome, entra, ordem)
where not exists (select 1 from public.pessoas);
