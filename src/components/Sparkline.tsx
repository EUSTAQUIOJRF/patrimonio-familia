/** Mini gráfico de linha (último mês). Uma cor só; o texto ao lado dá a leitura exata. */
export default function Sparkline({ serie, rotulo }: { serie: number[]; rotulo: string }) {
  if (serie.length < 2) return <div className="sparkline sparkline-vazio" aria-hidden="true" />
  const L = 96
  const A = 32
  const p = 3
  const min = Math.min(...serie)
  const max = Math.max(...serie)
  const faixa = max - min || 1
  const x = (i: number) => p + (i * (L - 2 * p)) / (serie.length - 1)
  const y = (v: number) => A - p - ((v - min) / faixa) * (A - 2 * p)
  const pontos = serie.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <svg className="sparkline" viewBox={`0 0 ${L} ${A}`} role="img" aria-label={rotulo}>
      <polyline className="sparkline-linha" points={pontos} />
      <circle className="sparkline-ponto" cx={x(serie.length - 1)} cy={y(serie[serie.length - 1])} r={2.5} />
    </svg>
  )
}
