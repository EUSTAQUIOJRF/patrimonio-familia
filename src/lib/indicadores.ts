export type TipoIndicador = 'numero' | 'percentual' | 'dinheiro'

export interface DefIndicador {
  chave: string
  rotulo: string
  /** Texto curto de ajuda (o que significa). */
  ajuda: string
  tipo: TipoIndicador
  /** Qual lado é "melhor": 'menor' (ex.: P/L), 'maior' (ex.: ROE) ou null (sem ranking). */
  melhor: 'menor' | 'maior' | null
  grupo: 'Preço e valor' | 'Rentabilidade' | 'Endividamento e liquidez' | 'Dividendos' | 'Porte'
}

export const INDICADORES: DefIndicador[] = [
  { chave: 'pl', rotulo: 'P/L', ajuda: 'Preço dividido pelo lucro por ação. Menor tende a ser mais barato.', tipo: 'numero', melhor: 'menor', grupo: 'Preço e valor' },
  { chave: 'pvp', rotulo: 'P/VP', ajuda: 'Preço dividido pelo valor patrimonial por ação.', tipo: 'numero', melhor: 'menor', grupo: 'Preço e valor' },
  { chave: 'evEbitda', rotulo: 'EV/EBITDA', ajuda: 'Valor da empresa dividido pelo EBITDA.', tipo: 'numero', melhor: 'menor', grupo: 'Preço e valor' },
  { chave: 'lpa', rotulo: 'LPA', ajuda: 'Lucro por ação.', tipo: 'numero', melhor: 'maior', grupo: 'Preço e valor' },
  { chave: 'vpa', rotulo: 'VPA', ajuda: 'Valor patrimonial por ação.', tipo: 'numero', melhor: null, grupo: 'Preço e valor' },
  { chave: 'dy', rotulo: 'Dividend Yield', ajuda: 'Proventos pagos nos últimos 12 meses sobre o preço.', tipo: 'percentual', melhor: 'maior', grupo: 'Dividendos' },
  { chave: 'ffoYield', rotulo: 'FFO Yield (FIIs)', ajuda: 'Fluxo de caixa operacional do fundo sobre o preço.', tipo: 'percentual', melhor: 'maior', grupo: 'Dividendos' },
  { chave: 'roe', rotulo: 'ROE', ajuda: 'Lucro sobre o patrimônio líquido.', tipo: 'percentual', melhor: 'maior', grupo: 'Rentabilidade' },
  { chave: 'roic', rotulo: 'ROIC', ajuda: 'Retorno sobre o capital investido.', tipo: 'percentual', melhor: 'maior', grupo: 'Rentabilidade' },
  { chave: 'margBruta', rotulo: 'Margem bruta', ajuda: 'Lucro bruto sobre a receita.', tipo: 'percentual', melhor: 'maior', grupo: 'Rentabilidade' },
  { chave: 'margEbit', rotulo: 'Margem EBIT', ajuda: 'Lucro operacional sobre a receita.', tipo: 'percentual', melhor: 'maior', grupo: 'Rentabilidade' },
  { chave: 'margLiquida', rotulo: 'Margem líquida', ajuda: 'Lucro líquido sobre a receita.', tipo: 'percentual', melhor: 'maior', grupo: 'Rentabilidade' },
  { chave: 'crescReceita5a', rotulo: 'Cresc. receita 5 anos', ajuda: 'Crescimento da receita nos últimos 5 anos.', tipo: 'percentual', melhor: 'maior', grupo: 'Rentabilidade' },
  { chave: 'divPatrim', rotulo: 'Dívida bruta/Patrimônio', ajuda: 'Quanto a empresa deve em relação ao patrimônio.', tipo: 'numero', melhor: 'menor', grupo: 'Endividamento e liquidez' },
  { chave: 'liqCorrente', rotulo: 'Liquidez corrente', ajuda: 'Capacidade de pagar dívidas de curto prazo.', tipo: 'numero', melhor: 'maior', grupo: 'Endividamento e liquidez' },
  { chave: 'vacancia', rotulo: 'Vacância (FIIs)', ajuda: 'Parte dos imóveis sem inquilino.', tipo: 'percentual', melhor: 'menor', grupo: 'Endividamento e liquidez' },
  { chave: 'valorMercado', rotulo: 'Valor de mercado', ajuda: 'Preço da ação vezes o número de ações.', tipo: 'dinheiro', melhor: null, grupo: 'Porte' },
]

export const GRUPOS = ['Preço e valor', 'Dividendos', 'Rentabilidade', 'Endividamento e liquidez', 'Porte'] as const

const fmtNum = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** "—" quando não há dado. Dinheiro em forma curta (mi, bi, tri). */
export function formatarIndicador(valor: number | null | undefined, tipo: TipoIndicador): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return '—'
  if (tipo === 'percentual') return `${fmtNum(valor)}%`
  if (tipo === 'dinheiro') {
    const abs = Math.abs(valor)
    if (abs >= 1e12) return `${fmtNum(valor / 1e12)} tri`
    if (abs >= 1e9) return `${fmtNum(valor / 1e9)} bi`
    if (abs >= 1e6) return `${fmtNum(valor / 1e6)} mi`
    return fmtNum(valor)
  }
  return fmtNum(valor)
}

/**
 * Posições (índices) com o melhor valor da linha. Só existe "melhor" com 2+ valores.
 * Para indicadores em que menor é melhor (P/L, P/VP…), valores zero ou negativos não concorrem
 * (um P/L negativo significa prejuízo, não "barato").
 */
export function melhoresDaLinha(
  valores: readonly (number | null | undefined)[],
  melhor: 'menor' | 'maior' | null,
): Set<number> {
  if (melhor === null) return new Set()
  const validos = valores
    .map((v, i) => ({ v, i }))
    .filter((x): x is { v: number; i: number } => x.v !== null && x.v !== undefined && Number.isFinite(x.v))
    .filter((x) => (melhor === 'menor' ? x.v > 0 : true))
  if (validos.length < 2) return new Set()
  const alvo = melhor === 'menor' ? Math.min(...validos.map((x) => x.v)) : Math.max(...validos.map((x) => x.v))
  return new Set(validos.filter((x) => x.v === alvo).map((x) => x.i))
}

export interface PontoSerie {
  d: string
  v: number
}

/** Põe a série na base 100 (primeiro ponto = 100) e converte a data em milissegundos. */
export function normalizarBase100(serie: readonly PontoSerie[]): { t: number; v: number }[] {
  if (serie.length === 0) return []
  const base = serie[0].v
  return serie.map((p) => ({ t: Date.parse(`${p.d}T12:00:00Z`), v: (p.v / base) * 100 }))
}

/**
 * Posição vertical dos rótulos no fim das linhas, sem sobreposição: ordena de cima para baixo,
 * empurra cada um para ao menos `minimo` de distância do anterior e mantém dentro de [topo, base].
 */
export function espalharRotulos(ys: readonly number[], minimo: number, topo: number, base: number): number[] {
  const ordem = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y)
  const out = new Array<number>(ys.length)
  let anterior = topo - minimo
  for (const o of ordem) {
    const y = Math.max(o.y, anterior + minimo)
    out[o.i] = y
    anterior = y
  }
  // Se passou da base, puxa tudo de volta para cima.
  let limite = base
  for (let k = ordem.length - 1; k >= 0; k--) {
    const i = ordem[k].i
    if (out[i] > limite) out[i] = limite
    limite = out[i] - minimo
  }
  return out
}
