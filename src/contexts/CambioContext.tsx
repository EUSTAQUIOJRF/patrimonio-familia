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
import { dataHoje } from '../lib/formato'

export type FonteCambio = 'online' | 'salvo' | 'manual'

interface CambioContexto {
  /** Reais por 1 dólar. null enquanto não houver nenhuma cotação disponível. */
  taxa: number | null
  /** Data (AAAA-MM-DD) a que a cotação se refere. */
  data: string | null
  fonte: FonteCambio | null
  carregando: boolean
  atualizar: () => Promise<void>
  definirManual: (taxa: number) => Promise<void>
}

const Contexto = createContext<CambioContexto | null>(null)

// API pública e gratuita de cotações, com CORS liberado (pode ser chamada do navegador).
const URL_COTACAO = 'https://economia.awesomeapi.com.br/json/last/USD-BRL'

async function buscarOnline(): Promise<number> {
  const controle = new AbortController()
  const limite = setTimeout(() => controle.abort(), 8000)
  try {
    const resposta = await fetch(URL_COTACAO, { signal: controle.signal })
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`)
    const json = (await resposta.json()) as { USDBRL?: { bid?: string } }
    const valor = Number(json.USDBRL?.bid)
    if (!Number.isFinite(valor) || valor <= 0) throw new Error('Resposta inesperada')
    return valor
  } finally {
    clearTimeout(limite)
  }
}

const arredondar = (v: number) => Math.round(v * 10000) / 10000

async function gravar(data: string, taxa: number, fonte: string) {
  // Guardar o histórico é um "extra": se falhar, a cotação continua valendo na tela.
  await supabase.from('cambio').upsert({ data, taxa, fonte }, { onConflict: 'data' })
}

export function CambioProvider({ children }: { children: ReactNode }) {
  const [taxa, setTaxa] = useState<number | null>(null)
  const [data, setData] = useState<string | null>(null)
  const [fonte, setFonte] = useState<FonteCambio | null>(null)
  const [carregando, setCarregando] = useState(true)

  const atualizar = useCallback(async () => {
    setCarregando(true)
    try {
      const valor = arredondar(await buscarOnline())
      const hoje = dataHoje()
      setTaxa(valor)
      setData(hoje)
      setFonte('online')
      await gravar(hoje, valor, 'AwesomeAPI')
    } catch {
      // Sem internet ou API fora do ar: usa a última cotação guardada no banco.
      const { data: linhas } = await supabase
        .from('cambio')
        .select('data, taxa')
        .order('data', { ascending: false })
        .limit(1)
      const ultima = linhas?.[0]
      if (ultima) {
        setTaxa(Number(ultima.taxa))
        setData(ultima.data as string)
        setFonte('salvo')
      }
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void atualizar()
  }, [atualizar])

  const definirManual = useCallback(async (valor: number) => {
    const v = arredondar(valor)
    const hoje = dataHoje()
    setTaxa(v)
    setData(hoje)
    setFonte('manual')
    await gravar(hoje, v, 'manual')
  }, [])

  const contexto = useMemo(
    () => ({ taxa, data, fonte, carregando, atualizar, definirManual }),
    [taxa, data, fonte, carregando, atualizar, definirManual],
  )
  return <Contexto.Provider value={contexto}>{children}</Contexto.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCambio(): CambioContexto {
  const ctx = useContext(Contexto)
  if (!ctx) throw new Error('useCambio precisa estar dentro de <CambioProvider>')
  return ctx
}
