// Funções puras usadas pelas funções da Netlify (testadas em netlify/functions/lib/mercado.test.mjs).

const dia = (segundos, deslocamento = 0) =>
  new Date((segundos + deslocamento) * 1000).toISOString().slice(0, 10)

/**
 * Lê a resposta do endpoint "chart" do Yahoo (range=1mo, interval=1d).
 * Devolve { preco, anterior, variacaoPct, moeda, hora, serie } ou { erro }.
 */
export function extrairCotacao(json) {
  const erroApi = json?.chart?.error
  if (erroApi) return { erro: erroApi.description || erroApi.code || 'erro da fonte' }
  const r = json?.chart?.result?.[0]
  const meta = r?.meta
  if (!meta) return { erro: 'resposta sem dados' }
  const preco = Number(meta.regularMarketPrice)
  if (!Number.isFinite(preco) || preco <= 0) return { erro: 'preço inválido' }

  const tempos = r.timestamp ?? []
  const fechamentos = r.indicators?.quote?.[0]?.close ?? []
  const barras = []
  for (let i = 0; i < tempos.length; i++) {
    const c = Number(fechamentos[i])
    if (fechamentos[i] !== null && Number.isFinite(c) && c > 0) barras.push({ t: tempos[i], c })
  }

  const hora = Number(meta.regularMarketTime)
  const desloc = Number(meta.gmtoffset) || 0
  let anterior = null
  if (barras.length > 0) {
    const ultima = barras[barras.length - 1]
    const mesmaData = Number.isFinite(hora) && dia(ultima.t, desloc) === dia(hora, desloc)
    // Se a última barra é a de hoje, o dia anterior é a penúltima; senão a última já é o fechamento anterior.
    const ref = mesmaData ? barras[barras.length - 2] : ultima
    anterior = ref ? ref.c : null
  }
  if (anterior === null && Number.isFinite(Number(meta.chartPreviousClose))) {
    anterior = Number(meta.chartPreviousClose)
  }

  const serie = barras.map((b) => b.c)
  // A barra de hoje pode estar atrasada em relação ao preço atual: garante que o gráfico termina nele.
  if (serie.length > 0 && serie[serie.length - 1] !== preco) {
    const mesmaData =
      Number.isFinite(hora) && dia(barras[barras.length - 1].t, desloc) === dia(hora, desloc)
    if (mesmaData) serie[serie.length - 1] = preco
    else serie.push(preco)
  }

  return {
    preco,
    anterior,
    variacaoPct: anterior ? ((preco - anterior) / anterior) * 100 : null,
    moeda: String(meta.currency || '').toUpperCase(),
    hora: Number.isFinite(hora) && hora > 0 ? new Date(hora * 1000).toISOString() : null,
    serie,
  }
}

const ENTIDADES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ' }

export function limparTexto(s) {
  return String(s ?? '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(amp|lt|gt|quot|apos|nbsp|#39);/g, (m) => ENTIDADES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function marca(bloco, nome) {
  const m = bloco.match(new RegExp(`<${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</${nome}>`, 'i'))
  return m ? limparTexto(m[1]) : ''
}

/** Lê um feed RSS (Google Notícias ou Yahoo Finanças). Devolve [{ titulo, link, fonte, data }]. */
export function lerRss(xml) {
  const itens = []
  const blocos = String(xml ?? '').match(/<item[\s>][\s\S]*?<\/item>/gi) ?? []
  for (const b of blocos) {
    let titulo = marca(b, 'title')
    const link = marca(b, 'link')
    let fonte = marca(b, 'source')
    const quando = Date.parse(marca(b, 'pubDate'))
    if (!titulo || !/^https?:\/\//i.test(link)) continue
    // O Google escreve "Título - Veículo": separa o veículo do título.
    if (fonte && titulo.endsWith(` - ${fonte}`)) titulo = titulo.slice(0, -(fonte.length + 3)).trim()
    if (!fonte) {
      try {
        fonte = new URL(link).hostname.replace(/^www\./, '')
      } catch {
        fonte = ''
      }
    }
    itens.push({
      titulo,
      link,
      fonte,
      data: Number.isFinite(quando) ? new Date(quando).toISOString() : null,
    })
  }
  return itens
}

const normalizar = (t) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** Junta notícias de várias buscas: tira repetidas (mesmo título) e ordena da mais nova para a mais antiga. */
export function mesclarNoticias(noticias, limite = 60) {
  const vistos = new Set()
  const unicas = []
  for (const n of noticias) {
    const k = `${n.origem}|${normalizar(n.titulo)}`
    if (vistos.has(k)) continue
    vistos.add(k)
    unicas.push(n)
  }
  unicas.sort((a, b) => (Date.parse(b.data ?? '') || 0) - (Date.parse(a.data ?? '') || 0))
  return unicas.slice(0, limite)
}

const SIMBOLO_OK = /^[A-Za-z0-9.\-=^]{1,20}$/

/** Valida a lista "A,B,C" de símbolos; devolve só os válidos, sem repetir, no máximo `max`. */
export function lerSimbolos(texto, max = 30) {
  const lista = String(texto ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => SIMBOLO_OK.test(s))
  return [...new Set(lista)].slice(0, max)
}

export function urlCotacao(simbolo) {
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(simbolo)}?range=1mo&interval=1d`
}

const termoLimpo = (t) => t.replace(/\.SA$/i, '').replace(/-USD$/i, '')

/** Endereços de notícias de um termo (ticker) por região: BR = imprensa brasileira, EXT = imprensa estrangeira. */
export function urlsNoticias(termo, regiao) {
  const t = termoLimpo(termo)
  if (regiao === 'BR') {
    return [
      `https://news.google.com/rss/search?q=${encodeURIComponent(`${t} when:14d`)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`,
    ]
  }
  return [
    `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(termo)}&region=US&lang=en-US`,
    `https://news.google.com/rss/search?q=${encodeURIComponent(`${t} stock when:14d`)}&hl=en-US&gl=US&ceid=US:en`,
  ]
}

export const URLS_GERAIS = {
  BR: [
    `https://news.google.com/rss/search?q=${encodeURIComponent('Ibovespa OR "mercado financeiro" when:2d')}&hl=pt-BR&gl=BR&ceid=BR:pt-419`,
  ],
  EXT: [
    `https://news.google.com/rss/search?q=${encodeURIComponent('"stock market" OR "Wall Street" when:2d')}&hl=en-US&gl=US&ceid=US:en`,
  ],
}

const TIPOS_BUSCA = new Set(['EQUITY', 'ETF', 'CRYPTOCURRENCY', 'MUTUALFUND', 'INDEX'])

/** Lê a resposta da busca do Yahoo: [{ simbolo, nome, tipo, bolsa }] só de ativos que fazem sentido comparar. */
export function lerBusca(json, max = 8) {
  const lista = Array.isArray(json?.quotes) ? json.quotes : []
  const saida = []
  for (const q of lista) {
    const simbolo = String(q?.symbol ?? '')
    const tipo = String(q?.quoteType ?? '').toUpperCase()
    if (!SIMBOLO_OK.test(simbolo) || !TIPOS_BUSCA.has(tipo) || tipo === 'INDEX') continue
    saida.push({
      simbolo,
      nome: limparTexto(q.longname || q.shortname || ''),
      tipo,
      bolsa: limparTexto(q.exchDisp || q.exchange || ''),
    })
    if (saida.length >= max) break
  }
  return saida
}

export function urlBusca(texto) {
  return `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(texto)}&quotesCount=10&newsCount=0&lang=pt-BR&region=BR`
}
