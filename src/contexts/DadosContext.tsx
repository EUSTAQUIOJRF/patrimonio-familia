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
import type { Instituicao, Pessoa, Saldo, TipoInstituicao } from '../lib/tipos'

interface DadosContexto {
  pessoas: Pessoa[]
  instituicoes: Instituicao[]
  saldos: Saldo[]
  carregando: boolean
  erro: string | null
  recarregar: () => Promise<void>
  /** Atualiza só pessoas e instituições (sem mexer nos saldos). */
  recarregarCadastro: () => Promise<void>
}

const Contexto = createContext<DadosContexto | null>(null)

const TAMANHO_PAGINA = 1000 // limite padrão de linhas por consulta do Supabase

async function buscarSaldos(): Promise<Saldo[]> {
  const todos: Saldo[] = []
  for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
    const { data, error } = await supabase
      .from('saldos')
      .select('id, pessoa_id, instituicao_id, mes, valor, moeda, cambio_usd_brl, observacao')
      .order('mes', { ascending: false })
      .order('id')
      .range(inicio, inicio + TAMANHO_PAGINA - 1)
    if (error) throw new Error(error.message)
    for (const r of data) {
      todos.push({
        id: r.id as string,
        pessoa_id: r.pessoa_id as string,
        instituicao_id: r.instituicao_id as string,
        mes: r.mes as string,
        valor: Number(r.valor),
        moeda: r.moeda as Moeda,
        cambio_usd_brl: Number(r.cambio_usd_brl),
        observacao: (r.observacao as string | null) ?? null,
      })
    }
    if (data.length < TAMANHO_PAGINA) break
  }
  return todos
}

export function DadosProvider({ children }: { children: ReactNode }) {
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [instituicoes, setInstituicoes] = useState<Instituicao[]>([])
  const [saldos, setSaldos] = useState<Saldo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    try {
      const [p, i, s] = await Promise.all([
        supabase.from('pessoas').select('id, nome, entra_na_familia, ordem').order('ordem'),
        supabase.from('instituicoes').select('id, nome, tipo, pais, ativa').order('nome'),
        buscarSaldos(),
      ])
      if (p.error) throw new Error(p.error.message)
      if (i.error) throw new Error(i.error.message)
      setPessoas(
        p.data.map((r) => ({
          id: r.id as string,
          nome: r.nome as string,
          entra_na_familia: Boolean(r.entra_na_familia),
          ordem: Number(r.ordem),
        })),
      )
      setInstituicoes(
        i.data.map((r) => ({
          id: r.id as string,
          nome: r.nome as string,
          tipo: r.tipo as TipoInstituicao,
          pais: r.pais as string,
          ativa: Boolean(r.ativa),
        })),
      )
      setSaldos(s)
      setErro(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setErro(
        msg.toLowerCase().includes('relation') || msg.toLowerCase().includes('schema cache')
          ? 'As tabelas ainda não existem no Supabase. Rode o arquivo supabase/01_schema_fase1.sql no SQL Editor.'
          : traduzirErroAuth(msg),
      )
    } finally {
      setCarregando(false)
    }
  }, [])

  const recarregarCadastro = useCallback(async () => {
    const [p, i] = await Promise.all([
      supabase.from('pessoas').select('id, nome, entra_na_familia, ordem').order('ordem'),
      supabase.from('instituicoes').select('id, nome, tipo, pais, ativa').order('nome'),
    ])
    if (p.error || i.error) return
    setPessoas(
      p.data.map((r) => ({
        id: r.id as string,
        nome: r.nome as string,
        entra_na_familia: Boolean(r.entra_na_familia),
        ordem: Number(r.ordem),
      })),
    )
    setInstituicoes(
      i.data.map((r) => ({
        id: r.id as string,
        nome: r.nome as string,
        tipo: r.tipo as TipoInstituicao,
        pais: r.pais as string,
        ativa: Boolean(r.ativa),
      })),
    )
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void recarregar()
  }, [recarregar])

  const valor = useMemo(
    () => ({ pessoas, instituicoes, saldos, carregando, erro, recarregar, recarregarCadastro }),
    [pessoas, instituicoes, saldos, carregando, erro, recarregar, recarregarCadastro],
  )
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDados(): DadosContexto {
  const ctx = useContext(Contexto)
  if (!ctx) throw new Error('useDados precisa estar dentro de <DadosProvider>')
  return ctx
}
