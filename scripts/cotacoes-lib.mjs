// Funções puras da rotina de cotações (testadas em scripts/cotacoes.test.mjs).

/** Data AAAA-MM-DD de um instante (segundos Unix) no fuso de Brasília. */
export function dataDoInstante(segundos) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(
    new Date(segundos * 1000),
  )
}

/**
 * Lê a resposta do endpoint "chart" do Yahoo Finance.
 * Devolve { preco, moeda, data } ou { erro }.
 */
export function extrairPreco(json) {
  const erroApi = json?.chart?.error
  if (erroApi) return { erro: erroApi.description || erroApi.code || 'erro da fonte' }
  const meta = json?.chart?.result?.[0]?.meta
  if (!meta) return { erro: 'resposta sem dados' }
  const preco = Number(meta.regularMarketPrice)
  if (!Number.isFinite(preco) || preco <= 0) return { erro: 'preço inválido' }
  const quando = Number(meta.regularMarketTime)
  return {
    preco,
    moeda: String(meta.currency || '').toUpperCase(),
    data: Number.isFinite(quando) && quando > 0 ? dataDoInstante(quando) : null,
  }
}

/** Confere se a moeda da fonte é a mesma cadastrada (evita gravar preço em moeda errada). */
export function moedaConfere(moedaFonte, moedaAtivo) {
  return moedaFonte === '' || moedaFonte === moedaAtivo
}

export function urlYahoo(simbolo) {
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(simbolo)}?range=5d&interval=1d`
}
