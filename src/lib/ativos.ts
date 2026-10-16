import type { Fatia, Totais } from './calculos.ts'
import type { Ativo, ClasseAtivo, Cotacao, Posicao } from './tipos.ts'
import type { Moeda } from './formato.ts'

export const CLASSES: ClasseAtivo[] = ['acao', 'fii', 'etf', 'bdr', 'exterior', 'cripto']

export const ROTULO_CLASSE: Record<ClasseAtivo, string> = {
  acao: 'Ações',
  fii: 'FIIs',
  etf: 'ETFs',
  bdr: 'BDRs',
  exterior: 'Exterior (EUA)',
  cripto: 'Cripto',
}

export const ROTULO_CLASSE_UM: Record<ClasseAtivo, string> = {
  acao: 'Ação',
  fii: 'FII',
  etf: 'ETF',
  bdr: 'BDR',
  exterior: 'Exterior',
  cripto: 'Cripto',
}

/** Moeda mais provável de cada classe. */
export function moedaPadrao(classe: ClasseAtivo): Moeda {
  return classe === 'exterior' || classe === 'cripto' ? 'USD' : 'BRL'
}

/** Código de busca de preço (estilo Yahoo Finance) a partir do ticker e da classe. */
export function simboloPadrao(ticker: string, classe: ClasseAtivo): string {
  const t = ticker.trim().toUpperCase()
  if (classe === 'cripto') return t.includes('-') ? t : `${t}-USD`
  if (classe === 'exterior') return t
  return t.endsWith('.SA') ? t : `${t}.SA`
}

export interface LinhaCarteira {
  ativoId: string
  ticker: string
  nome: string | null
  classe: ClasseAtivo
  moeda: Moeda
  quantidade: number
  /** Preço médio ponderado (moeda do ativo). */
  precoMedio: number
  /** Último preço conhecido (moeda do ativo) ou null. */
  preco: number | null
  dataPreco: string | null
  /** Quanto foi pago (moeda do ativo). */
  custo: number
  /** Valor atual (moeda do ativo). Sem preço, usa o custo e marca semPreco. */
  valor: number
  semPreco: boolean
  /** Resultado = valor - custo (moeda do ativo); null sem preço. */
  resultado: number | null
  resultadoPct: number | null
  brl: number
  usd: number
  custoBrl: number
  custoUsd: number
}

function converter(v: number, moeda: Moeda, taxa: number): Totais {
  return moeda === 'BRL' ? { brl: v, usd: v / taxa } : { brl: v * taxa, usd: v }
}

export interface Carteira {
  linhas: LinhaCarteira[]
  total: Totais
  custo: Totais
  /** Quantos ativos estão sem preço (valorizados pelo custo). */
  semPreco: number
}

/** Junta as posições das pessoas escolhidas, ativo por ativo, e valoriza pelo último preço. */
export function carteira(
  posicoes: readonly Posicao[],
  ativos: readonly Ativo[],
  cotacoes: ReadonlyMap<string, Cotacao>,
  pessoaIds: ReadonlySet<string>,
  taxa: number,
): Carteira {
  const porAtivo = new Map<string, { qtd: number; custo: number }>()
  for (const p of posicoes) {
    if (!pessoaIds.has(p.pessoa_id) || p.quantidade <= 0) continue
    const g = porAtivo.get(p.ativo_id) ?? { qtd: 0, custo: 0 }
    g.qtd += p.quantidade
    g.custo += p.quantidade * p.preco_medio
    porAtivo.set(p.ativo_id, g)
  }
  const mapa = new Map(ativos.map((a) => [a.id, a]))
  const linhas: LinhaCarteira[] = []
  const total = { brl: 0, usd: 0 }
  const custoTotal = { brl: 0, usd: 0 }
  let semPreco = 0
  for (const [ativoId, g] of porAtivo) {
    const a = mapa.get(ativoId)
    if (!a) continue
    const cot = cotacoes.get(ativoId) ?? null
    const preco = cot ? cot.preco : null
    const valor = preco !== null ? g.qtd * preco : g.custo
    const resultado = preco !== null ? valor - g.custo : null
    const v = converter(valor, a.moeda, taxa)
    const c = converter(g.custo, a.moeda, taxa)
    total.brl += v.brl
    total.usd += v.usd
    custoTotal.brl += c.brl
    custoTotal.usd += c.usd
    if (preco === null) semPreco++
    linhas.push({
      ativoId,
      ticker: a.ticker,
      nome: a.nome,
      classe: a.classe,
      moeda: a.moeda,
      quantidade: g.qtd,
      precoMedio: g.qtd > 0 ? g.custo / g.qtd : 0,
      preco,
      dataPreco: cot ? cot.data : null,
      custo: g.custo,
      valor,
      semPreco: preco === null,
      resultado,
      resultadoPct: resultado !== null && g.custo > 0 ? (resultado / g.custo) * 100 : null,
      brl: v.brl,
      usd: v.usd,
      custoBrl: c.brl,
      custoUsd: c.usd,
    })
  }
  linhas.sort((x, y) => y.brl - x.brl)
  return { linhas, total, custo: custoTotal, semPreco }
}

/** Participação de cada classe (ações, FIIs, cripto…) no total. */
export function porClasse(linhas: readonly LinhaCarteira[]): Fatia[] {
  const g = new Map<ClasseAtivo, Totais>()
  for (const l of linhas) {
    const x = g.get(l.classe) ?? { brl: 0, usd: 0 }
    x.brl += l.brl
    x.usd += l.usd
    g.set(l.classe, x)
  }
  const soma = [...g.values()].reduce((a, x) => a + x.brl, 0)
  return [...g.entries()]
    .map(([classe, t]) => ({
      id: classe,
      nome: ROTULO_CLASSE[classe],
      brl: t.brl,
      usd: t.usd,
      pct: soma > 0 ? (t.brl / soma) * 100 : 0,
    }))
    .sort((a, b) => b.brl - a.brl)
}

/** Participação de cada ativo no total. */
export function porAtivoCarteira(linhas: readonly LinhaCarteira[]): Fatia[] {
  const soma = linhas.reduce((a, l) => a + l.brl, 0)
  return linhas.map((l) => ({
    id: l.ativoId,
    nome: l.ticker,
    brl: l.brl,
    usd: l.usd,
    pct: soma > 0 ? (l.brl / soma) * 100 : 0,
  }))
}

/** Dias entre duas datas AAAA-MM-DD (b - a). */
export function diasEntre(a: string, b: string): number {
  const [ya, ma, da] = a.split('-').map(Number)
  const [yb, mb, db] = b.split('-').map(Number)
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86_400_000)
}

/** Data de preço mais antiga entre as linhas com preço (para avisar de cotação velha). */
export function precoMaisAntigo(linhas: readonly LinhaCarteira[]): string | null {
  let m: string | null = null
  for (const l of linhas) if (l.dataPreco && (m === null || l.dataPreco < m)) m = l.dataPreco
  return m
}
