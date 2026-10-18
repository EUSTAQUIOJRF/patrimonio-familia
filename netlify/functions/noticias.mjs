// Notícias dos favoritos e do mercado. GET /.netlify/functions/noticias?s=PETR4.SA,AAPL&geral=1
// Cada notícia vem marcada com origem "BR" (imprensa brasileira) ou "EXT" (imprensa estrangeira).
import { exigirLogin, json } from './lib/auth.mjs'
import { URLS_GERAIS, lerRss, lerSimbolos, mesclarNoticias, urlsNoticias } from './lib/mercado.mjs'

async function baixar(url) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; patrimonio-familia)' },
      signal: AbortSignal.timeout(7000),
    })
    if (!r.ok) return []
    return lerRss(await r.text())
  } catch {
    return []
  }
}

/** Baixa as páginas de uma lista (em paralelo) e marca origem e ativo em cada notícia. */
async function porRegiao(urls, origem, ativo, porBusca) {
  const listas = await Promise.all(urls.map(baixar))
  const todas = listas.flat().slice(0, porBusca * urls.length)
  return todas.map((n) => ({ ...n, origem, ativo }))
}

export default async (req) => {
  const login = await exigirLogin(req)
  if (!login.ok) return json({ erro: login.erro }, login.status, { 'cache-control': 'no-store' })
  const params = new URL(req.url).searchParams
  const simbolos = lerSimbolos(params.get('s'), 12)
  const tarefas = []
  for (const s of simbolos) {
    tarefas.push(porRegiao(urlsNoticias(s, 'BR'), 'BR', s, 6))
    tarefas.push(porRegiao(urlsNoticias(s, 'EXT'), 'EXT', s, 4))
  }
  if (params.get('geral') === '1') {
    tarefas.push(porRegiao(URLS_GERAIS.BR, 'BR', null, 10))
    tarefas.push(porRegiao(URLS_GERAIS.EXT, 'EXT', null, 10))
  }
  const noticias = mesclarNoticias((await Promise.all(tarefas)).flat(), 80)
  return json({ noticias, atualizadoEm: new Date().toISOString() }, 200, { 'cache-control': 'private, max-age=300' })
}
