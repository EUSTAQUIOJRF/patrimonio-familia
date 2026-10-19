import { useMemo, useState } from 'react'
import GraficoComparacao, { type SerieComparada } from '../components/GraficoComparacao'
import { useAtivos } from '../contexts/AtivosContext'
import { ROTULO_CLASSE_UM } from '../lib/ativos'
import { formatarMoeda, type Moeda } from '../lib/formato'
import {
  GRUPOS,
  INDICADORES,
  formatarIndicador,
  melhoresDaLinha,
  normalizarBase100,
} from '../lib/indicadores'
import { buscarComparacao, type DadosComparacao, type Desempenho } from '../lib/mercado'

const MAX = 5
const CHAVE = 'pf:comparar'
const CORES = ['var(--cat-1)', 'var(--cat-2)', 'var(--cat-3)', 'var(--cat-4)', 'var(--cat-5)']

function lerSalvos(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) ?? '[]') as unknown
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

const pct = (v: number | null) =>
  v === null ? '—' : `${v > 0 ? '▲ +' : v < 0 ? '▼ ' : ''}${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`

const temDesempenho = (d: DadosComparacao['desempenho']): d is Desempenho => d.erro === undefined

export default function Comparar() {
  const { ativos, favoritos, carregando, erro } = useAtivos()
  const [escolhidos, setEscolhidos] = useState<string[]>(lerSalvos)
  const [dados, setDados] = useState<Record<string, DadosComparacao> | null>(null)
  const [comparados, setComparados] = useState<string[]>([])
  const [buscando, setBuscando] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const ordenados = useMemo(() => {
    const fav = new Set(favoritos.map((f) => f.ativo_id))
    return [...ativos].sort((a, b) => Number(fav.has(b.id)) - Number(fav.has(a.id)) || a.ticker.localeCompare(b.ticker))
  }, [ativos, favoritos])
  const mapa = useMemo(() => new Map(ativos.map((a) => [a.id, a])), [ativos])
  const validos = escolhidos.filter((id) => mapa.has(id))

  function alternar(id: string) {
    setMsg(null)
    setEscolhidos((atual) => {
      const novo = atual.includes(id) ? atual.filter((x) => x !== id) : atual.length >= MAX ? atual : [...atual, id]
      try {
        localStorage.setItem(CHAVE, JSON.stringify(novo))
      } catch {
        /* sem armazenamento: segue sem lembrar */
      }
      return novo
    })
  }

  async function comparar() {
    if (validos.length < 2) return setMsg('Escolha pelo menos 2 ativos.')
    setBuscando(true)
    setMsg(null)
    try {
      const lista = validos.map((id) => mapa.get(id)!)
      const r = await buscarComparacao(lista.map((a) => ({ simbolo: a.simbolo_cotacao, classe: a.classe })))
      setDados(r)
      setComparados(validos)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setBuscando(false)
    }
  }

  const colunas = useMemo(
    () =>
      comparados.flatMap((id, i) => {
        const a = mapa.get(id)
        const d = a ? dados?.[a.simbolo_cotacao] : undefined
        return a && d ? [{ a, d, cor: CORES[i] }] : []
      }),
    [comparados, mapa, dados],
  )

  const series: SerieComparada[] = colunas.flatMap((c) =>
    temDesempenho(c.d.desempenho)
      ? [{ id: c.a.id, nome: c.a.ticker, cor: c.cor, pontos: normalizarBase100(c.d.desempenho.serie) }]
      : [],
  )

  if (carregando) return <p className="muted">Carregando…</p>
  if (erro) {
    return (
      <div className="cartao">
        <h2>Não foi possível carregar os dados</h2>
        <p className="erro">{erro}</p>
      </div>
    )
  }

  const linhasDesempenho: { rotulo: string; valor: (d: Desempenho) => number | null; tipo: 'pct' | 'vol' }[] = [
    { rotulo: 'Variação em 1 mês', valor: (d) => d.ret1m, tipo: 'pct' },
    { rotulo: 'Variação em 6 meses', valor: (d) => d.ret6m, tipo: 'pct' },
    { rotulo: 'Variação em 12 meses', valor: (d) => d.ret12m, tipo: 'pct' },
    { rotulo: 'Variação no ano', valor: (d) => d.retAno, tipo: 'pct' },
    { rotulo: 'Volatilidade (ao ano)', valor: (d) => d.vol, tipo: 'vol' },
  ]

  return (
    <section>
      <h1 className="titulo-pagina">Comparar ativos</h1>

      <div className="cartao">
        <h2>Escolha de 2 a {MAX} ativos</h2>
        {ordenados.length === 0 ? (
          <p className="muted">Cadastre ativos na tela Ativos ou Favoritos para poder compará-los.</p>
        ) : (
          <ul className="chips">
            {ordenados.map((a) => {
              const marcado = escolhidos.includes(a.id)
              const cheio = !marcado && escolhidos.length >= MAX
              return (
                <li key={a.id}>
                  <label className={`chip ${marcado ? 'ativo' : ''} ${cheio ? 'desativado' : ''}`}>
                    <input type="checkbox" checked={marcado} disabled={cheio} onChange={() => alternar(a.id)} />
                    {a.ticker} <span className="muted pequeno">{ROTULO_CLASSE_UM[a.classe]}</span>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
        {msg && (
          <p className="erro" role="alert">
            {msg}
          </p>
        )}
        <button type="button" className="botao" onClick={() => void comparar()} disabled={buscando || validos.length < 2}>
          {buscando ? 'Buscando dados…' : `Comparar ${validos.length || ''}`.trim()}
        </button>
        <p className="muted pequeno">
          Os dados vêm de fontes gratuitas (Yahoo Finanças, Fundamentus e Finnhub) e podem ter atraso ou erro.
          Confirme antes de decidir.
        </p>
      </div>

      {dados && colunas.length > 0 && (
        <>
          <div className="cartao">
            <h2>Preço em 12 meses</h2>
            <GraficoComparacao series={series} />
            <details className="tabela-alternativa">
              <summary>Ver como tabela</summary>
              <table>
                <thead>
                  <tr>
                    <th>Ativo</th>
                    <th className="num">Hoje (base 100)</th>
                  </tr>
                </thead>
                <tbody>
                  {series.map((s) => (
                    <tr key={s.id}>
                      <td>{s.nome}</td>
                      <td className="num">{s.pontos.length ? s.pontos[s.pontos.length - 1].v.toFixed(1).replace('.', ',') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </div>

          <div className="cartao">
            <h2>Desempenho</h2>
            <div className="tabela-rolagem">
              <table className="comparativo">
                <thead>
                  <tr>
                    <th scope="col">&nbsp;</th>
                    {colunas.map((c) => (
                      <th key={c.a.id} scope="col">
                        <span className="legenda-marca" style={{ background: c.cor }} aria-hidden="true" /> {c.a.ticker}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Preço</th>
                    {colunas.map((c) => (
                      <td key={c.a.id}>
                        {temDesempenho(c.d.desempenho) ? formatarMoeda(c.d.desempenho.preco, c.a.moeda as Moeda) : <span className="muted pequeno">{c.d.desempenho.erro}</span>}
                      </td>
                    ))}
                  </tr>
                  {linhasDesempenho.map((l) => {
                    const valores = colunas.map((c) => (temDesempenho(c.d.desempenho) ? l.valor(c.d.desempenho) : null))
                    const melhores = melhoresDaLinha(valores, l.tipo === 'vol' ? 'menor' : 'maior')
                    return (
                      <tr key={l.rotulo}>
                        <th scope="row">{l.rotulo}</th>
                        {valores.map((v, i) => (
                          <td key={colunas[i].a.id} className={melhores.has(i) ? 'melhor' : ''}>
                            {l.tipo === 'vol' ? (v === null ? '—' : `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`) : pct(v)}
                            {melhores.has(i) && <span className="estrela" aria-label="melhor da linha"> ★</span>}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                  <tr>
                    <th scope="row">Mín – máx. 52 semanas</th>
                    {colunas.map((c) => (
                      <td key={c.a.id}>
                        {temDesempenho(c.d.desempenho)
                          ? `${formatarMoeda(c.d.desempenho.min52, c.a.moeda as Moeda)} – ${formatarMoeda(c.d.desempenho.max52, c.a.moeda as Moeda)}`
                          : '—'}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="muted pequeno">★ marca o melhor valor da linha (para volatilidade, o menor).</p>
          </div>

          <div className="cartao">
            <h2>Indicadores fundamentalistas</h2>
            <div className="tabela-rolagem">
              <table className="comparativo">
                <thead>
                  <tr>
                    <th scope="col">&nbsp;</th>
                    {colunas.map((c) => (
                      <th key={c.a.id} scope="col">
                        <span className="legenda-marca" style={{ background: c.cor }} aria-hidden="true" /> {c.a.ticker}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Fonte</th>
                    {colunas.map((c) => (
                      <td key={c.a.id}>
                        {c.d.fundamentos.indicadores ? (
                          <span className="pequeno">{c.d.fundamentos.fonte}</span>
                        ) : (
                          <span className="muted pequeno">{c.d.fundamentos.erro ?? 'indisponível'}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                  {GRUPOS.map((grupo) => {
                    const defs = INDICADORES.filter((d) => d.grupo === grupo).filter((d) =>
                      colunas.some((c) => c.d.fundamentos.indicadores?.[d.chave] != null),
                    )
                    if (defs.length === 0) return null
                    return [
                      <tr key={grupo} className="grupo">
                        <th colSpan={colunas.length + 1} scope="colgroup">
                          {grupo}
                        </th>
                      </tr>,
                      ...defs.map((def) => {
                        const valores = colunas.map((c) => c.d.fundamentos.indicadores?.[def.chave] ?? null)
                        const melhores = melhoresDaLinha(valores, def.melhor)
                        return (
                          <tr key={def.chave}>
                            <th scope="row" title={def.ajuda}>
                              {def.rotulo}
                            </th>
                            {valores.map((v, i) => (
                              <td key={colunas[i].a.id} className={melhores.has(i) ? 'melhor' : ''}>
                                {formatarIndicador(v, def.tipo)}
                                {melhores.has(i) && <span className="estrela" aria-label="melhor da linha"> ★</span>}
                              </td>
                            ))}
                          </tr>
                        )
                      }),
                    ]
                  })}
                </tbody>
              </table>
            </div>
            <p className="muted pequeno">
              ★ marca o melhor valor da linha (para P/L, P/VP, EV/EBITDA, dívida e vacância, o menor; para os
              demais, o maior). Prejuízo (P/L negativo) não concorre. Cada tipo de ativo tem indicadores
              diferentes, então a comparação entre ações e FIIs é limitada. Passe o mouse (ou toque) no nome do
              indicador para ver o significado. ETFs, BDRs e criptos não têm indicadores fundamentalistas nesta
              versão.
            </p>
          </div>
        </>
      )}
    </section>
  )
}
