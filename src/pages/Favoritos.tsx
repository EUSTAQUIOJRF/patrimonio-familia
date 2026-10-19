import { useEffect, useMemo, useState, type FormEvent } from 'react'
import Sparkline from '../components/Sparkline'
import { useAtivos } from '../contexts/AtivosContext'
import {
  CLASSES,
  ROTULO_CLASSE_UM,
  ehManual,
  moedaPadrao,
  simboloPadrao,
} from '../lib/ativos'
import { formatarVariacao, tempoRelativo } from '../lib/apresentacao'
import { formatarMoeda, type Moeda } from '../lib/formato'
import { buscarNoticias, type Noticia } from '../lib/mercado'
import { supabase } from '../lib/supabase'
import type { ClasseAtivo } from '../lib/tipos'
import { useCotacoesAoVivo } from '../lib/useAoVivo'

const NOVO = '__novo__'
const GERAL = '__geral__'
const TODOS = '__todos__'

type FiltroOrigem = 'todas' | 'BR' | 'EXT'

const hora = (t: number) =>
  new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

export default function Favoritos() {
  const { ativos, favoritos, avisoFavoritos, cotacoes, carregando, erro, recarregar } = useAtivos()

  const lista = useMemo(() => {
    const mapa = new Map(ativos.map((a) => [a.id, a]))
    return favoritos.flatMap((f) => {
      const a = mapa.get(f.ativo_id)
      return a ? [a] : []
    })
  }, [ativos, favoritos])
  const simbolos = useMemo(() => lista.filter((a) => !ehManual(a.classe)).map((a) => a.simbolo_cotacao), [lista])
  const vivo = useCotacoesAoVivo(simbolos)

  // ---- adicionar favorito
  const [escolha, setEscolha] = useState('')
  const [ticker, setTicker] = useState('')
  const [classe, setClasse] = useState<ClasseAtivo>('acao')
  const [moeda, setMoeda] = useState<Moeda>('BRL')
  const [simbolo, setSimbolo] = useState('')
  const [simboloMexido, setSimboloMexido] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const jaFavoritos = useMemo(() => new Set(favoritos.map((f) => f.ativo_id)), [favoritos])
  const disponiveis = ativos.filter((a) => !jaFavoritos.has(a.id) && !ehManual(a.classe))
  const simboloAuto = simboloPadrao(ticker || 'TICKER', classe)

  async function adicionar(e: FormEvent) {
    e.preventDefault()
    setMsg(null)
    setSalvando(true)
    try {
      let id = escolha
      if (escolha === NOVO) {
        const t = ticker.trim().toUpperCase()
        if (!t) throw new Error('Informe o código do ativo (ex.: PETR4, AAPL, BTC).')
        const cod = (simboloMexido ? simbolo : simboloAuto).trim()
        const { data, error } = await supabase
          .from('ativos')
          .insert({ ticker: t, classe, moeda, simbolo_cotacao: cod })
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
      }
      if (!id) throw new Error('Escolha um ativo.')
      const { error } = await supabase
        .from('favoritos')
        .insert({ ativo_id: id, ordem: favoritos.length })
      if (error) throw new Error(error.message)
      await recarregar()
      setEscolha('')
      setTicker('')
      setSimbolo('')
      setSimboloMexido(false)
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setSalvando(false)
    }
  }

  async function remover(ativoId: string, nome: string) {
    if (!window.confirm(`Tirar ${nome} dos favoritos? (O ativo e a carteira não são afetados.)`)) return
    const { error } = await supabase.from('favoritos').delete().eq('ativo_id', ativoId)
    if (error) return setMsg(error.message)
    await recarregar()
  }

  // ---- notícias
  const [noticias, setNoticias] = useState<Noticia[]>([])
  const [carregandoNoticias, setCarregandoNoticias] = useState(false)
  const [erroNoticias, setErroNoticias] = useState<string | null>(null)
  const [filtroOrigem, setFiltroOrigem] = useState<FiltroOrigem>('todas')
  const [filtroAtivo, setFiltroAtivo] = useState(TODOS)
  const [agora, setAgora] = useState(() => Date.now())

  const tickersNoticia = useMemo(() => lista.map((a) => a.simbolo_cotacao), [lista])
  const chaveNoticias = tickersNoticia.join(',')

  useEffect(() => {
    let cancelado = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCarregandoNoticias(true)
    buscarNoticias(chaveNoticias ? chaveNoticias.split(',') : [], true)
      .then((n) => {
        if (cancelado) return
        setNoticias(n)
        setErroNoticias(null)
        setAgora(Date.now())
      })
      .catch((e: unknown) => {
        if (!cancelado) setErroNoticias(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (!cancelado) setCarregandoNoticias(false)
      })
    return () => {
      cancelado = true
    }
  }, [chaveNoticias])

  const nomePorSimbolo = useMemo(() => new Map(lista.map((a) => [a.simbolo_cotacao, a.ticker])), [lista])
  const visiveis = noticias.filter((n) => {
    if (filtroOrigem !== 'todas' && n.origem !== filtroOrigem) return false
    if (filtroAtivo === TODOS) return true
    if (filtroAtivo === GERAL) return n.ativo === null
    return n.ativo === filtroAtivo
  })

  if (carregando) return <p className="muted">Carregando…</p>
  if (erro) {
    return (
      <div className="cartao">
        <h2>Não foi possível carregar os dados</h2>
        <p className="erro">{erro}</p>
      </div>
    )
  }

  return (
    <section>
      <h1 className="titulo-pagina">Favoritos</h1>
      {avisoFavoritos && <p className="erro">{avisoFavoritos}</p>}

      <div className="cartao">
        <div className="cartao-topo">
          <h2>Cotações</h2>
          <button
            type="button"
            className="botao botao-secundario botao-pequeno"
            onClick={() => void vivo.atualizar()}
            disabled={vivo.carregando || lista.length === 0}
          >
            {vivo.carregando ? 'Atualizando…' : 'Atualizar agora'}
          </button>
        </div>
        <p className="muted pequeno">
          Atualiza sozinha a cada minuto com a tela aberta. As bolsas podem ter atraso de até cerca
          de 15 minutos.
          {vivo.atualizadoEm && ` Última atualização às ${hora(vivo.atualizadoEm)}.`}
        </p>
        {vivo.erro && (
          <p className="aviso-suave" role="status">
            {vivo.erro} Mostrando o último preço salvo, quando houver.
          </p>
        )}

        {lista.length === 0 ? (
          <p className="muted">Nenhum favorito ainda. Adicione o primeiro abaixo.</p>
        ) : (
          <ul className="lista-ativos">
            {lista.map((a) => {
              const c = vivo.dados[a.simbolo_cotacao]
              const ok = c && c.erro === undefined ? c : null
              const salvo = cotacoes.get(a.id)
              const m = a.moeda
              return (
                <li key={a.id} className="ativo-linha fav-linha">
                  <div className="fav-nome">
                    <span className="ativo-ticker">{a.ticker}</span>{' '}
                    <span className="selo">{ROTULO_CLASSE_UM[a.classe]}</span>
                    {a.nome && <div className="muted pequeno">{a.nome}</div>}
                  </div>
                  <div className="fav-grafico">
                    {ok ? (
                      <Sparkline
                        serie={ok.serie}
                        rotulo={`${a.ticker}: variação do último mês`}
                      />
                    ) : null}
                  </div>
                  <div className="fav-preco">
                    {ok ? (
                      <>
                        <div className="valor-grande-fav">
                          {formatarMoeda(ok.preco, m)}
                        </div>
                        {ok.variacaoPct !== null && (
                          <div
                            className={`resultado ${ok.variacaoPct > 0 ? 'pos' : ok.variacaoPct < 0 ? 'neg' : ''}`}
                          >
                            {formatarVariacao(ok.variacaoPct)}
                          </div>
                        )}
                      </>
                    ) : salvo ? (
                      <>
                        <div className="valor-grande-fav">{formatarMoeda(salvo.preco, m)}</div>
                        <div className="muted pequeno">
                          preço salvo de {salvo.data.split('-').reverse().join('/')}
                        </div>
                      </>
                    ) : (
                      <div className="muted pequeno">
                        {vivo.carregando ? 'buscando…' : c?.erro ? 'sem preço' : '—'}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="botao-icone"
                    aria-label={`Tirar ${a.ticker} dos favoritos`}
                    onClick={() => void remover(a.id, a.ticker)}
                  >
                    ×
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <form className="cartao formulario" onSubmit={adicionar}>
        <h2>Adicionar favorito</h2>
        <label className="controle">
          <span className="controle-rotulo">Ativo</span>
          <select value={escolha} onChange={(e) => setEscolha(e.target.value)}>
            <option value="">Escolher…</option>
            {disponiveis.map((a) => (
              <option key={a.id} value={a.id}>
                {a.ticker} · {ROTULO_CLASSE_UM[a.classe]}
              </option>
            ))}
            <option value={NOVO}>＋ Novo ativo (que não tenho)…</option>
          </select>
        </label>
        {escolha === NOVO && (
          <div className="controles">
            <label className="controle">
              <span className="controle-rotulo">Código (ticker)</span>
              <input
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                placeholder="WEGE3, MSFT, ETH"
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
                }}
              >
                {CLASSES.filter((c) => !ehManual(c)).map((c) => (
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
              <span className="controle-rotulo">Código para buscar o preço</span>
              <input
                type="text"
                value={simboloMexido ? simbolo : simboloAuto}
                onChange={(e) => {
                  setSimbolo(e.target.value)
                  setSimboloMexido(true)
                }}
              />
            </label>
          </div>
        )}
        {msg && (
          <p className="erro" role="alert">
            {msg}
          </p>
        )}
        <button type="submit" className="botao" disabled={salvando || !escolha}>
          {salvando ? 'Salvando…' : 'Adicionar aos favoritos'}
        </button>
      </form>

      <div className="cartao">
        <h2>Notícias</h2>
        <div className="controles">
          <div className="controle">
            <span className="controle-rotulo">Imprensa</span>
            <div className="segmentado" role="group" aria-label="Origem da notícia">
              {(
                [
                  ['todas', 'Todas'],
                  ['BR', 'Brasil'],
                  ['EXT', 'Exterior'],
                ] as const
              ).map(([v, r]) => (
                <button key={v} type="button" aria-pressed={filtroOrigem === v} onClick={() => setFiltroOrigem(v)}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <label className="controle">
            <span className="controle-rotulo">Assunto</span>
            <select value={filtroAtivo} onChange={(e) => setFiltroAtivo(e.target.value)}>
              <option value={TODOS}>Todos os favoritos e o mercado</option>
              <option value={GERAL}>Mercado em geral</option>
              {lista.map((a) => (
                <option key={a.id} value={a.simbolo_cotacao}>
                  {a.ticker}
                </option>
              ))}
            </select>
          </label>
        </div>

        {carregandoNoticias && noticias.length === 0 && <p className="muted">Buscando notícias…</p>}
        {erroNoticias && <p className="aviso-suave">{erroNoticias}</p>}
        {!carregandoNoticias && !erroNoticias && visiveis.length === 0 && (
          <p className="muted">Nenhuma notícia encontrada com esse filtro.</p>
        )}
        <ul className="noticias">
          {visiveis.map((n) => (
            <li key={`${n.origem}|${n.link}`} className={`noticia noticia-${n.origem === 'BR' ? 'br' : 'ext'}`}>
              <div className="noticia-meta">
                <span className={`noticia-selo noticia-selo-${n.origem === 'BR' ? 'br' : 'ext'}`}>
                  {n.origem === 'BR' ? 'Brasil' : 'Exterior'}
                </span>
                {n.ativo && <span className="selo">{nomePorSimbolo.get(n.ativo) ?? n.ativo}</span>}
                <span className="muted pequeno">
                  {n.fonte}
                  {n.data && ` · ${tempoRelativo(n.data, agora)}`}
                </span>
              </div>
              <a href={n.link} target="_blank" rel="noopener noreferrer" className="noticia-titulo">
                {n.titulo}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
