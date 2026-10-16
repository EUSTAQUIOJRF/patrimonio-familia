import { useState } from 'react'
import { usePreferencias } from '../contexts/PreferenciasContext'
import { formatarCompacto, formatarMoeda, rotuloMes, rotuloMesCurto, type Moeda } from '../lib/formato'
import { marcasDoEixo } from '../lib/calculos'
import type { PontoProvento } from '../lib/proventos'

const L = 360
const A = 200
const M = { e: 34, d: 4, t: 10, b: 24 }

/** Colunas mensais de uma cor só, com valor ao passar o dedo/mouse e tabela alternativa. */
export default function GraficoBarrasMes({ pontos }: { pontos: PontoProvento[] }) {
  const { moedaPrincipal, privado } = usePreferencias()
  const moeda: Moeda = moedaPrincipal
  const [ativo, setAtivo] = useState<number | null>(null)
  const v = (p: PontoProvento) => (moeda === 'BRL' ? p.brl : p.usd)
  const maximo = Math.max(...pontos.map(v), 0)
  const marcas = marcasDoEixo(0, maximo || 1)
  const topo = marcas[marcas.length - 1] || 1
  const largura = (L - M.e - M.d) / pontos.length
  const y = (x: number) => M.t + (A - M.t - M.b) * (1 - x / topo)
  const sel = ativo !== null ? pontos[ativo] : null

  return (
    <div className="grafico">
      <p className="grafico-leitura" aria-live="polite">
        {sel
          ? `${rotuloMes(sel.mes)}: ${privado ? '••••••' : formatarMoeda(v(sel), moeda)}`
          : 'Toque numa coluna para ver o valor do mês.'}
      </p>
      <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label="Proventos recebidos por mês">
        {marcas.map((m) => (
          <g key={m}>
            <line className="grade" x1={M.e} x2={L - M.d} y1={y(m)} y2={y(m)} />
            <text className="eixo-texto" x={M.e - 6} y={y(m) + 4} textAnchor="end">
              {privado ? '' : formatarCompacto(m)}
            </text>
          </g>
        ))}
        {pontos.map((p, i) => {
          const x0 = M.e + i * largura
          const h = Math.max(0, y(0) - y(v(p)))
          return (
            <g
              key={p.mes}
              onMouseEnter={() => setAtivo(i)}
              onMouseLeave={() => setAtivo(null)}
              onClick={() => setAtivo(i)}
            >
              <rect x={x0} y={M.t} width={largura} height={A - M.t - M.b} fill="transparent" />
              <rect
                className={`coluna ${ativo === i ? 'ativa' : ''}`}
                x={x0 + largura * 0.2}
                width={largura * 0.6}
                y={y(0) - h}
                height={h}
                rx={2}
              />
              {i % 2 === 0 && (
                <text className="eixo-texto" x={x0 + largura / 2} y={A - 7} textAnchor="middle">
                  {rotuloMesCurto(p.mes)}
                </text>
              )}
            </g>
          )
        })}
        <line className="eixo" x1={M.e} x2={L - M.d} y1={y(0)} y2={y(0)} />
      </svg>
      <details className="tabela-alternativa">
        <summary>Ver como tabela</summary>
        <table>
          <thead>
            <tr>
              <th>Mês</th>
              <th className="num">{moeda === 'BRL' ? 'R$' : 'US$'}</th>
            </tr>
          </thead>
          <tbody>
            {pontos.map((p) => (
              <tr key={p.mes}>
                <td>{rotuloMes(p.mes)}</td>
                <td className="num">{privado ? '••••••' : formatarMoeda(v(p), moeda)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
