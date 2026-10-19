import { useMemo, useState, type FormEvent } from 'react'
import BarrasInstituicoes from '../components/BarrasInstituicoes'
import { Valor, ValorDuplo } from '../components/Valor'
import { useAtivos } from '../contexts/AtivosContext'
import { useCambio } from '../contexts/CambioContext'
import { useDados } from '../contexts/DadosContext'
import { usePreferencias } from '../contexts/PreferenciasContext'
import {
  CLASSES,
  ROTULO_CLASSE,
  ROTULO_CLASSE_UM,
  carteira,
  diasEntre,
  ehManual,
  moedaPadrao,
  porAtivoCarteira,
  porClasse,
  precoMaisAntigo,
  simboloPadrao,
} from '../lib/ativos'
import { lerValor } from '../lib/calculos'
import { dataHoje, formatarPercentual, type Moeda } from '../lib/formato'
import { supabase } from '../lib/supabase'
import type { ClasseAtivo } from '../lib/tipos'

const FAMILIA = 'familia'
const NOVO = '__novo__'

const numero = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 8 })
const dataBR = (d: string) => d.split('-').reverse().join('/')

function Resultado({ valor, pct }: { valor: number | null; pct: number | null }) {
  const { privado } = usePreferencias()
  if (valor === null || pct === null) return <span className="muted">sem preço</span>
  const sinal = valor > 0 ? '▲ +' : valor < 0 ? '▼ ' : ''
  return (
    <span className={`resultado ${valor > 0 ? 'pos' : valor < 0 ? 'neg' : ''}`}>
      {privado ? '••••' : `${sinal}${formatarPercentual(pct)}`}
    </span>
  )
}

interface PropsForm {
  pessoaId: string
  pessoaNome: string
  ativoInicial: string
  onFim: () => void
}

