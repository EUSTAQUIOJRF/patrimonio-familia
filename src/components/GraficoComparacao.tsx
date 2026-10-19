import { useMemo, useState, type PointerEvent } from 'react'
import { espalharRotulos } from '../lib/indicadores'

export interface SerieComparada {
  id: string
  nome: string
  /** Variável CSS da cor (ex.: 'var(--cat-1)'). */
  cor: string
  pontos: { t: number; v: number }[]
}

const L = 360
const A = 250
const M = { e: 34, d: 56, t: 10, b: 24 }

const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
const mesAno = (t: number) => new Date(t).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' }).replace('.', '')

/** Linhas na base 100 (o ponto de partida vale 100). Nome no fim de cada linha e dica ao tocar. */
export default function GraficoComparacao({ series }: { series: SerieComparada[] }) {
  const [cursor, setCursor] = useState<number | null>(null)

  const g = useMemo(() => {
    const todos = series.flatMap((s) => s.pontos)
    if (todos.length === 0) return null
    const t0 = Math.min(...todos.map((p) => p.t))
    const t1 = Math.max(...todos.map((p) => p.t))
    let min = Math.min(...todos.map((p) => p.v), 100)
    let max = Math.max(...todos.map((p) => p.v), 100)
    const folga = (max - min) * 0.08 || 5
    min -= folga
    max += folga
    const x = (t: number) => M.e + ((t - t0) / (t1 - t0 || 1)) * (L - M.e - M.d)
    const y = (v: number) => M.t + (1 - (v - min) / (max - min)) * (A - M.t - M.b)
    const fim = series.map((s) => (s.pontos.length ? y(s.pontos[s.pontos.length - 1].v) : 0))
    const rotulos = espalharRotulos(fim, 13, M.t + 6, A - M.b)
    const marcas = [0, 1, 2, 3].map((i) => t0 + ((t1 - t0) * i) / 3)
    const grade = [min, 100, max].map((v) => Math.round(v))
    return { t0, t1, x, y, fim, rotulos, marcas, grade, min, max }
  }, [series])

  if (!g) return <p className="muted">Sem histórico de preço para desenhar.</p>

  const valorEm = (s: SerieComparada, t: number) => {
    let ref: { t: number; v: number } | null = null
    for (const p of s.pontos) {
      if (p.t <= t) ref = p
      else break
    }
    return ref
  }

  function mover(e: PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * L
    const frac = Math.min(1, Math.max(0, (px - M.e) / (L - M.e - M.d)))
    setCursor(g!.t0 + frac * (g!.t1 - g!.t0))
  }

  return (
    <div className="grafico comparacao">
      <ul className="legenda" aria-label="Legenda">
        {series.map((s) => (
          <li key={s.id}>
            <span className="legenda-marca" style={{ background: s.cor }} aria-hidden="true" />
            {s.nome}
          </li>
        ))}
      </ul>
      <p className="grafico-leitura" aria-live="polite">
        {cursor === null
          ? 'Passe o dedo ou o mouse sobre o gráfico para ver os valores. 100 = preço de 12 meses atrás.'
          : `${new Date(cursor).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}: ` +
            series
              .map((s) => {
                const p = valorEm(s, cursor)
                return p ? `${s.nome} ${fmt(p.v)}` : null
              })
              .filter(Boolean)
              .join(' · ')}
      </p>
      <svg
        viewBox={`0 0 ${L} ${A}`}
        role="img"
        aria-label="Evolução do preço de cada ativo em 12 meses, com o preço inicial igual a 100"
        onPointerMove={mover}
        onPointerLeave={() => setCursor(null)}
      >
        {g.grade.map((v, i) => (
          <g key={`${v}-${i}`}>
            <line className={v === 100 ? 'eixo' : 'grade'} x1={M.e} x2={L - M.d} y1={g.y(v)} y2={g.y(v)} strokeDasharray={v === 100 ? '3 3' : undefined} />
            <text className="eixo-texto" x={M.e - 5} y={g.y(v) + 4} textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        {g.marcas.map((t, i) => (
          <text key={t} className="eixo-texto" x={g.x(t)} y={A - 7} textAnchor={i === 0 ? 'start' : i === g.marcas.length - 1 ? 'end' : 'middle'}>
            {mesAno(t)}
          </text>
        ))}
        {series.map((s) => (
          <polyline
            key={s.id}
            className="linha-comparada"
            style={{ stroke: s.cor }}
            points={s.pontos.map((p) => `${g.x(p.t).toFixed(1)},${g.y(p.v).toFixed(1)}`).join(' ')}
          />
        ))}
        {series.map((s, i) => {
          const ult = s.pontos[s.pontos.length - 1]
          if (!ult) return null
          return (
            <g key={s.id}>
              <circle className="ponto-comparado" style={{ fill: s.cor }} cx={g.x(ult.t)} cy={g.fim[i]} r={4} />
              <text className="rotulo-linha" x={g.x(ult.t) + 8} y={g.rotulos[i] + 4}>
                {s.nome}
              </text>
            </g>
          )
        })}
        {cursor !== null && <line className="cruz" x1={g.x(cursor)} x2={g.x(cursor)} y1={M.t} y2={A - M.b} />}
      </svg>
    </div>
  )
}
