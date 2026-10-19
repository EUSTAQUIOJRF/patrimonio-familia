// Busca de ativos por nome ou código. GET /.netlify/functions/buscar?q=petrobras
import { exigirLogin, json } from './lib/auth.mjs'
import { lerBusca, urlBusca } from './lib/mercado.mjs'

export default async (req) => {
  const login = await exigirLogin(req)
  if (!login.ok) return json({ erro: login.erro }, login.status, { 'cache-control': 'no-store' })
  const q = String(new URL(req.url).searchParams.get('q') ?? '').trim().slice(0, 40)
  if (q.length < 2) return json({ resultados: [] })
  try {
    const r = await fetch(urlBusca(q), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; patrimonio-familia)' },
      signal: AbortSignal.timeout(7000),
    })
    if (!r.ok) return json({ erro: `A busca respondeu HTTP ${r.status}.` }, 502)
    return json({ resultados: lerBusca(await r.json()) }, 200, { 'cache-control': 'private, max-age=300' })
  } catch {
    return json({ erro: 'Não consegui consultar a busca agora.' }, 502)
  }
}
