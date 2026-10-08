import { usePreferencias } from '../contexts/PreferenciasContext'
import { formatarMoeda, type Moeda } from '../lib/formato'

const MASCARA = '••••••'

/** Um valor em uma moeda. Respeita o modo privacidade. */
export function Valor({ valor, moeda }: { valor: number; moeda: Moeda }) {
  const { privado } = usePreferencias()
  return <span className="valor">{privado ? MASCARA : formatarMoeda(valor, moeda)}</span>
}

/**
 * Valor grande na moeda principal e valor pequeno na outra.
 * O botão BRL/USD do topo inverte qual é grande e qual é pequeno.
 */
export function ValorDuplo({
  brl,
  usd,
  tamanho = 'normal',
}: {
  brl: number
  usd: number
  tamanho?: 'hero' | 'normal' | 'pequeno'
}) {
  const { moedaPrincipal } = usePreferencias()
  const principal: Moeda = moedaPrincipal
  const secundaria: Moeda = principal === 'BRL' ? 'USD' : 'BRL'
  const valores: Record<Moeda, number> = { BRL: brl, USD: usd }

  return (
    <div className={`valor-duplo vd-${tamanho}`}>
      <div className="valor-grande">
        <Valor valor={valores[principal]} moeda={principal} />
      </div>
      <div className="valor-pequeno">
        <Valor valor={valores[secundaria]} moeda={secundaria} />
      </div>
    </div>
  )
}