function FormPosicao({ pessoaId, pessoaNome, ativoInicial, onFim }: PropsForm) {
  const { ativos, posicoes, cotacoes, recarregar } = useAtivos()
  const [ativoId, setAtivoId] = useState(ativoInicial)
  const existente = ativos.find((a) => a.id === ativoId) ?? null
  const posicao = posicoes.find((p) => p.pessoa_id === pessoaId && p.ativo_id === ativoId) ?? null

  const [ticker, setTicker] = useState('')
  const [nome, setNome] = useState('')
  const [classe, setClasse] = useState<ClasseAtivo>('acao')
  const [moeda, setMoeda] = useState<Moeda>('BRL')
  const [simbolo, setSimbolo] = useState('')
  const [simboloMexido, setSimboloMexido] = useState(false)
  const [qtd, setQtd] = useState(posicao ? numero(posicao.quantidade) : '')
  const [pm, setPm] = useState(posicao ? numero(posicao.preco_medio) : '')
  const [preco, setPreco] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const novo = ativoId === NOVO
  const simboloAuto = novo ? simboloPadrao(ticker || 'TICKER', classe) : ''
  const moedaAtivo: Moeda = novo ? moeda : (existente?.moeda ?? 'BRL')
  const classeAtivo: ClasseAtivo = novo ? classe : (existente?.classe ?? 'acao')
  const manual = ehManual(classeAtivo)
  const simboloAtual = novo
    ? simboloMexido
      ? simbolo
      : simboloAuto
    : simboloMexido
      ? simbolo
      : (existente?.simbolo_cotacao ?? '')

  function escolher(id: string) {
    setAtivoId(id)
    setSimboloMexido(false)
    setMsg(null)
    const p = posicoes.find((x) => x.pessoa_id === pessoaId && x.ativo_id === id)
    setQtd(p ? numero(p.quantidade) : '')
    setPm(p ? numero(p.preco_medio) : '')
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setMsg(null)
    const q = lerValor(qtd)
    const p = pm.trim() === '' ? 0 : lerValor(pm)
    if (q === null || q < 0) return setMsg('Informe a quantidade (ex.: 100 ou 0,05).')
    if (p === null || p < 0) return setMsg('O preço médio está inválido.')
    const precoAgora = preco.trim() === '' ? null : lerValor(preco)
    if (precoAgora !== null && precoAgora <= 0) return setMsg('O preço atual está inválido.')
    if (preco.trim() !== '' && precoAgora === null) return setMsg('O preço atual está inválido.')

    setSalvando(true)
    try {
      let id = ativoId
      if (novo) {
        const t = ticker.trim().toUpperCase()
        if (!t) throw new Error('Informe o código do ativo (ex.: PETR4, AAPL, BTC).')
        const cod = simboloAtual.trim()
        if (!cod) throw new Error('Informe o código de cotação.')
        const { data, error } = await supabase
          .from('ativos')
          .insert({ ticker: t, nome: nome.trim() || null, classe, moeda, simbolo_cotacao: cod })
          .select('id')
          .single()
        if (error) {
          throw new Error(
            error.message.toLowerCase().includes('duplicate')
              ? `${t} já está cadastrado. Escolha-o na lista.`
              : error.message,
          )
        }
        id = data.id as string
      } else if (existente && simboloMexido && simbolo.trim() && simbolo.trim() !== existente.simbolo_cotacao) {
        const { error } = await supabase
          .from('ativos')
          .update({ simbolo_cotacao: simbolo.trim() })
          .eq('id', existente.id)
        if (error) throw new Error(error.message)
      }
      if (!id) throw new Error('Escolha o ativo.')
      const { error } = await supabase
        .from('posicoes')
        .upsert(
          { pessoa_id: pessoaId, ativo_id: id, quantidade: q, preco_medio: p },
          { onConflict: 'pessoa_id,ativo_id' },
        )
      if (error) throw new Error(error.message)
      if (precoAgora !== null) {
        const r = await supabase
          .from('cotacoes')
          .upsert(
            { ativo_id: id, data: dataHoje(), preco: precoAgora, fonte: 'manual' },
            { onConflict: 'ativo_id,data' },
          )
        if (r.error) throw new Error(r.error.message)
      }
      await recarregar()
      onFim()
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setSalvando(false)
    }
  }

  async function excluir() {
    if (!posicao || !existente) return
    if (!window.confirm(`Remover ${existente.ticker} da carteira de ${pessoaNome}?`)) return
    const { error } = await supabase.from('posicoes').delete().eq('id', posicao.id)
    if (error) return setMsg(error.message)
    await recarregar()
    onFim()
  }

  const ultimo = existente ? cotacoes.get(existente.id) : undefined

  return (
    <form className="cartao formulario" onSubmit={salvar}>
      <h2>{posicao ? `Editar posição de ${pessoaNome}` : `Adicionar ativo para ${pessoaNome}`}</h2>

      <label className="controle">
        <span className="controle-rotulo">Ativo</span>
        <select value={ativoId} onChange={(e) => escolher(e.target.value)}>
          <option value="">Escolher…</option>
          {ativos.map((a) => (
            <option key={a.id} value={a.id}>
              {a.ticker} · {ROTULO_CLASSE_UM[a.classe]}
            </option>
          ))}
          <option value={NOVO}>＋ Novo ativo…</option>
        </select>
      </label>

      {novo && (
        <div className="controles">
          <label className="controle">
            <span className="controle-rotulo">Código (ticker)</span>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              placeholder="PETR4, XPML11, AAPL, BTC"
              autoCapitalize="characters"
            />
          </label>
          <label className="controle">
            <span className="controle-rotulo">Tipo</span>
            <select
              value={classe}
              onChange={(e) => {
                const c = e.target.value as ClasseAtivo
                setClasse(c)
                setMoeda(moedaPadrao(c))
                setSimboloMexido(false)
              }}
            >
              {CLASSES.map((c) => (
                <option key={c} value={c}>
                  {ROTULO_CLASSE_UM[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="controle">
            <span className="controle-rotulo">Moeda do preço</span>
            <select value={moeda} onChange={(e) => setMoeda(e.target.value as Moeda)}>
              <option value="BRL">Real (R$)</option>
              <option value="USD">Dólar (US$)</option>
            </select>
          </label>
          <label className="controle">
            <span className="controle-rotulo">Nome (opcional)</span>
            <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} />
          </label>
        </div>
      )}

      {(novo || existente) && (
        <>
          <div className="controles">
            <label className="controle">
              <span className="controle-rotulo">Quantidade</span>
              <input
                type="text"
                inputMode="decimal"
                value={qtd}
                onChange={(e) => setQtd(e.target.value)}
                placeholder="0"
              />
            </label>
            <label className="controle">
              <span className="controle-rotulo">Preço médio ({moedaAtivo === 'BRL' ? 'R$' : 'US$'})</span>
              <input
                type="text"
                inputMode="decimal"
                value={pm}
                onChange={(e) => setPm(e.target.value)}
                placeholder="0,00"
              />
            </label>
            <label className="controle">
              <span className="controle-rotulo">{manual ? 'Valor atual de 1 unidade' : 'Preço atual (opcional)'}</span>
              <input
                type="text"
                inputMode="decimal"
                value={preco}
                onChange={(e) => setPreco(e.target.value)}
                placeholder={ultimo ? numero(ultimo.preco) : 'só se faltar'}
              />
            </label>
            {!manual && (
              <label className="controle">
                <span className="controle-rotulo">Código para buscar o preço</span>
                <input
                  type="text"
                  value={simboloAtual}
                  onChange={(e) => {
                    setSimbolo(e.target.value)
                    setSimboloMexido(true)
                  }}
                />
              </label>
            )}
          </div>
          {manual ? (
            <p className="muted pequeno">
              Renda fixa e Tesouro Direto não têm cotação automática. Dica: use quantidade 1, o valor aplicado como
              preço médio e, de tempos em tempos, digite o valor atual (o que o banco ou o Tesouro mostra) no campo
              acima. Ele vale como preço de hoje.
            </p>
          ) : (
            <p className="muted pequeno">
              O preço médio é o que você pagou, na moeda do ativo. O preço atual é atualizado sozinho
              toda noite; só digite aqui se o ativo ainda estiver sem preço.
            </p>
          )}
        </>
      )}

      {msg && (
        <p className="erro" role="alert">
          {msg}
        </p>
      )}
      <div className="linha-botoes">
        <button type="submit" className="botao" disabled={salvando || !ativoId}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
        <button type="button" className="botao botao-secundario" onClick={onFim}>
          Cancelar
        </button>
        {posicao && (
          <button type="button" className="botao botao-perigo" onClick={() => void excluir()}>
            Remover da carteira
          </button>
        )}
      </div>
    </form>
  )
}

export default function Ativos() {
  const { pessoas, carregando: carregandoPessoas, erro: erroPessoas } = useDados()
  const { ativos, posicoes, cotacoes, carregando, erro } = useAtivos()
  const { taxa } = useCambio()
  const [escopo, setEscopo] = useState(FAMILIA)
  const [form, setForm] = useState<{ chave: number; ativoId: string } | null>(null)

  const membros = useMemo(() => pessoas.filter((p) => p.entra_na_familia), [pessoas])
  const monitoradas = useMemo(() => pessoas.filter((p) => !p.entra_na_familia), [pessoas])
  const idsEscopo = useMemo(
    () => new Set(escopo === FAMILIA ? membros.map((m) => m.id) : [escopo]),
    [escopo, membros],
  )
  const cambio = taxa ?? 1
  const cart = useMemo(
    () => carteira(posicoes, ativos, cotacoes, idsEscopo, cambio),
    [posicoes, ativos, cotacoes, idsEscopo, cambio],
  )
  const classes = useMemo(() => porClasse(cart.linhas), [cart.linhas])
  const fatiasAtivos = useMemo(() => porAtivoCarteira(cart.linhas), [cart.linhas])

  if (carregando || carregandoPessoas) return <p className="muted">Carregando…</p>
  if (erro || erroPessoas) {
    return (
      <div className="cartao">
        <h2>Não foi possível carregar os dados</h2>
        <p className="erro">{erro ?? erroPessoas}</p>
      </div>
    )
  }

  const pessoaDoEscopo = pessoas.find((p) => p.id === escopo) ?? null
  const editavel = escopo !== FAMILIA && pessoaDoEscopo !== null
  const nomeEscopo = escopo === FAMILIA ? 'Família' : (pessoaDoEscopo?.nome ?? '')
  const foraDaFamilia = pessoaDoEscopo !== null && !pessoaDoEscopo.entra_na_familia
  const maisAntigo = precoMaisAntigo(cart.linhas)
  const atraso = maisAntigo ? diasEntre(maisAntigo, dataHoje()) : 0
  const resultadoBrl = cart.total.brl - cart.custo.brl
  const comPreco = cart.linhas.filter((l) => !l.semPreco)
  const valorComPreco = comPreco.reduce((a, l) => a + l.brl, 0)
  const custoComPreco = comPreco.reduce((a, l) => a + l.custoBrl, 0)
  const pctGeral = custoComPreco > 0 ? ((valorComPreco - custoComPreco) / custoComPreco) * 100 : null

  const abas = [
    { id: FAMILIA, nome: 'Família' },
    ...membros,
    ...monitoradas.map((m) => ({ id: m.id, nome: `${m.nome} (monitor)` })),
  ]

  return (
    <section>
      <h1 className="titulo-pagina">Ativos</h1>

      <div className="abas" role="tablist" aria-label="Quem ver">
        {abas.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={escopo === a.id}
            className={`aba ${escopo === a.id ? 'ativa' : ''}`}
            onClick={() => {
              setEscopo(a.id)
              setForm(null)
            }}
          >
            {a.nome}
          </button>
        ))}
      </div>

      {foraDaFamilia && (
        <p className="aviso-suave">
          {nomeEscopo} só aparece aqui, para acompanhamento. Não entra na soma da Família nem no
          Patrimônio.
        </p>
      )}

      <div className="cartao">
        <p className="rotulo-cartao">Carteira · {nomeEscopo}</p>
        {cart.linhas.length === 0 ? (
          <p className="muted">
            {editavel
              ? 'Nenhum ativo ainda. Use o botão abaixo para adicionar o primeiro.'
              : 'Nenhum ativo cadastrado. Escolha uma pessoa para adicionar.'}
          </p>
        ) : (
          <>
            <ValorDuplo brl={cart.total.brl} usd={cart.total.usd} tamanho="hero" />
            <p className="muted resumo-resultado">
              Investido: <Valor valor={cart.custo.brl} moeda="BRL" /> · Resultado:{' '}
              <Valor valor={resultadoBrl} moeda="BRL" />{' '}
              (<Resultado valor={comPreco.length ? resultadoBrl : null} pct={pctGeral} />)
            </p>
            {cart.semPreco > 0 && (
              <p className="aviso-suave">
                {cart.semPreco === 1 ? '1 ativo está sem preço' : `${cart.semPreco} ativos estão sem preço`}:
                {' '}valorizado{cart.semPreco === 1 ? '' : 's'} pelo preço médio até o primeiro
                preço chegar (a rotina roda toda noite).
              </p>
            )}
            {atraso > 4 && maisAntigo && (
              <p className="aviso-suave">
                Há preços de {dataBR(maisAntigo)} ({atraso} dias). Confira a rotina em GitHub →
                Actions → Atualizar cotações.
              </p>
            )}
            {taxa === null && cart.linhas.some((l) => l.moeda === 'USD') && (
              <p className="aviso-suave">Sem cotação do dólar: ativos em dólar estão sem conversão correta.</p>
            )}
          </>
        )}
        {editavel && !form && (
          <button
            type="button"
            className="botao botao-secundario"
            onClick={() => setForm({ chave: Date.now(), ativoId: '' })}
          >
            ＋ Adicionar ativo
          </button>
        )}
      </div>

      {editavel && form && pessoaDoEscopo && (
        <FormPosicao
          key={form.chave}
          pessoaId={pessoaDoEscopo.id}
          pessoaNome={pessoaDoEscopo.nome}
          ativoInicial={form.ativoId}
          onFim={() => setForm(null)}
        />
      )}

      {cart.linhas.length > 0 && (
        <>
          <div className="cartao">
            <h2>Por tipo de ativo</h2>
            <BarrasInstituicoes fatias={classes} rotulo="Participação por tipo de ativo" todo="da carteira" />
          </div>

          <div className="cartao">
            <h2>Por ativo</h2>
            <BarrasInstituicoes
              fatias={fatiasAtivos.slice(0, 12)}
              rotulo="Participação por ativo"
              todo="da carteira"
            />
            {fatiasAtivos.length > 12 && (
              <p className="muted pequeno">Mostrando os 12 maiores de {fatiasAtivos.length}.</p>
            )}
          </div>

          <div className="cartao">
            <h2>Posições</h2>
            <ul className="lista-ativos">
              {cart.linhas.map((l) => (
                <li key={l.ativoId} className="ativo-linha">
                  <div className="ativo-topo">
                    <div>
                      <span className="ativo-ticker">{l.ticker}</span>{' '}
                      <span className="selo">{ROTULO_CLASSE[l.classe]}</span>
                      {l.nome && <div className="muted pequeno">{l.nome}</div>}
                    </div>
                    <div className="ativo-valor">
                      <ValorDuplo brl={l.brl} usd={l.usd} tamanho="pequeno" />
                    </div>
                  </div>
                  <div className="ativo-detalhe muted">
                    <span>
                      {numero(l.quantidade)} × PM <Valor valor={l.precoMedio} moeda={l.moeda} />
                    </span>
                    <span>
                      {l.preco !== null && l.dataPreco ? (
                        <>
                          Preço <Valor valor={l.preco} moeda={l.moeda} /> em {dataBR(l.dataPreco)}
                        </>
                      ) : (
                        'Sem preço ainda'
                      )}
                    </span>
                    <span>
                      <Resultado valor={l.resultado} pct={l.resultadoPct} />
                    </span>
                    {editavel && (
                      <button
                        type="button"
                        className="link-discreto"
                        onClick={() => setForm({ chave: Date.now(), ativoId: l.ativoId })}
                      >
                        Editar
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <p className="total-linha">
              <span>Total</span>
              <span>
                <Valor valor={cart.total.brl} moeda="BRL" />
                {' · '}
                <Valor valor={cart.total.usd} moeda="USD" />
              </span>
            </p>
          </div>
        </>
      )}
    </section>
  )
}
