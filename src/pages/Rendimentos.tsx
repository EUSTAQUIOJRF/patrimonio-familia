import { useEffect, useMemo, useState, type FormEvent } from 'react'
import BarrasInstituicoes from '../components/BarrasInstituicoes'
import GraficoBarrasMes from '../components/GraficoBarrasMes'
import { Valor, ValorDuplo } from '../components/Valor'
import { useAtivos } from '../contexts/AtivosContext'
import { useCambio } from '../contexts/CambioContext'
import { useDados } from '../contexts/DadosContext'
import { lerValor } from '../lib/calculos'
import { mesAtual, rotuloMes, type Moeda } from '../lib/formato'
import {
  ROTULO_TIPO,
  filtrar,
  mediaAnual,
  porAtivoProvento,
  somaPorMes,
  totalDe,
  totaisPorAno,
  valoresDe,
} from '../lib/proventos'
import { supabase } from '../lib/supabase'
import type { TipoProvento } from '../lib/tipos'

const FAMILIA = 'familia'
const TODOS = 'todos'

export default function Rendimentos() {
  const { pessoas, carregando: cp, erro: ep } = useDados()
  const { ativos, posicoes, proventos, carregando, erro, recarregar } = useAtivos()
  const { taxa } = useCambio()
  const [escopo, setEscopo] = useState(FAMILIA)
  const [ano, setAno] = useState<string>(TODOS)

  const membros = useMemo(() => pessoas.filter((p) => p.entra_na_familia), [pessoas])
  const ids = useMemo(
    () => new Set(escopo === FAMILIA ? membros.map((m) => m.id) : [escopo]),
    [escopo, membros],
  )
  const doEscopo = useMemo(() => filtrar(proventos, ids), [proventos, ids])
  const agora = mesAtual()

  const anos = useMemo(() => totaisPorAno(doEscopo), [doEscopo])
  const anoNum = ano === TODOS ? null : Number(ano)
  const doPeriodo = useMemo(
    () => (anoNum === null ? doEscopo : doEscopo.filter((p) => p.mes.startsWith(`${anoNum}-`))),
    [doEscopo, anoNum],
  )
  const totalPeriodo = useMemo(() => totalDe(doPeriodo), [doPeriodo])
  const media = useMemo(() => mediaAnual(doEscopo, agora), [doEscopo, agora])
  const meses = useMemo(() => somaPorMes(doEscopo, agora, 12), [doEscopo, agora])
  const porAtivo = useMemo(
    () => porAtivoProvento(doEscopo, ativos, agora, anoNum),
    [doEscopo, ativos, agora, anoNum],
  )
  const nomeAtivo = useMemo(() => new Map(ativos.map((a) => [a.id, a])), [ativos])
  const nomePessoa = useMemo(() => new Map(pessoas.map((p) => [p.id, p.nome])), [pessoas])

  // Formulário
  const [pessoaForm, setPessoaForm] = useState('')
  const pessoaId = pessoaForm || (escopo !== FAMILIA ? escopo : (membros[0]?.id ?? ''))
  const [ativoId, setAtivoId] = useState('')
  const [mesTxt, setMesTxt] = useState(agora.slice(0, 7))
  const [tipo, setTipo] = useState<TipoProvento>('dividendo')
  const [valorTxt, setValorTxt] = useState('')
  const [moedaForm, setMoedaForm] = useState<Moeda | ''>('')
  const [cambioTxt, setCambioTxt] = useState('')
  const [cambioMexido, setCambioMexido] = useState(false)
  const [verTodos, setVerTodos] = useState(false)
  const [obs, setObs] = useState('')
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!cambioMexido && taxa !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCambioTxt(String(taxa).replace('.', ','))
    }
  }, [taxa, cambioMexido])

  const opcoesAtivo = useMemo(() => {
    const dela = new Set(posicoes.filter((p) => p.pessoa_id === pessoaId).map((p) => p.ativo_id))
    const lista = verTodos || dela.size === 0 ? ativos : ativos.filter((a) => dela.has(a.id))
    return lista
  }, [ativos, posicoes, pessoaId, verTodos])
  const ativoEscolhido = nomeAtivo.get(ativoId) ?? null
  const moeda: Moeda = moedaForm || ativoEscolhido?.moeda || 'BRL'

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setMsg(null)
    const v = lerValor(valorTxt)
    const c = lerValor(cambioTxt)
    if (!pessoaId) return setMsg({ tipo: 'erro', texto: 'Escolha a pessoa.' })
    if (!ativoId) return setMsg({ tipo: 'erro', texto: 'Escolha o ativo.' })
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mesTxt)) return setMsg({ tipo: 'erro', texto: 'Escolha o mês.' })
    if (v === null || v <= 0) return setMsg({ tipo: 'erro', texto: 'Informe o valor recebido (ex.: 123,45).' })
    if (c === null || c <= 0) return setMsg({ tipo: 'erro', texto: 'Informe a cotação do dólar do dia.' })
    setSalvando(true)
    const { error } = await supabase.from('proventos').insert({
      pessoa_id: pessoaId,
      ativo_id: ativoId,
      mes: `${mesTxt}-01`,
      tipo,
      valor: Math.round(v * 100) / 100,
      moeda,
      cambio_usd_brl: c,
      observacao: obs.trim() || null,
    })
    if (error) {
      setSalvando(false)
      return setMsg({ tipo: 'erro', texto: error.message })
    }
    await recarregar()
    setSalvando(false)
    setValorTxt('')
    setObs('')
    setMsg({ tipo: 'ok', texto: `Provento de ${ativoEscolhido?.ticker ?? ''} salvo em ${rotuloMes(`${mesTxt}-01`)}.` })
  }

  async function excluir(id: string, ticker: string) {
    if (!window.confirm(`Excluir este provento de ${ticker}?`)) return
    const { error } = await supabase.from('proventos').delete().eq('id', id)
    if (error) return setMsg({ tipo: 'erro', texto: error.message })
    await recarregar()
  }

  if (carregando || cp) return <p className="muted">Carregando…</p>
  if (erro || ep) {
    return (
      <div className="cartao">
        <h2>Não foi possível carregar os dados</h2>
        <p className="erro">{erro ?? ep}</p>
      </div>
    )
  }

  const nomeEscopo = escopo === FAMILIA ? 'Família' : (nomePessoa.get(escopo) ?? '')
  const recentes = doEscopo.slice(0, 15)

  return (
    <section>
      <h1 className="titulo-pagina">Rendimentos</h1>

      <div className="abas" role="tablist" aria-label="Quem ver">
        {[{ id: FAMILIA, nome: 'Família' }, ...membros].map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={escopo === a.id}
            className={`aba ${escopo === a.id ? 'ativa' : ''}`}
            onClick={() => {
              setEscopo(a.id)
              setAno(TODOS)
            }}
          >
            {a.nome}
          </button>
        ))}
      </div>

      {doEscopo.length === 0 ? (
        <div className="cartao">
          <h2>Nenhum provento lançado{escopo === FAMILIA ? '' : ` para ${nomeEscopo}`}</h2>
          <p className="muted">Lance abaixo os dividendos, JCP e rendimentos de FIIs que cair na conta.</p>
        </div>
      ) : (
        <>
          <div className="controles">
            <label className="controle">
              <span className="controle-rotulo">Período</span>
              <select value={ano} onChange={(e) => setAno(e.target.value)}>
                <option value={TODOS}>Todo o histórico</option>
                {anos.map((a) => (
                  <option key={a.ano} value={String(a.ano)}>
                    {a.ano}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="tiles">
            <div className="tile">
              <p className="rotulo-cartao">
                Recebido · {nomeEscopo} · {anoNum ?? 'total'}
              </p>
              <ValorDuplo brl={totalPeriodo.brl} usd={totalPeriodo.usd} tamanho="pequeno" />
            </div>
            <div className="tile">
              <p className="rotulo-cartao">Média anual</p>
              <ValorDuplo brl={media.brl} usd={media.usd} tamanho="pequeno" />
              <p className="tile-pct">todo o histórico, em base de 12 meses</p>
            </div>
          </div>

          <div className="cartao">
            <h2>Últimos 12 meses</h2>
            <GraficoBarrasMes pontos={meses} />
          </div>

          <div className="cartao">
            <h2>Por ativo · {anoNum ?? 'todo o histórico'}</h2>
            {porAtivo.length === 0 ? (
              <p className="muted">Nenhum provento neste período.</p>
            ) : (
              <>
                <BarrasInstituicoes
                  fatias={porAtivo}
                  rotulo="Proventos por ativo"
                  todo="dos proventos"
                />
                <h3 className="subtitulo-ajustes">Média anual de cada ativo</h3>
                <ul className="lista-simples">
                  {[...porAtivo]
                    .sort((a, b) => b.media.brl - a.media.brl)
                    .map((f) => (
                      <li key={f.id}>
                        <span>{f.nome}</span>
                        <span>
                          <Valor valor={f.media.brl} moeda="BRL" />
                          {' · '}
                          <Valor valor={f.media.usd} moeda="USD" />
                        </span>
                      </li>
                    ))}
                </ul>
              </>
            )}
          </div>

          <div className="cartao">
            <h2>Ano a ano</h2>
            <ul className="lista-simples">
              {anos.map((a) => (
                <li key={a.ano}>
                  <span>{a.ano}</span>
                  <span>
                    <Valor valor={a.brl} moeda="BRL" />
                    {' · '}
                    <Valor valor={a.usd} moeda="USD" />
                  </span>
                </li>
              ))}
            </ul>
            <p className="muted pequeno">
              Dólar convertido pelo câmbio do dia em que cada provento foi lançado. A média anual
              divide o total pelo tempo de histórico (mínimo de 12 meses, para não inflar quem
              começou há pouco).
            </p>
          </div>
        </>
      )}

      <form className="cartao formulario" onSubmit={salvar}>
        <h2>Lançar provento</h2>
        <div className="controles">
          <label className="controle">
            <span className="controle-rotulo">Pessoa</span>
            <select
              value={pessoaId}
              onChange={(e) => {
                setPessoaForm(e.target.value)
                setAtivoId('')
              }}
            >
              {membros.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="controle">
            <span className="controle-rotulo">Ativo</span>
            <select value={ativoId} onChange={(e) => { setAtivoId(e.target.value); setMoedaForm('') }}>
              <option value="">Escolher…</option>
              {opcoesAtivo.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.ticker}
                </option>
              ))}
            </select>
          </label>
          <label className="controle">
            <span className="controle-rotulo">Mês do recebimento</span>
            <input type="month" value={mesTxt} onChange={(e) => setMesTxt(e.target.value)} />
          </label>
          <label className="controle">
            <span className="controle-rotulo">Tipo</span>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoProvento)}>
              {(Object.keys(ROTULO_TIPO) as TipoProvento[]).map((t) => (
                <option key={t} value={t}>
                  {ROTULO_TIPO[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="controle">
            <span className="controle-rotulo">Valor líquido recebido ({moeda === 'BRL' ? 'R$' : 'US$'})</span>
            <input
              type="text"
              inputMode="decimal"
              value={valorTxt}
              onChange={(e) => setValorTxt(e.target.value)}
              placeholder="0,00"
            />
          </label>
          <label className="controle">
            <span className="controle-rotulo">Moeda</span>
            <select value={moeda} onChange={(e) => setMoedaForm(e.target.value as Moeda)}>
              <option value="BRL">Real (R$)</option>
              <option value="USD">Dólar (US$)</option>
            </select>
          </label>
          <label className="controle">
            <span className="controle-rotulo">Dólar do dia (R$)</span>
            <input
              type="text"
              inputMode="decimal"
              value={cambioTxt}
              onChange={(e) => {
                setCambioTxt(e.target.value)
                setCambioMexido(true)
              }}
            />
          </label>
          <label className="controle">
            <span className="controle-rotulo">Observação (opcional)</span>
            <input type="text" value={obs} onChange={(e) => setObs(e.target.value)} />
          </label>
        </div>
        <label className="caixa-marcar">
          <input type="checkbox" checked={verTodos} onChange={(e) => setVerTodos(e.target.checked)} />
          Mostrar todos os ativos, não só os da carteira desta pessoa
        </label>
        {msg && (
          <p className={msg.tipo === 'ok' ? 'ok' : 'erro'} role="status">
            {msg.texto}
          </p>
        )}
        <button type="submit" className="botao" disabled={salvando}>
          {salvando ? 'Salvando…' : 'Salvar provento'}
        </button>
      </form>

      {recentes.length > 0 && (
        <div className="cartao">
          <h2>Últimos lançamentos</h2>
          <ul className="lista-simples">
            {recentes.map((p) => {
              const a = nomeAtivo.get(p.ativo_id)
              const v = valoresDe(p)
              return (
                <li key={p.id}>
                  <span>
                    {rotuloMes(p.mes)} · <strong>{a?.ticker ?? '?'}</strong> · {ROTULO_TIPO[p.tipo]}
                    {escopo === FAMILIA && (
                      <span className="muted"> · {nomePessoa.get(p.pessoa_id)}</span>
                    )}
                  </span>
                  <span className="linha-com-botao">
                    <Valor valor={p.moeda === 'BRL' ? v.brl : v.usd} moeda={p.moeda} />
                    <button
                      type="button"
                      className="botao-icone"
                      aria-label={`Excluir provento de ${a?.ticker ?? ''}`}
                      onClick={() => void excluir(p.id, a?.ticker ?? '')}
                    >
                      ×
                    </button>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
