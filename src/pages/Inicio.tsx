import { ValorDuplo } from '../components/Valor'

/**
 * Página inicial da Fase 0. Os números abaixo são APENAS UM EXEMPLO para testar
 * o botão BRL/USD e o modo privacidade. A tela real de patrimônio vem na Fase 1.
 */
export default function Inicio() {
  const cambioExemplo = 5.5
  const brl = 1_234_567.89
  return (
    <section>
      <h1 className="titulo-pagina">Patrimônio</h1>
      <div className="cartao">
        <p className="muted">Exemplo (dados fictícios)</p>
        <ValorDuplo brl={brl} usd={brl / cambioExemplo} />
        <p className="muted">
          Use os botões do topo para inverter a moeda principal e esconder os valores. A tela real,
          com os saldos por banco e corretora, chega na Fase 1.
        </p>
      </div>
    </section>
  )
}
