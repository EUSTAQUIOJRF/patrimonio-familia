export type Moeda = 'BRL' | 'USD'

const formatadores: Record<Moeda, Intl.NumberFormat> = {
  BRL: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }),
  USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
}

export function formatarMoeda(valor: number, moeda: Moeda): string {
  return formatadores[moeda].format(valor)
}

export function formatarPercentual(valor: number): string {
  return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

/** Traduz mensagens de erro comuns do Supabase Auth para português. */
export function traduzirErroAuth(mensagem: string): string {
  const m = mensagem.toLowerCase()
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (m.includes('email not confirmed')) return 'E-mail ainda não confirmado.'
  if (m.includes('rate limit') || m.includes('too many'))
    return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.'
  if (m.includes('invalid totp') || m.includes('invalid code') || m.includes('invalid mfa'))
    return 'Código incorreto ou expirado. Tente o código atual do aplicativo.'
  if (m.includes('password should be at least'))
    return 'A senha precisa ter pelo menos 8 caracteres.'
  if (m.includes('same password') || m.includes('different from the old'))
    return 'A nova senha precisa ser diferente da anterior.'
  if (m.includes('network') || m.includes('failed to fetch'))
    return 'Sem conexão com o servidor. Verifique a internet.'
  return mensagem
}
