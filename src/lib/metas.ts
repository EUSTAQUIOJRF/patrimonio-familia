import type { Moeda } from './formato.ts'
import { mesesEntre, somarMeses } from './proventos.ts'

export type TipoMeta = 'patrimonio' | 'ativo'

export interface Meta {
  id: string
  tipo: TipoMeta
  nome: string | null
  /** null = a Família toda. */
  pessoa_id: string | null
  ativo_id: string | null
  alvo_valor: number | null
  alvo_quantidade: number | null
  moeda_alvo: Moeda
  /** AAAA-MM-DD ou null. */
  prazo: string | null
}

export type Situacao = 'atingida' | 'no_ritmo' | 'atrasada' | 'acompanhando' | 'sem_prazo'

export interface Avaliacao {
  atual: number
  alvo: number
  /** Progresso de 0 a 100 (limitado). */
  pct: number
  falta: number
  situacao: Situacao
  /** Meses entre o mês atual e o do prazo (0 se vencido); null sem prazo. */
  mesesRestantes: number | null
  /** Quanto precisa avançar por mês para chegar no prazo; null sem prazo ou prazo vencido. */
  aporteMensal: number | null
  /** Meses até chegar mantendo o ritmo dos últimos meses; null se não há ritmo positivo. */
  previsaoMeses: number | null
  /** Mês previsto (AAAA-MM-01) mantendo o ritmo; null se não há previsão. */
  previsaoMes: string | null
}

/** Meses do mês atual até o mês do prazo (mínimo 0). `hojeMes` = AAAA-MM-01. */
export function mesesAte(prazo: string, hojeMes: string): number {
  return Math.max(0, mesesEntre(hojeMes, `${prazo.slice(0, 7)}-01`))
}

/**
 * Ritmo médio de crescimento por mês, medido nos últimos `janela` meses da série
 * (média simples: (último - valor de `janela` meses atrás) / meses). null com menos de 2 pontos.
 */
export function ritmoMensal(serie: readonly number[], janela = 6): number | null {
  const n = serie.length
  if (n < 2) return null
  const k = Math.min(janela, n - 1)
  return (serie[n - 1] - serie[n - 1 - k]) / k
}

const LIMITE_PREVISAO = 600 // 50 anos: além disso a previsão não tem sentido

export function avaliar(
  atual: number,
  alvo: number,
  ritmo: number | null,
  prazo: string | null,
  hojeMes: string,
): Avaliacao {
  const falta = Math.max(0, alvo - atual)
  const pct = alvo > 0 ? Math.min(100, Math.max(0, (atual / alvo) * 100)) : 0
  const mesesRestantes = prazo ? mesesAte(prazo, hojeMes) : null

  let previsaoMeses: number | null = null
  if (falta > 0 && ritmo !== null && ritmo > 0) {
    const m = Math.ceil(falta / ritmo)
    if (m <= LIMITE_PREVISAO) previsaoMeses = m
  }
  const previsaoMes = previsaoMeses !== null ? somarMeses(hojeMes, previsaoMeses) : null
  const aporteMensal =
    mesesRestantes !== null && mesesRestantes > 0 && falta > 0 ? falta / mesesRestantes : null

  let situacao: Situacao
  if (falta === 0) situacao = 'atingida'
  else if (mesesRestantes === null) situacao = 'sem_prazo'
  else if (mesesRestantes === 0) situacao = 'atrasada'
  else if (ritmo === null) situacao = 'acompanhando'
  else situacao = previsaoMeses !== null && previsaoMeses <= mesesRestantes ? 'no_ritmo' : 'atrasada'

  return { atual, alvo, pct, falta, situacao, mesesRestantes, aporteMensal, previsaoMeses, previsaoMes }
}
