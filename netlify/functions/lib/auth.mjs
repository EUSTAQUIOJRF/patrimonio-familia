// Só deixa passar quem está logado no app (token do Supabase).
export async function exigirLogin(req) {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const chave = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_CHAVE_PUBLICA
  if (!url || !chave) return { erro: 'Servidor sem configuração do Supabase.', status: 500 }
  const auth = req.headers.get('authorization') || ''
  if (!/^Bearer\s+\S+/i.test(auth)) return { erro: 'Faça login.', status: 401 }
  try {
    const r = await fetch(`${url.replace(/\/+$/, '')}/auth/v1/user`, {
      headers: { apikey: chave, Authorization: auth },
      signal: AbortSignal.timeout(6000),
    })
    if (!r.ok) return { erro: 'Sessão inválida. Entre de novo.', status: 401 }
    return { ok: true }
  } catch {
    return { erro: 'Não consegui validar o login.', status: 502 }
  }
}

export const json = (corpo, status = 200, extra = {}) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, max-age=20', ...extra },
  })
