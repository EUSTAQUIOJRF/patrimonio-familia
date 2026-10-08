import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import BarrasInstituicoes from '../components/BarrasInstituicoes'
import CambioInfo from '../components/CambioInfo'
import GraficoEvolucao from '../components/GraficoEvolucao'
import { Valor, ValorDuplo } from '../components/Valor'
import { useCambio } from '../contexts/CambioContext'
import { useDados } from '../contexts/DadosContext'
import {
  listaMeses,
  porInstituicao,
  porPessoa,
  retratoAte,
  serieMensal,
  totais,
  type ModoCambio,
} from '../lib/calculos'
import { formatarPercentual, rotuloMes } from '../lib/formato'

const FAMILIA = 'familia'

export default function Patrimonio() {
  const { pessoas, instituicoes, saldos, carregando, erro } = useDados()
  const { taxa } = useCambio()
  const [escopo, setEscopo] = useState<string>(FAMILIA)
  const [mesEscolhido, setMesEscolhido] = useState<string | null>(null)
  const [modoPedido, setModoPedido] = useState<ModoCambio>('hoje')

  // Quem aparece nas abas: só quem entra na soma da família (a filha é só para monitorar ativos).
  const membros = useMemo(() => pessoas.filter((p) => p.entra_na_familia), [pessoas])
  const idsEscopo = useMemo(
    () => new Set(escopo === FAMILIA ? membros.map((m) => m.id) : [escopo]),
    [escopo, membros],
  )

  const mesesDoEscopo = useMemo(
    () => listaMeses(saldos.filter((s) => idsEscopo.has(s.pessoa_id))),
    [saldos, idsEscopo],
  )
  const mes =
    mesEscolhido && mesesDoEscopo.includes(mesEscolhido) ? mesEscolhido : (mesesDoEscopo[0] ?? null)

  // Sem cotação do dólar disponível, só dá para usar o câmbio gravado em cada lançamento.
  const modo: ModoCambio = taxa === null ? 'epoca' : modoPedido
  const hoje = taxa ?? 1

  const calculo = useMemo(() => {
    if (!mes) return null
    const retrato = retratoAte(saldos, mes, idsEscopo)
    return {
      retrato,
      total: totais(retrato.itens, modo, hoje),
      instituicoes: porInstituicao(retrato.itens, instituicoes, modo, hoje),
      pessoas: porPessoa(retrato.itens, pessoas, modo, hoje),
      serie: serieMensal(saldos, idsEscopo, modo, hoje),
    }
  }, [mes, saldos, idsEscopo, instituicoes, pessoas, modo, hoje])

  if (carregando) return <p className="muted">Carregando…</p>
  if (erro) {
    return (
      <div className="cartao">
        <h2>Não foi possível carregar os dados</h2>
        <p className="erro">{erro}</p>
      </div>
    )
  }

  const nomeEscopo =
    escopo === FAMILIA ? 'Família' : (membros.find((m) => m.id === escopo)?.nome ?? '')

  return (
    <section>
      <h1 className="titulo-pagina">Patrimônio</h1>

      <div className="abas" role="tablist" aria-label="Quem ver">
        {[{ id: FAMILIA, nome: 'Família' }, ...membros].map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={escopo === a.id}
            className={`aba ${escopo === a.id ? 'ativa' : ''}`}
            onClick={() => setEscopo(a.id)}
          >
            {a.nome}
          </button>
        ))}
      </div>

      {!calculo || !mes ? (
        <div className="cartao">
          <h2>Ainda não há saldos lançados{escopo === FAMILIA ? '' : ` para ${nomeEscopo}`}</h2>
          <p className="muted">
            Informe o saldo de cada banco e corretora para ver o patrimônio e os gráficos.
          </p>
          <Link to="/lancar" className="botao botao-link">
            Lançar saldos
          </Link>
        </div>
      ) : (
        <>
          <div className="controles">
            <label className="controle">
              <span className="controle-rotulo">Mês</span>
              <select value={mes} onChange={(e) => setMesEscolhido(e.target.value)}>
                {mesesDoEscopo.map((m) => (
                  <option key={m} value={m}>
                    {rotuloMes(m)}
                  </option>
                ))}
              </select>
            </label>
            <div className="controle">
              <span className="controle-rotulo">Dólar pela cotação</span>
              <div className="segmentado" role="group" aria-label="Cotação usada na conversão">
                <button
                  type="button"
                  aria-pressed={modo === 'hoje'}
                  disabled={taxa === null}
                  onClick={() => setModoPedido('hoje')}
                >
                  de hoje
                </button>
                <button
                  type="button"
                  aria-pressed={modo === 'epoca'}
                  onClick={() => setModoPedido('epoca')}
                >
                  da época
                </button>
              </div>
            </div>
          </div>
          <CambioInfo />

          <div className="cartao">
            <p className="rotulo-cartao">
              Patrimônio · {nomeEscopo} · {rotuloMes(mes)}
            </p>
            <ValorDuplo brl={calculo.total.brl} usd={calculo.total.usd} tamanho="hero" />
            {calculo.retrato.repetidos > 0 && (
              <p className="aviso-suave">
                {calculo.retrato.repetidos === 1
                  ? '1 saldo não foi lançado'
                  : `${calculo.retrato.repetidos} saldos não foram lançados`}{' '}
                em {rotuloMes(mes)}; está valendo o último valor informado.{' '}
                <Link to="/lancar">Atualizar</Link>
              </p>
            )}
            {taxa === null && (
              <p className="aviso-suave">
                Sem cotação do dólar no momento: valores convertidos pelo câmbio da época de cada
                lançamento.
              </p>
            )}
          </div>

          {escopo === FAMILIA && calculo.pessoas.length > 1 && (
            <div className="tiles">
              {calculo.pessoas.map((f) => (
                <div key={f.id} className="tile">
                  <p className="rotulo-cartao">{f.nome}</p>
                  <ValorDuplo brl={f.brl} usd={f.usd} tamanho="pequeno" />
                  <p className="tile-pct">{formatarPercentual(f.pct)} da família</p>
                </div>
              ))}
            </div>
          )}

          <div className="cartao">
            <h2>Por banco e corretora</h2>
            <p className="muted">Participação de cada instituição no total de {rotuloMes(mes)}.</p>
            <BarrasInstituicoes fatias={calculo.instituicoes} />
            <p className="total-linha">
              <span>Total</span>
              <span>
                <Valor valor={calculo.total.brl} moeda="BRL" />
                {' · '}
                <Valor valor={calculo.total.usd} moeda="USD" />
              </span>
            </p>
          </div>

          <div className="cartao">
            <h2>Evolução do patrimônio</h2>
            {calculo.serie.length < 2 ? (
              <p className="muted">
                O gráfico aparece a partir do segundo mês com saldos lançados.
              </p>
            ) : (
              <GraficoEvolucao pontos={calculo.serie} />
            )}
          </div>
        </>
      )}
    </section>
  )
}
