import { useMemo, useState, type FormEvent } from 'react'
import { Valor } from '../components/Valor'
import { useAtivos } from '../contexts/AtivosContext'
import { useCambio } from '../contexts/CambioContext'
import { useDados } from '../contexts/DadosContext'
import { usePreferencias } from '../contexts/PreferenciasContext'
import { carteira } from '../lib/ativos'
import { lerValor, serieMensal } from '../lib/calculos'
import { mesAtual, rotuloMes, type Moeda } from '../lib/formato'
import { avaliar, ritmoMensal, type Avaliacao, type Meta, type Situacao, type TipoMeta } from '../lib/metas'
import { supabase } from '../lib/supabase'

const FAMILIA = 'familia'

const ROTULO_SITUACAO: Record<Situacao, string> = {
  atingida: '✓ Meta atingida',
  no_ritmo: '● No ritmo',
  atrasada: '▲ Atrasada',
  acompanhando: '● Acompanhando',
  sem_prazo: '○ Sem prazo',
}

const numero = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 8 })

export default function Metas() {
  const { pessoas, saldos, carregando: cp, erro: ep } = useDados()
  const { ativos, posicoes, cotacoes, metas, avisoMetas, carregando, erro, recarregar } = useAtivos()
  const { taxa } = useCambio()
  const { privado } = usePreferencias()

  const membros = useMemo(() => pessoas.filter((p) => p.entra_na_familia), [pessoas])
  const nomePessoa = useMemo(() => new Map(pessoas.map((p) => [p.id, p.nome])), [pessoas])
  const mapaAtivo = useMemo(() => new Map(ativos.map((a) => [a.id, a])), [ativos])
  const cambio = taxa ?? 1
  const hojeMes = mesAtual()

  const idsDe = (pessoaId: string | null) =>
    new Set(pessoaId === null ? membros.map((m) => m.id) : [pessoaId])

  /** Calcula andamento de uma meta. Devolve também como mostrar os números (dinheiro ou quantidade). */
  function andamento(m: Meta): { av: Avaliacao; formato: 'dinheiro' | 'quantidade'; ritmo: number | null; semDados: boolean } {
    const ids = idsDe(m.pessoa_id)
    if (m.tipo === 'patrimonio') {
      const pontos = serieMensal(saldos, ids, taxa === null ? 'epoca' : 'hoje', cambio)
      const serie = pontos.map((p) => (m.moeda_alvo === 'BRL' ? p.brl : p.usd))
      const ritmo = ritmoMensal(serie)
      const atual = serie.length ? serie[serie.length - 1] : 0
      return {
        av: avaliar(atual, m.alvo_valor ?? 0, ritmo, m.prazo, hojeMes),
        formato: 'dinheiro',
        ritmo,
        semDados: serie.length === 0,
      }
    }
    const linha = carteira(posicoes, ativos, cotacoes, ids, cambio).linhas.find((l) => l.ativoId === m.ativo_id)
    if (m.alvo_quantidade !== null) {
      const atual = linha ? linha.quantidade : 0
      return { av: avaliar(atual, m.alvo_quantidade, null, m.prazo, hojeMes), formato: 'quantidade', ritmo: null, semDados: false }
    }
    const atual = linha ? (m.moeda_alvo === 'BRL' ? linha.brl : linha.usd) : 0
    return { av: avaliar(atual, m.alvo_valor ?? 0, null, m.prazo, hojeMes), formato: 'dinheiro', ritmo: null, semDados: false }
  }

  function titulo(m: Meta): string {
    if (m.nome) return m.nome
    const quem = m.pessoa_id === null ? 'da Família' : `de ${nomePessoa.get(m.pessoa_id) ?? ''}`
    if (m.tipo === 'patrimonio') return `Patrimônio ${quem}`
    const t = mapaAtivo.get(m.ativo_id ?? '')?.ticker ?? 'ativo'
    return `${t} ${quem}`
  }

  // ---- formulário
  const [tipo, setTipo] = useState<TipoMeta>('patrimonio')
  const [escopo, setEscopo] = useState(FAMILIA)
  const [ativoId, setAtivoId] = useState('')
  const [alvoEm, setAlvoEm] = useState<'valor' | 'quantidade'>('valor')
  const [alvoTxt, setAlvoTxt] = useState('')
  const [moeda, setMoeda] = useState<Moeda>('BRL')
  const [prazoTxt, setPrazoTxt] = useState('')
  const [nome, setNome] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function criar(e: FormEvent) {
    e.preventDefault()
    setMsg(null)
    const alvo = lerValor(alvoTxt)
    if (alvo === null || alvo <= 0) return setMsg('Informe o valor da meta (maior que zero).')
    if (tipo === 'ativo' && !ativoId) return setMsg('Escolha o ativo da meta.')
    if (prazoTxt && !/^\d{4}-(0[1-9]|1[0-2])$/.test(prazoTxt)) return setMsg('Prazo inválido.')
    const porQuantidade = tipo === 'ativo' && alvoEm === 'quantidade'
    setSalvando(true)
    const { error } = await supabase.from('metas').insert({
      tipo,
      nome: nome.trim() || null,
      pessoa_id: escopo === FAMILIA ? null : escopo,
      ativo_id: tipo === 'ativo' ? ativoId : null,
      alvo_valor: porQuantidade ? null : alvo,
      alvo_quantidade: porQuantidade ? alvo : null,
      moeda_alvo: moeda,
      prazo: prazoTxt ? `${prazoTxt}-01` : null,
    })
    setSalvando(false)
    if (error) return setMsg(error.message)
    await recarregar()
    setAlvoTxt('')
    setNome('')
    setPrazoTxt('')
  }

  async function excluir(m: Meta) {
    if (!window.confirm(`Excluir a meta "${titulo(m)}"?`)) return
    const { error } = await supabase.from('metas').delete().eq('id', m.id)
    if (error) return setMsg(error.message)
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

  const porQuantidadeForm = tipo === 'ativo' && alvoEm === 'quantidade'
  const escoposForm = tipo === 'patrimonio' ? membros : pessoas

  return (
    <section>
      <h1 className="titulo-pagina">Metas</h1>
      {avisoMetas && <p className="erro">{avisoMetas}</p>}

      {metas.length === 0 && !avisoMetas && (
        <div className="cartao">
          <h2>Nenhuma meta ainda</h2>
          <p className="muted">
            Crie uma meta de patrimônio (ex.: R$ 1 milhão da Família) ou de um ativo (ex.: 500 cotas
            de XPML11). O app mostra o progresso e quanto falta.
          </p>
        </div>
      )}

      {metas.map((m) => {
        const { av, formato, ritmo, semDados } = andamento(m)
        const dinheiro = formato === 'dinheiro'
        const mostrar = (n: number) =>
          dinheiro ? <Valor valor={n} moeda={m.moeda_alvo} /> : <span className="valor">{privado ? '••••' : numero(n)}</span>
        const unidade = dinheiro ? '' : ' cotas'
        return (
          <div key={m.id} className="cartao meta">
            <div className="cartao-topo">
              <h2>{titulo(m)}</h2>
              <button type="button" className="botao-icone" aria-label={`Excluir meta ${titulo(m)}`} onClick={() => void excluir(m)}>
                ×
              </button>
            </div>
            <p className={`meta-situacao meta-${av.situacao}`}>{ROTULO_SITUACAO[av.situacao]}</p>
            <div
              className="meta-trilha"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(av.pct)}
              aria-label={`${titulo(m)}: ${Math.round(av.pct)}% da meta`}
            >
              <div className="meta-preench" style={{ width: `${av.pct}%` }} />
            </div>
            <p className="meta-numeros">
              <strong>{av.pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</strong>
              {' · '}
              {mostrar(av.atual)}
              {unidade} de {mostrar(av.alvo)}
              {unidade}
            </p>
            {av.falta > 0 && (
              <p className="muted">
                Faltam {mostrar(av.falta)}
                {unidade}.
              </p>
            )}
            {m.prazo && (
              <p className="muted">
                Prazo: {rotuloMes(`${m.prazo.slice(0, 7)}-01`)}
                {av.mesesRestantes !== null && av.mesesRestantes > 0 && ` (${av.mesesRestantes} ${av.mesesRestantes === 1 ? 'mês' : 'meses'})`}
                {av.aporteMensal !== null && (
                  <>
                    {' '}
                    · para chegar lá: {mostrar(av.aporteMensal)}
                    {unidade} por mês
                  </>
                )}
              </p>
            )}
            {m.tipo === 'patrimonio' && av.situacao !== 'atingida' && (
              <p className="muted pequeno">
                {semDados
                  ? 'Ainda não há saldos lançados para calcular o ritmo.'
                  : ritmo === null
                    ? 'O ritmo aparece a partir do segundo mês com saldos lançados.'
                    : ritmo <= 0
                      ? 'Nos últimos meses o patrimônio não cresceu; sem previsão.'
                      : av.previsaoMes
                        ? (
                            <>
                              No ritmo dos últimos meses (+{mostrar(ritmo)} por mês), você chega em{' '}
                              {rotuloMes(av.previsaoMes)}.
                            </>
                          )
                        : 'No ritmo atual a meta levaria mais de 50 anos.'}
              </p>
            )}
          </div>
        )
      })}

      <form className="cartao formulario" onSubmit={criar}>
        <h2>Nova meta</h2>
        <div className="controles">
          <label className="controle">
            <span className="controle-rotulo">Tipo</span>
            <select
              value={tipo}
              onChange={(e) => {
                setTipo(e.target.value as TipoMeta)
                setEscopo(FAMILIA)
              }}
            >
              <option value="patrimonio">Patrimônio</option>
              <option value="ativo">Ativo</option>
            </select>
          </label>
          <label className="controle">
            <span className="controle-rotulo">De quem</span>
            <select value={escopo} onChange={(e) => setEscopo(e.target.value)}>
              <option value={FAMILIA}>Família</option>
              {escoposForm.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </label>
          {tipo === 'ativo' && (
            <>
              <label className="controle">
                <span className="controle-rotulo">Ativo</span>
                <select value={ativoId} onChange={(e) => setAtivoId(e.target.value)}>
                  <option value="">Escolher…</option>
                  {ativos.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.ticker}
                    </option>
                  ))}
                </select>
              </label>
              <label className="controle">
                <span className="controle-rotulo">Meta em</span>
                <select value={alvoEm} onChange={(e) => setAlvoEm(e.target.value as 'valor' | 'quantidade')}>
                  <option value="valor">Valor (dinheiro)</option>
                  <option value="quantidade">Quantidade de cotas/unidades</option>
                </select>
              </label>
            </>
          )}
          <label className="controle">
            <span className="controle-rotulo">{porQuantidadeForm ? 'Quantidade alvo' : 'Valor alvo'}</span>
            <input
              type="text"
              inputMode="decimal"
              value={alvoTxt}
              onChange={(e) => setAlvoTxt(e.target.value)}
              placeholder={porQuantidadeForm ? '500' : '1.000.000,00'}
            />
          </label>
          {!porQuantidadeForm && (
            <label className="controle">
              <span className="controle-rotulo">Moeda da meta</span>
              <select value={moeda} onChange={(e) => setMoeda(e.target.value as Moeda)}>
                <option value="BRL">Real (R$)</option>
                <option value="USD">Dólar (US$)</option>
              </select>
            </label>
          )}
          <label className="controle">
            <span className="controle-rotulo">Prazo (opcional)</span>
            <input type="month" value={prazoTxt} onChange={(e) => setPrazoTxt(e.target.value)} />
          </label>
          <label className="controle">
            <span className="controle-rotulo">Nome (opcional)</span>
            <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Primeiro milhão" />
          </label>
        </div>
        <p className="muted pequeno">
          Metas de patrimônio usam os saldos lançados em Lançar/Patrimônio. Metas de ativo usam a
          carteira da tela Ativos.
        </p>
        {msg && (
          <p className="erro" role="alert">
            {msg}
          </p>
        )}
        <button type="submit" className="botao" disabled={salvando}>
          {salvando ? 'Salvando…' : 'Criar meta'}
        </button>
      </form>
    </section>
  )
}
