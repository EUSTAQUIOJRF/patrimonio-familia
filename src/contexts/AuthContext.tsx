import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { traduzirErroAuth } from '../lib/formato'

type Estado = 'carregando' | 'deslogado' | 'precisa_mfa' | 'logado'

interface AuthContexto {
  estado: Estado
  email: string | null
  /** true se a conta já tem verificação em duas etapas ativa; null = ainda não sabemos */
  possuiMfa: boolean | null
  /** true quando a pessoa chegou pelo link de "esqueci a senha" */
  emRecuperacao: boolean
  entrar: (email: string, senha: string) => Promise<string | null>
  verificarMfa: (codigo: string) => Promise<string | null>
  sair: () => Promise<void>
  enviarRecuperacao: (email: string) => Promise<string | null>
  definirNovaSenha: (senha: string) => Promise<string | null>
  reavaliar: () => Promise<void>
}

const Contexto = createContext<AuthContexto | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>('carregando')
  const [session, setSession] = useState<Session | null>(null)
  const [possuiMfa, setPossuiMfa] = useState<boolean | null>(null)
  const [emRecuperacao, setEmRecuperacao] = useState(false)

  const avaliar = useCallback(async (s: Session | null) => {
    setSession(s)
    if (!s) {
      setPossuiMfa(null)
      setEstado('deslogado')
      return
    }
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    const temFator = data?.nextLevel === 'aal2'
    setPossuiMfa(temFator)
    if (temFator && data?.currentLevel !== 'aal2') setEstado('precisa_mfa')
    else setEstado('logado')
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      void avaliar(data.session)
    })

    const { data: assinatura } = supabase.auth.onAuthStateChange((evento, s) => {
      if (evento === 'PASSWORD_RECOVERY') setEmRecuperacao(true)
      // Não chamar o Supabase diretamente dentro do callback (evita travamento).
      setTimeout(() => {
        void avaliar(s)
      }, 0)
    })
    return () => assinatura.subscription.unsubscribe()
  }, [avaliar])

  const entrar = useCallback(async (email: string, senha: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    })
    return error ? traduzirErroAuth(error.message) : null
  }, [])

  const verificarMfa = useCallback(
    async (codigo: string) => {
      const { data: fatores, error: erroFatores } = await supabase.auth.mfa.listFactors()
      if (erroFatores) return traduzirErroAuth(erroFatores.message)
      const fator = fatores.totp[0]
      if (!fator) return 'Nenhum aplicativo autenticador cadastrado nesta conta.'

      const { data: desafio, error: erroDesafio } = await supabase.auth.mfa.challenge({
        factorId: fator.id,
      })
      if (erroDesafio) return traduzirErroAuth(erroDesafio.message)

      const { error } = await supabase.auth.mfa.verify({
        factorId: fator.id,
        challengeId: desafio.id,
        code: codigo.replace(/\s/g, ''),
      })
      if (error) return traduzirErroAuth(error.message)

      const { data } = await supabase.auth.getSession()
      await avaliar(data.session)
      return null
    },
    [avaliar],
  )

  const sair = useCallback(async () => {
    await supabase.auth.signOut()
    setEmRecuperacao(false)
  }, [])

  const enviarRecuperacao = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/`,
    })
    return error ? traduzirErroAuth(error.message) : null
  }, [])

  const definirNovaSenha = useCallback(
    async (senha: string) => {
      const { error } = await supabase.auth.updateUser({ password: senha })
      if (error) return traduzirErroAuth(error.message)
      setEmRecuperacao(false)
      const { data } = await supabase.auth.getSession()
      await avaliar(data.session)
      return null
    },
    [avaliar],
  )

  const reavaliar = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    await avaliar(data.session)
  }, [avaliar])

  const valor = useMemo<AuthContexto>(
    () => ({
      estado,
      email: session?.user.email ?? null,
      possuiMfa,
      emRecuperacao,
      entrar,
      verificarMfa,
      sair,
      enviarRecuperacao,
      definirNovaSenha,
      reavaliar,
    }),
    [
      estado,
      session,
      possuiMfa,
      emRecuperacao,
      entrar,
      verificarMfa,
      sair,
      enviarRecuperacao,
      definirNovaSenha,
      reavaliar,
    ],
  )

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContexto {
  const ctx = useContext(Contexto)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return ctx
}
