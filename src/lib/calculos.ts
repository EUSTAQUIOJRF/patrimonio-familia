import type { Instituicao, Pessoa, Saldo } from './tipos.ts'

/** 'hoje' converte tudo pela cotação atual; 'epoca' usa o câmbio gravado em cada lançamento. */
export type ModoCambio = 'hoje' | 'epoca'

export function taxaUsada(s: Saldo, modo: ModoCambio, hoje: number): number {
  return modo === 'hoje' ? hoje : s.cambio_usd_brl
}

export function emBRL(s: Saldo, modo: ModoCambio, hoje: number): number {
  return s.moeda === 'BRL' ? s.valor : s.valor * taxaUsada(s, modo, hoje)
}

export function emUSD(s: Saldo, modo: ModoCambio, hoje: number): number {
  return s.moeda === 'USD' ? s.valor : s.valor / taxaUsada(s, modo, hoje)
}

export interface Retrato {
  itens: Saldo[]
  /** Quantos itens vieram de meses anteriores (não foram lançados no mês pedido). */
  repetidos: number
}

/**
 * Situação do patrimônio em um mês: para cada combinação pessoa + instituição + moeda,
 * vale o último saldo lançado até aquele mês. Assim, uma conta que não foi atualizada
 * no mês mantém o valor anterior em vez de "sumir" do total.
 * `ate` e `saldo.mes` usam o formato AAAA-MM-01 (comparação de texto funciona).
 */
export function retratoAte(
  saldos: readonly Saldo[],
  ate: string,
  pessoaIds: ReadonlySet<string>,
): Retrato {
  const ultimos = new Map<string, Saldo>()
  for (const s of saldos) {
    if (!pessoaIds.has(s.pessoa_id) || s.mes > ate) continue
    const chave = `${s.pessoa_id}|${s.instituicao_id}|${s.moeda}`
    const atual = ultimos.get(chave)
    if (!atual || s.mes > atual.mes) ultimos.set(chave, s)
  }
  const itens = [...ultimos.values()]
  return { itens, repetidos: itens.filter((i) => i.mes < ate).length }
}

export interface Totais {
  brl: number
  usd: number
}

export function totais(itens: readonly Saldo[], modo: ModoCambio, hoje: number): Totais {
  let brl = 0
  let usd = 0
  for (const i of itens) {
    brl += emBRL(i, modo, hoje)
    usd += emUSD(i, modo, hoje)
  }
  return { brl, usd }
}

export interface Fatia extends Totais {
  id: string
  nome: string
  /** Participação no total em reais, de 0 a 100. */
  pct: number
}

function fatiar(grupos: Map<string, Totais & { nome: string }>): Fatia[] {
  let total = 0
  for (const g of grupos.values()) total += g.brl
  return [...grupos.entries()]
    .map(([id, g]) => ({ id, ...g, pct: total > 0 ? (g.brl / total) * 100 : 0 }))
    .sort((a, b) => b.brl - a.brl)
}

function acumular(
  grupos: Map<string, Totais & { nome: string }>,
  id: string,
  nome: string,
  s: Saldo,
  modo: ModoCambio,
  hoje: number,
) {
  const g = grupos.get(id) ?? { nome, brl: 0, usd: 0 }
  g.brl += emBRL(s, modo, hoje)
  g.usd += emUSD(s, modo, hoje)
  grupos.set(id, g)
}

export function porInstituicao(
  itens: readonly Saldo[],
  instituicoes: readonly Instituicao[],
  modo: ModoCambio,
  hoje: number,
): Fatia[] {
  const nomes = new Map(instituicoes.map((i) => [i.id, i.nome]))
  const grupos = new Map<string, Totais & { nome: string }>()
  for (const s of itens) {
    acumular(grupos, s.instituicao_id, nomes.get(s.instituicao_id) ?? '(sem nome)', s, modo, hoje)
  }
  return fatiar(grupos)
}

export function porPessoa(
  itens: readonly Saldo[],
  pessoas: readonly Pessoa[],
  modo: ModoCambio,
  hoje: number,
): Fatia[] {
  const nomes = new Map(pessoas.map((p) => [p.id, p.nome]))
  const grupos = new Map<string, Totais & { nome: string }>()
  for (const s of itens) {
    acumular(grupos, s.pessoa_id, nomes.get(s.pessoa_id) ?? '(sem nome)', s, modo, hoje)
  }
  return fatiar(grupos)
}

/** Meses com lançamentos, do mais recente para o mais antigo. */
export function listaMeses(saldos: readonly Saldo[]): string[] {
  return [...new Set(saldos.map((s) => s.mes))].sort().reverse()
}

export interface PontoMensal extends Totais {
  mes: string
}

/** Total mês a mês (do primeiro mês com dados no escopo até o último). */
export function serieMensal(
  saldos: readonly Saldo[],
  pessoaIds: ReadonlySet<string>,
  modo: ModoCambio,
  hoje: number,
): PontoMensal[] {
  const doEscopo = saldos.filter((s) => pessoaIds.has(s.pessoa_id))
  const meses = [...new Set(doEscopo.map((s) => s.mes))].sort()
  return meses.map((mes) => ({
    mes,
    ...totais(retratoAte(doEscopo, mes, pessoaIds).itens, modo, hoje),
  }))
}

/** Converte texto digitado ("1.234,56", "1234.56", "-500") em número. Retorna null se inválido. */
export function lerValor(texto: string): number | null {
  let t = texto.replace(/\s|R\$|US\$|\$/g, '')
  if (t === '') return null
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '')
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** Marcas "redondas" para os eixos de um gráfico. */
export function marcasDoEixo(min: number, max: number, quantidade = 4): number[] {
  let lo = min
  let hi = max
  if (lo === hi) {
    const d = Math.abs(lo) * 0.1 || 1
    lo -= d
    hi += d
  } else {
    const folga = (hi - lo) * 0.15
    lo -= folga
    hi += folga
  }
  const bruto = (hi - lo) / quantidade
  const mag = 10 ** Math.floor(Math.log10(bruto))
  const f = bruto / mag
  const passo = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag
  let inicio = Math.floor(lo / passo) * passo
  if (min >= 0) inicio = Math.max(0, inicio)
  const fim = Math.ceil(hi / passo) * passo
  const marcas: number[] = []
  for (let v = inicio; v <= fim + passo / 2; v += passo) marcas.push(Number(v.toPrecision(12)))
  return marcas
}
