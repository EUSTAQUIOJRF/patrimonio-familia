import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Valor } from './Valor'
import { usePreferencias } from '../contexts/PreferenciasContext'
import { marcasDoEixo, type PontoMensal } from '../lib/calculos'
import { formatarCompacto, rotuloMes, rotuloMesCurto, type Moeda } from '../lib/formato'

const MARGEM = { topo: 16, direita: 18, base: 28 }

/**
 * Evolução do patrimônio mês a mês: uma linha de 2px, área suave embaixo, marcadores de 8px
 * com anel da cor da superfície, cruz + dica ao passar o mouse/dedo e tabela como alternativa.
 */
export default function GraficoEvolucao({ pontos }: { pontos: PontoMensal[] }) {
  const { moedaPrincipal, privado } = usePreferencias()
  const principal: Moeda = moedaPrincipal
  const secundaria: Moeda = principal === 'BRL' ? 'USD' : 'BRL'
  const caixa = useRef<HTMLDivElement>(null)
  const [largura, setLargura] = useState(640)
  const [ativo, setAtivo] = useState<number | null>(null)

  useEffect(() => {
    const el = caixa.current
    if (!el) return
    const obs = new ResizeObserver(([entrada]) => {
      setLargura(Math.max(280, Math.floor(entrada.contentRect.width)))
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const altura = largura < 480 ? 210 : 250
  const esquerda = privado ? 14 : 62
  const valorDe = (p: PontoMensal, m: Moeda) => (m === 'BRL' ? p.brl : p.usd)
  const simbolo = (m: Moeda) => (m === 'BRL' ? 'R$' : 'US$')

  const n = pontos.length
  const valores = pontos.map((p) => valorDe(p, principal))
  const marcas = marcasDoEixo(Math.min(...valores), Math.max(...valores))
  const dominioMin = marcas[0]
  const dominioMax = marcas[marcas.length - 1]
  const areaW = largura - esquerda - MARGEM.direita
  const areaH = altura - MARGEM.topo - MARGEM.base

  const x = (i: number) => (n === 1 ? esquerda + areaW / 2 : esquerda + (i / (n - 1)) * areaW)
  const y = (v: number) =>
    MARGEM.topo + areaH - ((v - dominioMin) / (dominioMax - dominioMin || 1)) * areaH
  const base = MARGEM.topo + areaH

  const caminho = pontos.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(valorDe(p, principal))}`)
  const linha = caminho.join(' ')
  const area = `${linha} L${x(n - 1)},${base} L${x(0)},${base} Z`

  // Rótulos do eixo X sem colisão: no máximo 1 a cada ~56px, alinhados ao último mês.
  const maxRotulos = Math.max(2, Math.floor(areaW / 56))
  const passo = Math.max(1, Math.ceil(n / maxRotulos))
  const mostrarRotulo = (i: number) => (n - 1 - i) % passo === 0

  function aoMover(e: PointerEvent<SVGRectElement>) {
    const caixaSvg = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - caixaSvg.left
    let melhor = 0
    for (let i = 1; i < n; i++) {
      if (Math.abs(x(i) - (px + esquerda)) < Math.abs(x(melhor) - (px + esquerda))) melhor = i
    }
    setAtivo(melhor)
  }

  function aoTeclar(e: KeyboardEvent<SVGSVGElement>) {
    if (e.key === 'ArrowLeft') setAtivo((a) => Math.max(0, (a ?? n) - 1))
    else if (e.key === 'ArrowRight') setAtivo((a) => Math.min(n - 1, (a ?? -1) + 1))
    else if (e.key === 'Escape') setAtivo(null)
  }

  const ultimo = pontos[n - 1]
  const descricao = privado
    ? `Evolução do patrimônio de ${rotuloMes(pontos[0].mes)} a ${rotuloMes(ultimo.mes)}`
    : `Evolução do patrimônio de ${rotuloMes(pontos[0].mes)} a ${rotuloMes(ultimo.mes)}. Último valor: ${simbolo(principal)} ${valorDe(ultimo, principal).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`

  const dica = ativo !== null ? pontos[ativo] : null
  const dicaX = ativo !== null ? Math.min(Math.max(x(ativo), 90), largura - 90) : 0

  return (
    <div>
      <div className="grafico" ref={caixa}>
        <svg
          width={largura}
          height={altura}
          viewBox={`0 0 ${largura} ${altura}`}
          role="img"
          aria-label={descricao}
          tabIndex={0}
          onKeyDown={aoTeclar}
          onBlur={() => setAtivo(null)}
        >
          {/* Linhas de grade e valores do eixo Y */}
          {marcas.map((m) => (
            <g key={m}>
              <line x1={esquerda} x2={largura - MARGEM.direita} y1={y(m)} y2={y(m)} className="grade" />
              {!privado && (
                <text x={esquerda - 8} y={y(m)} className="eixo-texto" textAnchor="end" dy="0.32em">
                  {simbolo(principal)} {formatarCompacto(m)}
                </text>
              )}
            </g>
          ))}
          <line x1={esquerda} x2={largura - MARGEM.direita} y1={base} y2={base} className="eixo" />

          {/* Meses */}
          {pontos.map((p, i) =>
            mostrarRotulo(i) ? (
              <text key={p.mes} x={x(i)} y={base + 18} className="eixo-texto" textAnchor="middle">
                {rotuloMesCurto(p.mes)}
              </text>
            ) : null,
          )}

          {n > 1 && <path d={area} className="area" />}
          {n > 1 && <path d={linha} className="linha" />}

          {/* Marcadores: todos quando são poucos; só o último quando são muitos */}
          {pontos.map((p, i) =>
            n <= 12 || i === n - 1 ? (
              <circle
                key={p.mes}
                cx={x(i)}
                cy={y(valorDe(p, principal))}
                r={ativo === i ? 6 : 4.5}
                className="marcador"
              />
            ) : null,
          )}

          {/* Valor do último ponto, escrito direto no gráfico */}
          {!privado && ativo === null && (
            <text
              x={x(n - 1)}
              y={y(valorDe(ultimo, principal)) - 12}
              className="rotulo-final"
              textAnchor="end"
            >
              {simbolo(principal)} {formatarCompacto(valorDe(ultimo, principal))}
            </text>
          )}

          {ativo !== null && (
            <line x1={x(ativo)} x2={x(ativo)} y1={MARGEM.topo} y2={base} className="cruz" />
          )}

          {/* Área sensível ao mouse/dedo, maior que os marcadores */}
          <rect
            x={esquerda}
            y={MARGEM.topo}
            width={areaW}
            height={areaH}
            fill="transparent"
            onPointerMove={aoMover}
            onPointerDown={aoMover}
            onPointerLeave={() => setAtivo(null)}
          />
        </svg>

        {dica && (
          <div className="dica" style={{ left: dicaX, top: 0 }} role="status">
            <div className="dica-titulo">{rotuloMes(dica.mes)}</div>
            <div className="dica-valor">
              <Valor valor={valorDe(dica, principal)} moeda={principal} />
            </div>
            <div className="dica-secundario">
              <Valor valor={valorDe(dica, secundaria)} moeda={secundaria} />
            </div>
          </div>
        )}
      </div>

      <details className="tabela-alternativa">
        <summary>Ver como tabela</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Mês</th>
              <th scope="col" className="num">
                R$
              </th>
              <th scope="col" className="num">
                US$
              </th>
            </tr>
          </thead>
          <tbody>
            {[...pontos].reverse().map((p) => (
              <tr key={p.mes}>
                <th scope="row">{rotuloMes(p.mes)}</th>
                <td className="num">
                  <Valor valor={p.brl} moeda="BRL" />
                </td>
                <td className="num">
                  <Valor valor={p.usd} moeda="USD" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
