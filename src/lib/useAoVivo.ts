import { useCallback, useEffect, useRef, useState } from 'react'
import { buscarCotacoes, type RespostaCotacao } from './mercado'

const INTERVALO = 60_000

/** Busca as cotações e repete a cada minuto enquanto a tela está aberta e visível. */
export function useCotacoesAoVivo(simbolos: string[]) {
  const chave = simbolos.join(',')
  const [dados, setDados] = useState<Record<string, RespostaCotacao>>({})
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [atualizadoEm, setAtualizadoEm] = useState<number | null>(null)
  const ocupado = useRef(false)

  const atualizar = useCallback(async () => {
    if (!chave || ocupado.current) return
    ocupado.current = true
    setCarregando(true)
    try {
      const r = await buscarCotacoes(chave.split(','))
      setDados(r)
      setErro(null)
      setAtualizadoEm(Date.now())
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      ocupado.current = false
      setCarregando(false)
    }
  }, [chave])

  useEffect(() => {
    if (!chave) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void atualizar()
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void atualizar()
    }, INTERVALO)
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') void atualizar()
    }
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [chave, atualizar])

  return { dados, carregando, erro, atualizadoEm, atualizar }
}
