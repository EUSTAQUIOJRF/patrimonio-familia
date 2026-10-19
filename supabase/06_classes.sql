-- Novos tipos de ativo: stocks, ETFs do exterior, REITs, ADRs (em dólar) e renda fixa / Tesouro Direto (em reais).
-- Rode uma vez no Supabase: SQL Editor -> New query -> colar -> Run.
alter table public.ativos drop constraint if exists ativos_classe_check;
-- o antigo "exterior" passa a se chamar "stock"
update public.ativos set classe = 'stock' where classe = 'exterior';
alter table public.ativos
  add constraint ativos_classe_check
  check (classe in ('acao','etf','bdr','fii','cripto','stock','etf_ext','reit','adr','renda_fixa','tesouro'));
