// Cotações "ao vivo" para a tela Favoritos. GET /.netlify/functions/cotacao?s=PETR4.SA,AAPL
// (O Yahoo não deixa o navegador consultar direto; por isso a consulta passa por aqui.)
import { exigirLogin, json } from './lib/auth.mjs'
import { extrairCotacao, lerSimbolos, urlCotacao } from './lib/mercado.mjs'

async function buscar(simbolo) {
  try {
    const r = await fetch(urlCotacao(simbolo), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; patrimonio-familia)' },
      signal: AbortSignal.timeout(7000),
    })
    if (!r.ok) return { erro: `HTTP ${r.status}` }
    return extrairCotacao(await r.json())
  } catch (e) {
    return { erro: e instanceof Error ? e.message : 'falha' }
  }
}

export default async (req) => {
  const login = await exigirLogin(req)
  if (!login.ok) return json({ erro: login.erro }, login.status, { 'cache-control': 'no-store' })
  const simbolos = lerSimbolos(new URL(req.url).searchParams.get('s'))
  if (simbolos.length === 0) return json({ cotacoes: {} })
  const resultados = await Promise.all(simbolos.map(buscar))
  const cotacoes = Object.fromEntries(simbolos.map((s, i) => [s, resultados[i]]))
  return json({ cotacoes, atualizadoEm: new Date().toISOString() })
}
