import { Valor } from './Valor'
import { usePreferencias } from '../contexts/PreferenciasContext'
import { formatarPercentual, type Moeda } from '../lib/formato'
import type { Fatia } from '../lib/calculos'

/**
 * Participação de cada banco/corretora no patrimônio.
 * Barras horizontais de uma cor só, ordenadas da maior para a menor. O nome vem escrito ao lado
 * de cada barra, então a identidade nunca depende de cor. A trilha clara mostra o "todo".
 */
export default function BarrasInstituicoes({
  fatias,
  rotulo = 'Participação por banco ou corretora',
  todo = 'do patrimônio',
}: {
  fatias: Fatia[]
  rotulo?: string
  todo?: string
}) {
  const { moedaPrincipal } = usePreferencias()
  const principal: Moeda = moedaPrincipal
  const secundaria: Moeda = principal === 'BRL' ? 'USD' : 'BRL'
  const maior = Math.max(...fatias.map((f) => f.pct), 1)

  const valorDe = (f: Fatia, m: Moeda) => (m === 'BRL' ? f.brl : f.usd)

  return (
    <ul className="barras" aria-label={rotulo}>
      {fatias.map((f) => (
        <li key={f.id} className="barras-linha">
          <div className="barras-nome" title={f.nome}>
            {f.nome}
          </div>
          <div
            className="barras-trilha"
            role="img"
            aria-label={`${f.nome}: ${formatarPercentual(f.pct)} ${todo}`}
          >
            <div
              className="barras-preenchimento"
              style={{ width: `${Math.max(0, (f.pct / maior) * 100)}%` }}
            />
          </div>
          <div className="barras-valores">
            <div className="barras-principal">
              <Valor valor={valorDe(f, principal)} moeda={principal} />
            </div>
            <div className="barras-secundario">
              <span className="barras-pct">{formatarPercentual(f.pct)}</span>
              {' · '}
              <Valor valor={valorDe(f, secundaria)} moeda={secundaria} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
