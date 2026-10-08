import { lerValor, retratoAte } from './calculos.ts'
import type { Moeda } from './formato.ts'
import type { Saldo } from './tipos.ts'

/** Uma linha do formulário "Lançar saldos": uma instituição em uma moeda. */
export interface Linha {
  chave: string
  instituicaoId: string
  moeda: Moeda
  /** O que está escrito no campo. */
  texto: string
  /** Id do saldo, quando já está salvo no banco. */
  saldoId: string | null
  valorOriginal: number | null
  cambioOriginal: number | null
  /** Último valor lançado em mês anterior, só como referência. */
  anterior: number | null
}

export const arred2 = (v: number) => Math.round(v * 100) / 100

export const paraTexto = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * Linhas do formulário para uma pessoa e um mês: os saldos já salvos naquele mês e,
 * em branco, as instituições que tinham saldo em meses anteriores (para lembrar de atualizar).
 */
export function montarLinhas(saldos: readonly Saldo[], pessoaId: string, mes: string): Linha[] {
  const ids = new Set([pessoaId])
  const doMes = saldos.filter((s) => s.pessoa_id === pessoaId && s.mes === mes)
  const antes = retratoAte(
    saldos.filter((s) => s.mes < mes),
    mes,
    ids,
  ).itens
  const anterior = new Map(antes.map((a) => [`${a.instituicao_id}|${a.moeda}`, a.valor]))

  const linhas: Linha[] = doMes.map((s) => ({
    chave: `${s.instituicao_id}|${s.moeda}`,
    instituicaoId: s.instituicao_id,
    moeda: s.moeda,
    texto: paraTexto(s.valor),
    saldoId: s.id,
    valorOriginal: arred2(s.valor),
    cambioOriginal: s.cambio_usd_brl,
    anterior: anterior.get(`${s.instituicao_id}|${s.moeda}`) ?? null,
  }))
  const jaTem = new Set(linhas.map((l) => l.chave))
  for (const a of antes) {
    const chave = `${a.instituicao_id}|${a.moeda}`
    if (jaTem.has(chave)) continue
    linhas.push({
      chave,
      instituicaoId: a.instituicao_id,
      moeda: a.moeda,
      texto: '',
      saldoId: null,
      valorOriginal: null,
      cambioOriginal: null,
      anterior: a.valor,
    })
  }
  return linhas
}

export interface LinhaParaSalvar {
  pessoa_id: string
  instituicao_id: string
  mes: string
  valor: number
  moeda: Moeda
  cambio_usd_brl: number
}

export type ResultadoEnvio = { envio: LinhaParaSalvar[] } | { erro: string }

/**
 * Decide o que gravar: linhas novas e linhas existentes cujo valor mudou.
 * Linhas existentes mantêm o câmbio original (a menos que `reaplicar`), campos vazios são ignorados.
 */
export function prepararEnvio(
  linhas: readonly Linha[],
  opcoes: {
    pessoaId: string
    mes: string
    cambio: number
    reaplicar: boolean
    nomeDe: (instituicaoId: string) => string
  },
): ResultadoEnvio {
  const envio: LinhaParaSalvar[] = []
  for (const l of linhas) {
    const v = lerValor(l.texto)
    if (l.texto.trim() !== '' && v === null) {
      return { erro: `Valor inválido em ${opcoes.nomeDe(l.instituicaoId)} (${l.moeda}).` }
    }
    if (v === null) continue
    const valor = arred2(v)
    if (l.saldoId && valor === l.valorOriginal && !opcoes.reaplicar) continue
    envio.push({
      pessoa_id: opcoes.pessoaId,
      instituicao_id: l.instituicaoId,
      mes: opcoes.mes,
      valor,
      moeda: l.moeda,
      cambio_usd_brl:
        l.saldoId && !opcoes.reaplicar ? (l.cambioOriginal ?? opcoes.cambio) : opcoes.cambio,
    })
  }
  return { envio }
}
