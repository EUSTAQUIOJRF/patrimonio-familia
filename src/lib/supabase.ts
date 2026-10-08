import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** true quando as variáveis de ambiente do Supabase estão preenchidas. */
export const supabaseConfigurado = Boolean(url && anonKey)

// Só a chave PÚBLICA (anon/publishable) é usada aqui. A segurança real vem do
// login + regras RLS no banco. A chave secreta (service_role) NUNCA entra no app.
export const supabase = createClient(
  url ?? 'http://localhost:54321',
  anonKey ?? 'chave-nao-configurada',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)
