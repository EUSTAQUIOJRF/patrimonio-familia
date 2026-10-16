import type { Fatia, Totais } from './calculos.ts'
import type { Ativo, Provento, TipoProvento } from './tipos.ts'

export const ROTULO_TIPO: Record<TipoProvento, string> = {
  dividendo: 'Dividendo',
  jcp: 'JCP',
  rendimento: 'Rendimento de FII',
  outro: 'Outro',
}

/** Um provento convertido pelo câmbio gravado no lançamento. */
export function valoresDe(p: Provento): Totais {
  return p.moeda === 'BRL'
    ? { brl: p.valor, usd: p.valor / p.cambio_usd_brl }
    : { brl: p.valor * p.cambio_usd_brl, usd: p.valor }
}

export function filtrar(proventos: readonly Provento[], pessoaIds: ReadonlySet<string>): Provento[] {
  return proventos.filter((p) => pessoaIds.has(p.pessoa_id))
}

/** Avança n meses a partir de 'AAAA-MM-01'. */
export function somarMeses(mes: string, n: number): string {
  const [a, m] = mes.split('-').map(Number)
  const idx = a * 12 + (m - 1) + n
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}-01`
}

/** Meses entre dois 'AAAA-MM-01' (b - a). */
export function mesesEntre(a: string, b: string): number {
  const [ya, ma] = a.split('-').map(Number)
  const [yb, mb] = b.split('-').map(Number)
  return (yb - ya) * 12 + (mb - ma)
}

export interface PontoProvento extends Totais {
  mes: string
}

/** Soma por mês dos últimos `qtd` meses terminando em `mesFim` (meses sem provento valem 0). */
export function somaPorMes(
  proventos: readonly Provento[],
  mesFim: string,
  qtd = 12,
): PontoProvento[] {
  const pontos: PontoProvento[] = []
  const idx = new Map<string, PontoProvento>()
  for (let i = qtd - 1; i >= 0; i--) {
    const mes = somarMeses(mesFim, -i)
    const p = { mes, brl: 0, usd: 0 }
    pontos.push(p)
    idx.set(mes, p)
  }
  for (const pr of proventos) {
    const p = idx.get(pr.mes)
    if (!p) continue
    const v = valoresDe(pr)
    p.brl += v.brl
    p.usd += v.usd
  }
  return pontos
}

export function totalDe(proventos: readonly Provento[]): Totais {
  const t = { brl: 0, usd: 0 }
  for (const p of proventos) {
    const v = valoresDe(p)
    t.brl += v.brl
    t.usd += v.usd
  }
  return t
}

export interface TotalAno extends Totais {
  ano: number
}

/** Total recebido em cada ano civil, do mais recente para o mais antigo. */
export function totaisPorAno(proventos: readonly Provento[]): TotalAno[] {
  const g = new Map<number, TotalAno>()
  for (const p of proventos) {
    const ano = Number(p.mes.slice(0, 4))
    const x = g.get(ano) ?? { ano, brl: 0, usd: 0 }
    const v = valoresDe(p)
    x.brl += v.brl
    x.usd += v.usd
    g.set(ano, x)
  }
  return [...g.values()].sort((a, b) => b.ano - a.ano)
}

/**
 * Média anual: total recebido dividido pelo tempo de histórico, em anos.
 * O histórico vai do primeiro provento até o mês atual. Com menos de 12 meses usa-se 12,
 * para não inflar a média de quem acabou de começar.
 */
export function mediaAnual(proventos: readonly Provento[], mesAtual: string): Totais {
  if (proventos.length === 0) return { brl: 0, usd: 0 }
  let primeiro = proventos[0].mes
  for (const p of proventos) if (p.mes < primeiro) primeiro = p.mes
  const meses = Math.max(12, mesesEntre(primeiro, mesAtual) + 1)
  const t = totalDe(proventos)
  return { brl: (t.brl / meses) * 12, usd: (t.usd / meses) * 12 }
}

export interface FatiaProvento extends Fatia {
  media: Totais
}

/** Total por ativo (opcionalmente só de um ano), com a média anual de cada um. */
export function porAtivoProvento(
  proventos: readonly Provento[],
  ativos: readonly Ativo[],
  mesAtual: string,
  ano: number | null,
): FatiaProvento[] {
  const nomes = new Map(ativos.map((a) => [a.id, a.ticker]))
  const todos = new Map<string, Provento[]>()
  for (const p of proventos) {
    const l = todos.get(p.ativo_id) ?? []
    l.push(p)
    todos.set(p.ativo_id, l)
  }
  const linhas = [...todos.entries()].map(([id, lista]) => {
    const doPeriodo = ano === null ? lista : lista.filter((p) => p.mes.startsWith(`${ano}-`))
    return { id, t: totalDe(doPeriodo), media: mediaAnual(lista, mesAtual) }
  })
  const soma = linhas.reduce((a, x) => a + x.t.brl, 0)
  return linhas
    .filter((x) => x.t.brl > 0 || x.t.usd > 0)
    .map((x) => ({
      id: x.id,
      nome: nomes.get(x.id) ?? '(ativo removido)',
      brl: x.t.brl,
      usd: x.t.usd,
      pct: soma > 0 ? (x.t.brl / soma) * 100 : 0,
      media: x.media,
    }))
    .sort((a, b) => b.brl - a.brl)
}
