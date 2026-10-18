import type { Moeda } from './formato.ts'

export interface Pessoa {
  id: string
  nome: string
  entra_na_familia: boolean
  ordem: number
}

export type TipoInstituicao = 'banco' | 'corretora' | 'exchange' | 'outro'

export interface Instituicao {
  id: string
  nome: string
  tipo: TipoInstituicao
  pais: string
  ativa: boolean
}

/** Saldo de uma pessoa em uma instituição, em um mês (sempre o dia 1, formato AAAA-MM-01). */
export interface Saldo {
  id: string
  pessoa_id: string
  instituicao_id: string
  mes: string
  valor: number
  moeda: Moeda
  /** Dólar (R$ por US$ 1) no dia do lançamento. */
  cambio_usd_brl: number
  observacao: string | null
}

export type ClasseAtivo = 'acao' | 'etf' | 'bdr' | 'fii' | 'cripto' | 'exterior'

export interface Ativo {
  id: string
  ticker: string
  nome: string | null
  classe: ClasseAtivo
  moeda: Moeda
  /** Código usado para buscar o preço (ex.: PETR4.SA, AAPL, BTC-USD). */
  simbolo_cotacao: string
  ativo: boolean
}

export interface Posicao {
  id: string
  pessoa_id: string
  ativo_id: string
  quantidade: number
  /** Preço médio pago, na moeda do ativo. */
  preco_medio: number
}

export interface Cotacao {
  ativo_id: string
  /** AAAA-MM-DD */
  data: string
  preco: number
  fonte: string
}

export type TipoProvento = 'dividendo' | 'jcp' | 'rendimento' | 'outro'

export interface Provento {
  id: string
  pessoa_id: string
  ativo_id: string
  /** Mês do recebimento (AAAA-MM-01). */
  mes: string
  tipo: TipoProvento
  /** Valor líquido recebido, na moeda indicada. */
  valor: number
  moeda: Moeda
  /** Dólar (R$ por US$ 1) no momento do lançamento. */
  cambio_usd_brl: number
  observacao: string | null
}

/** Ativo marcado como favorito (acompanhado na tela Favoritos). */
export interface Favorito {
  ativo_id: string
  ordem: number
}
