import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '../lib/supabase'
import { traduzirErroAuth, type Moeda } from '../lib/formato'
import type { Ativo, ClasseAtivo, Cotacao, Favorito, Posicao, Provento, TipoProvento } from '../lib/tipos'
import type { Meta, TipoMeta } from '../lib/metas'

interface AtivosContexto {
  ativos: Ativo[]
  posicoes: Posicao[]
  /** Último preço de cada ativo, por id do ativo. */
  cotacoes: Map<string, Cotacao>
  proventos: Provento[]
  favoritos: Favorito[]
  /** Aviso se a tabela de favoritos ainda não existe (Fase 3 não instalada). */
  avisoFavoritos: string | null
  metas: Meta[]
  /** Aviso se a tabela de metas ainda não existe (Fase 4 não instalada). */
  avisoMetas: string | null
  carregando: boolean
  erro: string | null
  recarregar: () => Promise<void>
}

const Contexto = createContext<AtivosContexto | null>(null)
const PAGINA = 1000

async function buscarProventos(): Promise<Provento[]> {
  const todos: Provento[] = []
  for (let inicio = 0; ; inicio += PAGINA) {
    const { data, error } = await supabase
      .from('proventos')
      .select('id, pessoa_id, ativo_id, mes, tipo, valor, moeda, cambio_usd_brl, observacao')
      .order('mes', { ascending: false })
      .order('id')
      .range(inicio, inicio + PAGINA - 1)
    if (error) throw new Error(error.message)
    for (const r of data) {
      todos.push({
        id: r.id as string,
        pessoa_id: r.pessoa_id as string,
        ativo_id: r.ativo_id as string,
        mes: r.mes as string,
        tipo: r.tipo as TipoProvento,
        valor: Number(r.valor),
        moeda: r.moeda as Moeda,
        cambio_usd_brl: Number(r.cambio_usd_brl),
        observacao: (r.observacao as string | null) ?? null,
      })
    }
    if (data.length < PAGINA) break
  }
  return todos
}

export function AtivosProvider({ children }: { children: ReactNode }) {
  const [ativos, setAtivos] = useState<Ativo[]>([])
  const [posicoes, setPosicoes] = useState<Posicao[]>([])
  const [cotacoes, setCotacoes] = useState<Map<string, Cotacao>>(new Map())
  const [proventos, setProventos] = useState<Provento[]>([])
  const [favoritos, setFavoritos] = useState<Favorito[]>([])
  const [avisoFavoritos, setAvisoFavoritos] = useState<string | null>(null)
  const [metas, setMetas] = useState<Meta[]>([])
  const [avisoMetas, setAvisoMetas] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    try {
      const [a, p, c, pr, fav, met] = await Promise.all([
        supabase
          .from('ativos')
          .select('id, ticker, nome, classe, moeda, simbolo_cotacao, ativo')
          .order('ticker'),
        supabase.from('posicoes').select('id, pessoa_id, ativo_id, quantidade, preco_medio'),
        supabase.from('cotacoes_ultimas').select('ativo_id, data, preco, fonte'),
        buscarProventos(),
        supabase.from('favoritos').select('ativo_id, ordem').order('ordem'),
        supabase
          .from('metas')
          .select('id, tipo, nome, pessoa_id, ativo_id, alvo_valor, alvo_quantidade, moeda_alvo, prazo')
          .order('criado_em'),
      ])
      if (a.error) throw new Error(a.error.message)
      if (p.error) throw new Error(p.error.message)
      if (c.error) throw new Error(c.error.message)
      setAtivos(
        a.data.map((r) => ({
          id: r.id as string,
          ticker: r.ticker as string,
          nome: (r.nome as string | null) ?? null,
          classe: r.classe as ClasseAtivo,
          moeda: r.moeda as Moeda,
          simbolo_cotacao: r.simbolo_cotacao as string,
          ativo: Boolean(r.ativo),
        })),
      )
      setPosicoes(
        p.data.map((r) => ({
          id: r.id as string,
          pessoa_id: r.pessoa_id as string,
          ativo_id: r.ativo_id as string,
          quantidade: Number(r.quantidade),
          preco_medio: Number(r.preco_medio),
        })),
      )
      setCotacoes(
        new Map(
          c.data.map((r) => [
            r.ativo_id as string,
            {
              ativo_id: r.ativo_id as string,
              data: r.data as string,
              preco: Number(r.preco),
              fonte: r.fonte as string,
            },
          ]),
        ),
      )
      setProventos(pr)
      // Favoritos são da Fase 3: se a tabela ainda não existe, o resto do app continua funcionando.
      if (fav.error) {
        setFavoritos([])
        setAvisoFavoritos(
          'A tabela de favoritos ainda não existe. Rode o arquivo supabase/04_fase3.sql no SQL Editor do Supabase.',
        )
      } else {
        setFavoritos(fav.data.map((r) => ({ ativo_id: r.ativo_id as string, ordem: Number(r.ordem) })))
        setAvisoFavoritos(null)
      }
      if (met.error) {
        setMetas([])
        setAvisoMetas(
          'A tabela de metas ainda não existe. Rode o arquivo supabase/05_fase4.sql no SQL Editor do Supabase.',
        )
      } else {
        setMetas(
          met.data.map((r) => ({
            id: r.id as string,
            tipo: r.tipo as TipoMeta,
            nome: (r.nome as string | null) ?? null,
            pessoa_id: (r.pessoa_id as string | null) ?? null,
            ativo_id: (r.ativo_id as string | null) ?? null,
            alvo_valor: r.alvo_valor === null ? null : Number(r.alvo_valor),
            alvo_quantidade: r.alvo_quantidade === null ? null : Number(r.alvo_quantidade),
            moeda_alvo: r.moeda_alvo as Moeda,
            prazo: (r.prazo as string | null) ?? null,
          })),
        )
        setAvisoMetas(null)
      }
      setErro(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setErro(
        msg.toLowerCase().includes('relation') || msg.toLowerCase().includes('schema cache')
          ? 'As tabelas de ativos ainda não existem. Rode o arquivo supabase/03_fase2.sql no SQL Editor do Supabase.'
          : traduzirErroAuth(msg),
      )
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void recarregar()
  }, [recarregar])

  const valor = useMemo(
    () => ({ ativos, posicoes, cotacoes, proventos, favoritos, avisoFavoritos, metas, avisoMetas, carregando, erro, recarregar }),
    [ativos, posicoes, cotacoes, proventos, favoritos, avisoFavoritos, metas, avisoMetas, carregando, erro, recarregar],
  )
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAtivos(): AtivosContexto {
  const ctx = useContext(Contexto)
  if (!ctx) throw new Error('useAtivos precisa estar dentro de <AtivosProvider>')
  return ctx
}
