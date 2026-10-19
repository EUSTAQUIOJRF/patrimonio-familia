// Leitores de dados do comparador (testados em fundamentos.test.mjs).
// Três fontes: Yahoo (desempenho do preço), Fundamentus (ações e FIIs do Brasil) e Finnhub (exterior).

import { limparTexto } from './mercado.mjs'

/** "1.234,56" -> 1234.56 ; "12,3%" -> 12.3 ; "-" ou vazio -> null. */
export function numeroBR(texto) {
  const t = String(texto ?? '')
    .replace(/%/g, '')
    .replace(/\s/g, '')
    .replace(/R\$/g, '')
  if (t === '' || t === '-' || t === '—') return null
  if (!/^-?[\d.]*,?\d*$/.test(t) || !/\d/.test(t)) return null
  const n = Number(t.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

// ---------- Desempenho (Yahoo, range=1y) ----------

const dia = (s) => new Date(s * 1000).toISOString().slice(0, 10)

/**
 * Lê o "chart" de 1 ano do Yahoo e calcula retornos, faixa de 52 semanas e volatilidade.
 * Devolve { preco, moeda, serie:[{d,v}], ret1m, ret6m, ret12m, retAno, min52, max52, vol } ou { erro }.
 */
export function extrairDesempenho(json) {
  const erroApi = json?.chart?.error
  if (erroApi) return { erro: erroApi.description || erroApi.code || 'erro da fonte' }
  const r = json?.chart?.result?.[0]
  const meta = r?.meta
  if (!meta) return { erro: 'resposta sem dados' }
  const preco = Number(meta.regularMarketPrice)
  if (!Number.isFinite(preco) || preco <= 0) return { erro: 'preço inválido' }

  const tempos = r.timestamp ?? []
  const fech = r.indicators?.quote?.[0]?.close ?? []
  const barras = []
  for (let i = 0; i < tempos.length; i++) {
    const c = Number(fech[i])
    if (fech[i] !== null && Number.isFinite(c) && c > 0) barras.push({ t: tempos[i], c })
  }
  if (barras.length < 2) return { erro: 'histórico insuficiente' }
  // O último ponto é o preço atual.
  const ult = barras[barras.length - 1]
  if (dia(ult.t) === dia(Number(meta.regularMarketTime) || ult.t)) ult.c = preco
  else barras.push({ t: Number(meta.regularMarketTime) || ult.t + 86400, c: preco })

  const fim = barras[barras.length - 1]
  const retDesde = (diasAtras) => {
    const alvo = fim.t - diasAtras * 86400
    let ref = null
    for (const b of barras) {
      if (b.t <= alvo) ref = b
      else break
    }
    if (!ref) return null // não há histórico tão antigo
    return ((fim.c - ref.c) / ref.c) * 100
  }
  const anoIni = Date.UTC(new Date(fim.t * 1000).getUTCFullYear(), 0, 1) / 1000
  let refAno = null
  for (const b of barras) {
    if (b.t < anoIni) refAno = b
    else break
  }
  const retAno = refAno ? ((fim.c - refAno.c) / refAno.c) * 100 : null

  const fechos = barras.map((b) => b.c)
  const retornos = []
  for (let i = 1; i < fechos.length; i++) retornos.push(Math.log(fechos[i] / fechos[i - 1]))
  const media = retornos.reduce((a, x) => a + x, 0) / retornos.length
  const variancia = retornos.reduce((a, x) => a + (x - media) ** 2, 0) / Math.max(1, retornos.length - 1)
  const vol = Math.sqrt(variancia) * Math.sqrt(252) * 100

  // Série para o gráfico: no máximo ~60 pontos (amostra uniforme, mantendo o último).
  const passo = Math.max(1, Math.floor(barras.length / 60))
  const serie = barras.filter((_, i) => i % passo === 0 || i === barras.length - 1).map((b) => ({ d: dia(b.t), v: b.c }))

  return {
    preco,
    moeda: String(meta.currency || '').toUpperCase(),
    serie,
    ret1m: retDesde(30),
    ret6m: retDesde(182),
    ret12m: retDesde(365),
    retAno,
    min52: Math.min(...fechos),
    max52: Math.max(...fechos),
    vol,
  }
}

// ---------- Indicadores (nomes internos) ----------
// pl, pvp, dy (%), roe (%), roic (%), margLiquida (%), margBruta (%), margEbit (%), divPatrim,
// liqCorrente, lpa, vpa, valorMercado, evEbitda, ffoYield (%), vacancia (%), crescReceita5a (%)

const norm = (s) =>
  limparTexto(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '')

const ROTULOS_FUNDAMENTUS = {
  pl: 'pl',
  pvp: 'pvp',
  divyield: 'dy',
  dividendyield: 'dy',
  roe: 'roe',
  roic: 'roic',
  margliquida: 'margLiquida',
  margbruta: 'margBruta',
  margebit: 'margEbit',
  divbrpatrim: 'divPatrim',
  liquidezcorr: 'liqCorrente',
  lpa: 'lpa',
  vpa: 'vpa',
  valordemercado: 'valorMercado',
  evebitda: 'evEbitda',
  ffoyield: 'ffoYield',
  vacanciamedia: 'vacancia',
  cresrec5a: 'crescReceita5a',
}

/**
 * Lê a página de detalhes do Fundamentus (fundamentus.com.br/detalhes.php?papel=XXXX).
 * Pega, na ordem, as células de rótulo (td.label) e de valor (td.data) e junta cada rótulo
 * ao próximo valor. Devolve { indicadores, bruto } ou { erro }. "bruto" guarda todos os pares lidos.
 */
export function lerFundamentus(html) {
  const texto = String(html ?? '')
  const celulas = [...texto.matchAll(/<td\s+class="(label|data)[^"]*"[^>]*>([\s\S]*?)<\/td>/gi)]
  const bruto = {}
  let rotulo = null
  for (const [, tipo, miolo] of celulas) {
    const t = limparTexto(miolo).replace(/^\?\s*/, '')
    if (tipo.toLowerCase() === 'label') rotulo = t
    else if (rotulo !== null) {
      if (!(rotulo in bruto)) bruto[rotulo] = t
      rotulo = null
    }
  }
  if (Object.keys(bruto).length === 0) return { erro: 'página sem indicadores (ativo não encontrado?)' }
  const indicadores = {}
  for (const [r, v] of Object.entries(bruto)) {
    const chave = ROTULOS_FUNDAMENTUS[norm(r)]
    if (chave && !(chave in indicadores)) indicadores[chave] = numeroBR(v)
  }
  if (Object.keys(indicadores).length === 0) return { erro: 'indicadores não reconhecidos na página', bruto }
  return { indicadores, bruto }
}

/** Resposta de https://finnhub.io/api/v1/stock/metric?symbol=XXX&metric=all (percentuais já em %). */
export function lerFinnhub(json) {
  const m = json?.metric
  if (!m || typeof m !== 'object' || Object.keys(m).length === 0) {
    return { erro: 'sem indicadores para este ativo' }
  }
  const n = (v) => (Number.isFinite(Number(v)) && v !== null ? Number(v) : null)
  const indicadores = {
    pl: n(m.peTTM ?? m.peBasicExclExtraTTM),
    pvp: n(m.pbAnnual ?? m.pbQuarterly),
    dy: n(m.dividendYieldIndicatedAnnual ?? m.currentDividendYieldTTM),
    roe: n(m.roeTTM),
    roic: n(m.roiTTM),
    margLiquida: n(m.netProfitMarginTTM),
    margBruta: n(m.grossMarginTTM),
    margEbit: n(m.operatingMarginTTM),
    divPatrim: n(m['totalDebt/totalEquityAnnual']),
    liqCorrente: n(m.currentRatioAnnual),
    lpa: n(m.epsTTM),
    valorMercado: n(m.marketCapitalization) === null ? null : n(m.marketCapitalization) * 1e6,
    crescReceita5a: n(m.revenueGrowth5Y),
  }
  if (Object.values(indicadores).every((v) => v === null)) return { erro: 'sem indicadores para este ativo' }
  return { indicadores }
}

/** Ticker para o Fundamentus: tira ".SA" e deixa em maiúsculas; só letras e números. */
export function papelFundamentus(simbolo) {
  const p = String(simbolo ?? '').replace(/\.SA$/i, '').toUpperCase()
  return /^[A-Z0-9]{4,8}$/.test(p) ? p : null
}

/** Qual fonte de fundamentos usar para cada tipo de ativo. */
export function fonteFundamentos(classe) {
  if (classe === 'acao' || classe === 'fii') return 'fundamentus'
  if (classe === 'exterior') return 'finnhub'
  return null // ETF, BDR e cripto: sem indicadores fundamentalistas nesta versão
}
