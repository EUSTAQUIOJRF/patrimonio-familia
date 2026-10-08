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
