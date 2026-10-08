import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Moeda } from '../lib/formato'

interface PreferenciasContexto {
  /** Modo privacidade: esconde todos os valores na tela. */
  privado: boolean
  alternarPrivado: () => void
  /** Moeda exibida em tamanho grande. A outra aparece menor. */
  moedaPrincipal: Moeda
  alternarMoeda: () => void
}

const Contexto = createContext<PreferenciasContexto | null>(null)

function ler<T extends string>(chave: string, padrao: T, validos: readonly T[]): T {
  try {
    const v = localStorage.getItem(chave) as T | null
    return v && validos.includes(v) ? v : padrao
  } catch {
    return padrao
  }
}

function gravar(chave: string, valor: string) {
  try {
    localStorage.setItem(chave, valor)
  } catch {
    /* navegador pode bloquear o armazenamento; a preferência só não persiste */
  }
}

export function PreferenciasProvider({ children }: { children: ReactNode }) {
  const [privado, setPrivado] = useState(
    () => ler('pf:privado', 'nao', ['sim', 'nao'] as const) === 'sim',
  )
  const [moedaPrincipal, setMoedaPrincipal] = useState<Moeda>(() =>
    ler<Moeda>('pf:moeda', 'BRL', ['BRL', 'USD']),
  )

  const alternarPrivado = useCallback(() => {
    setPrivado((atual) => {
      gravar('pf:privado', atual ? 'nao' : 'sim')
      return !atual
    })
  }, [])

  const alternarMoeda = useCallback(() => {
    setMoedaPrincipal((atual) => {
      const nova: Moeda = atual === 'BRL' ? 'USD' : 'BRL'
      gravar('pf:moeda', nova)
      return nova
    })
  }, [])

  const valor = useMemo(
    () => ({ privado, alternarPrivado, moedaPrincipal, alternarMoeda }),
    [privado, alternarPrivado, moedaPrincipal, alternarMoeda],
  )

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePreferencias(): PreferenciasContexto {
  const ctx = useContext(Contexto)
  if (!ctx) throw new Error('usePreferencias precisa estar dentro de <PreferenciasProvider>')
  return ctx
}
