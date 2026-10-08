import { useEffect, useMemo, useState, type FormEvent } from 'react'
import CambioInfo from '../components/CambioInfo'
import { Valor } from '../components/Valor'
import { useCambio } from '../contexts/CambioContext'
import { useDados } from '../contexts/DadosContext'
import { usePreferencias } from '../contexts/PreferenciasContext'
import { lerValor } from '../lib/calculos'
import { montarLinhas, prepararEnvio, type Linha } from '../lib/lancamento'
import { mesAtual, rotuloMes, type Moeda } from '../lib/formato'
import { supabase } from '../lib/supabase'
import type { TipoInstituicao } from '../lib/tipos'

const NOVA = '__nova__'

export default function Lancar() {
  const { pessoas, instituicoes, saldos, carregando, erro, recarregar, recarregarCadastro } =
    useDados()
  const { taxa } = useCambio()
  const { privado } = usePreferencias()

  const membros = useMemo(() => pessoas.filter((p) => p.entra_na_familia), [pessoas])
  const [pessoaEscolhida, setPessoaEscolhida] = useState<string | null>(null)
  const pessoaId = pessoaEscolhida ?? membros[0]?.id ?? ''
  const [mesTexto, setMesTexto] = useState(mesAtual().slice(0, 7))
  const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(mesTexto) ? `${mesTexto}-01` : null

  const [linhas, setLinhas] = useState<Linha[]>([])
  const [cambioTxt, setCambioTxt] = useState('')
  const [cambioMexido, setCambioMexido] = useState(false)
  const [reaplicar, setReaplicar] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  // Linha nova
  const [novaInst, setNovaInst] = useState('')
  const [novaMoeda, setNovaMoeda] = useState<Moeda>('BRL')
  const [nomeInst, setNomeInst] = useState('')
  const [tipoInst, setTipoInst] = useState<TipoInstituicao>('banco')
  const [paisInst, setPaisInst] = useState('BR')

  // Recria a lista ao trocar de pessoa/mês ou depois de salvar (os saldos são recarregados).
  useEffect(() => {
    if (!pessoaId || !mes) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLinhas([])
      return
    }
    setLinhas(montarLinhas(saldos, pessoaId, mes))
  }, [saldos, pessoaId, mes])

  // Preenche o câmbio com a cotação do dia, a menos que a pessoa já tenha digitado outro.
  useEffect(() => {
    if (!cambioMexido && taxa !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCambioTxt(String(taxa).replace('.', ','))
    }
  }, [taxa, cambioMexido])

  const nomes = useMemo(() => new Map(instituicoes.map((i) => [i.id, i.nome])), [instituicoes])
  const ordenadas = useMemo(
    () =>
      [...linhas].sort(
        (a, b) =>
          (nomes.get(a.instituicaoId) ?? '').localeCompare(nomes.get(b.instituicaoId) ?? '', 'pt-BR') ||
          a.moeda.localeCompare(b.moeda),
      ),
    [linhas, nomes],
  )

  const cambio = lerValor(cambioTxt)

  const digitado = useMemo(() => {
    let brl = 0
    let usd = 0
    if (!cambio || cambio <= 0) return null
    for (const l of linhas) {
      const v = lerValor(l.texto)
      if (v === null) continue
      if (l.moeda === 'BRL') {
        brl += v
        usd += v / cambio
      } else {
        usd += v
        brl += v * cambio
      }
    }
    return { brl, usd }
  }, [linhas, cambio])

  function mudarTexto(chave: string, texto: string) {
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, texto } : l)))
  }

  async function adicionarLinha(e: FormEvent) {
    e.preventDefault()
    setMensagem(null)
    let instituicaoId = novaInst
    if (novaInst === NOVA) {
      const nome = nomeInst.trim()
      if (!nome) return setMensagem({ tipo: 'erro', texto: 'Dê um nome para a nova instituição.' })
      const { data, error } = await supabase
        .from('instituicoes')
        .insert({ nome, tipo: tipoInst, pais: paisInst })
        .select('id')
        .single()
      if (error) {
        const jaExiste = error.message.toLowerCase().includes('duplicate')
        return setMensagem({
          tipo: 'erro',
          texto: jaExiste ? 'Já existe uma instituição com esse nome.' : error.message,
        })
      }
      instituicaoId = data.id as string
      await recarregarCadastro()
      setNomeInst('')
    }
    if (!instituicaoId) return setMensagem({ tipo: 'erro', texto: 'Escolha a instituição.' })
    const chave = `${instituicaoId}|${novaMoeda}`
    if (linhas.some((l) => l.chave === chave)) {
      return setMensagem({ tipo: 'erro', texto: 'Essa instituição já está na lista nessa moeda.' })
    }
    setLinhas((ls) => [
      ...ls,
      {
        chave,
        instituicaoId,
        moeda: novaMoeda,
        texto: '',
        saldoId: null,
        valorOriginal: null,
        cambioOriginal: null,
        anterior: null,
      },
    ])
    setNovaInst('')
  }

  async function remover(l: Linha) {
    if (!l.saldoId) {
      setLinhas((ls) => ls.filter((x) => x.chave !== l.chave))
      return
    }
    const nome = nomes.get(l.instituicaoId) ?? 'esta instituição'
    if (!window.confirm(`Excluir o saldo de ${nome} em ${mes ? rotuloMes(mes) : ''}?`)) return
    const { error } = await supabase.from('saldos').delete().eq('id', l.saldoId)
    if (error) return setMensagem({ tipo: 'erro', texto: error.message })
    await recarregar()
    setMensagem({ tipo: 'ok', texto: 'Saldo excluído.' })
  }

  async function salvar() {
    setMensagem(null)
    if (!mes || !pessoaId) return setMensagem({ tipo: 'erro', texto: 'Escolha a pessoa e o mês.' })
    if (!cambio || cambio <= 0) {
      return setMensagem({ tipo: 'erro', texto: 'Informe a cotação do dólar (ex.: 5,35).' })
    }
    const preparado = prepararEnvio(linhas, {
      pessoaId,
      mes,
      cambio,
      reaplicar,
      nomeDe: (id) => nomes.get(id) ?? 'instituição',
    })
    if ('erro' in preparado) return setMensagem({ tipo: 'erro', texto: preparado.erro })
    const envio = preparado.envio
    if (envio.length === 0) {
      return setMensagem({ tipo: 'ok', texto: 'Nada novo para salvar.' })
    }
    setSalvando(true)
    const { error } = await supabase
      .from('saldos')
      .upsert(envio, { onConflict: 'pessoa_id,instituicao_id,mes,moeda' })
    if (error) {
      setSalvando(false)
      return setMensagem({ tipo: 'erro', texto: error.message })
    }
    await recarregar()
    setSalvando(false)
    setMensagem({
      tipo: 'ok',
      texto: `${envio.length === 1 ? '1 saldo salvo' : `${envio.length} saldos salvos`} em ${rotuloMes(mes)}.`,
    })
  }

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
      <h1 className="titulo-pagina">Lançar saldos</h1>
      <p className="muted">
        Informe quanto há em cada banco ou corretora no fim do mês. Os valores do mês anterior
        aparecem como referência.
      </p>

      <div className="controles">
        <label className="controle">
          <span className="controle-rotulo">Pessoa</span>
          <select
            value={pessoaId}
            onChange={(e) => {
              setPessoaEscolhida(e.target.value)
              setMensagem(null)
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
          <span className="controle-rotulo">Mês</span>
          <input
            type="month"
            value={mesTexto}
            onChange={(e) => {
              setMesTexto(e.target.value)
              setMensagem(null)
            }}
            placeholder="AAAA-MM"
          />
        </label>
      </div>
      {!mes && <p className="erro">Escolha um mês válido (AAAA-MM).</p>}

      <div className="cartao">
        <h2>Câmbio usado nos novos lançamentos</h2>
        <CambioInfo />
        <label className="controle campo-cambio">
          <span className="controle-rotulo">US$ 1 = R$</span>
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
        <label className="caixa-marcar">
          <input
            type="checkbox"
            checked={reaplicar}
            onChange={(e) => setReaplicar(e.target.checked)}
          />
          Reaplicar este câmbio também nas linhas já salvas deste mês
        </label>
        <p className="muted pequeno">
          Cada saldo guarda o dólar do dia em que foi lançado, para a opção "cotação da época" no
          Patrimônio. Linhas já salvas mantêm o câmbio original, salvo se você marcar acima.
        </p>
      </div>

      <div className="cartao">
        <h2>Saldos de {mes ? rotuloMes(mes) : '—'}</h2>
        {ordenadas.length === 0 ? (
          <p className="muted">Nenhuma instituição nesta lista ainda. Adicione abaixo.</p>
        ) : (
          <ul className="lista-saldos">
            {ordenadas.map((l) => (
              <li key={l.chave} className="saldo-linha">
                <div className="saldo-nome">
                  <span>{nomes.get(l.instituicaoId) ?? '(sem nome)'}</span>
                  <span className="selo">{l.moeda === 'BRL' ? 'R$' : 'US$'}</span>
                  {l.saldoId ? (
                    <span className="selo selo-ok">salvo</span>
                  ) : (
                    l.texto.trim() !== '' && <span className="selo selo-alerta">novo</span>
                  )}
                </div>
                <input
                  type={privado ? 'password' : 'text'}
                  inputMode="decimal"
                  autoComplete="off"
                  className="saldo-campo"
                  aria-label={`Saldo em ${nomes.get(l.instituicaoId) ?? ''} (${l.moeda})`}
                  placeholder="0,00"
                  value={l.texto}
                  onChange={(e) => mudarTexto(l.chave, e.target.value)}
                />
                <button
                  type="button"
                  className="botao-icone"
                  aria-label={`Remover ${nomes.get(l.instituicaoId) ?? ''}`}
                  onClick={() => void remover(l)}
                >
                  ×
                </button>
                {l.anterior !== null && (
                  <div className="saldo-anterior muted">
                    Último lançamento: <Valor valor={l.anterior} moeda={l.moeda} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {digitado && (
          <p className="total-linha">
            <span>Total desta lista</span>
            <span>
              <Valor valor={digitado.brl} moeda="BRL" />
              {' · '}
              <Valor valor={digitado.usd} moeda="USD" />
            </span>
          </p>
        )}

        {mensagem && (
          <p className={mensagem.tipo === 'ok' ? 'ok' : 'erro'} role="status">
            {mensagem.texto}
          </p>
        )}
        <button type="button" className="botao" onClick={() => void salvar()} disabled={salvando}>
          {salvando ? 'Salvando…' : 'Salvar saldos'}
        </button>
      </div>

      <form className="cartao formulario" onSubmit={adicionarLinha}>
        <h2>Adicionar banco ou corretora à lista</h2>
        <div className="controles">
          <label className="controle">
            <span className="controle-rotulo">Instituição</span>
            <select value={novaInst} onChange={(e) => setNovaInst(e.target.value)}>
              <option value="">Escolher…</option>
              {instituicoes.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nome}
                </option>
              ))}
              <option value={NOVA}>＋ Nova instituição…</option>
            </select>
          </label>
          <label className="controle">
            <span className="controle-rotulo">Moeda do saldo</span>
            <select value={novaMoeda} onChange={(e) => setNovaMoeda(e.target.value as Moeda)}>
              <option value="BRL">Real (R$)</option>
              <option value="USD">Dólar (US$)</option>
            </select>
          </label>
        </div>

        {novaInst === NOVA && (
          <div className="controles">
            <label className="controle">
              <span className="controle-rotulo">Nome</span>
              <input
                type="text"
                value={nomeInst}
                onChange={(e) => setNomeInst(e.target.value)}
                placeholder="Ex.: Banco X, Corretora Y"
              />
            </label>
            <label className="controle">
              <span className="controle-rotulo">Tipo</span>
              <select
                value={tipoInst}
                onChange={(e) => setTipoInst(e.target.value as TipoInstituicao)}
              >
                <option value="banco">Banco</option>
                <option value="corretora">Corretora</option>
                <option value="exchange">Exchange (cripto)</option>
                <option value="outro">Outro</option>
              </select>
            </label>
            <label className="controle">
              <span className="controle-rotulo">País</span>
              <select value={paisInst} onChange={(e) => setPaisInst(e.target.value)}>
                <option value="BR">Brasil</option>
                <option value="US">Estados Unidos</option>
                <option value="OUTRO">Outro</option>
              </select>
            </label>
          </div>
        )}
        <button type="submit" className="botao botao-secundario">
          Adicionar à lista
        </button>
      </form>
    </section>
  )
}
